package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/db"
	"github.com/link-app/chat-svc/internal/model"
)

// ChatService provides comprehensive business logic for chat operations
type ChatService struct {
	repo  *db.Repository
	redis *RedisService
	logger *logrus.Logger
}

// NewChatService creates a new chat service with Redis integration
func NewChatService(repo *db.Repository, redis *RedisService, logger *logrus.Logger) *ChatService {
	return &ChatService{
		repo:   repo,
		redis:  redis,
		logger: logger,
	}
}

// CreateRoom creates a new chat room with proper validation
func (s *ChatService) CreateRoom(ctx context.Context, req model.CreateRoomRequest, userID uuid.UUID) (*model.ChatRoom, error) {
	// Validate request
	if err := s.validateCreateRoomRequest(req); err != nil {
		return nil, fmt.Errorf("invalid room creation request: %w", err)
	}

	room := &model.ChatRoom{
		ID:          uuid.New(),
		Name:        strings.TrimSpace(req.Name),
		Description: strings.TrimSpace(req.Description),
		CreatedBy:   userID,
		IsPrivate:   req.IsPrivate,
		MaxMembers:  req.MaxMembers,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	// Create the room in database
	if err := s.repo.Conversations.CreateConversation(ctx, room); err != nil {
		s.logger.WithError(err).Error("Failed to create chat room")
		return nil, fmt.Errorf("failed to create chat room: %w", err)
	}

	// Add creator as owner
	member := &model.RoomMember{
		ID:       uuid.New(),
		RoomID:   room.ID,
		UserID:   userID,
		Role:     model.MemberRoleOwner,
		JoinedAt: time.Now().UTC(),
	}

	if err := s.repo.RoomMembers.AddMember(ctx, member); err != nil {
		s.logger.WithError(err).Error("Failed to add room creator as member")
		return nil, fmt.Errorf("failed to add room creator as member: %w", err)
	}

	// Publish room created event
	event := &model.RealtimeEvent{
		Type:   model.EventTypeUserJoined,
		ConversationID: room.ID,
		UserID: userID,
		Data:   room,
	}
	s.redis.PublishRealtimeEvent(ctx, event)

	s.logger.WithFields(logrus.Fields{
		"room_id":   room.ID,
		"room_name": room.Name,
		"user_id":   userID,
	}).Info("Chat room created successfully")

	return room, nil
}

// CreateDirectConversation creates or gets existing direct conversation
func (s *ChatService) CreateDirectConversation(ctx context.Context, participant1, participant2 uuid.UUID) (*model.ChatRoom, error) {
	// Validate participants
	if participant1 == participant2 {
		return nil, fmt.Errorf("cannot create conversation with yourself")
	}

	// Check if direct conversation already exists
	existingRoom, err := s.repo.Conversations.GetDirectConversation(ctx, participant1, participant2)
	if err == nil {
		s.logger.WithFields(logrus.Fields{
			"room_id":      existingRoom.ID,
			"participant1": participant1,
			"participant2": participant2,
		}).Debug("Direct conversation already exists")
		return existingRoom, nil
	}

	// Create new direct conversation
	room, err := s.repo.Conversations.CreateDirectConversation(ctx, participant1, participant2)
	if err != nil {
		s.logger.WithError(err).Error("Failed to create direct conversation")
		return nil, fmt.Errorf("failed to create direct conversation: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"room_id":      room.ID,
		"participant1": participant1,
		"participant2": participant2,
	}).Info("Direct conversation created")

	return room, nil
}

// GetRoom retrieves a chat room by ID with membership validation
func (s *ChatService) GetRoom(ctx context.Context, roomID, userID uuid.UUID) (*model.ChatRoom, error) {
	// Check if user is member of the room
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to check room membership")
		return nil, fmt.Errorf("failed to check room membership: %w", err)
	}

	if !isMember {
		return nil, fmt.Errorf("user is not a member of the room")
	}

	room, err := s.repo.Conversations.GetConversationByID(ctx, roomID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to get chat room")
		return nil, fmt.Errorf("failed to get chat room: %w", err)
	}

	return room, nil
}

// ListConversations retrieves paginated conversations with unread counts
func (s *ChatService) ListConversations(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ConversationWithUnread, int, error) {
	conversations, total, err := s.repo.Conversations.ListConversationsWithUnread(ctx, userID, page, size)
	if err != nil {
		s.logger.WithError(err).Error("Failed to list conversations")
		return nil, 0, fmt.Errorf("failed to list conversations: %w", err)
	}

	// Enhance with Redis unread counts (more real-time)
	for _, conv := range conversations {
		redisUnread, err := s.redis.GetUnreadCount(ctx, userID, conv.ID)
		if err == nil && redisUnread > 0 {
			// Use Redis count if available and higher (more recent)
			conv.UnreadCount = redisUnread
		}
	}

	return conversations, total, nil
}

