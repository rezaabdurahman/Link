package privacy

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/model"
)

// Service implements the PrivacyService interface
type Service struct {
	db         *sqlx.DB
	logger     *zerolog.Logger
	anonymizer *Anonymizer
	jwtSecret  string
}

// NewService creates a new privacy service
func NewService(db *sqlx.DB, logger *zerolog.Logger, jwtSecret string) *Service {
	return &Service{
		db:         db,
		logger:     logger,
		anonymizer: NewAnonymizer(),
		jwtSecret:  jwtSecret,
	}
}

// GetUserConsent retrieves the current consent settings for a user
func (s *Service) GetUserConsent(ctx context.Context, userID uuid.UUID) (*model.UserConsent, error) {
	var consent model.UserConsent
	
	query := `
		SELECT id, user_id, ai_processing_consent, data_anonymization_consent, 
		       analytics_consent, marketing_consent, consent_version,
		       consent_given_at, consent_withdrawn_at, ip_address, user_agent,
		       created_at, updated_at
		FROM user_consent 
		WHERE user_id = $1`

	err := s.db.GetContext(ctx, &consent, query, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return default consent (all false) if no record exists
			return &model.UserConsent{
				UserID:                   userID,
				AIProcessingConsent:      false,
				DataAnonymizationConsent: false,
				AnalyticsConsent:         false,
				MarketingConsent:         false,
				ConsentVersion:           "1.0",
				CreatedAt:                time.Now(),
				UpdatedAt:                time.Now(),
			}, nil
		}
		return nil, fmt.Errorf("failed to get user consent: %w", err)
	}

	return &consent, nil
}

// UpdateUserConsent updates consent settings for a user
func (s *Service) UpdateUserConsent(ctx context.Context, userID uuid.UUID, request *model.ConsentRequest, ipAddress, userAgent string) (*model.ConsentResponse, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get current consent or create default
	currentConsent, err := s.GetUserConsent(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current consent: %w", err)
	}

	// Update fields that were provided
	updated := false
	if request.AIProcessingConsent != nil {
		currentConsent.AIProcessingConsent = *request.AIProcessingConsent
		updated = true
	}
	if request.DataAnonymizationConsent != nil {
		currentConsent.DataAnonymizationConsent = *request.DataAnonymizationConsent
		updated = true
	}
	if request.AnalyticsConsent != nil {
		currentConsent.AnalyticsConsent = *request.AnalyticsConsent
		updated = true
	}
	if request.MarketingConsent != nil {
		currentConsent.MarketingConsent = *request.MarketingConsent
		updated = true
	}

	if !updated {
		return nil, fmt.Errorf("no consent fields provided for update")
	}

	// Get current privacy policy version
	policyVersion, err := s.GetActivePrivacyPolicyVersion(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to get active privacy policy version")
		// Continue with default version instead of failing
		currentConsent.ConsentVersion = "1.0"
	} else {
		currentConsent.ConsentVersion = policyVersion.Version
	}

	// Set timestamps and metadata
	now := time.Now()
	currentConsent.UpdatedAt = now
	
	// Check if this is giving consent for the first time or re-giving after withdrawal
	anyConsentGiven := currentConsent.AIProcessingConsent || currentConsent.DataAnonymizationConsent || 
					  currentConsent.AnalyticsConsent || currentConsent.MarketingConsent
					  
	if anyConsentGiven && currentConsent.ConsentGivenAt == nil {
		currentConsent.ConsentGivenAt = &now
		currentConsent.ConsentWithdrawnAt = nil
	} else if !anyConsentGiven {
		currentConsent.ConsentWithdrawnAt = &now
	}

	if ipAddress != "" {
		currentConsent.IPAddress = &ipAddress
	}
	if userAgent != "" {
		currentConsent.UserAgent = &userAgent
	}

	// Upsert consent record
	query := `
		INSERT INTO user_consent (
			user_id, ai_processing_consent, data_anonymization_consent,
			analytics_consent, marketing_consent, consent_version,
			consent_given_at, consent_withdrawn_at, ip_address, user_agent,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		ON CONFLICT (user_id) DO UPDATE SET
			ai_processing_consent = EXCLUDED.ai_processing_consent,
			data_anonymization_consent = EXCLUDED.data_anonymization_consent,
			analytics_consent = EXCLUDED.analytics_consent,
			marketing_consent = EXCLUDED.marketing_consent,
			consent_version = EXCLUDED.consent_version,
			consent_given_at = EXCLUDED.consent_given_at,
			consent_withdrawn_at = EXCLUDED.consent_withdrawn_at,
			ip_address = EXCLUDED.ip_address,
			user_agent = EXCLUDED.user_agent,
			updated_at = EXCLUDED.updated_at
		RETURNING id`

	var consentID uuid.UUID
	err = tx.GetContext(ctx, &consentID, query,
		currentConsent.UserID,
		currentConsent.AIProcessingConsent,
		currentConsent.DataAnonymizationConsent,
		currentConsent.AnalyticsConsent,
		currentConsent.MarketingConsent,
		currentConsent.ConsentVersion,
		currentConsent.ConsentGivenAt,
		currentConsent.ConsentWithdrawnAt,
		currentConsent.IPAddress,
		currentConsent.UserAgent,
		now, // created_at (only used on INSERT)
		currentConsent.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert consent: %w", err)
	}

	// Log the consent update
	auditReq := &AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionConsentUpdated,
		ResourceType: "user_consent",
		ResourceID:   &consentID,
		Details: map[string]interface{}{
			"ai_processing_consent":       currentConsent.AIProcessingConsent,
			"data_anonymization_consent":  currentConsent.DataAnonymizationConsent,
			"analytics_consent":           currentConsent.AnalyticsConsent,
			"marketing_consent":           currentConsent.MarketingConsent,
			"consent_version":             currentConsent.ConsentVersion,
		},
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
	}

	if err := s.logActionWithTx(ctx, tx, auditReq); err != nil {
		s.logger.Error().Err(err).Msg("Failed to log consent update audit")
		// Continue without failing the main operation
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Return response
	return &model.ConsentResponse{
		UserID:                   currentConsent.UserID,
		AIProcessingConsent:      currentConsent.AIProcessingConsent,
		DataAnonymizationConsent: currentConsent.DataAnonymizationConsent,
		AnalyticsConsent:         currentConsent.AnalyticsConsent,
		MarketingConsent:         currentConsent.MarketingConsent,
		ConsentVersion:           currentConsent.ConsentVersion,
		ConsentGivenAt:           currentConsent.ConsentGivenAt,
		ConsentWithdrawnAt:       currentConsent.ConsentWithdrawnAt,
		UpdatedAt:                currentConsent.UpdatedAt,
	}, nil
}

