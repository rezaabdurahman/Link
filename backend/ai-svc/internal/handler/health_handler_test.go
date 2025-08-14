package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/model"
)

// MockDatabaseService provides a mock database service for testing
type MockDatabaseService struct {
	shouldFail bool
}

func (m *MockDatabaseService) Health(ctx context.Context) error {
	if m.shouldFail {
		return fmt.Errorf("database connection failed")
	}
	return nil
}

func (m *MockDatabaseService) SetShouldFail(fail bool) {
	m.shouldFail = fail
}

// MockRedisService provides a mock Redis service for testing
type MockRedisService struct {
	shouldFail bool
}

func (m *MockRedisService) Health(ctx context.Context) error {
	if m.shouldFail {
		return fmt.Errorf("redis connection failed")
	}
	return nil
}

func (m *MockRedisService) SetShouldFail(fail bool) {
	m.shouldFail = fail
}

// MockAIService provides a mock AI service for testing
type MockAIService struct {
	shouldFail bool
}

func (m *MockAIService) Health(ctx context.Context) error {
	if m.shouldFail {
		return fmt.Errorf("AI service unavailable")
	}
	return nil
}

func (m *MockAIService) SetShouldFail(fail bool) {
	m.shouldFail = fail
}

func TestNewHealthHandler(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	if handler == nil {
		t.Fatal("Expected health handler to be created, got nil")
	}

	if handler.dbService != mockDB {
		t.Error("Expected database service to be set correctly")
	}

	if handler.redisService != mockRedis {
		t.Error("Expected Redis service to be set correctly")
	}

	if handler.aiService != mockAI {
		t.Error("Expected AI service to be set correctly")
	}

	if handler.logger != &logger {
		t.Error("Expected logger to be set correctly")
	}
}

func TestHandleHealth_AllHealthy(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	// Check content type
	if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}

	// Parse response
	var response model.HealthResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check response fields
	if response.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got %s", response.Status)
	}

	if response.Service != "ai-svc" {
		t.Errorf("Expected service 'ai-svc', got %s", response.Service)
	}

	if response.Version != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got %s", response.Version)
	}

	// Check individual service health checks
	if len(response.Checks) != 4 {
		t.Errorf("Expected 4 health checks, got %d", len(response.Checks))
	}

	expectedChecks := []string{"database", "redis", "ai_service", "system"}
	for _, checkName := range expectedChecks {
		check, exists := response.Checks[checkName]
		if !exists {
			t.Errorf("Expected health check %s to exist", checkName)
			continue
		}

		if check.Status != "healthy" {
			t.Errorf("Expected %s status to be 'healthy', got %s", checkName, check.Status)
		}

		if check.Timestamp == "" {
			t.Errorf("Expected %s timestamp to be set", checkName)
		}
	}
}

func TestHandleHealth_DatabaseFailure(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockDB.SetShouldFail(true)
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, status)
	}

	// Parse response
	var response model.HealthResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check overall status
	if response.Status != "unhealthy" {
		t.Errorf("Expected overall status 'unhealthy', got %s", response.Status)
	}

	// Check database status specifically
	dbCheck, exists := response.Checks["database"]
	if !exists {
		t.Fatal("Expected database check to exist")
	}

	if dbCheck.Status != "unhealthy" {
		t.Errorf("Expected database status 'unhealthy', got %s", dbCheck.Status)
	}

	if dbCheck.Message == "" {
		t.Error("Expected database error message to be set")
	}
}

func TestHandleHealth_RedisFailure(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockRedis.SetShouldFail(true)
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, status)
	}

	// Parse response
	var response model.HealthResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check Redis status specifically
	redisCheck, exists := response.Checks["redis"]
	if !exists {
		t.Fatal("Expected redis check to exist")
	}

	if redisCheck.Status != "unhealthy" {
		t.Errorf("Expected redis status 'unhealthy', got %s", redisCheck.Status)
	}
}

func TestHandleHealth_AIServiceFailure(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	mockAI.SetShouldFail(true)
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, status)
	}

	// Parse response
	var response model.HealthResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check AI service status specifically
	aiCheck, exists := response.Checks["ai_service"]
	if !exists {
		t.Fatal("Expected ai_service check to exist")
	}

	if aiCheck.Status != "unhealthy" {
		t.Errorf("Expected ai_service status 'unhealthy', got %s", aiCheck.Status)
	}
}

