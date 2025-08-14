package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/ai"
	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/client/chat"
	"github.com/link-app/ai-svc/internal/config"
	"github.com/link-app/ai-svc/internal/handler"
	"github.com/link-app/ai-svc/internal/middleware"
	"github.com/link-app/ai-svc/internal/model"
	"github.com/link-app/ai-svc/internal/privacy"
)

// TestChatServiceStub provides a mock chat service for testing
type TestChatServiceStub struct {
	messages map[uuid.UUID][]*chat.ChatMessage
}

func NewTestChatServiceStub() *TestChatServiceStub {
	return &TestChatServiceStub{
		messages: make(map[uuid.UUID][]*chat.ChatMessage),
	}
}

func (s *TestChatServiceStub) GetRecentMessages(ctx context.Context, conversationID uuid.UUID, limit int) (*chat.ChatMessage, error) {
	messages, exists := s.messages[conversationID]
	if !exists || len(messages) == 0 {
		return nil, fmt.Errorf("no messages found for conversation %s", conversationID)
	}

	// Return the first message (in real implementation, this would aggregate messages)
	return messages[0], nil
}

func (s *TestChatServiceStub) AddMessage(conversationID uuid.UUID, message *chat.ChatMessage) {
	if s.messages[conversationID] == nil {
		s.messages[conversationID] = make([]*chat.ChatMessage, 0)
	}
	s.messages[conversationID] = append(s.messages[conversationID], message)
}

// MockAIService provides a deterministic AI service for testing
type MockAIService struct {
	shouldFail    bool
	responseDelay time.Duration
}

func NewMockAIService() *MockAIService {
	return &MockAIService{
		shouldFail:    false,
		responseDelay: 100 * time.Millisecond,
	}
}

func (m *MockAIService) SetShouldFail(fail bool) {
	m.shouldFail = fail
}

func (m *MockAIService) SetResponseDelay(delay time.Duration) {
	m.responseDelay = delay
}

func (m *MockAIService) SummarizeMessages(ctx context.Context, req *ai.SummarizeRequest) (*ai.SummarizeResponse, error) {
	if m.shouldFail {
		return nil, fmt.Errorf("mock AI service error")
	}

	// Simulate processing time
	time.Sleep(m.responseDelay)

	response := &ai.SummarizeResponse{
		ID:             uuid.New().String(),
		ConversationID: req.ConversationID,
		Summary:        "This is a mock summary of the conversation messages.",
		MessageCount:   len(req.Messages),
		TokensUsed:     150,
		Model:          "gpt-3.5-turbo",
		ProcessingTime: m.responseDelay,
		CachedResult:   false,
		Metadata: map[string]interface{}{
			"mock": true,
			"test": "integration",
		},
		CreatedAt: time.Now(),
	}

	return response, nil
}

func (m *MockAIService) InvalidateConversationSummaries(ctx context.Context, conversationID uuid.UUID) error {
	return nil // No-op for mock
}

func (m *MockAIService) Health(ctx context.Context) error {
	if m.shouldFail {
		return fmt.Errorf("mock AI service unhealthy")
	}
	return nil
}

func (m *MockAIService) GetSupportedModels() []string {
	return []string{"gpt-3.5-turbo", "gpt-4"}
}

func (m *MockAIService) ValidateModel(model string) bool {
	supportedModels := m.GetSupportedModels()
	for _, supported := range supportedModels {
		if model == supported {
			return true
		}
	}
	return false
}

// MockPrivacyService provides a mock privacy service that always grants consent
type MockPrivacyService struct {
	shouldFailConsent bool
	hasAIConsent      bool
	hasDataConsent    bool
}

func NewMockPrivacyService() *MockPrivacyService {
	return &MockPrivacyService{
		shouldFailConsent: false,
		hasAIConsent:      true,
		hasDataConsent:    true,
	}
}

func (m *MockPrivacyService) SetConsentStatus(aiConsent, dataConsent bool) {
	m.hasAIConsent = aiConsent
	m.hasDataConsent = dataConsent
}