// HasAIProcessingConsent checks if user has given consent for AI processing
func (s *Service) HasAIProcessingConsent(ctx context.Context, userID uuid.UUID) (bool, error) {
	consent, err := s.GetUserConsent(ctx, userID)
	if err != nil {
		return false, err
	}
	return consent.AIProcessingConsent, nil
}

// HasDataAnonymizationConsent checks if user has given consent for data anonymization
func (s *Service) HasDataAnonymizationConsent(ctx context.Context, userID uuid.UUID) (bool, error) {
	consent, err := s.GetUserConsent(ctx, userID)
	if err != nil {
		return false, err
	}
	return consent.DataAnonymizationConsent, nil
}

// RevokeAllConsent revokes all consent for a user (GDPR right to withdraw)
func (s *Service) RevokeAllConsent(ctx context.Context, userID uuid.UUID, ipAddress, userAgent string) error {
	revokeRequest := &model.ConsentRequest{
		AIProcessingConsent:      boolPtr(false),
		DataAnonymizationConsent: boolPtr(false),
		AnalyticsConsent:         boolPtr(false),
		MarketingConsent:         boolPtr(false),
	}

	_, err := s.UpdateUserConsent(ctx, userID, revokeRequest, ipAddress, userAgent)
	if err != nil {
		return fmt.Errorf("failed to revoke consent: %w", err)
	}

	// Log the revocation
	auditReq := &AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionConsentWithdrawn,
		ResourceType: "user_consent",
		Details: map[string]interface{}{
			"revoked_all": true,
			"reason":      "GDPR withdrawal request",
		},
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
	}

	if err := s.LogAction(ctx, auditReq); err != nil {
		s.logger.Error().Err(err).Msg("Failed to log consent revocation audit")
		// Continue without failing
	}

	return nil
}

// GetActivePrivacyPolicyVersion gets the current active privacy policy version
func (s *Service) GetActivePrivacyPolicyVersion(ctx context.Context) (*model.PrivacyPolicyVersion, error) {
	var version model.PrivacyPolicyVersion
	
	query := `
		SELECT id, version, content, effective_date, created_at, is_active
		FROM privacy_policy_versions 
		WHERE is_active = true
		ORDER BY effective_date DESC
		LIMIT 1`

	err := s.db.GetContext(ctx, &version, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get active privacy policy version: %w", err)
	}

	return &version, nil
}

