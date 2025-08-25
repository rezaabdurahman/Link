package model

import (
	"time"

	"github.com/google/uuid"
)

// Conversation represents a conversation (matches DB schema)
type Conversation struct {
	ID        uuid.UUID       `json:"id" db:"id"`
	Type      ConversationType `json:"type" db:"type"`
	CreatorID uuid.UUID       `json:"creator_id" db:"creator_id"`
	CreatedAt time.Time       `json:"created_at" db:"created_at"`
}

// ConversationType represents the type of conversation
type ConversationType string

const (
	ConversationTypeDirect ConversationType = "direct"
	ConversationTypeGroup  ConversationType = "group"
)

// Compatibility layer for existing code - maps to new schema
// ChatRoom is a compatibility alias for Conversation with additional fields for backward compatibility
type ChatRoom struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	Name        string          `json:"name" db:"name"`          // Derived from type for direct, custom for group
	Description string          `json:"description" db:"description"` // Empty for direct conversations
	CreatedBy   uuid.UUID       `json:"created_by" db:"creator_id"`
	IsPrivate   bool            `json:"is_private" db:"is_private"` // Always true for direct, configurable for group
	MaxMembers  int             `json:"max_members" db:"max_members"` // 2 for direct, configurable for group
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"` // Same as created_at for now
	Type        ConversationType `json:"type" db:"type"` // New field from normalized schema
}

// ToConversation converts ChatRoom to Conversation for new schema
func (c *ChatRoom) ToConversation() *Conversation {
	return &Conversation{
		ID:        c.ID,
		Type:      c.Type,
		CreatorID: c.CreatedBy,
		CreatedAt: c.CreatedAt,
	}
}

// FromConversation creates ChatRoom from Conversation for backward compatibility
func ChatRoomFromConversation(conv *Conversation) *ChatRoom {
	chatRoom := &ChatRoom{
		ID:        conv.ID,
		CreatedBy: conv.CreatorID,
		CreatedAt: conv.CreatedAt,
		UpdatedAt: conv.CreatedAt,
		Type:      conv.Type,
	}
	
	// Set defaults based on conversation type
	switch conv.Type {
	case ConversationTypeDirect:
		chatRoom.Name = "Direct Conversation"
		chatRoom.IsPrivate = true
		chatRoom.MaxMembers = 2
	case ConversationTypeGroup:
		chatRoom.Name = "Group Conversation"
		chatRoom.IsPrivate = false
		chatRoom.MaxMembers = 100
	}
	
	return chatRoom
}

// ConversationFromChatRoom converts ChatRoom to Conversation
func ConversationFromChatRoom(room *ChatRoom) *Conversation {
	return &Conversation{
		ID:        room.ID,
		Type:      room.Type,
		CreatorID: room.CreatedBy,
		CreatedAt: room.CreatedAt,
	}
}