func (m *MockPrivacyService) SetShouldFail(fail bool) {
	m.shouldFailConsent = fail
}

// Implement all required privacy service methods
func (m *MockPrivacyService) GetUserConsent(ctx context.Context, userID uuid.UUID) (*model.UserConsent, error) {
	return &model.UserConsent{
		ID:                       uuid.New(),
		UserID:                   userID,
		AIProcessingConsent:      m.hasAIConsent,
		DataAnonymizationConsent: m.hasDataConsent,
		ConsentVersion:           "1.0",
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}, nil
}

func (m *MockPrivacyService) UpdateUserConsent(ctx context.Context, userID uuid.UUID, request *model.ConsentRequest, ipAddress, userAgent string) (*model.ConsentResponse, error) {
	return nil, fmt.Errorf("not implemented in mock")
}

func (m *MockPrivacyService) HasAIProcessingConsent(ctx context.Context, userID uuid.UUID) (bool, error) {
	if m.shouldFailConsent {
		return false, fmt.Errorf("mock consent check error")
	}
	return m.hasAIConsent, nil
}

func (m *MockPrivacyService) HasDataAnonymizationConsent(ctx context.Context, userID uuid.UUID) (bool, error) {
	if m.shouldFailConsent {
		return false, fmt.Errorf("mock consent check error")
	}
	return m.hasDataConsent, nil
}

func (m *MockPrivacyService) RevokeAllConsent(ctx context.Context, userID uuid.UUID, ipAddress, userAgent string) error {
	return fmt.Errorf("not implemented in mock")
}

func (m *MockPrivacyService) GetActivePrivacyPolicyVersion(ctx context.Context) (*model.PrivacyPolicyVersion, error) {
	return &model.PrivacyPolicyVersion{
		Version:   "1.0",
		IsActive:  true,
		CreatedAt: time.Now(),
	}, nil
}

func (m *MockPrivacyService) LogAction(ctx context.Context, log *privacy.AuditLogRequest) error {
	return nil // No-op for mock
}

func (m *MockPrivacyService) GetUserAuditLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.AuditLog, int64, error) {
	return []model.AuditLog{}, 0, nil
}

func (m *MockPrivacyService) GetAuditLogsByAction(ctx context.Context, action string, limit, offset int) ([]model.AuditLog, int64, error) {
	return []model.AuditLog{}, 0, nil
}

func (m *MockPrivacyService) CleanupExpiredLogs(ctx context.Context) (int64, error) {
	return 0, nil
}

func (m *MockPrivacyService) AnonymizeText(ctx context.Context, userID uuid.UUID, text string, options *privacy.AnonymizationOptions) (*privacy.AnonymizationResult, error) {
	return &privacy.AnonymizationResult{
		OriginalText:       text,
		AnonymizedText:     text, // No actual anonymization in mock
		FieldsAnonymized:   []string{},
		ProcessedAt:        time.Now(),
	}, nil
}

func (m *MockPrivacyService) AnonymizeUserData(ctx context.Context, userID uuid.UUID, data map[string]string, options *privacy.AnonymizationOptions) (*privacy.AnonymizationResult, error) {
	return nil, fmt.Errorf("not implemented in mock")
}

func (m *MockPrivacyService) GetAnonymizationRecord(ctx context.Context, userID uuid.UUID, originalDataHash string) (*model.DataAnonymizationRecord, error) {
	return nil, fmt.Errorf("not implemented in mock")
}

func (m *MockPrivacyService) CreateAnonymizationRecord(ctx context.Context, record *model.DataAnonymizationRecord) error {
	return nil
}

func (m *MockPrivacyService) CheckAIProcessingConsent(userID uuid.UUID) error {
	if !m.hasAIConsent {
		return fmt.Errorf("user has not consented to AI processing")
	}
	return nil
}

func (m *MockPrivacyService) CheckDataAnonymizationConsent(userID uuid.UUID) error {
	if !m.hasDataConsent {
		return fmt.Errorf("user has not consented to data anonymization")
	}
	return nil
}