func TestHandleHealth_MultipleFailures(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockDB.SetShouldFail(true)
	mockRedis := &MockRedisService{}
	mockRedis.SetShouldFail(true)
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, status)
	}

	// Parse response
	var response model.HealthResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check overall status
	if response.Status != "unhealthy" {
		t.Errorf("Expected overall status 'unhealthy', got %s", response.Status)
	}

	// Check that both failed services are marked as unhealthy
	dbCheck := response.Checks["database"]
	if dbCheck.Status != "unhealthy" {
		t.Errorf("Expected database status 'unhealthy', got %s", dbCheck.Status)
	}

	redisCheck := response.Checks["redis"]
	if redisCheck.Status != "unhealthy" {
		t.Errorf("Expected redis status 'unhealthy', got %s", redisCheck.Status)
	}

	// But AI service should still be healthy
	aiCheck := response.Checks["ai_service"]
	if aiCheck.Status != "healthy" {
		t.Errorf("Expected ai_service status 'healthy', got %s", aiCheck.Status)
	}
}

func TestHandleReadiness(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/ready", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleReadiness(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	// Parse response
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check response fields
	if response["status"] != "ready" {
		t.Errorf("Expected status 'ready', got %s", response["status"])
	}

	if response["service"] != "ai-svc" {
		t.Errorf("Expected service 'ai-svc', got %s", response["service"])
	}

	// Check that checks exist
	checks, exists := response["checks"].(map[string]interface{})
	if !exists {
		t.Fatal("Expected checks to exist in response")
	}

	if len(checks) != 2 {
		t.Errorf("Expected 2 readiness checks, got %d", len(checks))
	}
}

func TestHandleReadiness_NotReady(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockDB.SetShouldFail(true) // Database not ready
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/ready", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleReadiness(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, status)
	}

	// Parse response
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check response fields
	if response["status"] != "not_ready" {
		t.Errorf("Expected status 'not_ready', got %s", response["status"])
	}
}

func TestHandleLiveness(t *testing.T) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	req, err := http.NewRequest("GET", "/live", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler.HandleLiveness(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	// Parse response
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Check response fields
	if response["status"] != "alive" {
		t.Errorf("Expected status 'alive', got %s", response["status"])
	}

	if response["service"] != "ai-svc" {
		t.Errorf("Expected service 'ai-svc', got %s", response["service"])
	}

	// Check timestamp exists and is recent
	timestampStr, exists := response["timestamp"].(string)
	if !exists {
		t.Fatal("Expected timestamp to exist")
	}

	timestamp, err := time.Parse(time.RFC3339, timestampStr)
	if err != nil {
		t.Fatalf("Failed to parse timestamp: %v", err)
	}

	if time.Since(timestamp) > time.Minute {
		t.Error("Expected timestamp to be recent")
	}
}

func TestHandleHealth_Timeout(t *testing.T) {
	// Create a mock service that takes longer than the timeout
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil).With().Timestamp().Logger()

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	// Create a request with a short timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req = req.WithContext(ctx)

	// Wait for context to timeout
	time.Sleep(2 * time.Millisecond)

	rr := httptest.NewRecorder()
	handler.HandleHealth(rr, req)

	// The handler should still complete, but may have timeout-related issues
	// This test primarily ensures the handler can deal with context timeouts
	if rr.Code != http.StatusOK && rr.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 200 or 503, got %d", rr.Code)
	}
}

func BenchmarkHandleHealth(b *testing.B) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil)

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest("GET", "/health", nil)
			rr := httptest.NewRecorder()
			handler.HandleHealth(rr, req)

			if rr.Code != http.StatusOK {
				b.Errorf("Expected status 200, got %d", rr.Code)
			}
		}
	})
}

func BenchmarkHandleLiveness(b *testing.B) {
	mockDB := &MockDatabaseService{}
	mockRedis := &MockRedisService{}
	mockAI := &MockAIService{}
	logger := zerolog.New(nil)

	handler := NewHealthHandler(mockDB, mockRedis, mockAI, &logger)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest("GET", "/live", nil)
			rr := httptest.NewRecorder()
			handler.HandleLiveness(rr, req)

			if rr.Code != http.StatusOK {
				b.Errorf("Expected status 200, got %d", rr.Code)
			}
		}
	})
}
