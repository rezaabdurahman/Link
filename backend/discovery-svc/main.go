package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/discovery-svc/internal/handlers"
	"github.com/link-app/discovery-svc/internal/middleware"
	"github.com/link-app/discovery-svc/internal/repository"
	"github.com/link-app/discovery-svc/internal/sentry"
	"github.com/link-app/discovery-svc/internal/service"
	"github.com/link-app/discovery-svc/internal/tracing"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/link-app/shared-libs/lifecycle"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Initialize Sentry for error reporting
	if err := sentry.Init(); err != nil {
		log.Printf("Failed to initialize Sentry: %v", err)
		// Continue running even if Sentry fails
	}

	// Initialize OpenTelemetry tracing
	err := tracing.Init("discovery-svc", "http://localhost:4318/v1/traces")
	if err != nil {
		log.Printf("Failed to initialize tracing: %v", err)
	} else {
		log.Printf("Distributed tracing initialized successfully")
	}

	// Initialize database
	db, err := initDB()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Note: Migrations are now handled by the separate migration tool
	// They run automatically via docker-entrypoint.sh before this service starts

	// Auto-migrate models (for any GORM schema changes)
	// Note: Commented out due to "insufficient arguments" error - using SQL migrations instead
	// err = db.AutoMigrate(&models.Broadcast{}, &models.Availability{}, &models.RankingConfig{})
	// if err != nil {
	//	log.Fatal("Failed to auto-migrate models:", err)
	// }

	// Initialize repositories
	broadcastRepo := repository.NewBroadcastRepository(db)
	availabilityRepo := repository.NewAvailabilityRepository(db)
	rankingConfigRepo := repository.NewRankingConfigRepository(db)
	cueRepo := repository.NewCueRepository(db)

	// Initialize services
	broadcastService := service.NewBroadcastService(broadcastRepo)
	rankingService := service.NewRankingService(rankingConfigRepo)
	availabilityService := service.NewAvailabilityService(availabilityRepo)
	cueService := service.NewCueService(cueRepo)

	// Initialize handlers
	broadcastHandler := handlers.NewBroadcastHandler(broadcastService)
	availabilityHandler := handlers.NewAvailabilityHandler(availabilityService)
	rankingHandler := handlers.NewRankingHandler(rankingService)
	cueHandler := handlers.NewCueHandler(cueService)

	// Initialize Gin router
	router := gin.Default()

	// Configure server with lifecycle management
	port := getEnv("PORT", "8083")
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Initialize lifecycle manager
	lifecycleManager := lifecycle.NewServiceManager(server)
	lifecycleManager.SetShutdownTimeout(30 * time.Second)
	lifecycleManager.SetHealthCheckPeriod(10 * time.Second)

	// Add health checkers
	if sqlDB, err := db.DB(); err == nil {
		lifecycleManager.AddHealthChecker("database", lifecycle.NewDatabaseHealthChecker(sqlDB))
	}

	// Global middleware
	router.Use(sentry.Middleware()) // Add Sentry middleware early
	router.Use(tracing.Middleware()) // Add distributed tracing middleware
	router.Use(middleware.PrometheusMiddleware()) // Add Prometheus metrics collection
	
	// Middleware for CORS (if needed)
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	})

	// Metrics endpoint for Prometheus scraping
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Add the new framework-agnostic health endpoints
	router.GET("/health/live", gin.WrapH(lifecycleManager.CreateLivenessHandler()))
	router.GET("/health/ready", gin.WrapH(lifecycleManager.CreateReadinessHandler()))
	router.GET("/health/detailed", gin.WrapH(lifecycleManager.CreateHealthHandler()))

	// Authentication middleware - extracts user info from API Gateway headers
	// The API Gateway validates JWT tokens and passes user info via headers
	router.Use(func(c *gin.Context) {
		// Extract user information from headers set by API Gateway
		userID := c.GetHeader("X-User-ID")
		userEmail := c.GetHeader("X-User-Email")
		userName := c.GetHeader("X-User-Name")
		
		// Set user context for handlers to use
		if userID != "" {
			c.Set("user_id", userID)
		}
		if userEmail != "" {
			c.Set("user_email", userEmail)
		}
		if userName != "" {
			c.Set("user_name", userName)
		}
		
		c.Next()
	})

	// API routes (all require authentication)
	v1 := router.Group("/api/v1")
	{
		// Broadcast routes
		v1.GET("/broadcasts", broadcastHandler.GetCurrentUserBroadcast)        // Get my broadcast
		v1.POST("/broadcasts", broadcastHandler.CreateBroadcast)                // Create my broadcast
		v1.PUT("/broadcasts", broadcastHandler.UpdateBroadcast)                 // Update my broadcast
		v1.DELETE("/broadcasts", broadcastHandler.DeleteBroadcast)              // Delete my broadcast
		v1.GET("/broadcasts/:userId", broadcastHandler.GetUserBroadcast)        // Get another user's broadcast

		// Availability routes
		v1.GET("/availability", availabilityHandler.GetCurrentUserAvailability)     // Get my availability
		v1.PUT("/availability", availabilityHandler.UpdateCurrentUserAvailability)  // Update my availability
		v1.POST("/availability/heartbeat", availabilityHandler.HandleHeartbeat)     // Send heartbeat to stay available
		v1.GET("/availability/:userId", availabilityHandler.GetUserAvailability)    // Check another user's availability
		v1.GET("/available-users", availabilityHandler.GetAvailableUsers)           // Browse available users for discovery
		v1.GET("/browse", availabilityHandler.BrowseAvailableUsers)                  // Browse available users with full profiles

		// Ranking configuration routes (A/B testing ready)
		v1.GET("/ranking/info", rankingHandler.GetRankingWeightsInfo)               // Get ranking algorithm information
		v1.GET("/ranking/weights", rankingHandler.GetRankingWeights)                // Get current ranking weights
		v1.PUT("/ranking/weights", rankingHandler.UpdateRankingWeights)             // Update ranking weights (A/B testing)
		v1.POST("/ranking/weights/reset", rankingHandler.ResetRankingWeights)       // Reset to default weights
		v1.GET("/ranking/weights/validate", rankingHandler.ValidateRankingWeights)  // Validate current weights
		v1.GET("/ranking/config", rankingHandler.GetRankingConfig)                  // Get all config (admin/debug)

		// Cue routes
		v1.GET("/cues", cueHandler.GetCurrentUserCue)                               // Get my cue
		v1.POST("/cues", cueHandler.CreateCue)                                      // Create my cue
		v1.PUT("/cues", cueHandler.UpdateCue)                                       // Update my cue
		v1.DELETE("/cues", cueHandler.DeleteCue)                                    // Delete my cue
		v1.GET("/cues/matches", cueHandler.GetCueMatches)                           // Get my cue matches
		v1.POST("/cues/matches/:matchId/viewed", cueHandler.MarkMatchAsViewed)      // Mark match as viewed
		v1.GET("/cues/matches/check/:userId", cueHandler.HasCueMatchWith)           // Check if I have a match with user
	}

	// Start cleanup routines
	go startCleanupRoutine(broadcastService, cueService)

	// Setup graceful shutdown
	lifecycleManager.OnShutdown(func(ctx context.Context) error {
		log.Println("Cleaning up resources...")
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
		return nil
	})

	// Start lifecycle manager
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := lifecycleManager.Start(ctx); err != nil {
		log.Fatal("Failed to start lifecycle manager: ", err)
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Discovery service starting on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start: ", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down discovery service...")

	// Use lifecycle manager for graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := lifecycleManager.Shutdown(shutdownCtx); err != nil {
		log.Fatal("Server forced to shutdown: ", err)
	}

	log.Println("Discovery service exited")
}

