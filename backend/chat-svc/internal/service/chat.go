package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/config"
	"github.com/link-app/chat-svc/internal/db"
	"github.com/link-app/chat-svc/internal/model"
)

// Service orchestrates all chat operations with Redis integration
type Service struct {
	repo   *db.Repository
	redis  *RedisService
	logger *logrus.Logger
}

// New creates a new chat service orchestrator
func New(cfg *config.Config, repo *db.Repository, logger *logrus.Logger) *Service {
	redisService := NewRedisService(&cfg.Redis, logger)
	
	return &Service{
		repo:   repo,
		redis:  redisService,
		logger: logger,
	}
}

// ConversationService provides conversation management operations
type ConversationService struct {
	*Service
}

// MessageService provides message operations
type MessageService struct {
	*Service
}

// PresenceService provides presence and real-time features
type PresenceService struct {
	*Service
}

// GetConversationService returns conversation service
func (s *Service) GetConversationService() *ConversationService {
	return &ConversationService{Service: s}
}

// GetMessageService returns message service
func (s *Service) GetMessageService() *MessageService {
	return &MessageService{Service: s}
}

// GetPresenceService returns presence service
func (s *Service) GetPresenceService() *PresenceService {
	return &PresenceService{Service: s}
}

// =======================
// Conversation Operations
// =======================

