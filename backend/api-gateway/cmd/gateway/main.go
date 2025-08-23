package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/link-app/api-gateway/internal/config"
	"github.com/link-app/api-gateway/internal/handlers"
	"github.com/link-app/api-gateway/internal/logger"
	"github.com/link-app/api-gateway/internal/metrics"
	"github.com/link-app/api-gateway/internal/middleware"
	"github.com/link-app/api-gateway/internal/sentry"
	"github.com/link-app/api-gateway/internal/tracing"
	"github.com/link-app/shared-libs/lifecycle"
)

func main() {
	// Initialize structured logger
	loggerInstance := logger.InitLogger()

	// Initialize Sentry for error reporting
	if err := sentry.InitSentry(); err != nil {
		loggerInstance.WithError(err).Warn("Failed to initialize Sentry - continuing without error reporting")
	} else {
		loggerInstance.Info("Sentry initialized successfully")
	}
	defer sentry.Flush(2 * time.Second)

	// Initialize OpenTelemetry tracing
	cleanupTracing, err := tracing.InitTracing("api-gateway")
	if err != nil {
		loggerInstance.WithError(err).Warn("Failed to initialize tracing - continuing without distributed tracing")
	} else {
		loggerInstance.Info("Distributed tracing initialized successfully")
		defer cleanupTracing()
	}

	// Initialize configurations
	jwtConfig := config.GetJWTConfig()
	jwtValidator := config.NewJWTValidator(jwtConfig)

	// Load Kubernetes service configuration
	k8sConfig := config.GetK8sServiceConfig()

	// Create K8s proxy handler
	k8sHandler := handlers.NewK8sProxyHandler(jwtValidator, jwtConfig)

	// Configure server first (needed for lifecycle manager)
	server := &http.Server{
		Addr:         getEnvOrDefault("PORT", ":8080"),
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Initialize service lifecycle manager
	lifecycleManager := lifecycle.NewServiceManager(server)
	lifecycleManager.SetShutdownTimeout(30 * time.Second)
	lifecycleManager.SetHealthCheckPeriod(10 * time.Second)

	// Setup database connection for health checks
	dbURL := buildDatabaseURL()
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		loggerInstance.WithError(err).Warn("Failed to connect to database - continuing without DB health checks")
	} else {
		// Add database health checker
		lifecycleManager.AddHealthChecker("database", lifecycle.NewDatabaseHealthChecker(db))
		loggerInstance.Info("Database health checker added")
	}

	// Setup Redis connection for health checks
	redisAddr := getEnvOrDefault("REDIS_HOST", "localhost") + ":" + getEnvOrDefault("REDIS_PORT", "6379")
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: getEnvOrDefault("REDIS_PASSWORD", ""),
		DB:       0,
	})
	lifecycleManager.AddHealthChecker("redis", lifecycle.NewRedisHealthChecker(redisClient))
	loggerInstance.Info("Redis health checker added")

	// Add K8s service health checkers (optional - K8s handles this)
	for serviceName, service := range k8sConfig.Services {
		healthURL := service.URL + service.HealthPath
		serviceChecker := lifecycle.NewHTTPServiceHealthChecker(serviceName, healthURL)
		serviceChecker.SetTimeout(5 * time.Second).SetRetries(2)
		lifecycleManager.AddHealthChecker(serviceName, serviceChecker)
	}

	// Set up lifecycle callbacks
	lifecycleManager.OnStateChange(func(oldState, newState lifecycle.ServiceState) {
		loggerInstance.WithFields(map[string]interface{}{
			"old_state": oldState.String(),
			"new_state": newState.String(),
		}).Info("Service state changed")
	})

	lifecycleManager.OnShutdown(func(ctx context.Context) error {
		loggerInstance.Info("Preparing for shutdown - draining connections...")
		// Add any cleanup logic here (close DB connections, etc.)
		if db != nil {
			db.Close()
		}
		redisClient.Close()
		return nil
	})

	loggerInstance.WithField("services", len(k8sConfig.Services)).Info("K8s service discovery initialized")

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

	// Initialize Redis rate limiter for stateless design
	redisRateLimiterConfig := &middleware.RedisRateLimiterConfig{
		RedisClient:     redisClient,
		DefaultLimit:    100, // 100 requests per minute default
		DefaultWindow:   time.Minute,
		BurstLimit:      20, // Allow 20 burst requests
		CleanupInterval: 5 * time.Minute,
	}
	redisRateLimiter := middleware.NewRedisRateLimiter(redisRateLimiterConfig)
	router.Use(middleware.RedisRateLimitMiddleware(redisRateLimiter))

	// Recovery middleware
	router.Use(gin.Recovery())

	// JWT metrics middleware (before auth middleware to track attempts)
	router.Use(metrics.JWTMetricsMiddleware())

	// Public endpoints (no auth required)
	// Metrics endpoint for Prometheus scraping
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Health check endpoint
	router.GET("/health", k8sHandler.HealthHandler)

	// Root endpoint with service discovery info
	router.GET("/", k8sHandler.RootHandler)

	// API documentation endpoint
	router.GET("/docs", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/docs/")
	})

	// Serve OpenAPI documentation
	router.Static("/docs/", "./docs/")

	// Authentication middleware (validates JWT and sets user context headers)
	authGroup := router.Group("/")
	authGroup.Use(middleware.AuthMiddleware(jwtValidator, jwtConfig))

	// Unversioned API routes (for frontend compatibility)
	// These routes map to /api/v1/* endpoints on the respective services
	unversionedGroup := authGroup.Group("/")
	{
		// Search routes -> search-svc /api/v1/search
		unversionedGroup.Any("/search", func(c *gin.Context) {
			// Rewrite path to add /api/v1 prefix
			c.Request.URL.Path = "/api/v1/search"
			k8sHandler.ProxyToK8sService("search-svc")(c)
		})
		
		// Discovery browse routes -> discovery-svc /api/v1/browse
		unversionedGroup.Any("/discovery/browse", func(c *gin.Context) {
			c.Request.URL.Path = "/api/v1/browse"
			k8sHandler.ProxyToK8sService("discovery-svc")(c)
		})
		
		// User routes -> user-svc /api/v1/users
		unversionedGroup.Any("/users/*path", func(c *gin.Context) {
			// Extract the path after /users
			path := c.Param("path")
			c.Request.URL.Path = "/api/v1/users" + path
			k8sHandler.ProxyToK8sService("user-svc")(c)
		})
	}

	// Service routes with K8s service discovery
	// Authentication routes (proxied to user-service)
	authServiceGroup := authGroup.Group("/auth")
	{
		authServiceGroup.Any("/*path", k8sHandler.ProxyToK8sService("user-svc"))
	}

	// User routes (proxied to user-service)
	usersGroup := authGroup.Group("/users")
	{
		usersGroup.Any("/*path", k8sHandler.ProxyToK8sService("user-svc"))
	}

	// Chat routes (proxied to chat-service)
	chatGroup := authGroup.Group("/chat")
	{
		chatGroup.Any("/*path", k8sHandler.ProxyToK8sService("chat-svc"))
	}

	// WebSocket endpoint for chat
	authGroup.Any("/ws", k8sHandler.ProxyToK8sService("chat-svc"))

	// AI routes (proxied to ai-service)
	aiGroup := authGroup.Group("/ai")
	{
		aiGroup.Any("/*path", k8sHandler.ProxyToK8sService("ai-svc"))
	}

	// Discovery/Broadcasts routes (proxied to discovery-service)
	broadcastsGroup := authGroup.Group("/broadcasts")
	{
		broadcastsGroup.Any("/*path", k8sHandler.ProxyToK8sService("discovery-svc"))
	}

	// Cue routes (proxied to discovery-service)
	cuesGroup := authGroup.Group("/cues")
	{
		cuesGroup.Any("/*path", k8sHandler.ProxyToK8sService("discovery-svc"))
	}
	discoveryGroup := authGroup.Group("/discovery")
	{
		discoveryGroup.Any("/*path", k8sHandler.ProxyToK8sService("discovery-svc"))
	}

	// Timeline aggregation endpoint (future implementation)
	authGroup.GET("/timeline", func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":   "NOT_IMPLEMENTED",
			"message": "Timeline aggregation not yet implemented",
			"code":    "FEATURE_NOT_IMPLEMENTED",
		})
	})

	// Add enhanced health endpoints using lifecycle manager
	router.GET("/health/live", gin.WrapH(http.HandlerFunc(lifecycleManager.CreateLivenessHandler())))
	router.GET("/health/ready", gin.WrapH(http.HandlerFunc(lifecycleManager.CreateReadinessHandler())))
	router.GET("/health/detailed", gin.WrapH(http.HandlerFunc(lifecycleManager.CreateHealthHandler())))

	// Catch-all for undefined routes
	router.NoRoute(k8sHandler.NotFoundHandler)

	// Set the router handler on the server
	server.Handler = router

	// Start lifecycle manager
	ctx := context.Background()
	if err := lifecycleManager.Start(ctx); err != nil {
		loggerInstance.WithError(err).Fatal("Failed to start lifecycle manager")
	}

	// Start server in a goroutine
	go func() {
		loggerInstance.WithField("port", server.Addr).Info("🚀 K8s-Native API Gateway starting up")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			loggerInstance.WithError(err).Fatal("Failed to start API Gateway server")
		}
	}()

	// Log service configuration
	loggerInstance.WithFields(map[string]interface{}{
		"services_configured": len(k8sConfig.Services),
		"service_discovery":   "kubernetes",
		"service_mesh":        "linkerd",
		"load_balancing":      "k8s + linkerd",
		"health_checks":       "k8s readiness probes",
		"jwt_auth":            len(jwtConfig.Secret) > 0,
	}).Info("K8s-Native API Gateway started successfully")

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	loggerInstance.Info("Shutting down API Gateway...")

	// Use lifecycle manager for graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := lifecycleManager.Shutdown(shutdownCtx); err != nil {
		loggerInstance.WithError(err).Error("Server forced to shutdown")
	}

	loggerInstance.Info("API Gateway stopped")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func buildDatabaseURL() string {
	host := getEnvOrDefault("DB_HOST", "localhost")
	port := getEnvOrDefault("DB_PORT", "5432")
	user := getEnvOrDefault("DB_USER", "linkuser")
	password := getEnvOrDefault("DB_PASSWORD", "linkpass")
	dbname := getEnvOrDefault("DB_NAME", "linkdb")
	sslmode := getEnvOrDefault("DB_SSL_MODE", "disable")

	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
}