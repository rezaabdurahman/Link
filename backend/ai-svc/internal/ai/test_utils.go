package ai

import (
	"context"

	"github.com/google/uuid"

	"github.com/link-app/ai-svc/internal/cache"
)

// MockSummaryCache implements cache.SummaryCache for testing
type MockSummaryCache struct {
	summaries map[string]*cache.Summary
}

// NewMockSummaryCache creates a new mock cache
func NewMockSummaryCache() *MockSummaryCache {
	return &MockSummaryCache{
		summaries: make(map[string]*cache.Summary),
	}
}

func (m *MockSummaryCache) GetSummary(ctx context.Context, key string) (*cache.Summary, error) {
	if summary, exists := m.summaries[key]; exists {
		return summary, nil
	}
	return nil, &cache.CacheError{Operation: "get", Err: cache.ErrNotFound}
}

func (m *MockSummaryCache) SetSummary(ctx context.Context, key string, summary *cache.Summary) error {
	m.summaries[key] = summary
	return nil
}

func (m *MockSummaryCache) InvalidateByConversation(ctx context.Context, conversationID uuid.UUID) error {
	// For testing, we'll just clear all summaries
	m.summaries = make(map[string]*cache.Summary)
	return nil
}

func (m *MockSummaryCache) Health(ctx context.Context) error {
	return nil
}

func (m *MockSummaryCache) Close() error {
	return nil
}
