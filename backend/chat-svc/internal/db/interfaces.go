package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/link-app/chat-svc/internal/model"
)

// ConversationRepository defines the interface for conversation (chat room) operations
type ConversationRepository interface {
	// ListConversations returns paginated conversations for a user
	ListConversations(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ChatRoom, int, error)
	
	// CreateConversation creates a new conversation
	CreateConversation(ctx context.Context, room *model.ChatRoom) error
	
	// GetConversationByID retrieves a conversation by ID
	GetConversationByID(ctx context.Context, roomID uuid.UUID) (*model.ChatRoom, error)
	
	// UpdateConversation updates a conversation
	UpdateConversation(ctx context.Context, room *model.ChatRoom) error
	
	// DeleteConversation soft deletes a conversation
	DeleteConversation(ctx context.Context, roomID uuid.UUID) error
	
	// GetConversationsByUserID returns all conversations for a user
	GetConversationsByUserID(ctx context.Context, userID uuid.UUID) ([]*model.ChatRoom, error)
	
	// CreateDirectConversation creates a direct conversation between two users
	CreateDirectConversation(ctx context.Context, participant1, participant2 uuid.UUID) (*model.ChatRoom, error)
	
	// GetDirectConversation finds existing direct conversation between two users
	GetDirectConversation(ctx context.Context, participant1, participant2 uuid.UUID) (*model.ChatRoom, error)
	
	// ListConversationsWithUnread returns conversations with unread counts
	ListConversationsWithUnread(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ConversationWithUnread, int, error)
}

// MessageRepository defines the interface for message operations
type MessageRepository interface {
	// ListMessages returns paginated messages for a conversation
	ListMessages(ctx context.Context, convoID, userID uuid.UUID, page, size int) ([]*model.Message, int, error)
	
	// CreateMessage creates a new message
	CreateMessage(ctx context.Context, message *model.Message) error
	
	// GetMessageByID retrieves a message by ID
	GetMessageByID(ctx context.Context, messageID uuid.UUID) (*model.Message, error)
	
	// UpdateMessage updates a message
	UpdateMessage(ctx context.Context, message *model.Message) error
	
	// DeleteMessage soft deletes a message
	DeleteMessage(ctx context.Context, messageID uuid.UUID) error
	
	// MarkMessagesAsRead marks messages as read for a user
	MarkMessagesAsRead(ctx context.Context, userID uuid.UUID, messageIDs []uuid.UUID) error
	
	// GetUnreadCount returns the count of unread messages for a user in a conversation
	GetUnreadCount(ctx context.Context, userID, convoID uuid.UUID) (int, error)
}

// RoomMemberRepository defines the interface for room member operations
type RoomMemberRepository interface {
	// AddMember adds a member to a room
	AddMember(ctx context.Context, member *model.RoomMember) error
	
	// RemoveMember removes a member from a room
	RemoveMember(ctx context.Context, roomID, userID uuid.UUID) error
	
	// GetRoomMembers returns all members of a room
	GetRoomMembers(ctx context.Context, roomID uuid.UUID) ([]*model.RoomMember, error)
	
	// IsUserMember checks if a user is a member of a room
	IsUserMember(ctx context.Context, roomID, userID uuid.UUID) (bool, error)
	
	// UpdateMemberRole updates a member's role in a room
	UpdateMemberRole(ctx context.Context, roomID, userID uuid.UUID, role model.MemberRole) error
}

// Repository aggregates all repository interfaces
type Repository struct {
	Conversations ConversationRepository
	Messages      MessageRepository
	RoomMembers   RoomMemberRepository
}
