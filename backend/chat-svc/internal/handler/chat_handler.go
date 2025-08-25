package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/api"
	"github.com/link-app/chat-svc/internal/middleware"
	"github.com/link-app/chat-svc/internal/model"
	"github.com/link-app/chat-svc/internal/service"
)

// ChatHandler handles HTTP requests and WebSocket connections for chat operations
type ChatHandler struct {
	service     *service.Service
	logger      *logrus.Logger
	upgrader    websocket.Upgrader
	authMw      *middleware.AuthMiddleware
	connections map[string]*websocket.Conn // conversation_id:user_id -> connection mapping
	mu          sync.RWMutex               // Mutex for thread-safe connections map access
}

// NewChatHandler creates a new chat handler
func NewChatHandler(service *service.Service, logger *logrus.Logger, authMw *middleware.AuthMiddleware) *ChatHandler {
	return &ChatHandler{
		service: service,
		logger:  logger,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// In production, implement proper origin checking
				return true
			},
			Subprotocols: []string{"jwt"},
		},
		authMw:      authMw,
		connections: make(map[string]*websocket.Conn),
		mu:          sync.RWMutex{},
	}
}

// Routes returns the router with all chat routes
func (h *ChatHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Apply authentication middleware to all routes
	r.Use(h.authMw.Middleware)

	// Conversation routes
	r.Get("/conversations", h.GetConversations)
	r.Post("/conversations", h.CreateConversation)
	r.Get("/conversations/{id}/messages", h.GetConversationMessages)

	// Message routes
	r.Post("/messages", h.SendMessage)

	return r
}

// GetConversations handles GET /api/v1/chat/conversations
func (h *ChatHandler) GetConversations(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		h.writeError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil || offset < 0 {
		offset = 0
	}

	conversations, total, err := h.service.GetConversationService().GetUserConversations(r.Context(), userID, limit, offset)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get user conversations")
		h.writeError(w, "Failed to get conversations", http.StatusInternalServerError)
		return
	}

	// Convert to API response format
	apiConversations := make([]api.Conversation, 0, len(conversations))
	for _, conv := range conversations {
		apiConv := h.mapToAPIConversation(conv)
		apiConversations = append(apiConversations, apiConv)
	}

	response := api.ConversationsResponse{
		Data:    apiConversations,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		HasMore: total > offset+limit,
	}

	h.writeJSON(w, response, http.StatusOK)
}

// CreateConversation handles POST /api/v1/chat/conversations
func (h *ChatHandler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		h.writeError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req api.CreateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Type == "" {
		h.writeError(w, "Conversation type is required", http.StatusBadRequest)
		return
	}

	// For group conversations, name is required
	if req.Type == api.Group && (req.Name == nil || *req.Name == "") {
		h.writeError(w, "Name is required for group conversations", http.StatusBadRequest)
		return
	}

	// Convert to internal model
	createReq := model.CreateRoomRequest{
		Name:        getStringOrEmpty(req.Name),
		Description: getStringOrEmpty(req.Description),
		IsPrivate:   getBoolOrDefault(req.IsPrivate, false),
		MaxMembers:  getIntOrDefault(req.MaxMembers, 100),
	}

	// Get participant IDs
	participantIDs := []uuid.UUID{}
	if req.ParticipantIds != nil {
		for _, id := range *req.ParticipantIds {
			participantIDs = append(participantIDs, uuid.UUID(id))
		}
	}

	var conversation *model.ChatRoom
	var err error

	if req.Type == api.Direct {
		// For direct conversations, we need exactly one participant
		if len(participantIDs) != 1 {
			h.writeError(w, "Direct conversations require exactly one participant", http.StatusBadRequest)
			return
		}
		conversation, err = h.service.GetConversationService().CreateDirectConversation(r.Context(), userID, participantIDs[0])
	} else {
		// For group conversations
		conversation, err = h.service.GetConversationService().CreateGroupConversation(r.Context(), createReq, userID, participantIDs)
	}

	if err != nil {
		h.logger.WithError(err).Error("Failed to create conversation")
		h.writeError(w, "Failed to create conversation", http.StatusInternalServerError)
		return
	}

	// Convert to API response
	apiConv := h.mapToAPIConversation(&model.ConversationWithUnread{
		Conversation: model.ConversationFromChatRoom(conversation),
		UnreadCount:  0,
		LastMessage:  nil,
	})

	h.writeJSON(w, apiConv, http.StatusCreated)
}