// SendMessage sends a message with comprehensive validation and real-time features
func (s *ChatService) SendMessage(ctx context.Context, req model.SendMessageRequest, roomID, userID uuid.UUID) (*model.Message, error) {
	// Validate message content
	if err := s.validateSendMessageRequest(req); err != nil {
		return nil, fmt.Errorf("invalid message: %w", err)
	}

	// Check if user is member of the room
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to check room membership")
		return nil, fmt.Errorf("failed to check room membership: %w", err)
	}
	if !isMember {
		return nil, fmt.Errorf("user is not a member of the room")
	}

	// Create message
	message := &model.Message{
		ID:          uuid.New(),
		ConversationID:      roomID,
		UserID:      userID,
		Content:     strings.TrimSpace(req.Content),
		MessageType: req.MessageType,
		ParentID:    req.ParentID,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	// Store message in database
	if err := s.repo.Messages.CreateMessage(ctx, message); err != nil {
		s.logger.WithError(err).Error("Failed to send message")
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	// Update unread counts for all room members except sender
	go s.updateUnreadCounts(context.Background(), roomID, userID)

	// Clear typing indicator for sender
	s.redis.SetTypingIndicator(ctx, roomID, userID, false)

	// Publish real-time event
	event := &model.RealtimeEvent{
		Type:    model.EventTypeNewMessage,
		ConversationID:  roomID,
		UserID:  userID,
		Message: message,
	}
	s.redis.PublishRealtimeEvent(ctx, event)

	s.logger.WithFields(logrus.Fields{
		"message_id":   message.ID,
		"room_id":      roomID,
		"user_id":      userID,
		"message_type": message.MessageType,
	}).Info("Message sent successfully")

	return message, nil
}

// GetMessages retrieves paginated messages for a conversation
func (s *ChatService) GetMessages(ctx context.Context, roomID, userID uuid.UUID, page, size int) ([]*model.Message, int, error) {
	// Check if user is member of the room
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to check room membership")
		return nil, 0, fmt.Errorf("failed to check room membership: %w", err)
	}
	if !isMember {
		return nil, 0, fmt.Errorf("user is not a member of the room")
	}

	messages, total, err := s.repo.Messages.ListMessages(ctx, roomID, userID, page, size)
	if err != nil {
		s.logger.WithError(err).Error("Failed to get messages")
		return nil, 0, fmt.Errorf("failed to get messages: %w", err)
	}

	return messages, total, nil
}

// MarkMessagesAsRead marks messages as read and updates unread counts
func (s *ChatService) MarkMessagesAsRead(ctx context.Context, userID uuid.UUID, messageIDs []uuid.UUID, roomID uuid.UUID) error {
	if len(messageIDs) == 0 {
		return fmt.Errorf("no message IDs provided")
	}

	// Mark messages as read in database
	if err := s.repo.Messages.MarkMessagesAsRead(ctx, userID, messageIDs); err != nil {
		s.logger.WithError(err).Error("Failed to mark messages as read")
		return fmt.Errorf("failed to mark messages as read: %w", err)
	}

	// Reset unread count in Redis
	if err := s.redis.ResetUnreadCount(ctx, userID, roomID); err != nil {
		s.logger.WithError(err).Error("Failed to reset Redis unread count")
		// Don't fail the operation for Redis errors
	}

	// Publish message read event
	event := &model.RealtimeEvent{
		Type:   model.EventTypeMessageRead,
		ConversationID: roomID,
		UserID: userID,
		Data:   map[string]interface{}{"message_ids": messageIDs},
	}
	s.redis.PublishRealtimeEvent(ctx, event)

	s.logger.WithFields(logrus.Fields{
		"user_id":      userID,
		"room_id":      roomID,
		"message_count": len(messageIDs),
	}).Debug("Messages marked as read")

	return nil
}

// JoinRoom adds a user to a room with validation
func (s *ChatService) JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	// Check if room exists
	room, err := s.repo.Conversations.GetConversationByID(ctx, roomID)
	if err != nil {
		return fmt.Errorf("room not found: %w", err)
	}

	// Check if user is already a member
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if isMember {
		return fmt.Errorf("user is already a member of the room")
	}

	// Check room capacity
	members, err := s.repo.RoomMembers.GetRoomMembers(ctx, roomID)
	if err != nil {
		return fmt.Errorf("failed to get room members: %w", err)
	}
	if room.MaxMembers > 0 && len(members) >= room.MaxMembers {
		return fmt.Errorf("room has reached maximum capacity")
	}

	// Add member
	member := &model.RoomMember{
		ID:       uuid.New(),
		RoomID:   roomID,
		UserID:   userID,
		Role:     model.MemberRoleMember,
		JoinedAt: time.Now().UTC(),
	}

	if err := s.repo.RoomMembers.AddMember(ctx, member); err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	// Publish user joined event
	event := &model.RealtimeEvent{
		Type:   model.EventTypeUserJoined,
		ConversationID: roomID,
		UserID: userID,
	}
	s.redis.PublishRealtimeEvent(ctx, event)

	s.logger.WithFields(logrus.Fields{
		"room_id": roomID,
		"user_id": userID,
	}).Info("User joined room")

	return nil
}

