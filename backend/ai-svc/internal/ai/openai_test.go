package ai

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/config"
)

// MockSummaryCache is now defined in test_utils.go

func TestNewOpenAIService(t *testing.T) {
	cfg := &config.AIConfig{
		APIKey:      "test-api-key",
		Model:       "gpt-3.5-turbo",
		MaxTokens:   2048,
		Temperature: 0.7,
		Timeout:     30 * time.Second,
		MaxRetries:  3,
	}

	cacheService := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewOpenAIService(cfg, cacheService, logger)

	if service == nil {
		t.Fatal("Expected service to be created, got nil")
	}

	if service.config != cfg {
		t.Error("Expected config to be set correctly")
	}

	if service.cache != cacheService {
		t.Error("Expected cache service to be set correctly")
	}

	if service.anonymizer == nil {
		t.Error("Expected anonymizer to be initialized")
	}

	if service.keyBuilder == nil {
		t.Error("Expected key builder to be initialized")
	}
}

func TestGetSupportedModels(t *testing.T) {
	cfg := &config.AIConfig{
		APIKey: "test-key",
		Model:  "gpt-3.5-turbo",
	}
	
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	models := service.GetSupportedModels()
	
	expectedModels := []string{
		"gpt-4",
		"gpt-4-turbo-preview", 
		"gpt-4-1106-preview",
		"gpt-3.5-turbo",
		"gpt-3.5-turbo-1106",
		"gpt-3.5-turbo-16k",
	}
	
	if len(models) != len(expectedModels) {
		t.Errorf("Expected %d models, got %d", len(expectedModels), len(models))
	}
	
	for i, expected := range expectedModels {
		if i >= len(models) || models[i] != expected {
			t.Errorf("Expected model %s at index %d, got %s", expected, i, models[i])
		}
	}
}

func TestValidateModel(t *testing.T) {
	cfg := &config.AIConfig{APIKey: "test-key"}
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	testCases := []struct {
		model    string
		expected bool
	}{
		{"gpt-4", true},
		{"gpt-3.5-turbo", true},
		{"invalid-model", false},
		{"", false},
	}
	
	for _, tc := range testCases {
		result := service.ValidateModel(tc.model)
		if result != tc.expected {
			t.Errorf("ValidateModel(%s) = %v, expected %v", tc.model, result, tc.expected)
		}
	}
}

func TestBuildSummarizationPrompt(t *testing.T) {
	cfg := &config.AIConfig{APIKey: "test-key"}
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	messages := "User: Hello there\nAssistant: Hello! How can I help you today?"
	prompt := service.buildSummarizationPrompt(messages)
	
	if !containsString(prompt, "Summarize the following messages") {
		t.Error("Expected prompt to contain summarization instruction")
	}
	
	if !containsString(prompt, "2-3 sentences") {
		t.Error("Expected prompt to specify 2-3 sentences")
	}
	
	if !containsString(prompt, messages) {
		t.Error("Expected prompt to contain the actual messages")
	}
}

func TestLimitMessages(t *testing.T) {
	cfg := &config.AIConfig{APIKey: "test-key"}
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	// Create test messages
	messages := make([]Message, 20)
	for i := 0; i < 20; i++ {
		messages[i] = Message{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Test message",
			Role:      "user",
			CreatedAt: time.Now(),
		}
	}
	
	// Test limiting to 10 messages
	limited := service.limitMessages(messages, 10)
	if len(limited) != 10 {
		t.Errorf("Expected 10 messages, got %d", len(limited))
	}
	
	// Should return the last 10 messages (most recent)
	for i, msg := range limited {
		if msg.ID != messages[10+i].ID {
			t.Error("Expected most recent messages to be returned")
		}
	}
	
	// Test with limit larger than slice
	limited = service.limitMessages(messages[:5], 10)
	if len(limited) != 5 {
		t.Errorf("Expected 5 messages when limit > slice length, got %d", len(limited))
	}
}

func TestCalculateBackoffDelay(t *testing.T) {
	cfg := &config.AIConfig{APIKey: "test-key"}
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	config := RetryConfig{
		BaseDelay:     100 * time.Millisecond,
		MaxDelay:      10 * time.Second,
		BackoffFactor: 2.0,
	}
	
	testCases := []struct {
		attempt      int
		expectedMin  time.Duration
		expectedMax  time.Duration
	}{
		{0, 100 * time.Millisecond, 200 * time.Millisecond},
		{1, 200 * time.Millisecond, 400 * time.Millisecond},
		{2, 400 * time.Millisecond, 800 * time.Millisecond},
		{10, 10 * time.Second, 10 * time.Second}, // Should be capped at MaxDelay
	}
	
	for _, tc := range testCases {
		delay := service.calculateBackoffDelay(tc.attempt, config)
		if delay < tc.expectedMin || delay > tc.expectedMax {
			t.Errorf("For attempt %d, expected delay between %v and %v, got %v",
				tc.attempt, tc.expectedMin, tc.expectedMax, delay)
		}
	}
}

