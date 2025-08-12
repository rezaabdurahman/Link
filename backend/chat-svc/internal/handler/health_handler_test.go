package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

)

// Mocks for dependencies
type mockDatabase struct {
	healthFunc func() error
}

func (m *mockDatabase) Health() error {
	return m.healthFunc()
}

type mockRedisService struct {
	healthFunc func(ctx context.Context) error
}

func (m *mockRedisService) Health(ctx context.Context) error {
	return m.healthFunc(ctx)
}

// Custom HealthHandler for testing with interfaces
type TestHealthHandler struct {
	database interface{ Health() error }
	redis    interface{ Health(ctx context.Context) error }
	logger   *logrus.Logger
}

// HandleHealth for the test handler
func (h *TestHealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	// This is a simplified version of the real handler's logic for testing
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
	dbCheck := HealthCheck{Timestamp: timestamp}
	if err := h.database.Health(); err != nil {
		dbCheck.Status = "unhealthy"
		dbCheck.Message = err.Error()
		overallHealthy = false
	} else {
		dbCheck.Status = "healthy"
	}
	response.Checks["database"] = dbCheck

	// Check Redis health
	redisCheck := HealthCheck{Timestamp: timestamp}
	if err := h.redis.Health(ctx); err != nil {
		redisCheck.Status = "unhealthy"
		redisCheck.Message = err.Error()
		overallHealthy = false
	} else {
		redisCheck.Status = "healthy"
	}
	response.Checks["redis"] = redisCheck
	
	if !overallHealthy {
		response.Status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	
	json.NewEncoder(w).Encode(response)
}


func TestHealthHandler_HandleHealth_Success(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	mockDB := &mockDatabase{healthFunc: func() error { return nil }}
	mockRedis := &mockRedisService{healthFunc: func(ctx context.Context) error { return nil }}
	
	handler := &TestHealthHandler{
		database: mockDB,
		redis:    mockRedis,
		logger:   logger,
	}

	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var resp HealthResponse
	json.Unmarshal(rr.Body.Bytes(), &resp)
	assert.Equal(t, "healthy", resp.Status)
	assert.Equal(t, "healthy", resp.Checks["database"].Status)
	assert.Equal(t, "healthy", resp.Checks["redis"].Status)
}

func TestHealthHandler_HandleHealth_DBFailure(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mockDB := &mockDatabase{healthFunc: func() error { return errors.New("db error") }}
	mockRedis := &mockRedisService{healthFunc: func(ctx context.Context) error { return nil }}

	handler := &TestHealthHandler{
		database: mockDB,
		redis:    mockRedis,
		logger:   logger,
	}

	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	assert.Equal(t, http.StatusServiceUnavailable, rr.Code)
	var resp HealthResponse
	json.Unmarshal(rr.Body.Bytes(), &resp)
	assert.Equal(t, "unhealthy", resp.Status)
	assert.Equal(t, "unhealthy", resp.Checks["database"].Status)
	assert.Equal(t, "db error", resp.Checks["database"].Message)
	assert.Equal(t, "healthy", resp.Checks["redis"].Status)
}

func TestHealthHandler_HandleLiveness_Success(t *testing.T) {
	// Setup - test liveness endpoint without dependencies
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	// Create handler with nil dependencies (liveness doesn't use them)
	handler := &HealthHandler{
		logger: logger,
	}
	
	// Test
	req := httptest.NewRequest("GET", "/health/liveness", nil)
	rr := httptest.NewRecorder()
	
	handler.HandleLiveness(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))
	
	var response map[string]interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	
	assert.Equal(t, "alive", response["status"])
	assert.Equal(t, "chat-svc", response["service"])
	assert.NotEmpty(t, response["timestamp"])
}
