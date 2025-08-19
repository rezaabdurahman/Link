package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/user-svc/internal/auth"
	"github.com/link-app/user-svc/internal/config"
	"github.com/link-app/user-svc/internal/events"
	"github.com/link-app/user-svc/internal/middleware"
	"github.com/link-app/user-svc/internal/onboarding"
	"github.com/link-app/user-svc/internal/profile"
	"github.com/link-app/user-svc/internal/repository"
	"github.com/link-app/user-svc/internal/sentry"
	"github.com/link-app/user-svc/internal/tracing"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// Initialize Sentry for error reporting
	if err := sentry.InitSentry(); err != nil {
		log.Printf("Failed to initialize Sentry: %v", err)
		// Continue running even if Sentry fails
	}
	defer sentry.Flush(2 * time.Second)

	// Initialize OpenTelemetry tracing
	cleanupTracing, err := tracing.InitTracing("user-svc")
	if err != nil {
		log.Printf("Failed to initialize tracing: %v", err)
	} else {
		log.Printf("Distributed tracing initialized successfully")
		defer cleanupTracing()
	}

	// Initialize database
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Initialize JWT service (for token generation only)
	jwtConfig := auth.GetJWTConfig()
	jwtService := auth.NewJWTService(jwtConfig)

	// Initialize event bus
	eventBus := events.NewInMemoryEventBus()

	// Register example event handlers (for demonstration)
	// In production, these would be in separate services
	if err := events.RegisterExampleHandlers(eventBus); err != nil {
		log.Printf("Warning: Failed to register example event handlers: %v", err)
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	onboardingRepo := onboarding.NewGormRepository(db)

	// Initialize services
	onboardingService := onboarding.NewService(onboardingRepo, eventBus)
	onboardingInterface := onboarding.NewOnboardingInterface(onboardingService)
	authService := auth.NewAuthService(userRepo, jwtService, eventBus, onboardingInterface)
	profileService := profile.NewProfileService(userRepo)

	// Initialize handlers
	authHandler := auth.NewAuthHandler(authService)
	profileHandler := profile.NewProfileHandler(profileService)
	onboardingHandler := onboarding.NewHandler(onboardingService)

	// Initialize Gin router
	router := gin.Default()

	// Global middleware
	router.Use(sentry.GinSentryMiddleware()) // Add Sentry middleware early
	router.Use(tracing.GinMiddleware("user-svc")) // Add distributed tracing middleware
	router.Use(middleware.PrometheusMiddleware()) // Add Prometheus metrics collection
	router.Use(middleware.AuthMetricsMiddleware()) // Add authentication metrics
	router.Use(corsMiddleware())
	router.Use(middleware.ExtractUserContext())

	// Metrics endpoint for Prometheus scraping
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "user-svc",
			"timestamp": time.Now(),
			"version":   "1.0.0",
		})
	})

	// API routes - using modular routers
	v1 := router.Group("/api/v1")
	{
		// Register individual domain routers
		auth.RegisterRoutes(v1, authHandler)
		profile.RegisterRoutes(v1, profileHandler)
		onboarding.RegisterRoutes(v1, onboardingHandler)

		// Admin endpoints (could be secured differently)
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

	// Start background cleanup routine
	go startCleanupRoutine(authService)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("User service starting on port %s", port)
	log.Fatal(router.Run(":" + port))
}

// corsMiddleware handles CORS for development
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

// startCleanupRoutine runs periodic cleanup tasks
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
