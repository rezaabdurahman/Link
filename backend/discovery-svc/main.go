package main

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/discovery-svc/internal/handlers"
	"github.com/link-app/discovery-svc/internal/migrations"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/repository"
	"github.com/link-app/discovery-svc/internal/service"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Initialize database
	db, err := initDB()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Run SQL migrations
	migrationsPath := filepath.Join(".", "migrations")
	migrator := migrations.NewMigrator(db, migrationsPath)
	log.Println("Running database migrations...")
	err = migrator.MigrateUp()
	if err != nil {
		log.Fatal("Failed to run migrations:", err)
	}
	log.Println("Database migrations completed successfully")

	// Auto-migrate models (for any GORM schema changes)
	err = db.AutoMigrate(&models.Broadcast{}, &models.Availability{})
	if err != nil {
		log.Fatal("Failed to auto-migrate models:", err)
	}

	// Initialize repositories
	broadcastRepo := repository.NewBroadcastRepository(db)
	availabilityRepo := repository.NewAvailabilityRepository(db)

	// Initialize services
	broadcastService := service.NewBroadcastService(broadcastRepo)
	availabilityService := service.NewAvailabilityService(availabilityRepo)

	// Initialize handlers
	broadcastHandler := handlers.NewBroadcastHandler(broadcastService)
	availabilityHandler := handlers.NewAvailabilityHandler(availabilityService)

	// Initialize Gin router
	router := gin.Default()

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

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "healthy",
			"service":   "discovery-svc",
			"timestamp": time.Now(),
		})
	})

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
	}

	// Start cleanup goroutine
	go startCleanupRoutine(broadcastService)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Discovery service starting on port %s", port)
	log.Fatal(router.Run(":" + port))
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

func startCleanupRoutine(broadcastService *service.BroadcastService) {
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
		}
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
