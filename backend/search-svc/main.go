package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/search-svc/internal/client"
	"github.com/link-app/search-svc/internal/config"
	"github.com/link-app/search-svc/internal/handlers"
	"github.com/link-app/search-svc/internal/middleware"
	"github.com/link-app/search-svc/internal/repository"
	"github.com/link-app/search-svc/internal/sentry"
	"github.com/link-app/search-svc/internal/service"
	"github.com/link-app/search-svc/internal/tracing"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/link-app/shared-libs/lifecycle"
)

func main() {
	// Initialize Sentry for error reporting
	if err := sentry.InitSentry(); err != nil {
		log.Printf("Failed to initialize Sentry: %v", err)
		// Continue running even if Sentry fails
	}
	defer sentry.Flush(2 * time.Second)

	// Initialize OpenTelemetry tracing
	cleanupTracing, err := tracing.InitTracing("search-svc")
	if err != nil {
		log.Printf("Failed to initialize tracing: %v", err)
	} else {
		log.Printf("Distributed tracing initialized successfully")
		defer cleanupTracing()
	}

	// Initialize database with pgvector extension
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Initialize embedding provider (OpenAI by default, but switchable)
	embeddingProvider, err := config.NewEmbeddingProvider()
	if err != nil {
		log.Fatal("Failed to initialize embedding provider:", err)
	}

	// Initialize repository
	searchRepo := repository.NewSearchRepository(db)
	reindexRepo := repository.NewReindexRepository(db)

	// Initialize service clients for indexing pipeline
	discoveryURL := getEnvOrDefault("DISCOVERY_SVC_URL", "http://discovery-svc:8081")
	userURL := getEnvOrDefault("USER_SVC_URL", "http://user-svc:8082")
	serviceToken := os.Getenv("SERVICE_AUTH_TOKEN")
	
	discoveryClient := client.NewDiscoveryClient(discoveryURL, serviceToken)
	userClient := client.NewUserClient(userURL, serviceToken)

	// Initialize indexing configuration
	indexingConfig := &service.IndexingConfig{
		CronIntervalMinutes: getEnvOrDefaultInt("INDEXING_CRON_INTERVAL_MINUTES", 120), // 2 hours
		WorkerPoolSize:      getEnvOrDefaultInt("INDEXING_WORKER_POOL_SIZE", 10),
		RateLimitPerSecond:  getEnvOrDefaultInt("INDEXING_RATE_LIMIT_PER_SECOND", 50),
		BatchSize:          getEnvOrDefaultInt("INDEXING_BATCH_SIZE", 100),
		EmbeddingTTLHours:  getEnvOrDefaultInt("INDEXING_EMBEDDING_TTL_HOURS", 2),
	}

	// Initialize services
	searchService := service.NewSearchService(searchRepo, embeddingProvider)
	reindexService := service.NewReindexService(reindexRepo, searchRepo, embeddingProvider)
	indexingService := service.NewIndexingService(searchRepo, discoveryClient, userClient, embeddingProvider, indexingConfig)

	// Initialize handlers
	searchHandler := handlers.NewSearchHandler(searchService)
	reindexHandler := handlers.NewReindexHandler(reindexService)
	indexingHandler := handlers.NewIndexingHandler(indexingService)

	// Initialize Gin router
	router := gin.Default()

	// Configure server with lifecycle management
	port := getEnvOrDefault("PORT", "8085")
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
	lifecycleManager.AddHealthChecker("embedding_provider", lifecycle.HealthCheckFunc(func(ctx context.Context) error {
		return embeddingProvider.CheckHealth(ctx)
	}))

	// Global middleware
	router.Use(sentry.GinSentryMiddleware()) // Add Sentry middleware early
	router.Use(tracing.GinMiddleware("search-svc")) // Add distributed tracing middleware
	router.Use(middleware.PrometheusMiddleware()) // Add Prometheus metrics collection
	router.Use(corsMiddleware())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.ErrorHandler())

	// Metrics endpoint for Prometheus scraping
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Add the new framework-agnostic health endpoints
	router.GET("/health/live", gin.WrapH(lifecycleManager.CreateLivenessHandler()))
	router.GET("/health/ready", gin.WrapH(lifecycleManager.CreateReadinessHandler()))
	router.GET("/health/detailed", gin.WrapH(lifecycleManager.CreateHealthHandler()))

	// Initialize rate limiter for search endpoint (50 requests per minute per user)
	rateLimiter := middleware.NewRateLimiterStore(50)

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Search endpoints (require auth + rate limiting)
		v1.POST("/search", middleware.AuthRequired(), middleware.RateLimit(rateLimiter), searchHandler.Search)

		// Reindex endpoints (require service auth)
		v1.POST("/reindex", middleware.ServiceAuthRequired(), reindexHandler.Reindex)
		v1.GET("/reindex/:jobId", middleware.ServiceAuthRequired(), reindexHandler.GetReindexStatus)
		
		// Indexing pipeline endpoints (require service auth)
		v1.GET("/indexing/stats", middleware.ServiceAuthRequired(), indexingHandler.GetIndexingStats)
		v1.POST("/indexing/trigger", middleware.ServiceAuthRequired(), indexingHandler.TriggerIndexing)
	}

	// Start background services
	go reindexService.StartWorker()
	
	// Start indexing pipeline
	go func() {
		if err := indexingService.StartIndexingPipeline(context.Background()); err != nil {
			log.Printf("Indexing pipeline stopped: %v", err)
		}
	}()
	
	// Start TTL cleanup worker
	go indexingService.StartTTLCleanupWorker(context.Background())
	
	// Start availability-based embedding cleanup (privacy safeguard)
	go searchService.StartAvailabilityCleanup(context.Background())

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
		log.Printf("Search service starting on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start: ", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down search service...")

	// Use lifecycle manager for graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := lifecycleManager.Shutdown(shutdownCtx); err != nil {
		log.Fatal("Server forced to shutdown: ", err)
	}

	log.Println("Search service exited")
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
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, X-User-Email, X-User-Name, X-User-Visibility, X-User-Available")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// getEnvOrDefault returns the environment variable value or a default value if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvOrDefaultInt returns the environment variable value as int or a default value if not set
func getEnvOrDefaultInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