// CheckAIProcessingConsent middleware-like function to check AI processing consent
func (s *Service) CheckAIProcessingConsent(userID uuid.UUID) error {
	ctx := context.Background() // Use background context for middleware
	hasConsent, err := s.HasAIProcessingConsent(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to check AI processing consent: %w", err)
	}

	if !hasConsent {
		return fmt.Errorf("user has not consented to AI processing")
	}

	return nil
}

// CheckDataAnonymizationConsent checks if user consents to data anonymization
func (s *Service) CheckDataAnonymizationConsent(userID uuid.UUID) error {
	ctx := context.Background()
	hasConsent, err := s.HasDataAnonymizationConsent(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to check data anonymization consent: %w", err)
	}

	if !hasConsent {
		return fmt.Errorf("user has not consented to data anonymization")
	}

	return nil
}

// ExtractUserIDFromRequest extracts user ID from HTTP request (JWT or headers)
func (s *Service) ExtractUserIDFromRequest(r *http.Request) (uuid.UUID, error) {
	// First try to get from JWT token
	if userID, err := s.extractUserIDFromJWT(r); err == nil {
		return userID, nil
	}

	// Fallback to headers (for development/testing)
	userIDHeader := r.Header.Get("X-User-ID")
	if userIDHeader != "" {
		userID, err := uuid.Parse(userIDHeader)
		if err != nil {
			return uuid.Nil, fmt.Errorf("invalid user ID in header: %w", err)
		}
		return userID, nil
	}

	return uuid.Nil, fmt.Errorf("no user ID found in request")
}

// extractUserIDFromJWT extracts user ID from JWT token
func (s *Service) extractUserIDFromJWT(r *http.Request) (uuid.UUID, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return uuid.Nil, fmt.Errorf("no authorization header")
	}

	// Remove "Bearer " prefix
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return uuid.Nil, fmt.Errorf("invalid authorization header format")
	}

	// Parse token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to parse JWT: %w", err)
	}

	if !token.Valid {
		return uuid.Nil, fmt.Errorf("invalid JWT token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, fmt.Errorf("invalid JWT claims")
	}

	// Get user ID from claims
	userIDStr, ok := claims["sub"].(string)
	if !ok {
		// Try alternative claim names
		if userIDStr, ok = claims["user_id"].(string); !ok {
			return uuid.Nil, fmt.Errorf("no user ID found in JWT claims")
		}
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user ID in JWT: %w", err)
	}

	return userID, nil
}

// LogAction logs an action for audit purposes
func (s *Service) LogAction(ctx context.Context, log *AuditLogRequest) error {
	return s.logActionWithTx(ctx, s.db, log)
}

