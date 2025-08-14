package chat

import (
	"time"

	"github.com/google/uuid"
)

// ChatMessage represents a message in a conversation
type ChatMessage struct {
	ID             uuid.UUID  `json:"id"`
	ConversationID uuid.UUID  `json:"conversation_id"`
	UserID         uuid.UUID  `json:"user_id"`
	Content        string     `json:"content"`
	MessageType    string     `json:"message_type"` // user, assistant, system
	Metadata       *Metadata  `json:"metadata,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

// Metadata holds additional message metadata
type Metadata struct {
	AttachmentCount int               `json:"attachment_count,omitempty"`
	Mentions        []string          `json:"mentions,omitempty"`
	Reactions       []Reaction        `json:"reactions,omitempty"`
	EditHistory     []EditHistory     `json:"edit_history,omitempty"`
	CustomFields    map[string]interface{} `json:"custom_fields,omitempty"`
}

// Reaction represents a reaction to a message
type Reaction struct {
	UserID    uuid.UUID `json:"user_id"`
	Emoji     string    `json:"emoji"`
	CreatedAt time.Time `json:"created_at"`
}

// EditHistory represents the edit history of a message
type EditHistory struct {
	EditedAt    time.Time `json:"edited_at"`
	EditedBy    uuid.UUID `json:"edited_by"`
	PrevContent string    `json:"prev_content"`
}

// GetMessagesResponse represents the response from the chat service
type GetMessagesResponse struct {
	Messages   []ChatMessage `json:"messages"`
	TotalCount int64         `json:"total_count"`
	HasMore    bool          `json:"has_more"`
	NextCursor *string       `json:"next_cursor,omitempty"`
}

// ErrorResponse represents an error response from the chat service
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message"`
	Code    string            `json:"code,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}