func TestIsRetryableError(t *testing.T) {
	cfg := &config.AIConfig{APIKey: "test-key"}
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	testCases := []struct {
		err      error
		expected bool
	}{
		{nil, false},
		{context.DeadlineExceeded, false},
		{context.Canceled, false},
		{createError("rate limit exceeded"), true},
		{createError("too many requests"), true},
		{createError("server error"), true},
		{createError("network connection failed"), true},
		{createError("502 bad gateway"), true},
		{createError("503 service unavailable"), true},
		{createError("504 gateway timeout"), true},
		{createError("authentication failed"), false},
		{createError("invalid request"), false},
	}
	
	for _, tc := range testCases {
		result := service.isRetryableError(tc.err)
		if result != tc.expected {
			errMsg := "nil"
			if tc.err != nil {
				errMsg = tc.err.Error()
			}
			t.Errorf("isRetryableError(%s) = %v, expected %v", errMsg, result, tc.expected)
		}
	}
}

func TestBuildCacheKey(t *testing.T) {
	cfg := &config.AIConfig{APIKey: "test-key"}
	service := NewOpenAIService(cfg, NewMockSummaryCache(), zerolog.New(nil))
	
	conversationID := uuid.New()
	messages := []Message{
		{ID: uuid.New(), CreatedAt: time.Now()},
		{ID: uuid.New(), CreatedAt: time.Now().Add(time.Minute)},
	}
	
	key1 := service.buildCacheKey(conversationID, messages, 15)
	key2 := service.buildCacheKey(conversationID, messages, 15)
	key3 := service.buildCacheKey(conversationID, messages, 10) // Different limit
	
	// Same inputs should generate same key
	if key1 != key2 {
		t.Error("Expected same cache key for same inputs")
	}
	
	// Different limit should generate different key
	if key1 == key3 {
		t.Error("Expected different cache key for different limit")
	}
	
	// Key should not be empty
	if key1 == "" {
		t.Error("Expected non-empty cache key")
	}
}

// Helper functions for tests

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || 
		(len(s) > len(substr) && 
			(s[:len(substr)] == substr || 
			 s[len(s)-len(substr):] == substr ||
			 findSubstring(s, substr))))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func createError(message string) error {
	return &TestError{message: message}
}

type TestError struct {
	message string
}

func (e *TestError) Error() string {
	return e.message
}

// Example usage function to demonstrate how to use the service
func ExampleUsage() {
	// This function demonstrates how to use the OpenAI service
	// Note: This won't run in tests as it requires actual OpenAI API key
	
	// Configuration
	cfg := &config.AIConfig{
		APIKey:      "your-openai-api-key", // Never commit real keys!
		Model:       "gpt-3.5-turbo",
		MaxTokens:   2048,
		Temperature: 0.7,
		Timeout:     30 * time.Second,
		MaxRetries:  3,
	}
	
	// Create cache service (in real usage, use Redis)
	cacheService := NewMockSummaryCache()
	
	// Create logger
	logger := zerolog.New(nil).With().Timestamp().Logger()
	
	// Create OpenAI service
	service := NewOpenAIService(cfg, cacheService, logger)
	
	// Create sample messages
	messages := []Message{
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Hi, I need help with my project",
			Role:      "user",
			CreatedAt: time.Now().Add(-10 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "I'd be happy to help! What kind of project are you working on?",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-9 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "It's a web application using Go and React. I'm having issues with CORS",
			Role:      "user",
			CreatedAt: time.Now().Add(-8 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "CORS issues are common. Let me help you configure your Go backend properly.",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-7 * time.Minute),
		},
	}
	
	// Create summarization request
	limit := 15
	request := &SummarizeRequest{
		ConversationID: uuid.New(),
		Messages:       messages,
		Limit:          &limit,
		UserID:         uuid.New(),
	}
	
	// Call summarization (would need real API key to work)
	ctx := context.Background()
	_, err := service.SummarizeMessages(ctx, request)
	if err != nil {
		// Handle error (expected in test environment without real API key)
		logger.Error().Err(err).Msg("Summarization failed (expected without real API key)")
	}
	
	// Health check
	err = service.Health(ctx)
	if err != nil {
		// Handle error (expected in test environment without real API key) 
		logger.Error().Err(err).Msg("Health check failed (expected without real API key)")
	}
	
	// Validate models
	supportedModels := service.GetSupportedModels()
	logger.Info().Strs("supported_models", supportedModels).Msg("Supported models")
	
	isValid := service.ValidateModel("gpt-4")
	logger.Info().Bool("is_valid", isValid).Msg("Model validation result")
}
