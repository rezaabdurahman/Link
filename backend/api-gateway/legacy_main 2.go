// LEGACY MAIN.GO - MOVED TO legacy_main.go
// This file has been replaced by cmd/gateway/main.go for the enhanced API Gateway
// with load balancing, circuit breakers, and multi-instance support.
//
// To use this legacy version, rename this file to main.go and update Dockerfile

package main

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/api-gateway/internal/config"
	"github.com/link-app/api-gateway/internal/handlers"
	"github.com/link-app/api-gateway/internal/logger"
	"github.com/link-app/api-gateway/internal/metrics"
	"github.com/link-app/api-gateway/internal/middleware"
	"github.com/link-app/api-gateway/internal/sentry"
	"github.com/link-app/api-gateway/internal/tracing"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// Initialize structured logger
	log := logger.InitLogger()

	// Initialize Sentry for error reporting
	if err := sentry.InitSentry(); err != nil {
		log.WithError(err).Warn("Failed to initialize Sentry - continuing without error reporting")
		// Continue running even if Sentry fails
	} else {
		log.Info("Sentry initialized successfully")
	}
	defer sentry.Flush(2 * time.Second)

	// Initialize OpenTelemetry tracing
	cleanupTracing, err := tracing.InitTracing("api-gateway")
	if err != nil {
		log.WithError(err).Warn("Failed to initialize tracing - continuing without distributed tracing")
	} else {
		log.Info("Distributed tracing initialized successfully")
		defer cleanupTracing()
	}

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
	router.Use(sentry.GinSentryMiddleware())         // Add Sentry middleware early
	router.Use(tracing.GinMiddleware("api-gateway")) // Add distributed tracing middleware
	router.Use(logger.CorrelationIDMiddleware())     // Add correlation ID tracking
	router.Use(metrics.PrometheusMiddleware())       // Add Prometheus metrics collection
	router.Use(logger.StructuredLoggingMiddleware()) // Replace basic logging with structured logging
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.RateLimitingMiddleware())

	// Recovery middleware
	router.Use(gin.Recovery())

	// JWT metrics middleware (before auth middleware to track attempts)
	router.Use(metrics.JWTMetricsMiddleware())

	// Authentication middleware (validates JWT and sets user context headers)
	router.Use(middleware.AuthMiddleware(jwtValidator, jwtConfig))

	// Metrics endpoint for Prometheus scraping - no auth required
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Health check endpoint - no auth required
	router.GET("/health", proxyHandler.HealthHandler)

	// Root redirect
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "Link API Gateway",
			"version": "1.0.0",
			"status":  "healthy",
			"docs":    "https://api.linkapp.com/docs",
			"health":  "/health",
			"endpoints": gin.H{
				"auth":          "/auth/*",
				"users":         "/users/*",
				"location":      "/location/*",
				"chat":          "/chat/*",
				"ai":            "/ai/*",
				"discovery":     "/broadcasts/*",
				"stories":       "/stories/*",
				"opportunities": "/opportunities/*",
				"websocket":     "/ws",
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

	// WebSocket endpoint for chat (current implementation)
	// TODO: Implement dedicated WebSocket handling for real-time features
	// This will include chat messaging, notifications, and live updates
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

	// Log service startup information
	log.WithFields(map[string]interface{}{
		"port":            port,
		"health_endpoint": "/health",
		"docs_endpoint":   "/docs/",
		"jwt_configured":  len(jwtConfig.Secret) > 0,
	}).Info("🚀 API Gateway starting up")

	// Log service URLs for debugging
	serviceConfig := config.GetServiceConfig()
	log.WithFields(map[string]interface{}{
		"user_service":      serviceConfig.UserService.URL,
		"location_service":  serviceConfig.LocationService.URL,
		"chat_service":      serviceConfig.ChatService.URL,
		"ai_service":        serviceConfig.AIService.URL,
		"discovery_service": serviceConfig.DiscoveryService.URL,
	}).Debug("Service URLs configured")

	log.Info("🚀 API Gateway server started successfully")
	if err := router.Run(":" + port); err != nil {
		log.WithError(err).Fatal("Failed to start API Gateway server")
	}
}