// GetConversationMessages handles GET /api/v1/chat/conversations/{id}/messages
func (h *ChatHandler) GetConversationMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		h.writeError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse conversation ID
	conversationIDStr := chi.URLParam(r, "id")
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		h.writeError(w, "Invalid conversation ID", http.StatusBadRequest)
		return
	}

	// Parse query parameters
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil || offset < 0 {
		offset = 0
	}

	var before *time.Time
	beforeStr := r.URL.Query().Get("before")
	if beforeStr != "" {
		t, err := time.Parse(time.RFC3339, beforeStr)
		if err == nil {
			before = &t
		}
	}

	// Get messages
	messages, total, err := h.service.GetMessageService().GetConversationMessages(
		r.Context(), conversationID, userID, limit, offset, before,
	)
	if err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "not a member") {
			h.writeError(w, "Conversation not found or access denied", http.StatusNotFound)
			return
		}
		h.logger.WithError(err).Error("Failed to get conversation messages")
		h.writeError(w, "Failed to get messages", http.StatusInternalServerError)
		return
	}

	// Convert to API response
	apiMessages := make([]api.Message, 0, len(messages))
	for _, msg := range messages {
		apiMessages = append(apiMessages, h.mapToAPIMessage(msg))
	}

	response := api.MessagesResponse{
		Data:    apiMessages,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		HasMore: total > offset+limit,
	}

	h.writeJSON(w, response, http.StatusOK)
}

// SendMessage handles POST /api/v1/chat/messages
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		h.writeError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req api.SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Content == "" {
		h.writeError(w, "Message content is required", http.StatusBadRequest)
		return
	}

	conversationID := uuid.UUID(req.ConversationId)

	// Set default message type if not provided
	messageType := model.MessageTypeText
	if req.MessageType != nil {
		messageType = model.MessageType(string(*req.MessageType))
	}

	// Convert parent ID if provided
	var parentID *uuid.UUID
	if req.ParentId != nil {
		pid := uuid.UUID(*req.ParentId)
		parentID = &pid
	}

	// Create internal request model
	msgReq := model.SendMessageRequest{
		Content:     req.Content,
		MessageType: messageType,
		ParentID:    parentID,
	}

	// Send message
	message, err := h.service.GetMessageService().SendMessage(r.Context(), msgReq, conversationID, userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "not a member") {
			h.writeError(w, "Conversation not found or access denied", http.StatusNotFound)
			return
		}
		h.logger.WithError(err).Error("Failed to send message")
		h.writeError(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	// Convert to API response
	apiMessage := h.mapToAPIMessage(message)

	// Broadcast message to WebSocket clients
	h.broadcastMessage(message)

	h.writeJSON(w, apiMessage, http.StatusCreated)
}

// HandleWebSocket handles WebSocket connections for real-time chat
func (h *ChatHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Verify subprotocol
	if !containsSubprotocol(r.Header.Get("Sec-WebSocket-Protocol"), "jwt") {
		h.logger.Error("WebSocket connection missing JWT subprotocol")
		http.Error(w, "WebSocket protocol 'jwt' is required", http.StatusBadRequest)
		return
	}

	// Get JWT token from query parameters
	token := r.URL.Query().Get("token")
	if token == "" {
		h.logger.Error("Missing JWT token for WebSocket connection")
		http.Error(w, "Missing JWT token", http.StatusUnauthorized)
		return
	}

	// Validate JWT token
	claims, err := h.authMw.ValidateWebSocketToken(token)
	if err != nil {
		h.logger.WithError(err).Error("Invalid JWT token for WebSocket connection")
		http.Error(w, "Invalid JWT token", http.StatusUnauthorized)
		return
	}

	userID := claims.UserID

	// Parse conversation ID from path
	conversationIDStr := chi.URLParam(r, "id")
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		h.logger.Error("Invalid conversation ID for WebSocket connection")
		http.Error(w, "Invalid conversation ID", http.StatusBadRequest)
		return
	}

	// Verify user is a member of the conversation
	isMember, err := h.service.GetConversationService().IsConversationMember(r.Context(), conversationID, userID)
	if err != nil || !isMember {
		h.logger.WithError(err).Error("User is not a member of the conversation")
		http.Error(w, "Not a member of the conversation", http.StatusForbidden)
		return
	}

	// Upgrade connection to WebSocket
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}

	// Store connection
	connectionKey := fmt.Sprintf("%s:%s", conversationID.String(), userID.String())
	
	h.mu.Lock()
	h.connections[connectionKey] = conn
	h.mu.Unlock()
	
	h.logger.WithFields(logrus.Fields{
		"conversation_id": conversationID,
		"user_id":         userID,
	}).Info("WebSocket connection established")

	// Notify other users that this user joined
	h.broadcastUserJoined(conversationID, userID)

	// Handle incoming messages
	go h.handleWebSocketConnection(conn, conversationID, userID)
}


