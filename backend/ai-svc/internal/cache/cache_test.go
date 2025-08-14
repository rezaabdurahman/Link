package cache

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/config"
)

func TestMemoryCache(t *testing.T) {
	// Create test configuration
	cfg := &config.RedisConfig{
		SummaryTTL: time.Hour,
	}

	// Create logger
	logger := zerolog.New(zerolog.NewTestWriter(t)).With().Timestamp().Logger()

	// Create memory cache
	cache, err := NewMemoryCache(cfg, logger)
	if err != nil {
		t.Fatalf("Failed to create memory cache: %v", err)
	}
	defer cache.Close()

	ctx := context.Background()

	// Test health check
	if err := cache.Health(ctx); err != nil {
		t.Errorf("Health check failed: %v", err)
	}

	// Test data
	conversationID := uuid.New()
	summaryID := uuid.New().String()
	key := "test-summary-key"

	summary := &Summary{
		ID:             summaryID,
		ConversationID: conversationID,
		Content:        "This is a test summary",
		Metadata: map[string]interface{}{
			"model": "gpt-4",
			"tokens": 150,
		},
		CreatedAt: time.Now(),
	}

	// Test SetSummary
	if err := cache.SetSummary(ctx, key, summary); err != nil {
		t.Errorf("Failed to set summary: %v", err)
	}

	// Test GetSummary
	retrievedSummary, err := cache.GetSummary(ctx, key)
	if err != nil {
		t.Errorf("Failed to get summary: %v", err)
	}

	if retrievedSummary.ID != summary.ID {
		t.Errorf("Expected summary ID %s, got %s", summary.ID, retrievedSummary.ID)
	}

	if retrievedSummary.Content != summary.Content {
		t.Errorf("Expected content %s, got %s", summary.Content, retrievedSummary.Content)
	}

	// Test getting non-existent key
	_, err = cache.GetSummary(ctx, "non-existent-key")
	if err == nil {
		t.Error("Expected error for non-existent key")
	}

	// Test InvalidateByConversation
	if err := cache.InvalidateByConversation(ctx, conversationID); err != nil {
		t.Errorf("Failed to invalidate by conversation: %v", err)
	}

	// Verify summary was invalidated
	_, err = cache.GetSummary(ctx, key)
	if err == nil {
		t.Error("Expected error after invalidation")
	}
}

func TestKeyBuilder(t *testing.T) {
	kb := NewKeyBuilder()

	conversationID := uuid.New()
	userID := uuid.New()
	requestID := "test-request-123"

	// Test BuildSummaryKey
	summaryKey := kb.BuildSummaryKey(conversationID, requestID)
	expected := conversationID.String() + ":" + requestID
	if summaryKey != expected {
		t.Errorf("Expected %s, got %s", expected, summaryKey)
	}

	// Test BuildConversationSummaryKey
	convKey := kb.BuildConversationSummaryKey(conversationID)
	expected = "conversation:" + conversationID.String()
	if convKey != expected {
		t.Errorf("Expected %s, got %s", expected, convKey)
	}

	// Test BuildUserSummaryKey
	userKey := kb.BuildUserSummaryKey(userID, conversationID)
	expected = "user:" + userID.String() + ":conversation:" + conversationID.String()
	if userKey != expected {
		t.Errorf("Expected %s, got %s", expected, userKey)
	}
}

func TestCacheExpiration(t *testing.T) {
	// Create test configuration with short TTL
	cfg := &config.RedisConfig{
		SummaryTTL: 100 * time.Millisecond,
	}

	// Create logger
	logger := zerolog.New(zerolog.NewTestWriter(t)).With().Timestamp().Logger()

	// Create memory cache
	cache, err := NewMemoryCache(cfg, logger)
	if err != nil {
		t.Fatalf("Failed to create memory cache: %v", err)
	}
	defer cache.Close()

	ctx := context.Background()

	// Test data
	conversationID := uuid.New()
	summaryID := uuid.New().String()
	key := "test-expiry-key"

	summary := &Summary{
		ID:             summaryID,
		ConversationID: conversationID,
		Content:        "This summary will expire",
		CreatedAt:      time.Now(),
	}

	// Set summary
	if err := cache.SetSummary(ctx, key, summary); err != nil {
		t.Errorf("Failed to set summary: %v", err)
	}

	// Verify it exists immediately
	_, err = cache.GetSummary(ctx, key)
	if err != nil {
		t.Errorf("Failed to get summary immediately: %v", err)
	}

	// Wait for expiration
	time.Sleep(150 * time.Millisecond)

	// Verify it's expired
	_, err = cache.GetSummary(ctx, key)
	if err == nil {
		t.Error("Expected error for expired summary")
	}
}
