package ai

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/sashabaranov/go-openai"

	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/config"
)

// MockOpenAIClient for testing OpenAI client
type MockOpenAIClient struct {
	shouldFail    bool
	failureError  error
	mockResponse  openai.ChatCompletionResponse
	mockDelay     time.Duration
	callCount     int
	lastRequest   openai.ChatCompletionRequest
}

func NewMockOpenAIClient() *MockOpenAIClient {
	return &MockOpenAIClient{
		mockResponse: openai.ChatCompletionResponse{
			Choices: []openai.ChatCompletionChoice{
				{
					Message: openai.ChatCompletionMessage{
						Content: "This is a test summary of the conversation.",
					},
				},
			},
			Usage: openai.Usage{
				PromptTokens:     50,
				CompletionTokens: 30,
				TotalTokens:      80,
			},
		},
	}
}

func (m *MockOpenAIClient) SetShouldFail(shouldFail bool, err error) {
	m.shouldFail = shouldFail
	m.failureError = err
}

func (m *MockOpenAIClient) SetMockResponse(response openai.ChatCompletionResponse) {
	m.mockResponse = response
}

func (m *MockOpenAIClient) SetDelay(delay time.Duration) {
	m.mockDelay = delay
}

func (m *MockOpenAIClient) GetCallCount() int {
	return m.callCount
}

func (m *MockOpenAIClient) GetLastRequest() openai.ChatCompletionRequest {
	return m.lastRequest
}

func (m *MockOpenAIClient) CreateChatCompletion(ctx context.Context, request openai.ChatCompletionRequest) (openai.ChatCompletionResponse, error) {
	m.callCount++
	m.lastRequest = request

	if m.mockDelay > 0 {
		time.Sleep(m.mockDelay)
	}

	if m.shouldFail {
		if m.failureError != nil {
			return openai.ChatCompletionResponse{}, m.failureError
		}
		return openai.ChatCompletionResponse{}, errors.New("mock OpenAI client error")
	}

	return m.mockResponse, nil
}

// Use the existing MockSummaryCache from test_utils.go

// TestableOpenAIService wraps OpenAIService for testing
type TestableOpenAIService struct {
	*OpenAIService
	mockClient *MockOpenAIClient
}

func NewTestableOpenAIService(mockClient *MockOpenAIClient, mockCache *MockSummaryCache, logger zerolog.Logger) *TestableOpenAIService {
	cfg := &config.AIConfig{
		Model:       "gpt-4-turbo-preview",
		MaxTokens:   500,
		Temperature: 0.3,
		MaxRetries:  3,
		Timeout:     30 * time.Second,
	}

	service := &OpenAIService{
		config:     cfg,
		cache:      mockCache,
		logger:     logger.With().Str("component", "openai_service_test").Logger(),
		keyBuilder: cache.NewKeyBuilder(),
	}

	// Override the OpenAI client with our mock
	service.client = mockClient

	return &TestableOpenAIService{
		OpenAIService: service,
		mockClient:    mockClient,
	}
}

func TestOpenAIService_SummarizeMessages_Success(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	ctx := context.Background()
	request := &SummarizeRequest{
		ConversationID: uuid.New(),
		UserID:         uuid.New(),
		Messages: []Message{
			{
				ID:        uuid.New(),
				UserID:    uuid.New(),
				Content:   "Hello, I need help with my account.",
				Role:      "user",
				CreatedAt: time.Now(),
			},
			{
				ID:        uuid.New(),
				UserID:    uuid.New(),
				Content:   "I'd be happy to help you with your account.",
				Role:      "assistant",
				CreatedAt: time.Now(),
			},
		},
	}

	response, err := service.SummarizeMessages(ctx, request)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if response == nil {
		t.Fatal("Expected response to be returned, got nil")
	}

	if response.ConversationID != request.ConversationID {
		t.Error("Expected conversation ID to match")
	}

	if response.Summary == "" {
		t.Error("Expected summary content to be set")
	}

	if response.TokensUsed <= 0 {
		t.Error("Expected tokens used to be greater than 0")
	}

	if mockClient.GetCallCount() != 1 {
		t.Error("Expected OpenAI client to be called once")
	}
}

