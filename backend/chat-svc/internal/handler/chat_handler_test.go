package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

	"github.com/link-app/chat-svc/internal/api"
	"github.com/link-app/chat-svc/internal/middleware"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// Simple test just to verify handler validation logic

// Test helper to create a request with user context
func createTestRequest(method, url string, body interface{}, userID uuid.UUID) *http.Request {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}
	
	req := httptest.NewRequest(method, url, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	
	// Add user ID to context
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

func TestChatHandler_CreateConversation_InvalidJSON(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	// Create a minimal handler with nil service - we're only testing JSON parsing
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with invalid JSON
	userID := uuid.New()
	req := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	
	rr := httptest.NewRecorder()
	
	handler.CreateConversation(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	
	var response api.Error
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Invalid request body", response.Error)
}

func TestChatHandler_CreateConversation_MissingType(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with missing type
	userID := uuid.New()
	reqBody := api.CreateConversationRequest{
		Name: stringPtr("Test Room"),
	}
	
	req := createTestRequest("POST", "/conversations", reqBody, userID)
	rr := httptest.NewRecorder()
	
	handler.CreateConversation(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	
	var response api.Error
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Conversation type is required", response.Error)
}

func TestChatHandler_SendMessage_InvalidJSON(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with invalid JSON
	userID := uuid.New()
	req := httptest.NewRequest("POST", "/messages", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	
	rr := httptest.NewRecorder()
	
	handler.SendMessage(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	
	var response api.Error
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Invalid request body", response.Error)
}

func TestChatHandler_SendMessage_EmptyContent(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with empty content
	userID := uuid.New()
	conversationID := uuid.New()
	reqBody := api.SendMessageRequest{
		ConversationId: openapi_types.UUID(conversationID),
		Content:       "",
	}
	
	req := createTestRequest("POST", "/messages", reqBody, userID)
	rr := httptest.NewRecorder()
	
	handler.SendMessage(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	
	var response api.Error
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Message content is required", response.Error)
}

func TestChatHandler_GetConversationMessages_InvalidID(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with invalid conversation ID
	userID := uuid.New()
	req := createTestRequest("GET", "/conversations/invalid-id/messages", nil, userID)
	
	// Setup chi router context with invalid ID
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "invalid-id")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	
	rr := httptest.NewRecorder()
	
	handler.GetConversationMessages(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	
	var response api.Error
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Invalid conversation ID", response.Error)
}

func TestChatHandler_GetConversations_NoUserID(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test - request without user ID in context
	req := httptest.NewRequest("GET", "/conversations", nil)
	rr := httptest.NewRecorder()
	
	handler.GetConversations(rr, req)
	
	// Assert
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	
	var response api.Error
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Unauthorized", response.Error)
}

func TestChatHandler_CreateConversation_ValidGroup(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with valid group conversation request
	userID := uuid.New()
	reqBody := api.CreateConversationRequest{
		Type:        api.Group,
		Name:        stringPtr("Test Group"),
		Description: stringPtr("A test group"),
		IsPrivate:   boolPtr(false),
	}
	
	req := createTestRequest("POST", "/conversations", reqBody, userID)
	rr := httptest.NewRecorder()
	
	handler.CreateConversation(rr, req)
	
	// This will fail due to no service implementation but validates request parsing
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.NotEqual(t, http.StatusBadRequest, rr.Code) // Validates JSON was parsed correctly
}

func TestChatHandler_CreateConversation_ValidDirect(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with valid direct conversation request
	userID := uuid.New()
	participantID := uuid.New()
	participantIDs := []openapi_types.UUID{openapi_types.UUID(participantID)}
	reqBody := api.CreateConversationRequest{
		Type:           api.Direct,
		ParticipantIds: &participantIDs,
	}
	
	req := createTestRequest("POST", "/conversations", reqBody, userID)
	rr := httptest.NewRecorder()
	
	handler.CreateConversation(rr, req)
	
	// This will fail due to no service implementation but validates request parsing
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.NotEqual(t, http.StatusBadRequest, rr.Code) // Validates JSON was parsed correctly
}

func TestChatHandler_GetConversations_ValidPagination(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with pagination parameters
	userID := uuid.New()
	req := createTestRequest("GET", "/conversations?page=2&size=10", nil, userID)
	rr := httptest.NewRecorder()
	
	handler.GetConversations(rr, req)
	
	// This will fail due to no service implementation but validates parameter parsing
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.NotEqual(t, http.StatusBadRequest, rr.Code) // Validates parameters were parsed correctly
}

func TestChatHandler_SendMessage_ValidMessage(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with valid message
	userID := uuid.New()
	conversationID := uuid.New()
	textType := api.Text
	reqBody := api.SendMessageRequest{
		ConversationId: openapi_types.UUID(conversationID),
		Content:        "Hello World!",
		MessageType:    &textType,
	}
	
	req := createTestRequest("POST", "/messages", reqBody, userID)
	rr := httptest.NewRecorder()
	
	handler.SendMessage(rr, req)
	
	// This will fail due to no service implementation but validates request parsing
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.NotEqual(t, http.StatusBadRequest, rr.Code) // Validates JSON was parsed correctly
}

func TestChatHandler_GetConversationMessages_ValidID(t *testing.T) {
	// Setup
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	handler := &ChatHandler{
		logger: logger,
	}
	
	// Test with valid conversation ID
	userID := uuid.New()
	conversationID := uuid.New()
	req := createTestRequest("GET", "/conversations/" + conversationID.String() + "/messages", nil, userID)
	
	// Setup chi router context with valid ID
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", conversationID.String())
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	
	rr := httptest.NewRecorder()
	
	handler.GetConversationMessages(rr, req)
	
	// This will fail due to no service implementation but validates ID parsing
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.NotEqual(t, http.StatusBadRequest, rr.Code) // Validates UUID was parsed correctly
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func boolPtr(b bool) *bool {
	return &b
}
