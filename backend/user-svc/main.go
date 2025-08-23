package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	"github.com/link-app/user-svc/internal/auth"
	"github.com/link-app/user-svc/internal/cache"
	"github.com/link-app/user-svc/internal/config"
	"github.com/link-app/user-svc/internal/events"
	"github.com/link-app/user-svc/internal/friends"
	"github.com/link-app/user-svc/internal/middleware"
	"github.com/link-app/user-svc/internal/onboarding"
	"github.com/link-app/user-svc/internal/profile"
	"github.com/link-app/user-svc/internal/repository"
	"github.com/link-app/user-svc/internal/security"
	"github.com/link-app/shared-libs/metrics"
)

func main() {
	// Simplified initialization for testing

	// Configure HTTP server
	port := getEnvOrDefault("PORT", "8080")
	server := &http.Server{
		Addr:         ":" + port,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}


	// Initialize database
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Initialize encryption services
	if err := security.InitGlobalKMSManager(); err != nil {
		log.Fatal("Failed to initialize KMS manager:", err)
	}
	defer security.CleanupGlobalKMSManager()

	if err := security.InitGlobalEncryptors(); err != nil {
		log.Fatal("Failed to initialize encryptors:", err)
	}

	if err := security.InitGlobalSessionTokenEncryptor(); err != nil {
		log.Fatal("Failed to initialize session token encryptor:", err)
	}

	// Register encryption hooks with GORM
	encryptionHooks := &security.EncryptionHooks{}
	if err := encryptionHooks.RegisterHooks(db); err != nil {
		log.Fatal("Failed to register encryption hooks:", err)
	}
	
	log.Println("Encryption services initialized successfully")


	// Initialize JWT service (for token generation only)
	jwtConfig := auth.GetJWTConfig()
	jwtService := auth.NewJWTService(jwtConfig)

	// Initialize event bus
	eventBus := events.NewInMemoryEventBus()

	// Register example event handlers (for demonstration)
	if err := events.RegisterExampleHandlers(eventBus); err != nil {
		log.Printf("Warning: Failed to register example event handlers: %v", err)
	}

	// Initialize Redis cache (optional)
	redisHost := getEnvOrDefault("REDIS_HOST", "localhost")
	redisPort := getEnvOrDefault("REDIS_PORT", "6379")
	cacheService := cache.NewSimpleCache(redisHost, redisPort)
	if cacheService != nil {
		log.Println("Redis cache initialized successfully")
		defer cacheService.Close()
	} else {
		log.Println("Redis cache not available - running without caching")
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	onboardingRepo := onboarding.NewGormRepository(db)

	// Initialize services
	onboardingService := onboarding.NewService(onboardingRepo, eventBus)
	onboardingInterface := onboarding.NewOnboardingInterface(onboardingService)
	authService := auth.NewAuthService(userRepo, jwtService, eventBus, onboardingInterface)
	
	// Initialize profile service with caching if available
	var profileService profile.ProfileService
	if cacheService != nil {
		profileService = profile.NewCachedProfileService(userRepo, cacheService)
		log.Println("Profile service initialized with Redis caching")
	} else {
		profileService = profile.NewProfileService(userRepo)
		log.Println("Profile service initialized without caching")
	}

	// Initialize friend service
	friendService := friends.NewFriendService(userRepo)

	// Initialize handlers
	authHandler := auth.NewAuthHandler(authService)
	profileHandler := profile.NewProfileHandler(profileService)
	onboardingHandler := onboarding.NewHandler(onboardingService)
	friendHandler := friends.NewFriendHandler(friendService)

	// Initialize metrics
	serviceMetrics := metrics.NewServiceMetrics("user-svc")
	serviceMetrics.SetHealthy(true) // Set initial health status

	// Initialize Gin router with all existing middleware
	router := gin.Default()

	// Global middleware
	router.Use(corsMiddleware())                       // CORS handling
	router.Use(serviceMetrics.GinMiddleware())         // Prometheus metrics middleware
	router.Use(jwtAuthMiddleware(jwtService))          // JWT authentication for testing
	router.Use(middleware.ExtractUserContext())        // User context extraction

	// Metrics endpoint for Prometheus scraping
	metrics.SetupMetricsEndpoint(router)

	// Simple health check endpoints
	router.GET("/health/live", func(c *gin.Context) { 
		serviceMetrics.SetHealthy(true)
		c.JSON(200, gin.H{"status": "alive"}) 
	})
	router.GET("/health/ready", func(c *gin.Context) { 
		// TODO: Add more sophisticated readiness checks
		serviceMetrics.SetHealthy(true)
		c.JSON(200, gin.H{"status": "ready"}) 
	})
	router.GET("/health", func(c *gin.Context) { 
		serviceMetrics.SetHealthy(true)
		c.JSON(200, gin.H{"status": "healthy"}) 
	})

	// API routes - using modular routers (preserved from original)
	v1 := router.Group("/api/v1")
	{
		// Register individual domain routers
		auth.RegisterRoutes(v1, authHandler)
		profile.RegisterRoutes(v1, profileHandler)
		onboarding.RegisterRoutes(v1, onboardingHandler)
		friends.RegisterRoutes(v1, friendHandler)

		// Admin endpoints
		admin := v1.Group("/admin")
		{
			admin.POST("/cleanup-sessions", func(c *gin.Context) {
				if err := authService.CleanupExpiredSessions(); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{
						"error":   "SERVER_ERROR",
						"message": "Failed to cleanup sessions",
					})
					return
				}
				c.JSON(http.StatusOK, gin.H{
					"message": "Session cleanup completed",
				})
			})
		}
	}


	// Start background cleanup routine (preserved from original)
	go startCleanupRoutine(authService)

	// Set router as server handler
	server.Handler = router


	// Start server in a goroutine
	go func() {
		log.Printf("User service starting on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server:", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down user service...")

	// Graceful shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if sqlDB, err := db.DB(); err == nil {
		sqlDB.Close()
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("User service stopped")
}

// corsMiddleware handles CORS for development (preserved from original)
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		
		// Allow specific origins or all in development
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, X-User-Email, X-User-Name")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// startCleanupRoutine runs periodic cleanup tasks (preserved from original)
func startCleanupRoutine(authService auth.AuthService) {
	ticker := time.NewTicker(1 * time.Hour) // Run cleanup every hour
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("Running session cleanup...")
			if err := authService.CleanupExpiredSessions(); err != nil {
				log.Printf("Error during session cleanup: %v", err)
			} else {
				log.Println("Session cleanup completed successfully")
			}
		}
	}
}

// jwtAuthMiddleware for testing purposes - validates JWT tokens
func jwtAuthMiddleware(jwtService *auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		log.Printf("[JWT Middleware] Authorization header: %v", authHeader != "")
		if authHeader == "" {
			c.Next()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			log.Printf("[JWT Middleware] Invalid auth header format")
			c.Next()
			return
		}

		tokenString := parts[1]
		claims, err := jwtService.ValidateAccessToken(tokenString)
		if err != nil {
			log.Printf("[JWT Middleware] Token validation failed: %v", err)
			c.Next()
			return
		}

		log.Printf("[JWT Middleware] Token validated successfully for user: %s", claims.UserID)

		// Set user context similar to what the gateway would do
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_name", claims.Username)

		// Set request headers for compatibility with existing code
		c.Request.Header.Set("X-User-ID", claims.UserID.String())
		c.Request.Header.Set("X-User-Email", claims.Email)
		c.Request.Header.Set("X-User-Name", claims.Username)

		log.Printf("[JWT Middleware] Set context and headers for user: %s", claims.UserID)
		c.Next()
	}
}

// getEnvOrDefault returns environment variable or default value
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
