package ai

import (
	"context"

	"github.com/google/uuid"
)

// SummarizationService defines the interface for message summarization
type SummarizationService interface {
	// SummarizeMessages creates a summary of conversation messages
	SummarizeMessages(ctx context.Context, req *SummarizeRequest) (*SummarizeResponse, error)
	
	// InvalidateConversationSummaries removes cached summaries for a conversation
	InvalidateConversationSummaries(ctx context.Context, conversationID uuid.UUID) error
	
	// Health checks the health of the AI service
	Health(ctx context.Context) error
	
	// GetSupportedModels returns the list of supported AI models
	GetSupportedModels() []string
	
	// ValidateModel checks if a model is supported
	ValidateModel(model string) bool
}

// AIProvider defines the interface for AI provider implementations
type AIProvider interface {
	SummarizationService
	
	// GetProviderName returns the name of the AI provider (e.g., "openai", "anthropic")
	GetProviderName() string
	
	// GetDefaultModel returns the default model for this provider
	GetDefaultModel() string
	
	// EstimateCost estimates the cost for a given request (optional, can return 0)
	EstimateCost(tokenCount int, model string) float64
}

// AnonymizationProvider defines the interface for PII anonymization
type AnonymizationProvider interface {
	// AnonymizeText removes or redacts PII from text
	AnonymizeText(ctx context.Context, text string) (anonymizedText string, fieldsAnonymized []string, err error)
	
	// DetectPII detects PII in text without anonymizing
	DetectPII(ctx context.Context, text string) ([]PIIDetection, error)
}

// PIIDetection represents detected PII in text
type PIIDetection struct {
	Type       string `json:"type"`        // email, phone, name, etc.
	Value      string `json:"value"`       // the detected value
	StartIndex int    `json:"start_index"` // start position in text
	EndIndex   int    `json:"end_index"`   // end position in text
	Confidence float64 `json:"confidence"` // confidence score (0.0 - 1.0)
}

// CacheProvider defines the interface for caching summaries
type CacheProvider interface {
	// Get retrieves a cached summary
	Get(ctx context.Context, key string) (*SummarizeResponse, error)
	
	// Set stores a summary in cache
	Set(ctx context.Context, key string, response *SummarizeResponse, ttl int64) error
	
	// Delete removes a cached summary
	Delete(ctx context.Context, key string) error
	
	// InvalidateByPrefix removes all cached items with a given prefix
	InvalidateByPrefix(ctx context.Context, prefix string) error
}

// MetricsProvider defines the interface for metrics collection
type MetricsProvider interface {
	// RecordSummarizationRequest records a summarization request
	RecordSummarizationRequest(ctx context.Context, model string, tokenCount int, duration int64, success bool)
	
	// RecordCacheHit records a cache hit
	RecordCacheHit(ctx context.Context, cacheType string)
	
	// RecordCacheMiss records a cache miss
	RecordCacheMiss(ctx context.Context, cacheType string)
	
	// RecordError records an error
	RecordError(ctx context.Context, errorType string, errorCode string)
}

// ServiceConfig defines configuration for AI services
type ServiceConfig interface {
	// GetProvider returns the configured AI provider name
	GetProvider() string
	
	// GetModel returns the configured model name
	GetModel() string
	
	// GetMaxTokens returns the maximum tokens for requests
	GetMaxTokens() int
	
	// GetTemperature returns the temperature setting
	GetTemperature() float64
	
	// GetTimeout returns the request timeout in seconds
	GetTimeout() int
	
	// GetMaxRetries returns the maximum retry attempts
	GetMaxRetries() int
	
	// IsAnonymizationEnabled returns whether PII anonymization is enabled
	IsAnonymizationEnabled() bool
	
	// IsCachingEnabled returns whether caching is enabled
	IsCachingEnabled() bool
}