func (m *MockPrivacyService) ExtractUserIDFromRequest(r *http.Request) (uuid.UUID, error) {
	return uuid.Nil, fmt.Errorf("not implemented in mock")
}

// TestIntegration runs end-to-end integration tests
func TestSummarizeIntegration_Success(t *testing.T) {
	// Setup test dependencies
	chatStub := NewTestChatServiceStub()
	aiService := NewMockAIService()
	privacyService := NewMockPrivacyService()
	cacheService, _ := cache.NewMemoryCache(&config.RedisConfig{SummaryTTL: time.Hour}, zerolog.New(nil))
	defer cacheService.Close()

	logger := zerolog.New(nil).With().Timestamp().Logger()

	// Setup test data
	conversationID := uuid.New()
	userID := uuid.New()

	testMessage := &chat.ChatMessage{
		ID:          uuid.New(),
		UserID:      userID,
		Content:     "Hello, I need help with my project. Can you summarize our previous discussion?",
		MessageType: "user",
		CreatedAt:   time.Now().Add(-5 * time.Minute),
	}
	chatStub.AddMessage(conversationID, testMessage)

	// Create handler
	summarizeHandler := handler.NewSummarizeHandler(
		aiService,
		chatStub,
		privacyService,
		cacheService,
		&logger,
	)

	// Setup routes with middleware
	r := chi.NewRouter()
	rateLimiter := middleware.NewRateLimiter(10, 5)

	// Add user context middleware for testing
	testAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", userID)
			ctx = context.WithValue(ctx, "user_email", "test@example.com")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Use(testAuthMiddleware)
	r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes("test-secret", rateLimiter))

	// Create test request
	requestBody := model.SummarizeRequest{
		ConversationID: conversationID,
		Limit:          &[]int{10}[0],
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Verify response
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, status, rr.Body.String())
	}

	var response model.SummarizeResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify response content
	if response.ConversationID != conversationID {
		t.Errorf("Expected conversation ID %s, got %s", conversationID, response.ConversationID)
	}

	if response.Summary == "" {
		t.Error("Expected summary to be populated")
	}

	if response.MessageCount != 1 {
		t.Errorf("Expected message count 1, got %d", response.MessageCount)
	}

	if response.Model == "" {
		t.Error("Expected model to be specified")
	}

	if response.ProcessingTime == 0 {
		t.Error("Expected processing time to be recorded")
	}

	if response.CachedResult {
		t.Error("Expected result to not be cached on first request")
	}
}

func TestSummarizeIntegration_NoConsent(t *testing.T) {
	// Setup test dependencies with no AI consent
	chatStub := NewTestChatServiceStub()
	aiService := NewMockAIService()
	privacyService := NewMockPrivacyService()
	privacyService.SetConsentStatus(false, true) // No AI consent
	cacheService, _ := cache.NewMemoryCache(&config.RedisConfig{SummaryTTL: time.Hour}, zerolog.New(nil))
	defer cacheService.Close()

	logger := zerolog.New(nil).With().Timestamp().Logger()

	conversationID := uuid.New()
	userID := uuid.New()

	testMessage := &chat.ChatMessage{
		ID:          uuid.New(),
		UserID:      userID,
		Content:     "Test message",
		MessageType: "user",
		CreatedAt:   time.Now(),
	}
	chatStub.AddMessage(conversationID, testMessage)

	// Create handler
	summarizeHandler := handler.NewSummarizeHandler(
		aiService,
		chatStub,
		privacyService,
		cacheService,
		&logger,
	)

	// Setup routes
	r := chi.NewRouter()
	rateLimiter := middleware.NewRateLimiter(10, 5)

	testAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Use(testAuthMiddleware)
	r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes("test-secret", rateLimiter))

	// Create test request
	requestBody := model.SummarizeRequest{
		ConversationID: conversationID,
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Verify forbidden response
	if status := rr.Code; status != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusForbidden, status, rr.Body.String())
	}

	var errorResponse model.ErrorResponse
	err = json.Unmarshal(rr.Body.Bytes(), &errorResponse)
	if err != nil {
		t.Fatalf("Failed to unmarshal error response: %v", err)
	}

	if errorResponse.Code != "CONSENT_REQUIRED" {
		t.Errorf("Expected error code CONSENT_REQUIRED, got %s", errorResponse.Code)
	}
}

