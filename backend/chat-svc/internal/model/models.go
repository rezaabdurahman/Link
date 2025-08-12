package model

import (
	"time"

	"github.com/google/uuid"
)

// ChatRoom represents a chat room
type ChatRoom struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	CreatedBy   uuid.UUID `json:"created_by" db:"created_by"`
	IsPrivate   bool      `json:"is_private" db:"is_private"`
	MaxMembers  int       `json:"max_members" db:"max_members"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Message represents a chat message
type Message struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	RoomID      uuid.UUID   `json:"room_id" db:"room_id"`
	UserID      uuid.UUID   `json:"user_id" db:"user_id"`
	Content     string      `json:"content" db:"content"`
	MessageType MessageType `json:"message_type" db:"message_type"`
	ParentID    *uuid.UUID  `json:"parent_id,omitempty" db:"parent_id"`
	EditedAt    *time.Time  `json:"edited_at,omitempty" db:"edited_at"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

// MessageType represents the type of message
type MessageType string

const (
	MessageTypeText   MessageType = "text"
	MessageTypeImage  MessageType = "image"
	MessageTypeFile   MessageType = "file"
	MessageTypeVideo  MessageType = "video"
	MessageTypeAudio  MessageType = "audio"
	MessageTypeSystem MessageType = "system"
)

// RoomMember represents a member of a chat room
type RoomMember struct {
	ID       uuid.UUID  `json:"id" db:"id"`
	RoomID   uuid.UUID  `json:"room_id" db:"room_id"`
	UserID   uuid.UUID  `json:"user_id" db:"user_id"`
	Role     MemberRole `json:"role" db:"role"`
	JoinedAt time.Time  `json:"joined_at" db:"joined_at"`
	LeftAt   *time.Time `json:"left_at,omitempty" db:"left_at"`
}

// MemberRole represents a member's role in a chat room
type MemberRole string

const (
	MemberRoleOwner     MemberRole = "owner"
	MemberRoleAdmin     MemberRole = "admin"
	MemberRoleModerator MemberRole = "moderator"
	MemberRoleMember    MemberRole = "member"
)

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type    WSMessageType `json:"type"`
	RoomID  uuid.UUID     `json:"room_id"`
	UserID  uuid.UUID     `json:"user_id"`
	Message *Message      `json:"message,omitempty"`
	Data    interface{}   `json:"data,omitempty"`
	Error   string        `json:"error,omitempty"`
}

// WSMessageType represents WebSocket message types
type WSMessageType string

const (
	WSMessageTypeJoin       WSMessageType = "join"
	WSMessageTypeLeave      WSMessageType = "leave"
	WSMessageTypeMessage    WSMessageType = "message"
	WSMessageTypeTyping     WSMessageType = "typing"
	WSMessageTypeStopTyping WSMessageType = "stop_typing"
	WSMessageTypeUserJoined WSMessageType = "user_joined"
	WSMessageTypeUserLeft   WSMessageType = "user_left"
	WSMessageTypeError      WSMessageType = "error"
	WSMessageTypeHeartbeat  WSMessageType = "heartbeat"
)

// CreateRoomRequest represents a request to create a chat room
type CreateRoomRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
	MaxMembers  int    `json:"max_members"`
}

// SendMessageRequest represents a request to send a message
type SendMessageRequest struct {
	Content     string      `json:"content"`
	MessageType MessageType `json:"message_type"`
	ParentID    *uuid.UUID  `json:"parent_id,omitempty"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Data    interface{} `json:"data"`
	Total   int         `json:"total"`
	Limit   int         `json:"limit"`
	Offset  int         `json:"offset"`
	HasMore bool        `json:"has_more"`
}

// MessageRead represents the read status of a message by a user
type MessageRead struct {
	ID        uuid.UUID `json:"id" db:"id"`
	MessageID uuid.UUID `json:"message_id" db:"message_id"`
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	ReadAt    time.Time `json:"read_at" db:"read_at"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string            `json:"error"`
	Code    int               `json:"code"`
	Details map[string]string `json:"details,omitempty"`
}

// UserPresence represents a user's presence status
type UserPresence struct {
	UserID    uuid.UUID     `json:"user_id"`
	Status    PresenceStatus `json:"status"`
	LastSeen  time.Time     `json:"last_seen"`
	RoomID    *uuid.UUID    `json:"room_id,omitempty"` // Current room if online
}

// PresenceStatus represents user presence status
type PresenceStatus string

const (
	PresenceOnline  PresenceStatus = "online"
	PresenceAway    PresenceStatus = "away"
	PresenceOffline PresenceStatus = "offline"
	PresenceBusy    PresenceStatus = "busy"
)

// ConversationWithUnread extends ChatRoom with unread count
type ConversationWithUnread struct {
	*ChatRoom
	UnreadCount int `json:"unread_count"`
	LastMessage *Message `json:"last_message,omitempty"`
}

// DirectConversation represents a direct conversation between two users
type DirectConversation struct {
	ID           uuid.UUID `json:"id"`
	Participant1 uuid.UUID `json:"participant_1"`
	Participant2 uuid.UUID `json:"participant_2"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// RealtimeEvent represents events published to Redis for real-time updates
type RealtimeEvent struct {
	Type      RealtimeEventType `json:"type"`
	RoomID    uuid.UUID         `json:"room_id"`
	UserID    uuid.UUID         `json:"user_id"`
	Message   *Message          `json:"message,omitempty"`
	Presence  *UserPresence     `json:"presence,omitempty"`
	Data      interface{}       `json:"data,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
}

// RealtimeEventType represents types of real-time events
type RealtimeEventType string

const (
	EventTypeNewMessage     RealtimeEventType = "new_message"
	EventTypeUserJoined     RealtimeEventType = "user_joined"
	EventTypeUserLeft       RealtimeEventType = "user_left"
	EventTypeTypingStart    RealtimeEventType = "typing_start"
	EventTypeTypingStop     RealtimeEventType = "typing_stop"
	EventTypePresenceUpdate RealtimeEventType = "presence_update"
	EventTypeMessageRead    RealtimeEventType = "message_read"
)