// Message represents a chat message (updated to match DB schema)
type Message struct {
	ID             uuid.UUID   `json:"id" db:"id"`
	ConversationID uuid.UUID   `json:"conversation_id" db:"conversation_id"`
	RoomID         uuid.UUID   `json:"room_id" db:"conversation_id"` // Compatibility alias
	SenderID       uuid.UUID   `json:"sender_id" db:"sender_id"`
	UserID         uuid.UUID   `json:"user_id" db:"sender_id"` // Compatibility alias
	Content        string      `json:"content" db:"content"`
	Type           MessageType `json:"type" db:"type"`
	MessageType    MessageType `json:"message_type" db:"type"` // Compatibility alias
	CreatedAt      time.Time   `json:"created_at" db:"created_at"`
	EditedAt       *time.Time  `json:"edited_at,omitempty" db:"edited_at"`
	// Legacy fields for compatibility
	ParentID  *uuid.UUID `json:"parent_id,omitempty" db:"parent_id"` // Not supported in new schema
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`         // Same as created_at
}

// SetCompatibilityFields ensures compatibility fields are set correctly
func (m *Message) SetCompatibilityFields() {
	m.RoomID = m.ConversationID
	m.UserID = m.SenderID
	m.MessageType = m.Type
	m.UpdatedAt = m.CreatedAt
	if m.EditedAt != nil {
		m.UpdatedAt = *m.EditedAt
	}
}


// MessageType represents the type of message (updated to match DB schema)
type MessageType string

const (
	MessageTypeText   MessageType = "text"
	MessageTypeQueued MessageType = "queued"
	// Legacy types for compatibility - will be mapped to text
	MessageTypeImage  MessageType = "image"
	MessageTypeFile   MessageType = "file"
	MessageTypeVideo  MessageType = "video"
	MessageTypeAudio  MessageType = "audio"
	MessageTypeSystem MessageType = "system"
)


// ConversationParticipant represents a participant in a conversation (matches DB schema)
type ConversationParticipant struct {
	ConversationID uuid.UUID `json:"conversation_id" db:"conversation_id"`
	UserID         uuid.UUID `json:"user_id" db:"user_id"`
	JoinedAt       time.Time `json:"joined_at" db:"joined_at"`
}

// Compatibility types for existing code
// RoomMember is a compatibility alias for ConversationParticipant with additional fields
type RoomMember struct {
	ID       uuid.UUID  `json:"id" db:"id"`             // Generated UUID for compatibility
	RoomID   uuid.UUID  `json:"room_id" db:"conversation_id"` // Maps to conversation_id
	UserID   uuid.UUID  `json:"user_id" db:"user_id"`
	Role     MemberRole `json:"role" db:"role"`         // Derived from creator status
	JoinedAt time.Time  `json:"joined_at" db:"joined_at"`
	LeftAt   *time.Time `json:"left_at,omitempty" db:"left_at"` // Not supported in new schema
}

// MemberRole represents a member's role in a chat room
type MemberRole string

const (
	MemberRoleOwner     MemberRole = "owner"
	MemberRoleAdmin     MemberRole = "admin"
	MemberRoleModerator MemberRole = "moderator"
	MemberRoleMember    MemberRole = "member"
)

// ToConversationParticipant converts RoomMember to ConversationParticipant
func (r *RoomMember) ToConversationParticipant() *ConversationParticipant {
	return &ConversationParticipant{
		ConversationID: r.RoomID,
		UserID:         r.UserID,
		JoinedAt:       r.JoinedAt,
	}
}

// RoomMemberFromConversationParticipant creates RoomMember from ConversationParticipant
func RoomMemberFromConversationParticipant(participant *ConversationParticipant, creatorID uuid.UUID) *RoomMember {
	role := MemberRoleMember
	if participant.UserID == creatorID {
		role = MemberRoleOwner
	}
	
	return &RoomMember{
		ID:       uuid.New(), // Generate new ID for compatibility
		RoomID:   participant.ConversationID,
		UserID:   participant.UserID,
		Role:     role,
		JoinedAt: participant.JoinedAt,
		LeftAt:   nil,
	}
}



// WebSocketMessage represents a message sent over WebSocket (updated field names)
type WebSocketMessage struct {
	Type           WSMessageType `json:"type"`
	ConversationID uuid.UUID     `json:"conversation_id"`
	RoomID         uuid.UUID     `json:"room_id"` // Compatibility alias
	UserID         uuid.UUID     `json:"user_id"`
	Message        *Message      `json:"message,omitempty"`
	Data           interface{}   `json:"data,omitempty"`
	Error          string        `json:"error,omitempty"`
}

// SetCompatibilityFields ensures compatibility fields are set
func (w *WebSocketMessage) SetCompatibilityFields() {
	w.RoomID = w.ConversationID
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

// CreateConversationRequest represents a request to create a conversation
type CreateConversationRequest struct {
	Type         ConversationType `json:"type"`
	Participants []uuid.UUID      `json:"participants"`
}

// CreateRoomRequest represents a request to create a chat room (compatibility)
type CreateRoomRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
	MaxMembers  int    `json:"max_members"`
	// Additional fields for conversion
	Participants []uuid.UUID `json:"participants,omitempty"`
}

// ToCreateConversationRequest converts to new format
func (r *CreateRoomRequest) ToCreateConversationRequest() *CreateConversationRequest {
	convType := ConversationTypeGroup
	if len(r.Participants) == 2 {
		convType = ConversationTypeDirect
	}
	
	return &CreateConversationRequest{
		Type:         convType,
		Participants: r.Participants,
	}
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

// MessageRead represents the read status of a message by a user (matches DB schema)
type MessageRead struct {
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

// UserPresence represents a user's presence status (updated field names)
type UserPresence struct {
	UserID         uuid.UUID      `json:"user_id"`
	Status         PresenceStatus `json:"status"`
	LastSeen       time.Time      `json:"last_seen"`
	ConversationID *uuid.UUID     `json:"conversation_id,omitempty"` // Current conversation if online
	RoomID         *uuid.UUID     `json:"room_id,omitempty"`          // Compatibility alias
}

// SetCompatibilityFields ensures compatibility fields are set
func (u *UserPresence) SetCompatibilityFields() {
	u.RoomID = u.ConversationID
}


// PresenceStatus represents user presence status
type PresenceStatus string

const (
	PresenceOnline  PresenceStatus = "online"
	PresenceAway    PresenceStatus = "away"
	PresenceOffline PresenceStatus = "offline"
	PresenceBusy    PresenceStatus = "busy"
)

// ConversationWithUnread extends Conversation with unread count
type ConversationWithUnread struct {
	*Conversation
	UnreadCount int      `json:"unread_count"`
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

// RealtimeEvent represents events published to Redis for real-time updates (updated field names)
type RealtimeEvent struct {
	Type           RealtimeEventType `json:"type"`
	ConversationID uuid.UUID         `json:"conversation_id"`
	RoomID         uuid.UUID         `json:"room_id"` // Compatibility alias
	UserID         uuid.UUID         `json:"user_id"`
	Message        *Message          `json:"message,omitempty"`
	Presence       *UserPresence     `json:"presence,omitempty"`
	Data           interface{}       `json:"data,omitempty"`
	Timestamp      time.Time         `json:"timestamp"`
}

// SetCompatibilityFields ensures compatibility fields are set
func (r *RealtimeEvent) SetCompatibilityFields() {
	r.RoomID = r.ConversationID
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
