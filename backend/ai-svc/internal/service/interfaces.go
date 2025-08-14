package service

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/ai-svc/internal/model"
)

// DatabaseService defines the interface for database operations
type DatabaseService interface {
	Health(ctx context.Context) error
	Close() error
}

// RedisService defines the interface for Redis operations
type RedisService interface {
	Health(ctx context.Context) error
	Set(ctx context.Context, key string, value interface{}, expiration int) error
	Get(ctx context.Context, key string) (string, error)
	Delete(ctx context.Context, key string) error
	Close() error
}

// AIService defines the interface for AI operations
type AIService interface {
	Health(ctx context.Context) error
	ProcessRequest(ctx context.Context, request *model.CreateAIRequestPayload, userID uuid.UUID) (*model.AIResponse, error)
	GetSupportedModels() []string
	ValidateModel(model string) bool
}

// ConversationService defines the interface for conversation management
type ConversationService interface {
	CreateConversation(ctx context.Context, payload *model.CreateConversationPayload, userID uuid.UUID) (*model.AIConversation, error)
	GetConversation(ctx context.Context, conversationID, userID uuid.UUID) (*model.AIConversation, error)
	UpdateConversation(ctx context.Context, conversationID uuid.UUID, payload *model.UpdateConversationPayload, userID uuid.UUID) (*model.AIConversation, error)
	DeleteConversation(ctx context.Context, conversationID, userID uuid.UUID) error
	ListConversations(ctx context.Context, userID uuid.UUID, page, limit int) (*model.ListConversationsResponse, error)
}

// RequestService defines the interface for AI request management
type RequestService interface {
	CreateRequest(ctx context.Context, payload *model.CreateAIRequestPayload, userID uuid.UUID) (*model.AIRequest, error)
	GetRequest(ctx context.Context, requestID, userID uuid.UUID) (*model.AIRequest, error)
	GetRequestWithResponse(ctx context.Context, requestID, userID uuid.UUID) (*model.AIRequest, *model.AIResponse, error)
	UpdateRequestStatus(ctx context.Context, requestID uuid.UUID, status model.AIRequestStatus) error
	ListRequests(ctx context.Context, userID uuid.UUID, conversationID *uuid.UUID, page, limit int) (*model.ListRequestsResponse, error)
}

// UsageStatsService defines the interface for usage statistics
type UsageStatsService interface {
	RecordUsage(ctx context.Context, userID uuid.UUID, tokensUsed int, cost float64, model, provider string) error
	GetUserUsage(ctx context.Context, userID uuid.UUID, startDate, endDate string) ([]model.AIUsageStats, error)
	GetUsageByModel(ctx context.Context, userID uuid.UUID, model string, startDate, endDate string) (*model.AIUsageStats, error)
}

// CacheService defines the interface for caching operations
type CacheService interface {
	Health(ctx context.Context) error
	Close() error
}

// ChatService defines the interface for chat service operations
type ChatService interface {
	GetRecentMessages(ctx context.Context, conversationID uuid.UUID, limit int) (*ChatMessage, error)
	Health(ctx context.Context) error
	UpdateJWTToken(token string)
}

// ChatMessage represents a message from the chat service
type ChatMessage struct {
	ID             uuid.UUID  `json:"id"`
	ConversationID uuid.UUID  `json:"conversation_id"`
	UserID         uuid.UUID  `json:"user_id"`
	Content        string     `json:"content"`
	MessageType    string     `json:"message_type"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// PrivacyService defines the interface for privacy and consent management
type PrivacyService interface {
	// User Consent Management
	GetUserConsent(ctx context.Context, userID uuid.UUID) (*model.UserConsent, error)
	UpdateUserConsent(ctx context.Context, userID uuid.UUID, request *model.ConsentRequest, ipAddress, userAgent string) (*model.ConsentResponse, error)
	HasAIProcessingConsent(ctx context.Context, userID uuid.UUID) (bool, error)
	HasDataAnonymizationConsent(ctx context.Context, userID uuid.UUID) (bool, error)
	RevokeAllConsent(ctx context.Context, userID uuid.UUID, ipAddress, userAgent string) error
	
	// Privacy Policy Management
	GetActivePrivacyPolicyVersion(ctx context.Context) (*model.PrivacyPolicyVersion, error)
	
	// Audit Logging
	LogAction(ctx context.Context, log *PrivacyAuditLogRequest) error
	GetUserAuditLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.AuditLog, int64, error)
	GetAuditLogsByAction(ctx context.Context, action string, limit, offset int) ([]model.AuditLog, int64, error)
	CleanupExpiredLogs(ctx context.Context) (int64, error)
	
	// Consent Checking (for middleware/validation)
	CheckAIProcessingConsent(userID uuid.UUID) error
	CheckDataAnonymizationConsent(userID uuid.UUID) error
	ExtractUserIDFromRequest(r *http.Request) (uuid.UUID, error)
}

// PrivacyAuditLogRequest represents a request to log an audit event for privacy compliance
type PrivacyAuditLogRequest struct {
	UserID       *uuid.UUID
	Action       string
	ResourceType string
	ResourceID   *uuid.UUID
	Details      map[string]interface{}
	IPAddress    *string
	UserAgent    *string
	SessionID    *string
	ExpiresAt    *time.Time // Optional custom expiration
}