// logActionWithTx logs an action using a transaction
func (s *Service) logActionWithTx(ctx context.Context, tx sqlx.ExtContext, log *AuditLogRequest) error {
	// Set default expiration if not provided
	expiresAt := time.Now().Add(7 * 365 * 24 * time.Hour) // 7 years for GDPR
	if log.ExpiresAt != nil {
		expiresAt = *log.ExpiresAt
	}

	// Marshal details to JSON
	var detailsJSON []byte
	var err error
	if log.Details != nil {
		detailsJSON, err = json.Marshal(log.Details)
		if err != nil {
			return fmt.Errorf("failed to marshal audit log details: %w", err)
		}
	}

	query := `
		INSERT INTO audit_logs (
			user_id, action, resource_type, resource_id, details,
			ip_address, user_agent, session_id, created_at, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err = tx.ExecContext(ctx, query,
		log.UserID,
		log.Action,
		log.ResourceType,
		log.ResourceID,
		detailsJSON,
		log.IPAddress,
		log.UserAgent,
		log.SessionID,
		time.Now(),
		expiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert audit log: %w", err)
	}

	return nil
}

// GetUserAuditLogs retrieves audit logs for a specific user
func (s *Service) GetUserAuditLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.AuditLog, int64, error) {
	// Get total count
	var totalCount int64
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE user_id = $1`
	err := s.db.GetContext(ctx, &totalCount, countQuery, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get audit log count: %w", err)
	}

	// Get logs
	query := `
		SELECT id, user_id, action, resource_type, resource_id, details,
		       ip_address, user_agent, session_id, created_at, expires_at
		FROM audit_logs 
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	var logs []model.AuditLog
	err = s.db.SelectContext(ctx, &logs, query, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get audit logs: %w", err)
	}

	return logs, totalCount, nil
}

// GetAuditLogsByAction retrieves audit logs filtered by action type
func (s *Service) GetAuditLogsByAction(ctx context.Context, action string, limit, offset int) ([]model.AuditLog, int64, error) {
	// Get total count
	var totalCount int64
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE action = $1`
	err := s.db.GetContext(ctx, &totalCount, countQuery, action)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get audit log count: %w", err)
	}

	// Get logs
	query := `
		SELECT id, user_id, action, resource_type, resource_id, details,
		       ip_address, user_agent, session_id, created_at, expires_at
		FROM audit_logs 
		WHERE action = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	var logs []model.AuditLog
	err = s.db.SelectContext(ctx, &logs, query, action, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get audit logs: %w", err)
	}

	return logs, totalCount, nil
}

// CleanupExpiredLogs removes expired audit logs
func (s *Service) CleanupExpiredLogs(ctx context.Context) (int64, error) {
	query := `DELETE FROM audit_logs WHERE expires_at < NOW()`
	
	result, err := s.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	// Log the cleanup
	if rowsAffected > 0 {
		auditReq := &AuditLogRequest{
			Action:       "AUDIT_CLEANUP",
			ResourceType: "audit_logs",
			Details: map[string]interface{}{
				"rows_deleted": rowsAffected,
				"cleanup_time": time.Now().Format(time.RFC3339),
			},
		}
		if err := s.LogAction(ctx, auditReq); err != nil {
			s.logger.Error().Err(err).Msg("Failed to log audit cleanup")
		}
	}

	return rowsAffected, nil
}

// Helper function to create bool pointer
func boolPtr(b bool) *bool {
	return &b
}

// AnonymizeText anonymizes sensitive data in text
func (s *Service) AnonymizeText(ctx context.Context, userID uuid.UUID, text string, options *AnonymizationOptions) (*AnonymizationResult, error) {
	// Check if user has consented to data anonymization
	if err := s.CheckDataAnonymizationConsent(userID); err != nil {
		return nil, fmt.Errorf("user consent required for anonymization: %w", err)
	}

	if options == nil {
		options = DefaultAnonymizationOptions()
	}

	// Perform anonymization
	anonymizedText, fieldsAnonymized, err := s.anonymizer.AnonymizeText(text, options)
	if err != nil {
		return nil, fmt.Errorf("failed to anonymize text: %w", err)
	}

	// Create hashes for tracking
	originalHash := s.hashData(text)
	anonymizedHash := s.hashData(anonymizedText)

	result := &AnonymizationResult{
		OriginalText:        text,
		AnonymizedText:      anonymizedText,
		FieldsAnonymized:    fieldsAnonymized,
		OriginalDataHash:    originalHash,
		AnonymizedDataHash:  anonymizedHash,
		AnonymizationMethod: "regex_replacement",
		ProcessedAt:         time.Now(),
	}

	// Create anonymization record
	record := &model.DataAnonymizationRecord{
		ID:                    uuid.New(),
		UserID:                userID,
		OriginalDataHash:      originalHash,
		AnonymizedDataHash:    anonymizedHash,
		AnonymizationMethod:   "regex_replacement",
		FieldsAnonymized:      fieldsAnonymized,
		AnonymizedAt:          result.ProcessedAt,
	}

	if err := s.CreateAnonymizationRecord(ctx, record); err != nil {
		s.logger.Error().Err(err).Msg("Failed to create anonymization record")
		// Continue without failing the main operation
	}

	// Log the anonymization
	auditReq := &AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionDataAnonymized,
		ResourceType: "text_data",
		ResourceID:   &record.ID,
		Details: map[string]interface{}{
			"fields_anonymized":     fieldsAnonymized,
			"anonymization_method":  "regex_replacement",
			"original_data_hash":    originalHash,
			"anonymized_data_hash":  anonymizedHash,
		},
	}

	if err := s.LogAction(ctx, auditReq); err != nil {
		s.logger.Error().Err(err).Msg("Failed to log anonymization audit")
	}

	return result, nil
}

// AnonymizeUserData anonymizes specific user data fields
func (s *Service) AnonymizeUserData(ctx context.Context, userID uuid.UUID, data map[string]string, options *AnonymizationOptions) (*AnonymizationResult, error) {
	// Check if user has consented to data anonymization
	if err := s.CheckDataAnonymizationConsent(userID); err != nil {
		return nil, fmt.Errorf("user consent required for anonymization: %w", err)
	}

	if options == nil {
		options = DefaultAnonymizationOptions()
	}

	// Combine all data into text for processing
	var originalParts []string
	var anonymizedParts []string
	var allFieldsAnonymized []string

	for fieldName, fieldValue := range data {
		originalParts = append(originalParts, fmt.Sprintf("%s: %s", fieldName, fieldValue))

		// Anonymize based on field type
		anonymizedValue, err := s.anonymizer.AnonymizeField(fieldName, fieldValue, options)
		if err != nil {
			return nil, fmt.Errorf("failed to anonymize field %s: %w", fieldName, err)
		}

		anonymizedParts = append(anonymizedParts, fmt.Sprintf("%s: %s", fieldName, anonymizedValue))

		// Track if field was actually changed
		if anonymizedValue != fieldValue {
			allFieldsAnonymized = append(allFieldsAnonymized, fieldName)
		}
	}

	originalText := strings.Join(originalParts, "; ")
	anonymizedText := strings.Join(anonymizedParts, "; ")

	// Create hashes for tracking
	originalHash := s.hashData(originalText)
	anonymizedHash := s.hashData(anonymizedText)

	result := &AnonymizationResult{
		OriginalText:        originalText,
		AnonymizedText:      anonymizedText,
		FieldsAnonymized:    allFieldsAnonymized,
		OriginalDataHash:    originalHash,
		AnonymizedDataHash:  anonymizedHash,
		AnonymizationMethod: "field_based_replacement",
		ProcessedAt:         time.Now(),
	}

	// Create anonymization record
	record := &model.DataAnonymizationRecord{
		ID:                    uuid.New(),
		UserID:                userID,
		OriginalDataHash:      originalHash,
		AnonymizedDataHash:    anonymizedHash,
		AnonymizationMethod:   "field_based_replacement",
		FieldsAnonymized:      allFieldsAnonymized,
		AnonymizedAt:          result.ProcessedAt,
	}

	if err := s.CreateAnonymizationRecord(ctx, record); err != nil {
		s.logger.Error().Err(err).Msg("Failed to create anonymization record")
		// Continue without failing the main operation
	}

	// Log the anonymization
	auditReq := &AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionDataAnonymized,
		ResourceType: "user_data",
		ResourceID:   &record.ID,
		Details: map[string]interface{}{
			"fields_anonymized":     allFieldsAnonymized,
			"anonymization_method":  "field_based_replacement",
			"original_data_hash":    originalHash,
			"anonymized_data_hash":  anonymizedHash,
			"field_count":           len(data),
		},
	}

	if err := s.LogAction(ctx, auditReq); err != nil {
		s.logger.Error().Err(err).Msg("Failed to log user data anonymization audit")
	}

	return result, nil
}

// GetAnonymizationRecord retrieves anonymization record for tracking
func (s *Service) GetAnonymizationRecord(ctx context.Context, userID uuid.UUID, originalDataHash string) (*model.DataAnonymizationRecord, error) {
	var record model.DataAnonymizationRecord

	query := `
		SELECT id, user_id, original_data_hash, anonymized_data_hash,
		       anonymization_method, fields_anonymized, anonymized_at
		FROM data_anonymization_records
		WHERE user_id = $1 AND original_data_hash = $2
		ORDER BY anonymized_at DESC
		LIMIT 1`

	err := s.db.GetContext(ctx, &record, query, userID, originalDataHash)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, fmt.Errorf("failed to get anonymization record: %w", err)
	}

	return &record, nil
}

// CreateAnonymizationRecord creates a record of anonymization operation
func (s *Service) CreateAnonymizationRecord(ctx context.Context, record *model.DataAnonymizationRecord) error {
	query := `
		INSERT INTO data_anonymization_records (
			id, user_id, original_data_hash, anonymized_data_hash,
			anonymization_method, fields_anonymized, anonymized_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)`

	// Convert string slice to PostgreSQL array
	fieldsArray := "{" + strings.Join(record.FieldsAnonymized, ",") + "}"

	_, err := s.db.ExecContext(ctx, query,
		record.ID,
		record.UserID,
		record.OriginalDataHash,
		record.AnonymizedDataHash,
		record.AnonymizationMethod,
		fieldsArray,
		record.AnonymizedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create anonymization record: %w", err)
	}

	return nil
}

// hashData creates a SHA-256 hash of data
func (s *Service) hashData(data string) string {
	hasher := sha256.New()
	hasher.Write([]byte(data))
	return hex.EncodeToString(hasher.Sum(nil))
}
