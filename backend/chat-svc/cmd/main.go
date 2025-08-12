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
)

// @title Chat Service API
// @version 1.0
// @description Real-time chat service for Link-chat application
// @host localhost:8080
// @BasePath /api/v1
func main() {
	// Initialize logger
	logger := logrus.New()
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
	healthHandler := handler.NewHealthHandler(database, chatService.GetRedisService(), logger)

	// Setup router
	r := chi.NewRouter()

	// Basic middleware
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

	// Health check endpoints
	r.Get("/health", healthHandler.HandleHealth)        // Comprehensive health check with DB & Redis
	r.Get("/health/readiness", healthHandler.HandleReadiness) // Readiness probe for K8s
	r.Get("/health/liveness", healthHandler.HandleLiveness)   // Liveness probe for K8s

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Mount("/chat", chatHandler.Routes())
	})

	// WebSocket routes
	r.Route("/ws", func(r chi.Router) {
		r.HandleFunc("/chat/{id}", chatHandler.HandleWebSocket)
	})

	// Create HTTP server
	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", cfg.ServerHost, cfg.ServerPort),
		Handler: r,
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

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown: ", err)
	}

	logger.Info("Server exited")
}
