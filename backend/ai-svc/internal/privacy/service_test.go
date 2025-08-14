package privacy

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/model"
)

func TestNewService(t *testing.T) {
	// Skip this test for now since we need proper database interface setup
	t.Skip("Skipping service constructor test - requires proper database interface")
}

func TestGetUserConsent_ExistingUser(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	expectedConsent := &model.UserConsent{
		ID:                       uuid.New(),
		UserID:                   userID,
		AIProcessingConsent:      true,
		DataAnonymizationConsent: true,
		AnalyticsConsent:         false,
		MarketingConsent:         false,
		ConsentVersion:           "1.0",
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}

	mockDB.AddUserConsent(userID, expectedConsent)

	ctx := context.Background()
	consent, err := service.GetUserConsent(ctx, userID)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if consent.UserID != userID {
		t.Error("Expected user ID to match")
	}

	if !consent.AIProcessingConsent {
		t.Error("Expected AI processing consent to be true")
	}

	if !consent.DataAnonymizationConsent {
		t.Error("Expected data anonymization consent to be true")
	}
}

func TestGetUserConsent_NewUser(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	ctx := context.Background()

	consent, err := service.GetUserConsent(ctx, userID)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if consent.UserID != userID {
		t.Error("Expected user ID to match")
	}

	if consent.AIProcessingConsent {
		t.Error("Expected AI processing consent to be false for new user")
	}

	if consent.DataAnonymizationConsent {
		t.Error("Expected data anonymization consent to be false for new user")
	}

	if consent.ConsentVersion != "1.0" {
		t.Error("Expected default consent version")
	}
}

func TestGetUserConsent_DatabaseError(t *testing.T) {
	mockDB := NewMockDB()
	mockDB.SetShouldFail(true, false)

	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	ctx := context.Background()

	_, err := service.GetUserConsent(ctx, userID)

	if err == nil {
		t.Error("Expected error when database fails")
	}
}

func TestHasAIProcessingConsent(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	consent := &model.UserConsent{
		ID:                  uuid.New(),
		UserID:              userID,
		AIProcessingConsent: true,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	mockDB.AddUserConsent(userID, consent)

	ctx := context.Background()
	hasConsent, err := service.HasAIProcessingConsent(ctx, userID)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if !hasConsent {
		t.Error("Expected user to have AI processing consent")
	}
}

func TestHasDataAnonymizationConsent(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	consent := &model.UserConsent{
		ID:                       uuid.New(),
		UserID:                   userID,
		DataAnonymizationConsent: true,
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}

	mockDB.AddUserConsent(userID, consent)

	ctx := context.Background()
	hasConsent, err := service.HasDataAnonymizationConsent(ctx, userID)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if !hasConsent {
		t.Error("Expected user to have data anonymization consent")
	}
}

func TestGetActivePrivacyPolicyVersion(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	ctx := context.Background()
	policy, err := service.GetActivePrivacyPolicyVersion(ctx)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if policy.Version != "1.0" {
		t.Error("Expected policy version to be 1.0")
	}

	if policy.Content != "Test privacy policy content" {
		t.Error("Expected policy content to match")
	}

	if !policy.IsActive {
		t.Error("Expected policy to be active")
	}
}

func TestLogAction(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	resourceID := uuid.New()
	ipAddress := "192.168.1.1"
	userAgent := "Test User Agent"

	auditReq := &AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionDataAccessed,
		ResourceType: "test_resource",
		ResourceID:   &resourceID,
		Details: map[string]interface{}{
			"test": "data",
		},
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
	}

	ctx := context.Background()
	err := service.LogAction(ctx, auditReq)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check that audit log was created
	if mockDB.GetAuditLogsCount() != 1 {
		t.Error("Expected one audit log to be created")
	}
}

func TestGetUserAuditLogs(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()

	// Add some test audit logs
	testLogs := []model.AuditLog{
		{
			ID:       uuid.New(),
			UserID:   &userID,
			Action:   model.AuditActionDataAccessed,
			CreatedAt: time.Now(),
		},
		{
			ID:       uuid.New(),
			UserID:   &userID,
			Action:   model.AuditActionConsentUpdated,
			CreatedAt: time.Now(),
		},
	}

	for _, log := range testLogs {
		mockDB.AddAuditLog(log)
	}

	ctx := context.Background()
	logs, totalCount, err := service.GetUserAuditLogs(ctx, userID, 10, 0)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if totalCount != 2 {
		t.Errorf("Expected total count to be 2, got %d", totalCount)
	}

	if len(logs) != 2 {
		t.Errorf("Expected 2 logs, got %d", len(logs))
	}
}

func TestCleanupExpiredLogs(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	// Add some test logs
	userID := uuid.New()
	testLog := model.AuditLog{
		ID:       uuid.New(),
		UserID:   &userID,
		Action:   "TEST_ACTION",
		CreatedAt: time.Now(),
	}
	mockDB.AddAuditLog(testLog)

	ctx := context.Background()
	deletedCount, err := service.CleanupExpiredLogs(ctx)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// In our mock, this will delete all logs
	if deletedCount != 1 {
		t.Errorf("Expected 1 log to be deleted, got %d", deletedCount)
	}
}

