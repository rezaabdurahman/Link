package model

import (
	"time"

	"github.com/google/uuid"
)

// AIRequest represents a request to the AI service
type AIRequest struct {
	ID            uuid.UUID `json:"id" db:"id"`
	UserID        uuid.UUID `json:"user_id" db:"user_id"`
	ConversationID *uuid.UUID `json:"conversation_id,omitempty" db:"conversation_id"`
	Prompt        string    `json:"prompt" db:"prompt"`
	Model         string    `json:"model" db:"model"`
	MaxTokens     int       `json:"max_tokens" db:"max_tokens"`
	Temperature   float64   `json:"temperature" db:"temperature"`
	SystemPrompt  *string   `json:"system_prompt,omitempty" db:"system_prompt"`
	Status        string    `json:"status" db:"status"` // pending, processing, completed, failed
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// AIResponse represents a response from the AI service
type AIResponse struct {
	ID              uuid.UUID `json:"id" db:"id"`
	RequestID       uuid.UUID `json:"request_id" db:"request_id"`
	Response        string    `json:"response" db:"response"`
	TokensUsed      int       `json:"tokens_used" db:"tokens_used"`
	Model           string    `json:"model" db:"model"`
	Provider        string    `json:"provider" db:"provider"`
	ProcessingTime  int64     `json:"processing_time_ms" db:"processing_time_ms"` // in milliseconds
	Error           *string   `json:"error,omitempty" db:"error"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

// AIConversation represents an AI conversation context
type AIConversation struct {
	ID          uuid.UUID `json:"id" db:"id"`
	UserID      uuid.UUID `json:"user_id" db:"user_id"`
	Title       string    `json:"title" db:"title"`
	SystemPrompt *string  `json:"system_prompt,omitempty" db:"system_prompt"`
	Model       string    `json:"model" db:"model"`
	Status      string    `json:"status" db:"status"` // active, archived, deleted
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// AIUsageStats represents usage statistics for AI services
type AIUsageStats struct {
	ID               uuid.UUID `json:"id" db:"id"`
	UserID           uuid.UUID `json:"user_id" db:"user_id"`
	Date             time.Time `json:"date" db:"date"`
	RequestCount     int       `json:"request_count" db:"request_count"`
	TokensUsed       int       `json:"tokens_used" db:"tokens_used"`
	TotalCost        float64   `json:"total_cost" db:"total_cost"`
	Model            string    `json:"model" db:"model"`
	Provider         string    `json:"provider" db:"provider"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// CreateAIRequestPayload represents the payload for creating an AI request
type CreateAIRequestPayload struct {
	ConversationID *uuid.UUID `json:"conversation_id,omitempty"`
	Prompt         string     `json:"prompt" validate:"required,min=1,max=10000"`
	Model          *string    `json:"model,omitempty"`
	MaxTokens      *int       `json:"max_tokens,omitempty"`
	Temperature    *float64   `json:"temperature,omitempty"`
	SystemPrompt   *string    `json:"system_prompt,omitempty"`
}

// CreateConversationPayload represents the payload for creating a conversation
type CreateConversationPayload struct {
	Title        string  `json:"title" validate:"required,min=1,max=255"`
	SystemPrompt *string `json:"system_prompt,omitempty"`
	Model        *string `json:"model,omitempty"`
}

// UpdateConversationPayload represents the payload for updating a conversation
type UpdateConversationPayload struct {
	Title        *string `json:"title,omitempty" validate:"omitempty,min=1,max=255"`
	SystemPrompt *string `json:"system_prompt,omitempty"`
	Status       *string `json:"status,omitempty" validate:"omitempty,oneof=active archived deleted"`
}

// AIRequestStatus represents the possible statuses of an AI request
type AIRequestStatus string

const (
	StatusPending    AIRequestStatus = "pending"
	StatusProcessing AIRequestStatus = "processing"
	StatusCompleted  AIRequestStatus = "completed"
	StatusFailed     AIRequestStatus = "failed"
)

// ConversationStatus represents the possible statuses of a conversation
type ConversationStatus string

const (
	ConversationActive   ConversationStatus = "active"
	ConversationArchived ConversationStatus = "archived"
	ConversationDeleted  ConversationStatus = "deleted"
)

// MessageRole represents the role of a message sender
type MessageRole string

const (
	RoleUser      MessageRole = "user"
	RoleAssistant MessageRole = "assistant"
	RoleSystem    MessageRole = "system"
)

// TokenUsage represents token usage statistics
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
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

// ErrorResponse represents a standard error response
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message"`
	Code    string            `json:"code,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}

// PaginationResponse represents pagination metadata
type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalCount int64 `json:"total_count"`
	TotalPages int   `json:"total_pages"`
	HasNext    bool  `json:"has_next"`
	HasPrev    bool  `json:"has_prev"`
}

// ListConversationsResponse represents the response for listing conversations
type ListConversationsResponse struct {
	Conversations []AIConversation   `json:"conversations"`
	Pagination    PaginationResponse `json:"pagination"`
}

// ListRequestsResponse represents the response for listing AI requests
type ListRequestsResponse struct {
	Requests   []AIRequest        `json:"requests"`
	Pagination PaginationResponse `json:"pagination"`
}

// UserConsent represents user consent preferences
type UserConsent struct {
	ID                        uuid.UUID  `json:"id" db:"id"`
	UserID                    uuid.UUID  `json:"user_id" db:"user_id"`
	AIProcessingConsent       bool       `json:"ai_processing_consent" db:"ai_processing_consent"`
	DataAnonymizationConsent  bool       `json:"data_anonymization_consent" db:"data_anonymization_consent"`
	AnalyticsConsent          bool       `json:"analytics_consent" db:"analytics_consent"`
	MarketingConsent          bool       `json:"marketing_consent" db:"marketing_consent"`
	ConsentVersion            string     `json:"consent_version" db:"consent_version"`
	ConsentGivenAt            *time.Time `json:"consent_given_at,omitempty" db:"consent_given_at"`
	ConsentWithdrawnAt        *time.Time `json:"consent_withdrawn_at,omitempty" db:"consent_withdrawn_at"`
	IPAddress                 *string    `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent                 *string    `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt                 time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time  `json:"updated_at" db:"updated_at"`
}

// AuditLog represents an audit log entry for GDPR/CCPA compliance
type AuditLog struct {
	ID           uuid.UUID              `json:"id" db:"id"`
	UserID       *uuid.UUID             `json:"user_id,omitempty" db:"user_id"`
	Action       string                 `json:"action" db:"action"`
	ResourceType string                 `json:"resource_type" db:"resource_type"`
	ResourceID   *uuid.UUID             `json:"resource_id,omitempty" db:"resource_id"`
	Details      map[string]interface{} `json:"details,omitempty" db:"details"`
	IPAddress    *string                `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent    *string                `json:"user_agent,omitempty" db:"user_agent"`
	SessionID    *string                `json:"session_id,omitempty" db:"session_id"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
	ExpiresAt    time.Time              `json:"expires_at" db:"expires_at"`
}

// PrivacyPolicyVersion represents a version of the privacy policy
type PrivacyPolicyVersion struct {
	ID            uuid.UUID `json:"id" db:"id"`
	Version       string    `json:"version" db:"version"`
	Content       string    `json:"content" db:"content"`
	EffectiveDate time.Time `json:"effective_date" db:"effective_date"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	IsActive      bool      `json:"is_active" db:"is_active"`
}

// DataAnonymizationRecord tracks data anonymization operations
type DataAnonymizationRecord struct {
	ID                    uuid.UUID `json:"id" db:"id"`
	UserID                uuid.UUID `json:"user_id" db:"user_id"`
	OriginalDataHash      string    `json:"original_data_hash" db:"original_data_hash"`
	AnonymizedDataHash    string    `json:"anonymized_data_hash" db:"anonymized_data_hash"`
	AnonymizationMethod   string    `json:"anonymization_method" db:"anonymization_method"`
	FieldsAnonymized      []string  `json:"fields_anonymized" db:"fields_anonymized"`
	AnonymizedAt          time.Time `json:"anonymized_at" db:"anonymized_at"`
}

// ConsentRequest represents a request to update user consent
type ConsentRequest struct {
	AIProcessingConsent      *bool `json:"ai_processing_consent,omitempty" validate:"omitempty"`
	DataAnonymizationConsent *bool `json:"data_anonymization_consent,omitempty" validate:"omitempty"`
	AnalyticsConsent         *bool `json:"analytics_consent,omitempty" validate:"omitempty"`
	MarketingConsent         *bool `json:"marketing_consent,omitempty" validate:"omitempty"`
}

// ConsentResponse represents the response for consent operations
type ConsentResponse struct {
	UserID                   uuid.UUID  `json:"user_id"`
	AIProcessingConsent      bool       `json:"ai_processing_consent"`
	DataAnonymizationConsent bool       `json:"data_anonymization_consent"`
	AnalyticsConsent         bool       `json:"analytics_consent"`
	MarketingConsent         bool       `json:"marketing_consent"`
	ConsentVersion           string     `json:"consent_version"`
	ConsentGivenAt           *time.Time `json:"consent_given_at,omitempty"`
	ConsentWithdrawnAt       *time.Time `json:"consent_withdrawn_at,omitempty"`
	UpdatedAt                time.Time  `json:"updated_at"`
}

// AnonymizedData represents anonymized user data
type AnonymizedData struct {
	Original   string `json:"-"`
	Anonymized string `json:"anonymized"`
}

// AuditLogAction constants for common actions
const (
	AuditActionConsentGiven          = "CONSENT_GIVEN"
	AuditActionConsentWithdrawn      = "CONSENT_WITHDRAWN"
	AuditActionConsentUpdated        = "CONSENT_UPDATED"
	AuditActionDataAnonymized        = "DATA_ANONYMIZED"
	AuditActionDataAccessed          = "DATA_ACCESSED"
	AuditActionDataDeleted           = "DATA_DELETED"
	AuditActionAIRequestProcessed    = "AI_REQUEST_PROCESSED"
	AuditActionUserProfileAccessed   = "USER_PROFILE_ACCESSED"
	AuditActionSystemAccess          = "SYSTEM_ACCESS"
	AuditActionComplianceCheck       = "COMPLIANCE_CHECK"
	AuditActionMessagesSummarized    = "MESSAGES_SUMMARIZED"
)

// SummarizeRequest represents a request to summarize messages
type SummarizeRequest struct {
	ConversationID uuid.UUID `json:"conversation_id" validate:"required"`
	Limit          *int      `json:"limit,omitempty" validate:"omitempty,min=1,max=100"` // Default 15 if not specified
}

// SummarizeResponse represents the response from summarization
type SummarizeResponse struct {
	ID             string                 `json:"id"`
	ConversationID uuid.UUID              `json:"conversation_id"`
	Summary        string                 `json:"summary"`
	MessageCount   int                    `json:"message_count"`
	TokensUsed     int                    `json:"tokens_used"`
	Model          string                 `json:"model"`
	ProcessingTime time.Duration          `json:"processing_time"`
	CachedResult   bool                   `json:"cached_result"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
}
