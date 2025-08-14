package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// SummaryCache defines the interface for summary caching operations
type SummaryCache interface {
	// GetSummary retrieves a cached summary by key
	GetSummary(ctx context.Context, key string) (*Summary, error)
	
	// SetSummary stores a summary in cache with TTL
	SetSummary(ctx context.Context, key string, summary *Summary) error
	
	// InvalidateByConversation removes all summaries related to a conversation
	InvalidateByConversation(ctx context.Context, conversationID uuid.UUID) error
	
	// Health checks the health of the cache
	Health(ctx context.Context) error
	
	// Close closes the cache connection
	Close() error
}

// Summary represents a cached summary
type Summary struct {
	ID             string                 `json:"id"`
	ConversationID uuid.UUID              `json:"conversation_id"`
	Content        string                 `json:"content"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	ExpiresAt      time.Time              `json:"expires_at"`
}

// CacheError represents cache-specific errors
type CacheError struct {
	Operation string
	Err       error
}

func (e *CacheError) Error() string {
	return "cache " + e.Operation + " failed: " + e.Err.Error()
}

func (e *CacheError) Unwrap() error {
	return e.Err
}

// Common cache errors
var (
	ErrCacheNotFound    = &CacheError{Operation: "get", Err: ErrNotFound}
	ErrCacheUnavailable = &CacheError{Operation: "connection", Err: ErrUnavailable}
)

// Base errors
var (
	ErrNotFound    = fmt.Errorf("not found")
	ErrUnavailable = fmt.Errorf("service unavailable")
)
