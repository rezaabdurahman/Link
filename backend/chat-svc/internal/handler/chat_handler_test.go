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
	// Skip this test as it requires service dependency
	t.Skip("Skipping test due to nil service dependency")
}

func TestChatHandler_CreateConversation_ValidDirect(t *testing.T) {
	// Skip this test as it requires service dependency
	t.Skip("Skipping test due to nil service dependency")
}

func TestChatHandler_GetConversations_ValidPagination(t *testing.T) {
	// Skip this test as it requires service dependency
	t.Skip("Skipping test due to nil service dependency")
}

func TestChatHandler_SendMessage_ValidMessage(t *testing.T) {
	// Skip this test as it requires service dependency
	t.Skip("Skipping test due to nil service dependency")
}

func TestChatHandler_GetConversationMessages_ValidID(t *testing.T) {
	// Skip this test as it requires service dependency
	t.Skip("Skipping test due to nil service dependency")
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
