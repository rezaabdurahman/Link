package handler

import (
	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/ai"
	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/config"
	"github.com/link-app/ai-svc/internal/middleware"
	"github.com/link-app/ai-svc/internal/privacy"
	"github.com/link-app/ai-svc/internal/service"
)

// ExampleIntegration demonstrates how to integrate the SummarizeHandler
// into your main application with all required middleware and dependencies.
//
// This example shows the complete setup including:
// - Rate limiter configuration (5 requests per minute per user)
// - JWT secret configuration
// - All service dependencies
// - Proper routing structure
//
// Usage in cmd/main.go:
//
//	// Initialize services (implement these based on your needs)
//	aiService := ai.NewOpenAIService(cfg.AI, cacheService, logger)
//	chatService := chat.NewChatService(cfg.ChatService, logger)
//	privacyService := privacy.NewPrivacyService(dbService, logger)
//	cacheService := cache.NewRedisSummaryCache(cfg.Redis, logger)
//
//	// Create summarize handler
//	summarizeHandler := handler.NewSummarizeHandler(
//		aiService,
//		chatService,
//		privacyService,
//		cacheService,
//		&logger,
//	)
//
//	// Setup main router
//	r := chi.NewRouter()
//
//	// Add global middleware
//	r.Use(middleware.RequestID)
//	r.Use(middleware.RealIP)
//	r.Use(middleware.Recoverer)
//
//	// Mount API routes
//	r.Route("/api/v1", func(r chi.Router) {
//		// Mount summarize handler with middleware
//		r.Mount("/ai/summarize", summarizeHandler.Routes(cfg.JWT.Secret, rateLimiter))
//	})
func ExampleIntegration(
	cfg *config.Config,
	aiService ai.SummarizationService,
	chatService service.ChatService,
	privacyService privacy.PrivacyService,
	cacheService cache.SummaryCache,
	logger *zerolog.Logger,
) chi.Router {
	// Create rate limiter for AI endpoints (5 requests per minute per user)
	// This is configured specifically for the summarization endpoint
	rateLimiter := middleware.NewRateLimiter(5, 10) // 5 req/min, burst of 10

	// Create summarize handler
	summarizeHandler := NewSummarizeHandler(
		aiService,
		chatService,
		privacyService,
		cacheService,
		logger,
	)

	// Setup router with all middleware applied in the handler
	r := chi.NewRouter()

	// Mount the summarize handler - it will apply its own middleware stack:
	// 1. Panic recovery
	// 2. Request logging  
	// 3. JWT authentication
	// 4. Rate limiting (5 req/min/user)
	r.Mount("/", summarizeHandler.Routes(cfg.JWT.Secret, rateLimiter))

	return r
}

// ExampleFullAPISetup shows how to integrate multiple handlers in a complete API setup
func ExampleFullAPISetup(
	cfg *config.Config,
	// AI and cache services
	aiService ai.SummarizationService,
	chatService service.ChatService,
	cacheService cache.SummaryCache,
	// Database and other services
	dbService service.DatabaseService,
	redisService service.RedisService,
	// Privacy service
	privacyService privacy.PrivacyService,
	logger *zerolog.Logger,
) chi.Router {
	// Create rate limiters for different endpoints
	// AI endpoints: 5 requests per minute per user (as specified)
	aiRateLimiter := middleware.NewRateLimiter(5, 10)
	
	// General API endpoints: higher limit
	generalRateLimiter := middleware.NewRateLimiter(60, 100)

	// Create handlers
	summarizeHandler := NewSummarizeHandler(
		aiService,
		chatService,
		privacyService,
		cacheService,
		logger,
	)

	consentHandler := NewConsentHandler(
		privacyService,
		logger,
	)

	healthHandler := NewHealthHandler(
		dbService,
		redisService,
		aiService,
		logger,
	)

	// Setup main router
	r := chi.NewRouter()

	// Health endpoints (no auth required)
	r.Get("/health", healthHandler.HandleHealth)
	r.Get("/health/readiness", healthHandler.HandleReadiness)
	r.Get("/health/liveness", healthHandler.HandleLiveness)

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// AI endpoints (with strict rate limiting)
		r.Route("/ai", func(r chi.Router) {
			// Summarization endpoint with full middleware stack
			r.Mount("/summarize", summarizeHandler.Routes(cfg.JWT.Secret, aiRateLimiter))
		})

		// Privacy and consent endpoints (with general rate limiting) 
		r.Route("/consent", func(r chi.Router) {
			// Apply middleware for consent endpoints
			r.Use(middleware.PanicRecovery(logger))
			r.Use(middleware.RequestLogger(logger))
			r.Use(middleware.JWTAuth(cfg.JWT.Secret, logger))
			r.Use(middleware.RateLimit(generalRateLimiter, logger))

			r.Mount("/", consentHandler.Routes())
		})
	})

	return r
}

// Configuration example for environment variables:
//
// # JWT Configuration
// JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
// JWT_EXPIRES_IN=24h
//
// # AI Service Configuration  
// AI_PROVIDER=openai
// AI_API_KEY=sk-your-openai-api-key-here
// AI_MODEL=gpt-4
// AI_MAX_TOKENS=2048
// AI_TEMPERATURE=0.7
// AI_TIMEOUT=30s
// AI_MAX_RETRIES=3
//
// # Chat Service Configuration
// CHAT_SERVICE_URL=http://localhost:8080
// CHAT_SERVICE_TIMEOUT=10s
// CHAT_SERVICE_MAX_RETRIES=3
//
// # Redis Configuration (for caching)
// REDIS_HOST=localhost
// REDIS_PORT=6379
// REDIS_PASSWORD=
// REDIS_DB=1
// SUMMARY_TTL=1h
//
// # Rate Limiting
// RATE_LIMIT_ENABLED=true
// RATE_LIMIT_REQUESTS_PER_MINUTE=60
// RATE_LIMIT_AI_REQUESTS_PER_MINUTE=5
//
// # Database Configuration
// DB_HOST=localhost
// DB_PORT=5432
// DB_NAME=ai_db
// DB_USER=postgres
// DB_PASSWORD=your-db-password
//
// # Logging
// LOG_LEVEL=info
// LOG_FORMAT=json

// API Documentation example:
//
// POST /api/v1/ai/summarize
//
// Description: Summarize conversation messages using AI
// 
// Headers:
//   Authorization: Bearer <jwt-token>
//   Content-Type: application/json
//
// Request Body:
//   {
//     "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
//     "limit": 15
//   }
//
// Response (200 OK):
//   {
//     "id": "summary-uuid-here",
//     "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
//     "summary": "The conversation discusses the new product launch...",
//     "message_count": 15,
//     "tokens_used": 256,
//     "model": "gpt-4",
//     "processing_time": "2.5s",
//     "cached_result": false,
//     "metadata": {
//       "anonymized_fields": ["email"],
//       "model_used": "gpt-4"
//     },
//     "created_at": "2024-01-15T10:30:00Z"
//   }
//
// Response Headers:
//   X-RateLimit-Limit: 5
//   X-RateLimit-Remaining: 4
//   Content-Type: application/json
//
// Error Responses:
//   400 Bad Request - Invalid request body
//   401 Unauthorized - Missing or invalid JWT token
//   403 Forbidden - AI processing consent required
//   404 Not Found - No messages found for conversation
//   429 Too Many Requests - Rate limit exceeded (5 requests per minute)
//   500 Internal Server Error - Server error