// LeaveRoom removes a user from a room
func (s *ChatService) LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	// Check if user is member
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if !isMember {
		return fmt.Errorf("user is not a member of the room")
	}

	// Remove member
	if err := s.repo.RoomMembers.RemoveMember(ctx, roomID, userID); err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	// Publish user left event
	event := &model.RealtimeEvent{
		Type:   model.EventTypeUserLeft,
		ConversationID: roomID,
		UserID: userID,
	}
	s.redis.PublishRealtimeEvent(ctx, event)

	s.logger.WithFields(logrus.Fields{
		"room_id": roomID,
		"user_id": userID,
	}).Info("User left room")

	return nil
}

// SetUserPresence updates user presence status
func (s *ChatService) SetUserPresence(ctx context.Context, userID uuid.UUID, status model.PresenceStatus, roomID *uuid.UUID) error {
	presence := model.UserPresence{
		UserID:   userID,
		Status:   status,
		LastSeen: time.Now().UTC(),
		ConversationID:   roomID,
	}

	return s.redis.SetUserPresence(ctx, userID, presence)
}

// GetUserPresence retrieves user presence status
func (s *ChatService) GetUserPresence(ctx context.Context, userID uuid.UUID) (*model.UserPresence, error) {
	return s.redis.GetUserPresence(ctx, userID)
}

// SetTypingIndicator sets or clears typing indicator
func (s *ChatService) SetTypingIndicator(ctx context.Context, roomID, userID uuid.UUID, isTyping bool) error {
	// Check if user is member of the room
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		return fmt.Errorf("failed to check room membership: %w", err)
	}
	if !isMember {
		return fmt.Errorf("user is not a member of the room")
	}

	return s.redis.SetTypingIndicator(ctx, roomID, userID, isTyping)
}

// GetRoomMembers retrieves all members of a room
func (s *ChatService) GetRoomMembers(ctx context.Context, roomID, userID uuid.UUID) ([]*model.RoomMember, error) {
	// Check if user is member of the room
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check room membership: %w", err)
	}
	if !isMember {
		return nil, fmt.Errorf("user is not a member of the room")
	}

	members, err := s.repo.RoomMembers.GetRoomMembers(ctx, roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to get room members: %w", err)
	}

	return members, nil
}

// validateCreateRoomRequest validates room creation request
func (s *ChatService) validateCreateRoomRequest(req model.CreateRoomRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("room name is required")
	}
	if len(req.Name) > 100 {
		return fmt.Errorf("room name too long (max 100 characters)")
	}
	if len(req.Description) > 500 {
		return fmt.Errorf("room description too long (max 500 characters)")
	}
	if req.MaxMembers < 0 {
		return fmt.Errorf("max members cannot be negative")
	}
	if req.MaxMembers > 10000 {
		return fmt.Errorf("max members too high (max 10000)")
	}
	return nil
}

// validateSendMessageRequest validates message sending request
func (s *ChatService) validateSendMessageRequest(req model.SendMessageRequest) error {
	if strings.TrimSpace(req.Content) == "" {
		return fmt.Errorf("message content is required")
	}
	if len(req.Content) > 4000 {
		return fmt.Errorf("message content too long (max 4000 characters)")
	}
	// Validate message type
	validTypes := map[model.MessageType]bool{
		model.MessageTypeText:   true,
		model.MessageTypeImage:  true,
		model.MessageTypeFile:   true,
		model.MessageTypeVideo:  true,
		model.MessageTypeAudio:  true,
		model.MessageTypeSystem: false, // System messages cannot be sent by users
	}
	if !validTypes[req.MessageType] {
		return fmt.Errorf("invalid message type: %s", req.MessageType)
	}
	return nil
}

// updateUnreadCounts updates unread counts for all room members except sender
func (s *ChatService) updateUnreadCounts(ctx context.Context, roomID, senderID uuid.UUID) {
	members, err := s.repo.RoomMembers.GetRoomMembers(ctx, roomID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to get room members for unread count update")
		return
	}

	for _, member := range members {
		// Skip sender
		if member.UserID == senderID {
			continue
		}

		// Increment unread count in Redis
		if err := s.redis.IncrementUnreadCount(ctx, member.UserID, roomID); err != nil {
			s.logger.WithError(err).WithFields(logrus.Fields{
				"user_id": member.UserID,
				"room_id": roomID,
			}).Error("Failed to increment unread count")
		}
	}
}