func initDB() (*gorm.DB, error) {
	// Database connection parameters
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "linkuser")
	password := getEnv("DB_PASSWORD", "linkpass")
	dbname := getEnv("DB_NAME", "linkdb")

	dsn := "host=" + host + " user=" + user + " password=" + password + " dbname=" + dbname + " port=" + port + " sslmode=disable TimeZone=UTC"

	// Configure GORM logger
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})
	
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

func startCleanupRoutine(broadcastService *service.BroadcastService, cueService *service.CueService) {
	ticker := time.NewTicker(1 * time.Hour) // Run cleanup every hour
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("Running broadcast cleanup...")
			err := broadcastService.CleanupExpiredBroadcasts()
			if err != nil {
				log.Printf("Error during broadcast cleanup: %v", err)
			} else {
				log.Println("Broadcast cleanup completed successfully")
			}

			log.Println("Running cue cleanup...")
			err = cueService.DeactivateExpiredCues()
			if err != nil {
				log.Printf("Error during cue expiration cleanup: %v", err)
			} else {
				log.Println("Cue expiration cleanup completed successfully")
			}

			// Clean up old cues (older than 7 days)
			err = cueService.CleanupOldCues(7 * 24 * time.Hour)
			if err != nil {
				log.Printf("Error during old cue cleanup: %v", err)
			} else {
				log.Println("Old cue cleanup completed successfully")
			}
		}
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