// Helper methods
func (h *ChatHandler) writeJSON(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func (h *ChatHandler) writeError(w http.ResponseWriter, message string, statusCode int) {
	response := api.Error{
		Error: message,
		Code:  statusCode,
	}
	h.writeJSON(w, response, statusCode)
}

// handleWebSocketConnection processes incoming WebSocket messages for a connection
func (h *ChatHandler) handleWebSocketConnection(conn *websocket.Conn, conversationID, userID uuid.UUID) {
	defer func() {
		conn.Close()
		
		connectionKey := fmt.Sprintf("%s:%s", conversationID.String(), userID.String())
		
		h.mu.Lock()
		delete(h.connections, connectionKey)
		h.mu.Unlock()
		
		// Notify other users that this user left
		h.broadcastUserLeft(conversationID, userID)
		
		h.logger.WithFields(logrus.Fields{
			"conversation_id": conversationID,
			"user_id":         userID,
		}).Info("WebSocket connection closed")
	}()

	for {
		var wsMessage model.WebSocketMessage
		err := conn.ReadJSON(&wsMessage)
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				h.logger.WithError(err).Debug("WebSocket read error")
			}
			break
		}

		h.handleWebSocketMessage(conn, &wsMessage, conversationID, userID)
	}
}

// handleWebSocketMessage processes incoming WebSocket messages
func (h *ChatHandler) handleWebSocketMessage(conn *websocket.Conn, wsMessage *model.WebSocketMessage, conversationID, userID uuid.UUID) {
	ctx := context.Background()

	switch wsMessage.Type {
	case model.WSMessageTypeMessage:
		if wsMessage.Message == nil {
			h.sendWebSocketError(conn, "Message data is required")
			return
		}

		req := model.SendMessageRequest{
			Content:     wsMessage.Message.Content,
			MessageType: wsMessage.Message.MessageType,
			ParentID:    wsMessage.Message.ParentID,
		}

		message, err := h.service.GetMessageService().SendMessage(ctx, req, conversationID, userID)
		if err != nil {
			h.sendWebSocketError(conn, "Failed to send message")
			return
		}

		// Broadcast message to all connections in the conversation
		h.broadcastMessage(message)

	case model.WSMessageTypeTyping:
		// Broadcast typing indicator to all connections in the conversation
		h.broadcastTypingEvent(conversationID, userID, true)

	case model.WSMessageTypeStopTyping:
		// Broadcast stop typing indicator to all connections in the conversation
		h.broadcastTypingEvent(conversationID, userID, false)

	case model.WSMessageTypeHeartbeat:
		// Respond to heartbeat
		response := model.WebSocketMessage{
			Type:   model.WSMessageTypeHeartbeat,
			RoomID: conversationID,
			UserID: userID,
		}
		conn.WriteJSON(&response)

	default:
		h.sendWebSocketError(conn, "Unknown message type")
	}
}

// broadcastMessage broadcasts a new message to all WebSocket connections in a conversation
func (h *ChatHandler) broadcastMessage(message *model.Message) {
	// Ensure message has compatibility fields set
	message.SetCompatibilityFields()
	
	wsMessage := model.WebSocketMessage{
		Type:           model.WSMessageTypeMessage,
		ConversationID: message.ConversationID,
		UserID:         message.SenderID,
		Message:        message,
	}
	
	// Set compatibility fields for WebSocket message
	wsMessage.SetCompatibilityFields()

	h.broadcastToConversation(message.ConversationID, &wsMessage)
}

// broadcastUserJoined broadcasts a user joined event to all WebSocket connections in a conversation
func (h *ChatHandler) broadcastUserJoined(conversationID, userID uuid.UUID) {
	wsMessage := model.WebSocketMessage{
		Type:           model.WSMessageTypeUserJoined,
		ConversationID: conversationID,
		UserID:         userID,
	}
	
	// Set compatibility fields
	wsMessage.SetCompatibilityFields()

	h.broadcastToConversation(conversationID, &wsMessage)
}

// broadcastUserLeft broadcasts a user left event to all WebSocket connections in a conversation
func (h *ChatHandler) broadcastUserLeft(conversationID, userID uuid.UUID) {
	wsMessage := model.WebSocketMessage{
		Type:           model.WSMessageTypeUserLeft,
		ConversationID: conversationID,
		UserID:         userID,
	}
	
	// Set compatibility fields
	wsMessage.SetCompatibilityFields()

	h.broadcastToConversation(conversationID, &wsMessage)
}

