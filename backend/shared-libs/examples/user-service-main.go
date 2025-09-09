package main

// Example: How the user-service would integrate with the shared lifecycle manager
// This demonstrates the pattern that all microservices should follow

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	_ "github.com/lib/pq"

	"github.com/link-app/shared-libs/lifecycle"
	// Import your service-specific packages here
	// "github.com/link-app/user-service/internal/handlers"
	// "github.com/link-app/user-service/internal/config"
)

func main() {
	// Configure HTTP server
	server := &http.Server{
		Addr:         getEnvOrDefault("PORT", ":8081"), // Different port per service
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Initialize service lifecycle manager
	lifecycleManager := lifecycle.NewServiceManager(server)
	lifecycleManager.SetShutdownTimeout(30 * time.Second)
	lifecycleManager.SetHealthCheckPeriod(10 * time.Second)

	// Setup service-specific health checks
	setupHealthCheckers(lifecycleManager)

	// Setup lifecycle callbacks
	lifecycleManager.OnStateChange(func(oldState, newState lifecycle.ServiceState) {
		// Log state changes or notify service registry
		// logger.WithFields(map[string]interface{}{
		//     "service": "user-service",
		//     "old_state": oldState.String(),
		//     "new_state": newState.String(),
		// }).Info("Service state changed")
	})

	lifecycleManager.OnShutdown(func(ctx context.Context) error {
		// Cleanup service-specific resources
		// - Close database connections
		// - Deregister from service discovery
		// - Flush caches
		// - Complete in-flight requests
		return nil
	})

	// Initialize Gin router
	router := setupRoutes(lifecycleManager)
	server.Handler = router

	// Start lifecycle manager
	ctx := context.Background()
	if err := lifecycleManager.Start(ctx); err != nil {
		// logger.WithError(err).Fatal("Failed to start lifecycle manager")
		panic(err)
	}

	// Start server
	go func() {
		// logger.WithField("port", server.Addr).Info("User Service starting")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			// logger.WithError(err).Fatal("Failed to start User Service server")
			panic(err)
		}
	}()

	// Wait for shutdown signal - lifecycle manager handles this automatically
	select {}
}

func setupHealthCheckers(lifecycleManager *lifecycle.ServiceManager) {
	// Database health checker
	if dbURL := buildDatabaseURL(); dbURL != "" {
		db, err := sql.Open("postgres", dbURL)
		if err == nil {
			lifecycleManager.AddHealthChecker("database", lifecycle.NewDatabaseHealthChecker(db))
		}
	}

	// Redis health checker
	redisAddr := getEnvOrDefault("REDIS_HOST", "localhost") + ":" + getEnvOrDefault("REDIS_PORT", "6379")
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: getEnvOrDefault("REDIS_PASSWORD", ""),
		DB:       0,
	})
	lifecycleManager.AddHealthChecker("redis", lifecycle.NewRedisHealthChecker(redisClient))

	// Service-specific dependency health checks
	// Example: External API dependencies
	if externalAPIURL := getEnvOrDefault("EXTERNAL_API_URL", ""); externalAPIURL != "" {
		apiChecker := lifecycle.NewHTTPServiceHealthChecker("external-api", externalAPIURL+"/health")
		apiChecker.SetTimeout(5 * time.Second).SetRetries(2)
		lifecycleManager.AddHealthChecker("external-api", apiChecker)
	}

	// Composite health checker for critical dependencies
	criticalDeps := lifecycle.NewDependencyHealthChecker()
	
	// Add critical dependencies (will fail health check if unavailable)
	if dbURL := buildDatabaseURL(); dbURL != "" {
		db, err := sql.Open("postgres", dbURL)
		if err == nil {
			criticalDeps.AddCritical("database", lifecycle.NewDatabaseHealthChecker(db))
		}
	}
	
	// Add optional dependencies (will log warnings but not fail)
	criticalDeps.AddOptional("redis", lifecycle.NewRedisHealthChecker(redisClient))
	
	lifecycleManager.AddHealthChecker("dependencies", criticalDeps)
}

func setupRoutes(lifecycleManager *lifecycle.ServiceManager) *gin.Engine {
	router := gin.Default()

	// Standard health endpoints (Kubernetes-compatible)
	router.GET("/health/live", gin.WrapH(lifecycleManager.CreateLivenessHandler()))
	router.GET("/health/ready", gin.WrapH(lifecycleManager.CreateReadinessHandler()))
	router.GET("/health/detailed", gin.WrapH(lifecycleManager.CreateHealthHandler()))

	// Legacy health endpoint for backward compatibility
	router.GET("/health", gin.WrapH(lifecycleManager.CreateHealthHandler()))

	// Service-specific routes
	v1 := router.Group("/api/v1")
	{
		// User management endpoints
		v1.POST("/users", handleCreateUser)
		v1.GET("/users/:id", handleGetUser)
		v1.PUT("/users/:id", handleUpdateUser)
		v1.DELETE("/users/:id", handleDeleteUser)
		
		// Authentication endpoints
		v1.POST("/auth/login", handleLogin)
		v1.POST("/auth/logout", handleLogout)
		v1.POST("/auth/refresh", handleRefreshToken)
	}

	return router
}

// Service-specific handlers (placeholder implementations)
func handleCreateUser(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func handleGetUser(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func handleUpdateUser(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func handleDeleteUser(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func handleLogin(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func handleLogout(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func handleRefreshToken(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// Helper functions
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

	if host == "" || user == "" || dbname == "" {
		return ""
	}

	return "host=" + host + " port=" + port + " user=" + user + " password=" + password + " dbname=" + dbname + " sslmode=" + sslmode
}
