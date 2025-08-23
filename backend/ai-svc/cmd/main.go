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
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/link-app/ai-svc/internal/config"
	"github.com/link-app/ai-svc/internal/service"
	"github.com/link-app/shared-libs/lifecycle"
	aiMetrics "github.com/link-app/ai-svc/internal/middleware"
)

// @title AI Service API
// @version 1.0
// @description AI processing service for Link-chat application
// @host localhost:8081
// @BasePath /api/v1
func main() {
	// Initialize structured logger (zerolog)
	setupLogger()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Set log level from config
	if level, err := zerolog.ParseLevel(cfg.LogLevel); err == nil {
		zerolog.SetGlobalLevel(level)
	}

	log.Info().Msg("Starting ai-svc...")

	// Initialize services
	// Note: These would be implemented based on your specific requirements
	var dbService service.DatabaseService
	var redisService service.RedisService  
	var aiService service.AIService

	// For now, we'll use placeholder implementations
	// In a real implementation, these would connect to actual services
	log.Warn().Msg("Using placeholder service implementations - implement actual services")

	// Setup router
	r := chi.NewRouter()

	// Basic middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5)) // Enable compression
	r.Use(aiMetrics.PrometheusMiddleware()) // Prometheus metrics middleware

	// Structured request logging with zerolog
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap the ResponseWriter to capture status code
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			next.ServeHTTP(ww, r)

			duration := time.Since(start)

			// Log request with structured data
			log.Info().
				Str("method", r.Method).
				Str("url", r.URL.String()).
				Str("user_agent", r.UserAgent()).
				Str("remote_addr", r.RemoteAddr).
				Int("status", ww.Status()).
				Int("bytes", ww.BytesWritten()).
				Dur("duration", duration).
				Str("request_id", middleware.GetReqID(r.Context())).
				Msg("HTTP request")
		})
	})

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
		log.Info().
			Int("requests_per_minute", cfg.RateLimitRequestsPerMinute).
			Msg("Rate limiting enabled")
	}

	// Request timeout
	r.Use(middleware.Timeout(60 * time.Second))

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// AI endpoints will be implemented here
		// r.Mount("/ai", aiHandler.Routes())
		// r.Mount("/conversations", conversationHandler.Routes())
		log.Info().Msg("API routes placeholder - implement actual handlers")
	})

	// Health endpoints (will be registered after lifecycle manager is created)
	// Note: These are registered after lifecycle manager initialization

	// Metrics endpoint for Prometheus scraping
	r.Get("/metrics", func(w http.ResponseWriter, r *http.Request) {
		promhttp.Handler().ServeHTTP(w, r)
	})

	// Create HTTP server
	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", cfg.ServerHost, cfg.ServerPort),
		Handler: r,
	}

	// Initialize lifecycle manager
	lifecycleManager := lifecycle.NewServiceManager(server)
	lifecycleManager.SetShutdownTimeout(30 * time.Second)
	lifecycleManager.SetHealthCheckPeriod(10 * time.Second)

	// Add health endpoints to router
	r.Get("/health/live", func(w http.ResponseWriter, r *http.Request) {
		lifecycleManager.CreateLivenessHandler().ServeHTTP(w, r)
	})
	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		lifecycleManager.CreateReadinessHandler().ServeHTTP(w, r)
	})
	r.Get("/health/detailed", func(w http.ResponseWriter, r *http.Request) {
		lifecycleManager.CreateHealthHandler().ServeHTTP(w, r)
	})

	// Add health checkers (using placeholder services for now)
	lifecycleManager.AddHealthChecker("database", lifecycle.HealthCheckFunc(func(ctx context.Context) error {
		if dbService == nil {
			return fmt.Errorf("database service not implemented")
		}
		return dbService.Health(ctx)
	}))
	lifecycleManager.AddHealthChecker("redis", lifecycle.HealthCheckFunc(func(ctx context.Context) error {
		if redisService == nil {
			return fmt.Errorf("redis service not implemented")
		}
		return redisService.Health(ctx)
	}))
	lifecycleManager.AddHealthChecker("ai_service", lifecycle.HealthCheckFunc(func(ctx context.Context) error {
		if aiService == nil {
			return fmt.Errorf("ai service not implemented")
		}
		return aiService.Health(ctx)
	}))

	// Setup graceful shutdown
	lifecycleManager.OnShutdown(func(ctx context.Context) error {
		log.Info().Msg("Cleaning up resources...")
		if dbService != nil {
			dbService.Close()
		}
		if redisService != nil {
			redisService.Close()
		}
		return nil
	})

	// Start lifecycle manager
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := lifecycleManager.Start(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to start lifecycle manager")
	}

	// Start server in a goroutine
	go func() {
		log.Info().
			Str("addr", server.Addr).
			Str("environment", cfg.Environment).
			Msg("Server starting")
		
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Use lifecycle manager for graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := lifecycleManager.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}

// setupLogger configures zerolog for structured logging
func setupLogger() {
	// Configure zerolog
	zerolog.TimeFieldFormat = time.RFC3339
	
	// Set up console writer for local development
	if os.Getenv("ENVIRONMENT") == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{
			Out:        os.Stderr,
			TimeFormat: "15:04:05",
		})
	}

	// Add service information to all logs
	log.Logger = log.With().
		Str("service", "ai-svc").
		Str("version", "1.0.0").
		Logger()
}
