package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/db"
	"github.com/link-app/chat-svc/internal/service"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	database *db.Database
	redis    *service.RedisService
	logger   *logrus.Logger
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status  string                 `json:"status"`
	Service string                 `json:"service"`
	Version string                 `json:"version,omitempty"`
	Checks  map[string]HealthCheck `json:"checks"`
}

// HealthCheck represents individual component health
type HealthCheck struct {
	Status    string `json:"status"`
	Message   string `json:"message,omitempty"`
	Timestamp string `json:"timestamp"`
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(database *db.Database, redis *service.RedisService, logger *logrus.Logger) *HealthHandler {
	return &HealthHandler{
		database: database,
		redis:    redis,
		logger:   logger,
	}
}

// HandleHealth performs comprehensive health checks
func (h *HealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	w.Header().Set("Content-Type", "application/json")
	
	response := HealthResponse{
		Status:  "healthy",
		Service: "chat-svc",
		Version: "1.0.0",
		Checks:  make(map[string]HealthCheck),
	}

	timestamp := time.Now().UTC().Format(time.RFC3339)
	overallHealthy := true

	// Check database health
	dbCheck := HealthCheck{
		Status:    "healthy",
		Message:   "Database connection successful",
		Timestamp: timestamp,
	}

	if err := h.database.Health(); err != nil {
		h.logger.WithError(err).Error("Database health check failed")
		dbCheck.Status = "unhealthy"
		dbCheck.Message = "Database connection failed: " + err.Error()
		overallHealthy = false
	}

	response.Checks["database"] = dbCheck

	// Check Redis health
	redisCheck := HealthCheck{
		Status:    "healthy",
		Message:   "Redis connection successful",
		Timestamp: timestamp,
	}

	if err := h.redis.Health(ctx); err != nil {
		h.logger.WithError(err).Error("Redis health check failed")
		redisCheck.Status = "unhealthy"
		redisCheck.Message = "Redis connection failed: " + err.Error()
		overallHealthy = false
	}

	response.Checks["redis"] = redisCheck

	// Set overall status
	if !overallHealthy {
		response.Status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	// Add basic system check
	response.Checks["system"] = HealthCheck{
		Status:    "healthy",
		Message:   "Service is running",
		Timestamp: timestamp,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.WithError(err).Error("Failed to encode health response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if overallHealthy {
		h.logger.Debug("Health check passed")
	} else {
		h.logger.Warn("Health check failed")
	}
}

// HandleReadiness performs readiness checks (lighter than health checks)
func (h *HealthHandler) HandleReadiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	w.Header().Set("Content-Type", "application/json")

	// For readiness, we do a quick ping to ensure we can accept traffic
	ready := true
	checks := make(map[string]HealthCheck)
	timestamp := time.Now().UTC().Format(time.RFC3339)

	// Quick database ping
	if err := h.database.Health(); err != nil {
		ready = false
		checks["database"] = HealthCheck{
			Status:    "not_ready",
			Message:   "Database not ready",
			Timestamp: timestamp,
		}
	} else {
		checks["database"] = HealthCheck{
			Status:    "ready",
			Message:   "Database ready",
			Timestamp: timestamp,
		}
	}

	// Quick Redis ping
	if err := h.redis.Health(ctx); err != nil {
		ready = false
		checks["redis"] = HealthCheck{
			Status:    "not_ready",
			Message:   "Redis not ready",
			Timestamp: timestamp,
		}
	} else {
		checks["redis"] = HealthCheck{
			Status:    "ready",
			Message:   "Redis ready",
			Timestamp: timestamp,
		}
	}

	response := map[string]interface{}{
		"status":  "ready",
		"service": "chat-svc",
		"checks":  checks,
	}

	if !ready {
		response["status"] = "not_ready"
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.WithError(err).Error("Failed to encode readiness response")
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
		"service":   "chat-svc",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.WithError(err).Error("Failed to encode liveness response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}
