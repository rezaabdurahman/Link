package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/ai-svc/internal/config"
	"github.com/rs/zerolog"
)

func TestClient_GetRecentMessages(t *testing.T) {
	conversationID := uuid.New()
	messages := []ChatMessage{
		{
			ID:             uuid.New(),
			ConversationID: conversationID,
			UserID:         uuid.New(),
			Content:        "Hello, world!",
			MessageType:    "user",
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
	}

	response := GetMessagesResponse{
		Messages:   messages,
		TotalCount: 1,
		HasMore:    false,
	}

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Validate request
		expectedPath := fmt.Sprintf("/api/v1/chat/conversations/%s/messages", conversationID.String())
		if r.URL.Path != expectedPath {
			t.Errorf("Expected path %s, got %s", expectedPath, r.URL.Path)
		}

		if r.URL.Query().Get("limit") != "10" {
			t.Errorf("Expected limit 10, got %s", r.URL.Query().Get("limit"))
		}

		// Check authorization header
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-jwt-token" {
			t.Errorf("Expected Bearer test-jwt-token, got %s", auth)
		}

		// Return mock response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Create client
	cfg := config.ChatServiceConfig{
		BaseURL:                server.URL,
		Timeout:                5 * time.Second,
		MaxRetries:             2,
		RetryDelay:             100 * time.Millisecond,
		RetryBackoffMultiplier: 2.0,
		CircuitBreakerEnabled:  false,
	}

	client := NewClient(ClientConfig{
		Config:   cfg,
		Logger:   zerolog.Nop(),
		JWTToken: "test-jwt-token",
	})

	// Test successful request
	result, err := client.GetRecentMessages(context.Background(), conversationID, 10)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(result.Messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(result.Messages))
	}

	if result.Messages[0].Content != "Hello, world!" {
		t.Errorf("Expected 'Hello, world!', got %s", result.Messages[0].Content)
	}
}

func TestClient_GetRecentMessages_WithRetry(t *testing.T) {
	conversationID := uuid.New()
	callCount := 0

	// Create test server that fails first time
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// Return success on second call
		response := GetMessagesResponse{
			Messages:   []ChatMessage{},
			TotalCount: 0,
			HasMore:    false,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Create client with retry enabled
	cfg := config.ChatServiceConfig{
		BaseURL:                server.URL,
		Timeout:                5 * time.Second,
		MaxRetries:             2,
		RetryDelay:             10 * time.Millisecond,
		RetryBackoffMultiplier: 2.0,
		CircuitBreakerEnabled:  false,
	}

	client := NewClient(ClientConfig{
		Config:   cfg,
		Logger:   zerolog.Nop(),
		JWTToken: "test-jwt-token",
	})

	// Test retry functionality
	_, err := client.GetRecentMessages(context.Background(), conversationID, 10)
	if err != nil {
		t.Fatalf("Expected no error after retry, got %v", err)
	}

	if callCount != 2 {
		t.Errorf("Expected 2 calls (1 failure + 1 retry), got %d", callCount)
	}
}

func TestClient_GetRecentMessages_WithCircuitBreaker(t *testing.T) {
	conversationID := uuid.New()
	callCount := 0

	// Create test server that always fails
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	// Create client with circuit breaker enabled
	cfg := config.ChatServiceConfig{
		BaseURL:                server.URL,
		Timeout:                5 * time.Second,
		MaxRetries:             1,
		RetryDelay:             10 * time.Millisecond,
		RetryBackoffMultiplier: 2.0,
		CircuitBreakerEnabled:  true,
		CircuitBreakerTimeout:  100 * time.Millisecond,
		CircuitBreakerMaxFails: 2,
	}

	client := NewClient(ClientConfig{
		Config:   cfg,
		Logger:   zerolog.Nop(),
		JWTToken: "test-jwt-token",
	})

	// First request should fail and trigger retry
	_, err := client.GetRecentMessages(context.Background(), conversationID, 10)
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	// Second request should fail and open circuit breaker
	_, err = client.GetRecentMessages(context.Background(), conversationID, 10)
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	// Third request should be rejected by circuit breaker
	_, err = client.GetRecentMessages(context.Background(), conversationID, 10)
	if err != ErrCircuitBreakerOpen {
		t.Errorf("Expected circuit breaker open error, got %v", err)
	}

	// Verify circuit breaker state
	state := client.GetCircuitBreakerState()
	if state != CircuitBreakerOpen {
		t.Errorf("Expected circuit breaker to be open, got %s", state.String())
	}
}

func TestClient_Health(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Errorf("Expected path /health, got %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create client
	cfg := config.ChatServiceConfig{
		BaseURL:               server.URL,
		Timeout:               5 * time.Second,
		CircuitBreakerEnabled: false,
	}

	client := NewClient(ClientConfig{
		Config:   cfg,
		Logger:   zerolog.Nop(),
		JWTToken: "test-jwt-token",
	})

	// Test health check
	err := client.Health(context.Background())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestCircuitBreaker_States(t *testing.T) {
	config := CircuitBreakerConfig{
		MaxFailures: 2,
		Timeout:     100 * time.Millisecond,
	}

	cb := NewCircuitBreaker(config)

	// Initial state should be closed
	if cb.GetState() != CircuitBreakerClosed {
		t.Errorf("Expected initial state to be closed, got %s", cb.GetState().String())
	}

	// Record failures to open circuit
	cb.recordFailure()
	if cb.GetState() != CircuitBreakerClosed {
		t.Errorf("Expected state to remain closed after 1 failure, got %s", cb.GetState().String())
	}

	cb.recordFailure()
	if cb.GetState() != CircuitBreakerOpen {
		t.Errorf("Expected state to be open after 2 failures, got %s", cb.GetState().String())
	}

	// Wait for timeout
	time.Sleep(150 * time.Millisecond)

	// Circuit should move to half-open on next execution attempt
	err := cb.Execute(context.Background(), func() error {
		return nil // Success
	})
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if cb.GetState() != CircuitBreakerClosed {
		t.Errorf("Expected state to be closed after successful execution, got %s", cb.GetState().String())
	}
}

func TestRetryer_Execute(t *testing.T) {
	config := RetryConfig{
		MaxRetries:         2,
		InitialDelay:       10 * time.Millisecond,
		BackoffMultiplier:  2.0,
		Jitter:            false,
	}

	retryer := NewRetryer(config)

	// Test successful execution
	callCount := 0
	err := retryer.Execute(context.Background(), func() error {
		callCount++
		return nil
	})

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if callCount != 1 {
		t.Errorf("Expected 1 call, got %d", callCount)
	}

	// Test retry on failure then success
	callCount = 0
	err = retryer.Execute(context.Background(), func() error {
		callCount++
		if callCount == 1 {
			return fmt.Errorf("temporary failure")
		}
		return nil
	})

	if err != nil {
		t.Errorf("Expected no error after retry, got %v", err)
	}

	if callCount != 2 {
		t.Errorf("Expected 2 calls, got %d", callCount)
	}
}