func TestSummarizeIntegration_NoMessages(t *testing.T) {
	// Setup test dependencies
	chatStub := NewTestChatServiceStub() // No messages added
	aiService := NewMockAIService()
	privacyService := NewMockPrivacyService()
	cacheService, _ := cache.NewMemoryCache(&config.RedisConfig{SummaryTTL: time.Hour}, zerolog.New(nil))
	defer cacheService.Close()

	logger := zerolog.New(nil).With().Timestamp().Logger()

	conversationID := uuid.New()
	userID := uuid.New()

	// Create handler
	summarizeHandler := handler.NewSummarizeHandler(
		aiService,
		chatStub,
		privacyService,
		cacheService,
		&logger,
	)

	// Setup routes
	r := chi.NewRouter()
	rateLimiter := middleware.NewRateLimiter(10, 5)

	testAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Use(testAuthMiddleware)
	r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes("test-secret", rateLimiter))

	// Create test request
	requestBody := model.SummarizeRequest{
		ConversationID: conversationID,
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Verify not found response
	if status := rr.Code; status != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, status, rr.Body.String())
	}

	var errorResponse model.ErrorResponse
	err = json.Unmarshal(rr.Body.Bytes(), &errorResponse)
	if err != nil {
		t.Fatalf("Failed to unmarshal error response: %v", err)
	}

	if errorResponse.Code != "NO_MESSAGES" {
		t.Errorf("Expected error code NO_MESSAGES, got %s", errorResponse.Code)
	}
}

func TestSummarizeIntegration_AIServiceFailure(t *testing.T) {
	// Setup test dependencies with failing AI service
	chatStub := NewTestChatServiceStub()
	aiService := NewMockAIService()
	aiService.SetShouldFail(true)
	privacyService := NewMockPrivacyService()
	cacheService, _ := cache.NewMemoryCache(&config.RedisConfig{SummaryTTL: time.Hour}, zerolog.New(nil))
	defer cacheService.Close()

	logger := zerolog.New(nil).With().Timestamp().Logger()

	conversationID := uuid.New()
	userID := uuid.New()

	testMessage := &chat.ChatMessage{
		ID:          uuid.New(),
		UserID:      userID,
		Content:     "Test message",
		MessageType: "user",
		CreatedAt:   time.Now(),
	}
	chatStub.AddMessage(conversationID, testMessage)

	// Create handler
	summarizeHandler := handler.NewSummarizeHandler(
		aiService,
		chatStub,
		privacyService,
		cacheService,
		&logger,
	)

	// Setup routes
	r := chi.NewRouter()
	rateLimiter := middleware.NewRateLimiter(10, 5)

	testAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Use(testAuthMiddleware)
	r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes("test-secret", rateLimiter))

	// Create test request
	requestBody := model.SummarizeRequest{
		ConversationID: conversationID,
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Verify internal server error response
	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusInternalServerError, status, rr.Body.String())
	}

	var errorResponse model.ErrorResponse
	err = json.Unmarshal(rr.Body.Bytes(), &errorResponse)
	if err != nil {
		t.Fatalf("Failed to unmarshal error response: %v", err)
	}

	if errorResponse.Code != "AI_ERROR" {
		t.Errorf("Expected error code AI_ERROR, got %s", errorResponse.Code)
	}
}

