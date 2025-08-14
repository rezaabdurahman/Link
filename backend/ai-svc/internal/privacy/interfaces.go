package privacy

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/ai-svc/internal/model"
)

// ConsentService defines the interface for user consent management
type ConsentService interface {
	// GetUserConsent retrieves the current consent settings for a user
	GetUserConsent(ctx context.Context, userID uuid.UUID) (*model.UserConsent, error)
	
	// UpdateUserConsent updates consent settings for a user
	UpdateUserConsent(ctx context.Context, userID uuid.UUID, request *model.ConsentRequest, ipAddress, userAgent string) (*model.ConsentResponse, error)
	
	// HasAIProcessingConsent checks if user has given consent for AI processing
	HasAIProcessingConsent(ctx context.Context, userID uuid.UUID) (bool, error)
	
	// HasDataAnonymizationConsent checks if user has given consent for data anonymization
	HasDataAnonymizationConsent(ctx context.Context, userID uuid.UUID) (bool, error)
	
	// RevokeAllConsent revokes all consent for a user (GDPR right to withdraw)
	RevokeAllConsent(ctx context.Context, userID uuid.UUID, ipAddress, userAgent string) error
	
	// GetActivePrivacyPolicyVersion gets the current active privacy policy version
	GetActivePrivacyPolicyVersion(ctx context.Context) (*model.PrivacyPolicyVersion, error)
}

// AuditService defines the interface for audit logging
type AuditService interface {
	// LogAction logs an action for audit purposes
	LogAction(ctx context.Context, log *AuditLogRequest) error
	
	// GetUserAuditLogs retrieves audit logs for a specific user
	GetUserAuditLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.AuditLog, int64, error)
	
	// GetAuditLogsByAction retrieves audit logs filtered by action type
	GetAuditLogsByAction(ctx context.Context, action string, limit, offset int) ([]model.AuditLog, int64, error)
	
	// CleanupExpiredLogs removes expired audit logs (typically called by scheduled job)
	CleanupExpiredLogs(ctx context.Context) (int64, error)
}

// AnonymizationService defines the interface for data anonymization
type AnonymizationService interface {
	// AnonymizeText anonymizes sensitive data in text
	AnonymizeText(ctx context.Context, userID uuid.UUID, text string, options *AnonymizationOptions) (*AnonymizationResult, error)
	
	// AnonymizeUserData anonymizes specific user data fields
	AnonymizeUserData(ctx context.Context, userID uuid.UUID, data map[string]string, options *AnonymizationOptions) (*AnonymizationResult, error)
	
	// GetAnonymizationRecord retrieves anonymization record for tracking
	GetAnonymizationRecord(ctx context.Context, userID uuid.UUID, originalDataHash string) (*model.DataAnonymizationRecord, error)
	
	// CreateAnonymizationRecord creates a record of anonymization operation
	CreateAnonymizationRecord(ctx context.Context, record *model.DataAnonymizationRecord) error
}

// AuditLogRequest represents a request to log an audit event
type AuditLogRequest struct {
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

// AnonymizationResult represents the result of an anonymization operation
type AnonymizationResult struct {
	OriginalText      string
	AnonymizedText    string
	FieldsAnonymized  []string
	OriginalDataHash  string
	AnonymizedDataHash string
	AnonymizationMethod string
	ProcessedAt       time.Time
}

// ConsentChecker provides utility methods for checking consent
type ConsentChecker interface {
	// CheckAIProcessingConsent middleware-like function to check AI processing consent
	CheckAIProcessingConsent(userID uuid.UUID) error
	
	// CheckDataAnonymizationConsent checks if user consents to data anonymization
	CheckDataAnonymizationConsent(userID uuid.UUID) error
	
	// ExtractUserIDFromRequest extracts user ID from HTTP request (JWT or headers)
	ExtractUserIDFromRequest(r *http.Request) (uuid.UUID, error)
}

// PrivacyService combines all privacy-related services
type PrivacyService interface {
	ConsentService
	AuditService
	AnonymizationService
	ConsentChecker
}