func TestOpenAIService_Health_Success(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	ctx := context.Background()
	err := service.Health(ctx)

	if err != nil {
		t.Fatalf("Expected healthy service, got error: %v", err)
	}

	if mockClient.GetCallCount() != 1 {
		t.Error("Expected OpenAI client to be called once for health check")
	}
}

func TestOpenAIService_Health_Failure(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockClient.SetShouldFail(true, errors.New("OpenAI API unavailable"))
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	ctx := context.Background()
	err := service.Health(ctx)

	if err == nil {
		t.Error("Expected error when OpenAI client fails")
	}

	if mockClient.GetCallCount() != 1 {
		t.Error("Expected OpenAI client to be called once for health check")
	}
}

func TestOpenAIService_SummarizeMessages_OpenAIError(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockClient.SetShouldFail(true, errors.New("rate limit exceeded"))
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	ctx := context.Background()
	request := &SummarizeRequest{
		ConversationID: uuid.New(),
		UserID:         uuid.New(),
		Messages: []Message{
			{
				ID:        uuid.New(),
				UserID:    uuid.New(),
				Content:   "Test message",
				Role:      "user",
				CreatedAt: time.Now(),
			},
		},
	}

	_, err := service.SummarizeMessages(ctx, request)

	if err == nil {
		t.Error("Expected error when OpenAI client fails")
	}

	if mockClient.GetCallCount() < 1 {
		t.Error("Expected OpenAI client to be called at least once")
	}
}

func TestOpenAIService_GetSupportedModels(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	models := service.GetSupportedModels()

	if len(models) == 0 {
		t.Error("Expected at least one supported model")
	}

	expectedModels := []string{
		"gpt-4",
		"gpt-4-turbo-preview",
		"gpt-3.5-turbo",
	}

	for _, expectedModel := range expectedModels {
		found := false
		for _, model := range models {
			if model == expectedModel {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected model '%s' to be in supported models list", expectedModel)
		}
	}
}

func TestOpenAIService_ValidateModel(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	validModel := "gpt-4-turbo-preview"
	if !service.ValidateModel(validModel) {
		t.Errorf("Expected model '%s' to be valid", validModel)
	}

	invalidModel := "invalid-model"
	if service.ValidateModel(invalidModel) {
		t.Errorf("Expected model '%s' to be invalid", invalidModel)
	}
}

func TestOpenAIService_InvalidateConversationSummaries(t *testing.T) {
	mockClient := NewMockOpenAIClient()
	mockCache := NewMockSummaryCache()
	logger := zerolog.New(nil).With().Timestamp().Logger()

	service := NewTestableOpenAIService(mockClient, mockCache, logger)

	conversationID := uuid.New()
	ctx := context.Background()

	err := service.InvalidateConversationSummaries(ctx, conversationID)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// Test utility functions
func TestUniqueStrings(t *testing.T) {
	input := []string{"a", "b", "a", "c", "b", "d"}
	result := uniqueStrings(input)

	expected := []string{"a", "b", "c", "d"}
	if len(result) != len(expected) {
		t.Errorf("Expected %d unique strings, got %d", len(expected), len(result))
	}

	for _, expectedStr := range expected {
		found := false
		for _, resultStr := range result {
			if resultStr == expectedStr {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected string '%s' to be in result", expectedStr)
		}
	}
}

func TestGenerateSummaryID(t *testing.T) {
	id1 := generateSummaryID()
	id2 := generateSummaryID()

	if id1 == id2 {
		t.Error("Expected generated IDs to be unique")
	}

	if len(id1) == 0 {
		t.Error("Expected generated ID to be non-empty")
	}
}
