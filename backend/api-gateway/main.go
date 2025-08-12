package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/link-app/api-gateway/internal/config"
	"github.com/link-app/api-gateway/internal/handlers"
	"github.com/link-app/api-gateway/internal/middleware"
)

func main() {
	// Initialize configurations
	jwtConfig := config.GetJWTConfig()
	jwtValidator := config.NewJWTValidator(jwtConfig)

	// Initialize handlers
	proxyHandler := handlers.NewProxyHandler()

	// Initialize Gin router
	router := gin.Default()

	// Trust all proxies in development (configure properly for production)
	router.SetTrustedProxies(nil)

	// Global middleware
	router.Use(middleware.RequestLoggingMiddleware())
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.RateLimitingMiddleware())

	// Recovery middleware
	router.Use(gin.Recovery())

	// Authentication middleware (validates JWT and sets user context headers)
	router.Use(middleware.AuthMiddleware(jwtValidator, jwtConfig))

	// Health check endpoint - no auth required
	router.GET("/health", proxyHandler.HealthHandler)

	// Root redirect
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service":     "Link API Gateway",
			"version":     "1.0.0",
			"status":      "healthy",
			"docs":        "https://api.linkapp.com/docs",
			"health":      "/health",
			"endpoints": gin.H{
				"auth":          "/auth/*",
				"users":         "/users/*",
				"location":      "/location/*",
				"chat":          "/chat/*",
				"ai":            "/ai/*",
				"discovery":     "/broadcasts/*",
				"stories":       "/stories/*",
				"opportunities": "/opportunities/*",
			},
		})
	})

	// API documentation endpoint
	router.GET("/docs", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/docs/")
	})

	// Serve OpenAPI documentation
	router.Static("/docs/", "./docs/")

	// Authentication routes (proxied to user-service)
	authGroup := router.Group("/auth")
	{
		authGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// User routes (proxied to user-service)
	usersGroup := router.Group("/users")
	{
		usersGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Location routes (proxied to location-service)
	locationGroup := router.Group("/location")
	{
		locationGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Chat routes (proxied to chat-service)
	chatGroup := router.Group("/chat")
	{
		chatGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// WebSocket endpoint for chat
	router.Any("/ws", proxyHandler.ProxyRequest)

	// AI routes (proxied to ai-service)
	aiGroup := router.Group("/ai")
	{
		aiGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Discovery/Broadcasts routes (proxied to discovery-service)
	broadcastsGroup := router.Group("/broadcasts")
	{
		broadcastsGroup.Any("/*path", proxyHandler.ProxyRequest)
	}
	discoveryGroup := router.Group("/discovery")
	{
		discoveryGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Stories routes (proxied to stories-service)
	storiesGroup := router.Group("/stories")
	{
		storiesGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Opportunities routes (proxied to opportunities-service)
	opportunitiesGroup := router.Group("/opportunities")
	{
		opportunitiesGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Timeline aggregation endpoint (future implementation)
	router.GET("/timeline", func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":   "NOT_IMPLEMENTED",
			"message": "Timeline aggregation not yet implemented",
			"code":    "FEATURE_NOT_IMPLEMENTED",
		})
	})

	// Catch-all for undefined routes
	router.NoRoute(proxyHandler.NotFoundHandler)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 API Gateway starting on port %s", port)
	log.Printf("📊 Health check available at: http://localhost:%s/health", port)
	log.Printf("📖 API documentation at: http://localhost:%s/docs/", port)
	log.Printf("🔐 JWT Secret: %s...", jwtConfig.Secret[:10])
	
	// Log service URLs for debugging
	serviceConfig := config.GetServiceConfig()
	log.Printf("🏢 Services:")
	log.Printf("   User Service: %s", serviceConfig.UserService.URL)
	log.Printf("   Location Service: %s", serviceConfig.LocationService.URL)
	log.Printf("   Chat Service: %s", serviceConfig.ChatService.URL)
	log.Printf("   AI Service: %s", serviceConfig.AIService.URL)
	log.Printf("   Discovery Service: %s", serviceConfig.DiscoveryService.URL)

	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start API Gateway:", err)
	}
}