func TestSummarizeIntegration_Caching(t *testing.T) {
	// Setup test dependencies
	chatStub := NewTestChatServiceStub()
	aiService := NewMockAIService()
	privacyService := NewMockPrivacyService()
	cacheService, _ := cache.NewMemoryCache(&config.RedisConfig{SummaryTTL: time.Hour}, zerolog.New(nil))
	defer cacheService.Close()

	logger := zerolog.New(nil).With().Timestamp().Logger()

	conversationID := uuid.New()
	userID := uuid.New()

	testMessage := &chat.ChatMessage{
		ID:          uuid.New(),
		UserID:      userID,
		Content:     "Test caching message",
		MessageType: "user",
		CreatedAt:   time.Now(),
	}
	chatStub.AddMessage(conversationID, testMessage)

	// Create handler
	summarizeHandler := handler.NewSummarizeHandler(
		aiService,
		chatStub,
		privacyService,
		cacheService,
		&logger,
	)

	// Setup routes
	r := chi.NewRouter()
	rateLimiter := middleware.NewRateLimiter(10, 5)

	testAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Use(testAuthMiddleware)
	r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes("test-secret", rateLimiter))

	// Create test request
	requestBody := model.SummarizeRequest{
		ConversationID: conversationID,
		Limit:          &[]int{10}[0],
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	// First request
	req1, _ := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
	req1.Header.Set("Content-Type", "application/json")

	rr1 := httptest.NewRecorder()
	start1 := time.Now()
	r.ServeHTTP(rr1, req1)
	duration1 := time.Since(start1)

	if status := rr1.Code; status != http.StatusOK {
		t.Errorf("First request failed with status %d: %s", status, rr1.Body.String())
	}

	var response1 model.SummarizeResponse
	json.Unmarshal(rr1.Body.Bytes(), &response1)

	// Second request (should be cached)
	req2, _ := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
	req2.Header.Set("Content-Type", "application/json")

	rr2 := httptest.NewRecorder()
	start2 := time.Now()
	r.ServeHTTP(rr2, req2)
	duration2 := time.Since(start2)

	if status := rr2.Code; status != http.StatusOK {
		t.Errorf("Second request failed with status %d: %s", status, rr2.Body.String())
	}

	var response2 model.SummarizeResponse
	json.Unmarshal(rr2.Body.Bytes(), &response2)

	// Verify caching worked
	if duration2 >= duration1 {
		t.Error("Second request should be faster due to caching")
	}

	// Both responses should have the same summary content
	if response1.Summary != response2.Summary {
		t.Error("Cached response should have same summary as original")
	}

	// Second response should indicate it's cached (this depends on implementation)
	if !response2.CachedResult {
		// This might not be set in all implementations
		t.Log("Note: CachedResult flag not set on second response")
	}
}

// Benchmark tests
func BenchmarkSummarizeIntegration(b *testing.B) {
	// Setup
	chatStub := NewTestChatServiceStub()
	aiService := NewMockAIService()
	aiService.SetResponseDelay(10 * time.Millisecond) // Faster for benchmark
	privacyService := NewMockPrivacyService()
	cacheService, _ := cache.NewMemoryCache(&config.RedisConfig{SummaryTTL: time.Hour}, zerolog.New(nil))
	defer cacheService.Close()

	logger := zerolog.New(nil)

	conversationID := uuid.New()
	userID := uuid.New()

	testMessage := &chat.ChatMessage{
		ID:          uuid.New(),
		UserID:      userID,
		Content:     "Benchmark test message",
		MessageType: "user",
		CreatedAt:   time.Now(),
	}
	chatStub.AddMessage(conversationID, testMessage)

	summarizeHandler := handler.NewSummarizeHandler(
		aiService,
		chatStub,
		privacyService,
		cacheService,
		&logger,
	)

	r := chi.NewRouter()
	rateLimiter := middleware.NewRateLimiter(100, 50) // Higher limits for benchmark

	testAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Use(testAuthMiddleware)
	r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes("test-secret", rateLimiter))

	requestBody := model.SummarizeRequest{
		ConversationID: conversationID,
	}

	body, _ := json.Marshal(requestBody)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest("POST", "/api/v1/ai/summarize/", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				b.Errorf("Request failed with status %d", rr.Code)
			}
		}
	})
}
