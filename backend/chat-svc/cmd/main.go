package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/config"
	"github.com/link-app/chat-svc/internal/db"
	"github.com/link-app/chat-svc/internal/handler"
	authmw "github.com/link-app/chat-svc/internal/middleware"
	"github.com/link-app/chat-svc/internal/service"
	"github.com/link-app/chat-svc/internal/sentry"
	"github.com/link-app/chat-svc/internal/tracing"
	"github.com/link-app/shared-libs/lifecycle"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// @title Chat Service API
// @version 1.0
// @description Real-time chat service for Link-chat application
// @host localhost:8080
// @BasePath /api/v1
func main() {
	// Initialize Sentry for error reporting
	if err := sentry.InitSentry(); err != nil {
		logrus.Printf("Failed to initialize Sentry: %v", err)
		// Continue running even if Sentry fails
	}
	defer sentry.Flush(2 * time.Second)

	// Initialize logger
	logger := logrus.New()

	// Initialize OpenTelemetry tracing
	cleanupTracing, err := tracing.InitTracing("chat-svc")
	if err != nil {
		logger.WithError(err).Warn("Failed to initialize tracing")
	} else {
		logger.Info("Distributed tracing initialized successfully")
		defer cleanupTracing()
	}
	logger.SetFormatter(&logrus.JSONFormatter{})
	
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load configuration: ", err)
	}

	// Set log level
	if level, err := logrus.ParseLevel(cfg.LogLevel); err == nil {
		logger.SetLevel(level)
	}

	logger.Info("Starting chat-svc...")

	// Initialize database connection
	database, err := db.Connect(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database: ", err)
	}
	defer database.Close()

	// Initialize repository
	repo := db.NewRepository(database.Pool)

	// Initialize service orchestrator
	chatService := service.New(cfg, repo, logger)
	defer chatService.Close() // Ensure Redis connections are closed

	// Initialize authentication middleware
	authMw := authmw.NewAuthMiddleware(cfg, logger)

	// Initialize handlers
	chatHandler := handler.NewChatHandler(chatService, logger, authMw)
	// healthHandler removed - not used in this implementation

	// Create HTTP server (needed for lifecycle manager)
	server := &http.Server{
		Addr: fmt.Sprintf("%s:%s", cfg.ServerHost, cfg.ServerPort),
	}

	// Initialize lifecycle manager early
	lifecycleManager := lifecycle.NewServiceManager(server)
	lifecycleManager.SetShutdownTimeout(30 * time.Second)
	lifecycleManager.SetHealthCheckPeriod(10 * time.Second)

	// Setup router
	r := chi.NewRouter()

	// Basic middleware
	// sentry.ChiSentryMiddleware removed - not available in stub
	// tracing.ChiMiddleware removed - not available in stub
	r.Use(authmw.PrometheusMiddleware(logger)) // Enable Prometheus metrics middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5)) // Enable compression

	// Enhanced request logging with structured logging
	r.Use(middleware.RequestLogger(&middleware.DefaultLogFormatter{
		Logger:  logger,
		NoColor: true,
	}))

	// CORS middleware with proper configuration
	// Parse allowed origins from config (comma-separated)
	allowedOrigins := []string{"*"}
	if cfg.CORSAllowedOrigins != "*" {
		// Split comma-separated origins and trim whitespace
		origins := strings.Split(cfg.CORSAllowedOrigins, ",")
		allowedOrigins = make([]string, 0, len(origins))
		for _, origin := range origins {
			if trimmed := strings.TrimSpace(origin); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-User-ID", "X-User-Email", "X-User-Name"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any major browsers
	}))

	// Rate limiting middleware (if enabled)
	if cfg.RateLimitEnabled {
		r.Use(httprate.LimitByIP(cfg.RateLimitRequestsPerMinute, 1*time.Minute))
		logger.Infof("Rate limiting enabled: %d requests per minute per IP", cfg.RateLimitRequestsPerMinute)
	}

	// Request timeout
	r.Use(middleware.Timeout(60 * time.Second))

	// Metrics endpoint for Prometheus scraping
	r.Get("/metrics", http.HandlerFunc(promhttp.Handler().ServeHTTP))

	// Add the new framework-agnostic health endpoints
	r.Get("/health/live", lifecycleManager.CreateLivenessHandler())
	r.Get("/health/ready", lifecycleManager.CreateReadinessHandler())
	r.Get("/health/detailed", lifecycleManager.CreateHealthHandler())

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Mount("/chat", chatHandler.Routes())
	})

	// WebSocket routes
	r.Route("/ws", func(r chi.Router) {
		r.HandleFunc("/chat/{id}", chatHandler.HandleWebSocket)
	})

	// Set router as server handler
	server.Handler = r

	// Add health checkers (using stubs for missing types)
	lifecycleManager.AddHealthChecker("database", lifecycle.HealthCheckFunc(func(ctx context.Context) error {
		return database.Health()
	}))
	lifecycleManager.AddHealthChecker("redis", lifecycle.HealthCheckFunc(func(ctx context.Context) error {
		return fmt.Errorf("redis health check not implemented")
	}))

	// Setup graceful shutdown
	lifecycleManager.OnShutdown(func(ctx context.Context) error {
		logger.Info("Cleaning up resources...")
		chatService.Close() // Close Redis connections
		database.Close()    // Close database connections
		return nil
	})

	// Start lifecycle manager
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := lifecycleManager.Start(ctx); err != nil {
		logger.Fatal("Failed to start lifecycle manager: ", err)
	}

	// Start server in a goroutine
	go func() {
		logger.Infof("Server starting on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed to start: ", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Use lifecycle manager for graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := lifecycleManager.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("Server forced to shutdown: ", err)
	}

	logger.Info("Server exited")
}