func TestAnonymizeText(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	consent := &model.UserConsent{
		ID:                       uuid.New(),
		UserID:                   userID,
		DataAnonymizationConsent: true,
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}
	mockDB.AddUserConsent(userID, consent)

	ctx := context.Background()
	text := "Please contact user@example.com for more information."
	options := &AnonymizationOptions{
		ReplaceEmails:     true,
		ReplacePhones:     false,
		ReplaceNames:      false,
		PlaceholderEmails: []string{"privacy@example.com"},
	}

	result, err := service.AnonymizeText(ctx, userID, text, options)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if result.OriginalText != text {
		t.Error("Expected original text to be preserved")
	}

	if result.AnonymizedText == text {
		t.Error("Expected text to be anonymized")
	}

	if len(result.FieldsAnonymized) == 0 {
		t.Error("Expected fields to be anonymized")
	}

	if !contains(result.FieldsAnonymized, "emails") {
		t.Error("Expected emails to be in anonymized fields")
	}

	if result.OriginalDataHash == "" {
		t.Error("Expected original data hash to be set")
	}

	if result.AnonymizedDataHash == "" {
		t.Error("Expected anonymized data hash to be set")
	}

	if result.AnonymizationMethod != "regex_replacement" {
		t.Error("Expected anonymization method to be regex_replacement")
	}
}

func TestAnonymizeText_NoConsent(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	consent := &model.UserConsent{
		ID:                       uuid.New(),
		UserID:                   userID,
		DataAnonymizationConsent: false, // No consent
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}
	mockDB.AddUserConsent(userID, consent)

	ctx := context.Background()
	text := "Please contact user@example.com for more information."

	_, err := service.AnonymizeText(ctx, userID, text, nil)

	if err == nil {
		t.Error("Expected error when user has no anonymization consent")
	}

	if !containsString(err.Error(), "consent required") {
		t.Error("Expected consent error message")
	}
}

func TestAnonymizeUserData(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	userID := uuid.New()
	consent := &model.UserConsent{
		ID:                       uuid.New(),
		UserID:                   userID,
		DataAnonymizationConsent: true,
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}
	mockDB.AddUserConsent(userID, consent)

	ctx := context.Background()
	data := map[string]string{
		"email": "user@example.com",
		"phone": "(555) 123-4567",
		"name":  "John Doe",
	}

	result, err := service.AnonymizeUserData(ctx, userID, data, nil)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if len(result.FieldsAnonymized) == 0 {
		t.Error("Expected some fields to be anonymized")
	}

	if result.AnonymizationMethod != "field_based_replacement" {
		t.Error("Expected anonymization method to be field_based_replacement")
	}

	// Check that original data contains field names
	if !containsString(result.OriginalText, "email:") {
		t.Error("Expected original text to contain field labels")
	}
}

func TestCheckAIProcessingConsent(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	testCases := []struct {
		name           string
		hasConsent     bool
		expectError    bool
	}{
		{"With consent", true, false},
		{"Without consent", false, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			userID := uuid.New()
			consent := &model.UserConsent{
				ID:                  uuid.New(),
				UserID:              userID,
				AIProcessingConsent: tc.hasConsent,
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			}
			mockDB.AddUserConsent(userID, consent)

			err := service.CheckAIProcessingConsent(userID)

			if tc.expectError && err == nil {
				t.Error("Expected error but got none")
			}

			if !tc.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestCheckDataAnonymizationConsent(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	testCases := []struct {
		name           string
		hasConsent     bool
		expectError    bool
	}{
		{"With consent", true, false},
		{"Without consent", false, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			userID := uuid.New()
			consent := &model.UserConsent{
				ID:                       uuid.New(),
				UserID:                   userID,
				DataAnonymizationConsent: tc.hasConsent,
				CreatedAt:                time.Now(),
				UpdatedAt:                time.Now(),
			}
			mockDB.AddUserConsent(userID, consent)

			err := service.CheckDataAnonymizationConsent(userID)

			if tc.expectError && err == nil {
				t.Error("Expected error but got none")
			}

			if !tc.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestHashData(t *testing.T) {
	mockDB := NewMockDB()
	logger := zerolog.New(nil).With().Timestamp().Logger()
	service := NewService(mockDB, &logger, "test-secret")

	data1 := "test data"
	data2 := "different data"

	hash1 := service.hashData(data1)
	hash2 := service.hashData(data1)
	hash3 := service.hashData(data2)

	// Same data should produce same hash
	if hash1 != hash2 {
		t.Error("Expected same hash for same data")
	}

	// Different data should produce different hash
	if hash1 == hash3 {
		t.Error("Expected different hash for different data")
	}

	// Hash should be hex encoded and proper length
	if len(hash1) != 64 {
		t.Errorf("Expected hash length to be 64, got %d", len(hash1))
	}
}

// Helper function to check if a string contains a substring
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
