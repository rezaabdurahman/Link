package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/discovery-svc/internal/handlers"
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

	// Auto-migrate models
	err = db.AutoMigrate(&models.Broadcast{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Initialize repository
	broadcastRepo := repository.NewBroadcastRepository(db)

	// Initialize service
	broadcastService := service.NewBroadcastService(broadcastRepo)

	// Initialize handlers
	broadcastHandler := handlers.NewBroadcastHandler(broadcastService)

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

	// TODO: Add JWT authentication middleware
	// For now, we'll use a mock middleware that sets user_id for testing
	router.Use(func(c *gin.Context) {
		// In production, this would extract user_id from JWT token
		// For testing, we'll use a header
		userID := c.GetHeader("X-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}
		c.Next()
	})

	// Broadcast routes
	v1 := router.Group("/api/v1")
	{
		// Authenticated routes (require user_id in context)
		v1.GET("/broadcasts", broadcastHandler.GetCurrentUserBroadcast)
		v1.POST("/broadcasts", broadcastHandler.CreateBroadcast)
		v1.PUT("/broadcasts", broadcastHandler.UpdateBroadcast)
		v1.DELETE("/broadcasts", broadcastHandler.DeleteBroadcast)

		// Public routes
		v1.GET("/broadcasts/:userId", broadcastHandler.GetUserBroadcast)
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