// CreateGroupConversation creates a new group conversation with validation
func (cs *ConversationService) CreateGroupConversation(ctx context.Context, req model.CreateRoomRequest, creatorID uuid.UUID, participantIDs []uuid.UUID) (*model.ChatRoom, error) {
	// Validate request and participants
	if err := cs.validateGroupConversationRequest(req, creatorID, participantIDs); err != nil {
		return nil, fmt.Errorf("invalid group conversation request: %w", err)
	}

	// Ensure uniqueness by checking if identical group already exists
	if existingRoom := cs.findExistingGroupConversation(ctx, participantIDs); existingRoom != nil {
		cs.logger.WithFields(logrus.Fields{
			"existing_room_id": existingRoom.ID,
			"participants":     participantIDs,
		}).Info("Returning existing group conversation")
		return existingRoom, nil
	}

	// Create conversation
	room := &model.ChatRoom{
		ID:          uuid.New(),
		Name:        strings.TrimSpace(req.Name),
		Description: strings.TrimSpace(req.Description),
		CreatedBy:   creatorID,
		IsPrivate:   req.IsPrivate,
		MaxMembers:  req.MaxMembers,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := cs.repo.Conversations.CreateConversation(ctx, room); err != nil {
		cs.logger.WithError(err).Error("Failed to create group conversation")
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	// Add all participants as members
	allParticipants := append(participantIDs, creatorID)
	if err := cs.addConversationMembers(ctx, room.ID, allParticipants, creatorID); err != nil {
		return nil, fmt.Errorf("failed to add members: %w", err)
	}

	// Publish group creation event
	cs.publishGroupCreatedEvent(ctx, room, allParticipants)

	cs.logger.WithFields(logrus.Fields{
		"room_id":       room.ID,
		"creator_id":    creatorID,
		"member_count":  len(allParticipants),
		"room_name":     room.Name,
	}).Info("Group conversation created successfully")

	return room, nil
}

// CreateDirectConversation creates or retrieves a direct conversation between two users
func (cs *ConversationService) CreateDirectConversation(ctx context.Context, participant1, participant2 uuid.UUID) (*model.ChatRoom, error) {
	// Validate participants
	if err := cs.validateDirectConversationParticipants(participant1, participant2); err != nil {
		return nil, fmt.Errorf("invalid direct conversation: %w", err)
	}

	// Check for existing direct conversation (enforces uniqueness)
	existingRoom, err := cs.repo.Conversations.GetDirectConversation(ctx, participant1, participant2)
	if err == nil {
		cs.logger.WithFields(logrus.Fields{
			"room_id":      existingRoom.ID,
			"participant1": participant1,
			"participant2": participant2,
		}).Debug("Direct conversation already exists")
		return existingRoom, nil
	}

	// Create new direct conversation
	room, err := cs.repo.Conversations.CreateDirectConversation(ctx, participant1, participant2)
	if err != nil {
		cs.logger.WithError(err).Error("Failed to create direct conversation")
		return nil, fmt.Errorf("failed to create direct conversation: %w", err)
	}

	// Publish direct conversation creation event
	participants := []uuid.UUID{participant1, participant2}
	cs.publishDirectConversationCreatedEvent(ctx, room, participants)

	cs.logger.WithFields(logrus.Fields{
		"room_id":      room.ID,
		"participant1": participant1,
		"participant2": participant2,
	}).Info("Direct conversation created successfully")

	return room, nil
}

// GetConversationsWithUnread retrieves user's conversations with unread message counts
func (cs *ConversationService) GetConversationsWithUnread(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ConversationWithUnread, int, error) {
	// Get conversations from database with basic unread counts
	conversations, total, err := cs.repo.Conversations.ListConversationsWithUnread(ctx, userID, page, size)
	if err != nil {
		cs.logger.WithError(err).Error("Failed to list conversations")
		return nil, 0, fmt.Errorf("failed to list conversations: %w", err)
	}

	// Enhance with Redis real-time unread counts
	for _, conv := range conversations {
		redisUnread, err := cs.redis.GetUnreadCount(ctx, userID, conv.ID)
		if err == nil && redisUnread > conv.UnreadCount {
			// Use Redis count if higher (more up-to-date)
			conv.UnreadCount = redisUnread
		}
	}

	cs.logger.WithFields(logrus.Fields{
		"user_id":     userID,
		"total_convs": total,
		"page":        page,
		"size":        size,
	}).Debug("Retrieved conversations with unread counts")

	return conversations, total, nil
}

// GetConversation retrieves a conversation with membership validation
func (cs *ConversationService) GetConversation(ctx context.Context, roomID, userID uuid.UUID) (*model.ChatRoom, error) {
	// Validate membership
	if !cs.isUserMemberOfConversation(ctx, roomID, userID) {
		return nil, fmt.Errorf("user is not a member of this conversation")
	}

	room, err := cs.repo.Conversations.GetConversationByID(ctx, roomID)
	if err != nil {
		cs.logger.WithError(err).Error("Failed to get conversation")
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	return room, nil
}

// JoinConversation adds a user to a conversation with validation
func (cs *ConversationService) JoinConversation(ctx context.Context, roomID, userID uuid.UUID) error {
	// Validate join request
	if err := cs.validateJoinRequest(ctx, roomID, userID); err != nil {
		return fmt.Errorf("cannot join conversation: %w", err)
	}

	// Add member
	member := &model.RoomMember{
		ID:       uuid.New(),
		RoomID:   roomID,
		UserID:   userID,
		Role:     model.MemberRoleMember,
		JoinedAt: time.Now().UTC(),
	}

	if err := cs.repo.RoomMembers.AddMember(ctx, member); err != nil {
		return fmt.Errorf("failed to join conversation: %w", err)
	}

	// Publish user joined event
	event := &model.RealtimeEvent{
		Type:           model.EventTypeUserJoined,
		ConversationID: roomID,
		UserID:         userID,
	}
	cs.redis.PublishRealtimeEvent(ctx, event)

	cs.logger.WithFields(logrus.Fields{
		"room_id": roomID,
		"user_id": userID,
	}).Info("User joined conversation")

	return nil
}

// LeaveConversation removes a user from a conversation
func (cs *ConversationService) LeaveConversation(ctx context.Context, roomID, userID uuid.UUID) error {
	// Validate leave request
	if !cs.isUserMemberOfConversation(ctx, roomID, userID) {
		return fmt.Errorf("user is not a member of this conversation")
	}

	// Remove member
	if err := cs.repo.RoomMembers.RemoveMember(ctx, roomID, userID); err != nil {
		return fmt.Errorf("failed to leave conversation: %w", err)
	}

	// Clear user's unread count for this conversation
	cs.redis.ResetUnreadCount(ctx, userID, roomID)

	// Publish user left event
	event := &model.RealtimeEvent{
		Type:   model.EventTypeUserLeft,
		ConversationID: roomID,
		UserID: userID,
	}
	cs.redis.PublishRealtimeEvent(ctx, event)

	cs.logger.WithFields(logrus.Fields{
		"room_id": roomID,
		"user_id": userID,
	}).Info("User left conversation")

	return nil
}

// GetConversationMembers retrieves all members of a conversation
func (cs *ConversationService) GetConversationMembers(ctx context.Context, roomID, requesterID uuid.UUID) ([]*model.RoomMember, error) {
	// Validate membership
	if !cs.isUserMemberOfConversation(ctx, roomID, requesterID) {
		return nil, fmt.Errorf("user is not a member of this conversation")
	}

	members, err := cs.repo.RoomMembers.GetRoomMembers(ctx, roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation members: %w", err)
	}

	return members, nil
}

// ====================
// Message Operations
// ====================

// SendMessage sends a message with comprehensive validation and real-time distribution
func (ms *MessageService) SendMessage(ctx context.Context, req model.SendMessageRequest, roomID, userID uuid.UUID) (*model.Message, error) {
	// Validate message and membership
	if err := ms.validateMessageSend(ctx, req, roomID, userID); err != nil {
		return nil, fmt.Errorf("invalid message send: %w", err)
	}

	// Create message
	message := &model.Message{
		ID:          uuid.New(),
		RoomID:      roomID,
		UserID:      userID,
		Content:     strings.TrimSpace(req.Content),
		MessageType: req.MessageType,
		ParentID:    req.ParentID,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	// Store message
	if err := ms.repo.Messages.CreateMessage(ctx, message); err != nil {
		ms.logger.WithError(err).Error("Failed to create message")
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	// Handle post-message operations asynchronously
	go ms.handlePostMessageOperations(context.Background(), message, roomID, userID)

	ms.logger.WithFields(logrus.Fields{
		"message_id": message.ID,
		"room_id":    roomID,
		"user_id":    userID,
		"type":       message.MessageType,
	}).Info("Message sent successfully")

	return message, nil
}

// GetMessages retrieves paginated messages for a conversation
func (ms *MessageService) GetMessages(ctx context.Context, roomID, userID uuid.UUID, page, size int) ([]*model.Message, int, error) {
	// Validate membership
	if !ms.isUserMemberOfConversation(ctx, roomID, userID) {
		return nil, 0, fmt.Errorf("user is not a member of this conversation")
	}

	messages, total, err := ms.repo.Messages.ListMessages(ctx, roomID, userID, page, size)
	if err != nil {
		ms.logger.WithError(err).Error("Failed to get messages")
		return nil, 0, fmt.Errorf("failed to get messages: %w", err)
	}

	return messages, total, nil
}

// MarkMessagesAsRead marks messages as read and updates unread counts
func (ms *MessageService) MarkMessagesAsRead(ctx context.Context, userID uuid.UUID, messageIDs []uuid.UUID, roomID uuid.UUID) error {
	if len(messageIDs) == 0 {
		return errors.New("no message IDs provided")
	}

	// Mark as read in database
	if err := ms.repo.Messages.MarkMessagesAsRead(ctx, userID, messageIDs); err != nil {
		ms.logger.WithError(err).Error("Failed to mark messages as read")
		return fmt.Errorf("failed to mark messages as read: %w", err)
	}

	// Reset Redis unread count
	if err := ms.redis.ResetUnreadCount(ctx, userID, roomID); err != nil {
		ms.logger.WithError(err).Error("Failed to reset Redis unread count")
		// Don't fail operation for Redis errors
	}

	// Publish read event
	event := &model.RealtimeEvent{
		Type:   model.EventTypeMessageRead,
		ConversationID: roomID,
		UserID: userID,
		Data:   map[string]interface{}{"message_ids": messageIDs, "count": len(messageIDs)},
	}
	ms.redis.PublishRealtimeEvent(ctx, event)

	ms.logger.WithFields(logrus.Fields{
		"user_id":       userID,
		"room_id":       roomID,
		"message_count": len(messageIDs),
	}).Debug("Messages marked as read")

	return nil
}

// GetUnreadCount gets unread message count for a user in a conversation
func (ms *MessageService) GetUnreadCount(ctx context.Context, userID, roomID uuid.UUID) (int, error) {
	// Get from Redis first (most up-to-date)
	redisCount, err := ms.redis.GetUnreadCount(ctx, userID, roomID)
	if err == nil {
		return redisCount, nil
	}

	// Fallback to database
	dbCount, err := ms.repo.Messages.GetUnreadCount(ctx, userID, roomID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return dbCount, nil
}

// ====================
// Presence Operations
// ====================

// SetUserPresence updates user presence with Redis TTL
func (ps *PresenceService) SetUserPresence(ctx context.Context, userID uuid.UUID, status model.PresenceStatus, roomID *uuid.UUID) error {
	presence := model.UserPresence{
		UserID:   userID,
		Status:   status,
		LastSeen: time.Now().UTC(),
		ConversationID: roomID,
	}

	if err := ps.redis.SetUserPresence(ctx, userID, presence); err != nil {
		ps.logger.WithError(err).Error("Failed to set user presence")
		return fmt.Errorf("failed to set presence: %w", err)
	}

	ps.logger.WithFields(logrus.Fields{
		"user_id": userID,
		"status":  status,
		"room_id": roomID,
	}).Debug("User presence updated")

	return nil
}

// GetUserPresence retrieves user presence status
func (ps *PresenceService) GetUserPresence(ctx context.Context, userID uuid.UUID) (*model.UserPresence, error) {
	presence, err := ps.redis.GetUserPresence(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user presence: %w", err)
	}

	return presence, nil
}

// SetTypingIndicator manages typing indicators with auto-expiry
func (ps *PresenceService) SetTypingIndicator(ctx context.Context, roomID, userID uuid.UUID, isTyping bool) error {
	// Validate membership
	if !ps.isUserMemberOfConversation(ctx, roomID, userID) {
		return fmt.Errorf("user is not a member of this conversation")
	}

	if err := ps.redis.SetTypingIndicator(ctx, roomID, userID, isTyping); err != nil {
		ps.logger.WithError(err).Error("Failed to set typing indicator")
		return fmt.Errorf("failed to set typing indicator: %w", err)
	}

	return nil
}

// GetOnlineUsers retrieves all currently online users
func (ps *PresenceService) GetOnlineUsers(ctx context.Context) ([]uuid.UUID, error) {
	users, err := ps.redis.GetOnlineUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get online users: %w", err)
	}

	return users, nil
}

// RemoveUserPresence cleans up user presence on logout
func (ps *PresenceService) RemoveUserPresence(ctx context.Context, userID uuid.UUID) error {
	return ps.redis.RemoveUserPresence(ctx, userID)
}

// ====================
// Private Helper Methods
// ====================

// validateGroupConversationRequest validates group conversation creation
func (cs *ConversationService) validateGroupConversationRequest(req model.CreateRoomRequest, creatorID uuid.UUID, participantIDs []uuid.UUID) error {
	// Validate basic request
	if strings.TrimSpace(req.Name) == "" {
		return errors.New("group name is required")
	}
	if len(req.Name) > 100 {
		return errors.New("group name too long (max 100 characters)")
	}
	if len(req.Description) > 500 {
		return errors.New("group description too long (max 500 characters)")
	}

	// Validate participants
	if len(participantIDs) == 0 {
		return errors.New("at least one participant is required")
	}
	if len(participantIDs) > 1000 {
		return errors.New("too many participants (max 1000)")
	}

	// Check for duplicates and ensure creator is not in participants
	seen := make(map[uuid.UUID]bool)
	for _, id := range participantIDs {
		if id == creatorID {
			return errors.New("creator cannot be in participants list")
		}
		if seen[id] {
			return errors.New("duplicate participants not allowed")
		}
		seen[id] = true
	}

	return nil
}

// validateDirectConversationParticipants validates direct conversation participants
func (cs *ConversationService) validateDirectConversationParticipants(participant1, participant2 uuid.UUID) error {
	if participant1 == participant2 {
		return errors.New("cannot create conversation with yourself")
	}
	// Additional validation could include checking if users exist, are blocked, etc.
	return nil
}

// findExistingGroupConversation checks if identical group conversation exists
func (cs *ConversationService) findExistingGroupConversation(ctx context.Context, participantIDs []uuid.UUID) *model.ChatRoom {
	// This would require a more complex query to find groups with exact same members
	// For now, we'll return nil and rely on the database to handle uniqueness
	// In a production system, you might implement a hash-based approach
	return nil
}

// addConversationMembers adds members to a conversation
func (cs *ConversationService) addConversationMembers(ctx context.Context, roomID uuid.UUID, participantIDs []uuid.UUID, creatorID uuid.UUID) error {
	for _, participantID := range participantIDs {
		role := model.MemberRoleMember
		if participantID == creatorID {
			role = model.MemberRoleOwner
		}

		member := &model.RoomMember{
			ID:       uuid.New(),
			RoomID:   roomID,
			UserID:   participantID,
			Role:     role,
			JoinedAt: time.Now().UTC(),
		}

		if err := cs.repo.RoomMembers.AddMember(ctx, member); err != nil {
			cs.logger.WithError(err).WithFields(logrus.Fields{
				"room_id": roomID,
				"user_id": participantID,
			}).Error("Failed to add member to conversation")
			return fmt.Errorf("failed to add member %s: %w", participantID, err)
		}
	}
	return nil
}

// isUserMemberOfConversation checks if user is member of conversation
func (s *Service) isUserMemberOfConversation(ctx context.Context, roomID, userID uuid.UUID) bool {
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, roomID, userID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to check membership")
		return false
	}
	return isMember
}

// validateJoinRequest validates if user can join a conversation
func (cs *ConversationService) validateJoinRequest(ctx context.Context, roomID, userID uuid.UUID) error {
	// Check if room exists
	room, err := cs.repo.Conversations.GetConversationByID(ctx, roomID)
	if err != nil {
		return fmt.Errorf("conversation not found")
	}

	// Check if already a member
	if cs.isUserMemberOfConversation(ctx, roomID, userID) {
		return fmt.Errorf("user is already a member")
	}

	// Check capacity
	members, err := cs.repo.RoomMembers.GetRoomMembers(ctx, roomID)
	if err != nil {
		return fmt.Errorf("failed to check capacity")
	}
	if room.MaxMembers > 0 && len(members) >= room.MaxMembers {
		return fmt.Errorf("conversation has reached maximum capacity")
	}

	// Check if private room (would need additional invitation logic)
	if room.IsPrivate {
		// In a real system, you'd check for invitations here
		return fmt.Errorf("cannot join private conversation without invitation")
	}

	return nil
}

// validateMessageSend validates message sending request
func (ms *MessageService) validateMessageSend(ctx context.Context, req model.SendMessageRequest, roomID, userID uuid.UUID) error {
	// Validate content
	if strings.TrimSpace(req.Content) == "" {
		return errors.New("message content is required")
	}
	if len(req.Content) > 4000 {
		return errors.New("message content too long (max 4000 characters)")
	}

	// Validate message type
	validTypes := map[model.MessageType]bool{
		model.MessageTypeText:  true,
		model.MessageTypeImage: true,
		model.MessageTypeFile:  true,
		model.MessageTypeVideo: true,
		model.MessageTypeAudio: true,
	}
	if !validTypes[req.MessageType] {
		return fmt.Errorf("invalid message type: %s", req.MessageType)
	}

	// Validate membership
	if !ms.isUserMemberOfConversation(ctx, roomID, userID) {
		return errors.New("user is not a member of this conversation")
	}

	return nil
}

// handlePostMessageOperations handles asynchronous post-message operations
func (ms *MessageService) handlePostMessageOperations(ctx context.Context, message *model.Message, roomID, userID uuid.UUID) {
	// Update unread counts for all members except sender
	members, err := ms.repo.RoomMembers.GetRoomMembers(ctx, roomID)
	if err != nil {
		ms.logger.WithError(err).Error("Failed to get members for unread count update")
		return
	}

	for _, member := range members {
		if member.UserID == userID {
			continue // Skip sender
		}
		if err := ms.redis.IncrementUnreadCount(ctx, member.UserID, roomID); err != nil {
			ms.logger.WithError(err).WithField("user_id", member.UserID).Error("Failed to increment unread count")
		}
	}

	// Clear typing indicator for sender
	ms.redis.SetTypingIndicator(ctx, roomID, userID, false)

	// Publish real-time message event
	event := &model.RealtimeEvent{
		Type:    model.EventTypeNewMessage,
		RoomID:  roomID,
		UserID:  userID,
		Message: message,
	}
	if err := ms.redis.PublishRealtimeEvent(ctx, event); err != nil {
		ms.logger.WithError(err).Error("Failed to publish message event")
	}
}

// publishGroupCreatedEvent publishes group creation event
func (cs *ConversationService) publishGroupCreatedEvent(ctx context.Context, room *model.ChatRoom, participants []uuid.UUID) {
	for _, participantID := range participants {
		event := &model.RealtimeEvent{
			Type:   model.EventTypeUserJoined,
			ConversationID: room.ID,
			UserID: participantID,
			Data:   room,
		}
		cs.redis.PublishRealtimeEvent(ctx, event)
	}
}

// publishDirectConversationCreatedEvent publishes direct conversation creation event
func (cs *ConversationService) publishDirectConversationCreatedEvent(ctx context.Context, room *model.ChatRoom, participants []uuid.UUID) {
	for _, participantID := range participants {
		event := &model.RealtimeEvent{
			Type:   model.EventTypeUserJoined,
			ConversationID: room.ID,
			UserID: participantID,
			Data:   room,
		}
		cs.redis.PublishRealtimeEvent(ctx, event)
	}
}

// GetUserConversations retrieves user's conversations with unread counts (alias for backward compatibility)
func (cs *ConversationService) GetUserConversations(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*model.ConversationWithUnread, int, error) {
	// Convert offset-based pagination to page-based
	page := offset / limit
	if limit == 0 {
		limit = 20
	}
	return cs.GetConversationsWithUnread(ctx, userID, page, limit)
}

// GetConversationMessages retrieves paginated messages for a conversation with time filtering
func (ms *MessageService) GetConversationMessages(ctx context.Context, conversationID, userID uuid.UUID, limit, offset int, before *time.Time) ([]*model.Message, int, error) {
	// Validate membership
	if !ms.isUserMemberOfConversation(ctx, conversationID, userID) {
		return nil, 0, fmt.Errorf("user is not a member of this conversation")
	}

	// Convert offset-based pagination to page-based
	page := offset / limit
	if limit == 0 {
		limit = 50
	}

	// For now, ignore the 'before' timestamp filtering and use basic pagination
	// In a real implementation, you'd modify the repository method to support timestamp filtering
	messages, total, err := ms.repo.Messages.ListMessages(ctx, conversationID, userID, page, limit)
	if err != nil {
		ms.logger.WithError(err).Error("Failed to get conversation messages")
		return nil, 0, fmt.Errorf("failed to get messages: %w", err)
	}

	return messages, total, nil
}

// IsConversationMember checks if a user is a member of a conversation
func (cs *ConversationService) IsConversationMember(ctx context.Context, conversationID, userID uuid.UUID) (bool, error) {
	isMember, err := cs.repo.RoomMembers.IsUserMember(ctx, conversationID, userID)
	if err != nil {
		cs.logger.WithError(err).Error("Failed to check conversation membership")
		return false, fmt.Errorf("failed to check membership: %w", err)
	}
	return isMember, nil
}


// GetRedisService returns the Redis service
func (s *Service) GetRedisService() *RedisService {
	return s.redis
}

// Close closes all connections
func (s *Service) Close() error {
	return s.redis.Close()
}

// Health checks service health
func (s *Service) Health(ctx context.Context) error {
	return s.redis.Health(ctx)
}

// Wrapper methods for backward compatibility with handlers

// GetConversationsForUser delegates to ConversationService
func (s *Service) GetConversationsForUser(ctx context.Context, userID string) ([]*model.ConversationWithUnread, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}
	conversations, _, err := s.GetConversationService().GetConversationsWithUnread(ctx, userUUID, 1, 50)
	return conversations, err
}

// CreateConversation delegates to ConversationService  
func (s *Service) CreateConversation(ctx context.Context, req model.Conversation) (*model.ChatRoom, error) {
	// This is a simplified adapter - in reality you'd need to properly map the request
	// For now, return error to indicate it needs proper implementation
	return nil, fmt.Errorf("CreateConversation needs proper implementation based on request type")
}

// GetMessages delegates to MessageService
func (s *Service) GetMessages(ctx context.Context, roomID, userID uuid.UUID, page, size int) ([]*model.Message, int, error) {
	return s.GetMessageService().GetMessages(ctx, roomID, userID, page, size)
}

// SendMessage delegates to MessageService
func (s *Service) SendMessage(ctx context.Context, req model.SendMessageRequest, roomID, userID uuid.UUID) (*model.Message, error) {
	return s.GetMessageService().SendMessage(ctx, req, roomID, userID)
}
