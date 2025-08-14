package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/model"
	"github.com/link-app/ai-svc/internal/service"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	dbService    service.DatabaseService
	redisService service.RedisService
	aiService    service.AIService
	logger       *zerolog.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(
	dbService service.DatabaseService,
	redisService service.RedisService,
	aiService service.AIService,
	logger *zerolog.Logger,
) *HealthHandler {
	return &HealthHandler{
		dbService:    dbService,
		redisService: redisService,
		aiService:    aiService,
		logger:       logger,
	}
}

// HandleHealth performs comprehensive health checks
func (h *HealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	w.Header().Set("Content-Type", "application/json")
	
	response := model.HealthResponse{
		Status:  "healthy",
		Service: "ai-svc",
		Version: "1.0.0",
		Checks:  make(map[string]model.HealthCheck),
	}

	timestamp := time.Now().UTC().Format(time.RFC3339)
	overallHealthy := true

	// Check database health
	dbCheck := model.HealthCheck{
		Status:    "healthy",
		Message:   "Database connection successful",
		Timestamp: timestamp,
	}

	if err := h.dbService.Health(ctx); err != nil {
		h.logger.Error().Err(err).Msg("Database health check failed")
		dbCheck.Status = "unhealthy"
		dbCheck.Message = "Database connection failed: " + err.Error()
		overallHealthy = false
	}

	response.Checks["database"] = dbCheck

	// Check Redis health
	redisCheck := model.HealthCheck{
		Status:    "healthy",
		Message:   "Redis connection successful",
		Timestamp: timestamp,
	}

	if err := h.redisService.Health(ctx); err != nil {
		h.logger.Error().Err(err).Msg("Redis health check failed")
		redisCheck.Status = "unhealthy"
		redisCheck.Message = "Redis connection failed: " + err.Error()
		overallHealthy = false
	}

	response.Checks["redis"] = redisCheck

	// Check AI service health
	aiCheck := model.HealthCheck{
		Status:    "healthy",
		Message:   "AI service operational",
		Timestamp: timestamp,
	}

	if err := h.aiService.Health(ctx); err != nil {
		h.logger.Error().Err(err).Msg("AI service health check failed")
		aiCheck.Status = "unhealthy"
		aiCheck.Message = "AI service not operational: " + err.Error()
		overallHealthy = false
	}

	response.Checks["ai_service"] = aiCheck

	// Set overall status
	if !overallHealthy {
		response.Status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	// Add basic system check
	response.Checks["system"] = model.HealthCheck{
		Status:    "healthy",
		Message:   "Service is running",
		Timestamp: timestamp,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error().Err(err).Msg("Failed to encode health response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if overallHealthy {
		h.logger.Debug().Msg("Health check passed")
	} else {
		h.logger.Warn().Msg("Health check failed")
	}
}

// HandleReadiness performs readiness checks (lighter than health checks)
func (h *HealthHandler) HandleReadiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	w.Header().Set("Content-Type", "application/json")

	// For readiness, we do a quick ping to ensure we can accept traffic
	ready := true
	checks := make(map[string]model.HealthCheck)
	timestamp := time.Now().UTC().Format(time.RFC3339)

	// Quick database ping
	if err := h.dbService.Health(ctx); err != nil {
		ready = false
		checks["database"] = model.HealthCheck{
			Status:    "not_ready",
			Message:   "Database not ready",
			Timestamp: timestamp,
		}
	} else {
		checks["database"] = model.HealthCheck{
			Status:    "ready",
			Message:   "Database ready",
			Timestamp: timestamp,
		}
	}

	// Quick Redis ping
	if err := h.redisService.Health(ctx); err != nil {
		ready = false
		checks["redis"] = model.HealthCheck{
			Status:    "not_ready",
			Message:   "Redis not ready",
			Timestamp: timestamp,
		}
	} else {
		checks["redis"] = model.HealthCheck{
			Status:    "ready",
			Message:   "Redis ready",
			Timestamp: timestamp,
		}
	}

	response := map[string]interface{}{
		"status":  "ready",
		"service": "ai-svc",
		"checks":  checks,
	}

	if !ready {
		response["status"] = "not_ready"
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error().Err(err).Msg("Failed to encode readiness response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// HandleLiveness performs basic liveness checks
func (h *HealthHandler) HandleLiveness(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]interface{}{
		"status":    "alive",
		"service":   "ai-svc",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error().Err(err).Msg("Failed to encode liveness response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}
