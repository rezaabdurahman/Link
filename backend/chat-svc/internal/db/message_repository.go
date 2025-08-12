package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/link-app/chat-svc/internal/model"
)

// messageRepository implements the MessageRepository interface
type messageRepository struct {
	db *pgxpool.Pool
}

// NewMessageRepository creates a new message repository
func NewMessageRepository(db *pgxpool.Pool) MessageRepository {
	return &messageRepository{db: db}
}

// ListMessages returns paginated messages for a conversation
func (r *messageRepository) ListMessages(ctx context.Context, convoID, userID uuid.UUID, page, size int) ([]*model.Message, int, error) {
	offset := (page - 1) * size
	
	// First check if user is a member of the conversation
	memberQuery := `
		SELECT 1 FROM room_members 
		WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
	`
	var exists int
	err := r.db.QueryRow(ctx, memberQuery, convoID, userID).Scan(&exists)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, 0, fmt.Errorf("user is not a member of this conversation")
		}
		return nil, 0, fmt.Errorf("failed to check membership: %w", err)
	}
	
	// Get the total count of messages in the conversation
	countQuery := `SELECT COUNT(*) FROM messages WHERE room_id = $1`
	var total int
	err = r.db.QueryRow(ctx, countQuery, convoID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count messages: %w", err)
	}
	
	// Get the paginated messages
	query := `
		SELECT id, room_id, user_id, content, message_type, parent_id, edited_at, created_at, updated_at
		FROM messages
		WHERE room_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	
	rows, err := r.db.Query(ctx, query, convoID, size, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list messages: %w", err)
	}
	defer rows.Close()
	
	var messages []*model.Message
	for rows.Next() {
		message := &model.Message{}
		err := rows.Scan(
			&message.ID, &message.RoomID, &message.UserID, &message.Content,
			&message.MessageType, &message.ParentID, &message.EditedAt,
			&message.CreatedAt, &message.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, message)
	}
	
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating messages: %w", err)
	}
	
	return messages, total, nil
}

// CreateMessage creates a new message
func (r *messageRepository) CreateMessage(ctx context.Context, message *model.Message) error {
	// Generate UUID if not provided
	if message.ID == uuid.Nil {
		message.ID = uuid.New()
	}
	
	// Set timestamps
	now := time.Now()
	message.CreatedAt = now
	message.UpdatedAt = now
	
	query := `
		INSERT INTO messages (id, room_id, user_id, content, message_type, parent_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	
	_, err := r.db.Exec(ctx, query,
		message.ID, message.RoomID, message.UserID, message.Content,
		message.MessageType, message.ParentID, message.CreatedAt, message.UpdatedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}
	
	// Update the room's updated_at timestamp
	updateRoomQuery := `UPDATE chat_rooms SET updated_at = $1 WHERE id = $2`
	_, err = r.db.Exec(ctx, updateRoomQuery, now, message.RoomID)
	if err != nil {
		// Log this error but don't fail the message creation
		fmt.Printf("Warning: failed to update room timestamp: %v\n", err)
	}
	
	return nil
}

// GetMessageByID retrieves a message by ID
func (r *messageRepository) GetMessageByID(ctx context.Context, messageID uuid.UUID) (*model.Message, error) {
	query := `
		SELECT id, room_id, user_id, content, message_type, parent_id, edited_at, created_at, updated_at
		FROM messages
		WHERE id = $1
	`
	
	message := &model.Message{}
	err := r.db.QueryRow(ctx, query, messageID).Scan(
		&message.ID, &message.RoomID, &message.UserID, &message.Content,
		&message.MessageType, &message.ParentID, &message.EditedAt,
		&message.CreatedAt, &message.UpdatedAt,
	)
	
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("message not found")
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}
	
	return message, nil
}

// UpdateMessage updates a message
func (r *messageRepository) UpdateMessage(ctx context.Context, message *model.Message) error {
	now := time.Now()
	message.UpdatedAt = now
	message.EditedAt = &now
	
	query := `
		UPDATE messages 
		SET content = $2, message_type = $3, edited_at = $4, updated_at = $5
		WHERE id = $1
	`
	
	result, err := r.db.Exec(ctx, query,
		message.ID, message.Content, message.MessageType, message.EditedAt, message.UpdatedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update message: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("message not found")
	}
	
	return nil
}

// DeleteMessage soft deletes a message (we'll implement this as a hard delete for now)
func (r *messageRepository) DeleteMessage(ctx context.Context, messageID uuid.UUID) error {
	query := `DELETE FROM messages WHERE id = $1`
	
	result, err := r.db.Exec(ctx, query, messageID)
	if err != nil {
		return fmt.Errorf("failed to delete message: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("message not found")
	}
	
	return nil
}

// MarkMessagesAsRead marks messages as read for a user
func (r *messageRepository) MarkMessagesAsRead(ctx context.Context, userID uuid.UUID, messageIDs []uuid.UUID) error {
	if len(messageIDs) == 0 {
		return nil
	}
	
	// First, we need to create a message_reads table to track read status
	// For now, we'll implement this as a simple approach
	// In a real implementation, you'd want to create the message_reads table in your migration
	
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	
	// Create temporary table to track reads if it doesn't exist
	createTableQuery := `
		CREATE TABLE IF NOT EXISTS message_reads (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
			user_id UUID NOT NULL,
			read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(message_id, user_id)
		)
	`
	
	_, err = tx.Exec(ctx, createTableQuery)
	if err != nil {
		return fmt.Errorf("failed to create message_reads table: %w", err)
	}
	
	// Insert read records
	for _, messageID := range messageIDs {
		insertQuery := `
			INSERT INTO message_reads (message_id, user_id, read_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = $3
		`
		
		_, err = tx.Exec(ctx, insertQuery, messageID, userID, time.Now())
		if err != nil {
			return fmt.Errorf("failed to mark message as read: %w", err)
		}
	}
	
	return tx.Commit(ctx)
}

// GetUnreadCount returns the count of unread messages for a user in a conversation
func (r *messageRepository) GetUnreadCount(ctx context.Context, userID, convoID uuid.UUID) (int, error) {
	// First ensure message_reads table exists
	createTableQuery := `
		CREATE TABLE IF NOT EXISTS message_reads (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
			user_id UUID NOT NULL,
			read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(message_id, user_id)
		)
	`
	
	_, err := r.db.Exec(ctx, createTableQuery)
	if err != nil {
		return 0, fmt.Errorf("failed to ensure message_reads table exists: %w", err)
	}
	
	query := `
		SELECT COUNT(*)
		FROM messages m
		LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
		WHERE m.room_id = $2 AND m.user_id != $1 AND mr.id IS NULL
	`
	
	var count int
	err = r.db.QueryRow(ctx, query, userID, convoID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}
	
	return count, nil
}
