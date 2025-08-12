package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/user-svc/internal/config"
	"github.com/link-app/user-svc/internal/handlers"
	"github.com/link-app/user-svc/internal/middleware"
	"github.com/link-app/user-svc/internal/repository"
	"github.com/link-app/user-svc/internal/service"
)

func main() {
	// Initialize database
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Initialize JWT service (for token generation only)
	jwtConfig := config.GetJWTConfig()
	jwtService := config.NewJWTService(jwtConfig)

	// Initialize repository
	userRepo := repository.NewUserRepository(db)

	// Initialize service
	userService := service.NewUserService(userRepo, jwtService)

	// Initialize handlers
	userHandler := handlers.NewUserHandler(userService)

	// Initialize Gin router
	router := gin.Default()

	// Global middleware
	router.Use(corsMiddleware())
	router.Use(middleware.ExtractUserContext())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "user-svc",
			"timestamp": time.Now(),
			"version":   "1.0.0",
		})
	})

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Public authentication endpoints
		auth := v1.Group("/auth")
		{
			auth.POST("/register", userHandler.RegisterUser)
			auth.POST("/login", userHandler.LoginUser)
			auth.POST("/refresh", userHandler.RefreshToken)
			auth.POST("/logout", userHandler.LogoutUser)
		}

		// User profile endpoints
		users := v1.Group("/users")
		{
			// Current user profile (requires auth via gateway)
			users.GET("/profile", userHandler.GetCurrentUserProfile)
			users.PUT("/profile", userHandler.UpdateUserProfile)

			// Public user profiles (no auth required for viewing public profiles)
			users.GET("/profile/:userId", userHandler.GetUserProfile)

			// Friends endpoints (require auth via gateway)
			users.GET("/friends", userHandler.GetFriends)
			users.GET("/friend-requests", userHandler.GetFriendRequests)
			users.POST("/friend-requests", userHandler.SendFriendRequest)
			users.PUT("/friend-requests/:requestId", userHandler.RespondToFriendRequest)

			// Search endpoints (require auth via gateway)
			users.GET("/search", userHandler.SearchUsers)
		}

		// Admin endpoints (could be secured differently)
		admin := v1.Group("/admin")
		{
			admin.POST("/cleanup-sessions", func(c *gin.Context) {
				if err := userService.CleanupExpiredSessions(); err != nil {
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
	go startCleanupRoutine(userService)

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
func startCleanupRoutine(userService service.UserService) {
	ticker := time.NewTicker(1 * time.Hour) // Run cleanup every hour
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("Running session cleanup...")
			if err := userService.CleanupExpiredSessions(); err != nil {
				log.Printf("Error during session cleanup: %v", err)
			} else {
				log.Println("Session cleanup completed successfully")
			}
		}
	}
}