// broadcastTypingEvent broadcasts a typing or stop typing event to all WebSocket connections in a conversation
func (h *ChatHandler) broadcastTypingEvent(conversationID, userID uuid.UUID, isTyping bool) {
	messageType := model.WSMessageTypeTyping
	if !isTyping {
		messageType = model.WSMessageTypeStopTyping
	}

	wsMessage := model.WebSocketMessage{
		Type:   messageType,
		RoomID: conversationID,
		UserID: userID,
	}

	h.broadcastToConversation(conversationID, &wsMessage)
}

// broadcastToConversation broadcasts a WebSocket message to all connections in a conversation
func (h *ChatHandler) broadcastToConversation(conversationID uuid.UUID, message *model.WebSocketMessage) {
	conversationPrefix := conversationID.String() + ":"
	
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	for connectionKey, conn := range h.connections {
		if strings.HasPrefix(connectionKey, conversationPrefix) {
			if err := conn.WriteJSON(message); err != nil {
				h.logger.WithError(err).Debug("Failed to send message to WebSocket connection")
				// Don't delete here to avoid concurrent map write during iteration
			}
		}
	}
}

// sendWebSocketError sends an error message over WebSocket
func (h *ChatHandler) sendWebSocketError(conn *websocket.Conn, errorMsg string) {
	response := model.WebSocketMessage{
		Type:  model.WSMessageTypeError,
		Error: errorMsg,
	}
	conn.WriteJSON(&response)
}

// mapToAPIConversation converts internal conversation model to API model
func (h *ChatHandler) mapToAPIConversation(conv *model.ConversationWithUnread) api.Conversation {
	// Determine conversation type from the embedded Conversation
	conversationType := api.Group
	if conv.Type == model.ConversationTypeDirect {
		conversationType = api.Direct
	}

	// Convert participants
	participants := make([]api.Participant, 0)
	// In a real implementation, you would fetch participants from the service

	// Convert last message if exists
	var lastMessage *api.Message
	if conv.LastMessage != nil {
		msg := h.mapToAPIMessage(conv.LastMessage)
		lastMessage = &msg
	}

	// Set default name and description based on conversation type
	var name, description *string
	defaultName := "Direct Conversation"
	if conv.Type == model.ConversationTypeGroup {
		defaultName = "Group Conversation"
	}
	name = &defaultName
	
	// Set default max members based on type
	maxMembers := 100 // Default for group
	if conv.Type == model.ConversationTypeDirect {
		maxMembers = 2
	}
	maxMembersPtr := &maxMembers

	// Set default privacy based on type
	isPrivate := conv.Type == model.ConversationTypeDirect

	return api.Conversation{
		Id:          openapi_types.UUID(conv.ID),
		Name:        name,
		Description: description,
		Type:        conversationType,
		IsPrivate:   isPrivate,
		MaxMembers:  maxMembersPtr,
		CreatedBy:   openapi_types.UUID(conv.CreatorID),
		Participants: participants,
		UnreadCount: conv.UnreadCount,
		LastMessage: lastMessage,
		CreatedAt:   conv.CreatedAt,
		UpdatedAt:   conv.CreatedAt, // Use CreatedAt since we don't track UpdatedAt in new schema
	}
}

// mapToAPIMessage converts internal message model to API model
func (h *ChatHandler) mapToAPIMessage(msg *model.Message) api.Message {
	// Convert parent ID if exists
	var parentID *openapi_types.UUID
	if msg.ParentID != nil {
		pid := openapi_types.UUID(*msg.ParentID)
		parentID = &pid
	}

	return api.Message{
		Id:            openapi_types.UUID(msg.ID),
		ConversationId: openapi_types.UUID(msg.RoomID),
		UserId:        openapi_types.UUID(msg.UserID),
		Content:       msg.Content,
		MessageType:   api.MessageType(string(msg.MessageType)),
		ParentId:      parentID,
		EditedAt:      msg.EditedAt,
		CreatedAt:     msg.CreatedAt,
		UpdatedAt:     msg.UpdatedAt,
	}
}

// Helper functions for optional fields

func getStringOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func getBoolOrDefault(b *bool, defaultValue bool) bool {
	if b == nil {
		return defaultValue
	}
	return *b
}

func getIntOrDefault(i *int, defaultValue int) int {
	if i == nil {
		return defaultValue
	}
	return *i
}

// containsSubprotocol checks if a subprotocol is in the list
func containsSubprotocol(header, protocol string) bool {
	protocols := strings.Split(header, ", ")
	for _, p := range protocols {
		if p == protocol {
			return true
		}
	}
	return false
}
