package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
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

	// Global middleware
	router.Use(sentry.GinSentryMiddleware()) // Add Sentry middleware early
	router.Use(tracing.GinMiddleware("search-svc")) // Add distributed tracing middleware
	router.Use(middleware.PrometheusMiddleware()) // Add Prometheus metrics collection
	router.Use(corsMiddleware())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.ErrorHandler())

	// Metrics endpoint for Prometheus scraping
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "search-svc",
			"timestamp": time.Now(),
			"version":   "1.0.0",
		})
	})

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

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Search service starting on port %s", port)
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
