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

// conversationRepository implements the ConversationRepository interface
type conversationRepository struct {
	db *pgxpool.Pool
}

// NewConversationRepository creates a new conversation repository
func NewConversationRepository(db *pgxpool.Pool) ConversationRepository {
	return &conversationRepository{db: db}
}

// ListConversations returns paginated conversations for a user
func (r *conversationRepository) ListConversations(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ChatRoom, int, error) {
	offset := (page - 1) * size
	
	// First get the total count
	countQuery := `
		SELECT COUNT(DISTINCT cr.id)
		FROM chat_rooms cr
		INNER JOIN room_members rm ON cr.id = rm.room_id
		WHERE rm.user_id = $1 AND rm.left_at IS NULL
	`
	
	var total int
	err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count conversations: %w", err)
	}
	
	// Get the paginated conversations
	query := `
		SELECT cr.id, cr.name, cr.description, cr.created_by, cr.is_private, 
		       cr.max_members, cr.created_at, cr.updated_at
		FROM chat_rooms cr
		INNER JOIN room_members rm ON cr.id = rm.room_id
		WHERE rm.user_id = $1 AND rm.left_at IS NULL
		ORDER BY cr.updated_at DESC
		LIMIT $2 OFFSET $3
	`
	
	rows, err := r.db.Query(ctx, query, userID, size, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list conversations: %w", err)
	}
	defer rows.Close()
	
	var conversations []*model.ChatRoom
	for rows.Next() {
		room := &model.ChatRoom{}
		err := rows.Scan(
			&room.ID, &room.Name, &room.Description, &room.CreatedBy,
			&room.IsPrivate, &room.MaxMembers, &room.CreatedAt, &room.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conversation: %w", err)
		}
		conversations = append(conversations, room)
	}
	
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating conversations: %w", err)
	}
	
	return conversations, total, nil
}

// CreateConversation creates a new conversation
func (r *conversationRepository) CreateConversation(ctx context.Context, room *model.ChatRoom) error {
	// Generate UUID if not provided
	if room.ID == uuid.Nil {
		room.ID = uuid.New()
	}
	
	// Set timestamps
	now := time.Now()
	room.CreatedAt = now
	room.UpdatedAt = now
	
	query := `
		INSERT INTO chat_rooms (id, name, description, created_by, is_private, max_members, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	
	_, err := r.db.Exec(ctx, query,
		room.ID, room.Name, room.Description, room.CreatedBy,
		room.IsPrivate, room.MaxMembers, room.CreatedAt, room.UpdatedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}
	
	return nil
}

// GetConversationByID retrieves a conversation by ID
func (r *conversationRepository) GetConversationByID(ctx context.Context, roomID uuid.UUID) (*model.ChatRoom, error) {
	query := `
		SELECT id, name, description, created_by, is_private, max_members, created_at, updated_at
		FROM chat_rooms
		WHERE id = $1
	`
	
	room := &model.ChatRoom{}
	err := r.db.QueryRow(ctx, query, roomID).Scan(
		&room.ID, &room.Name, &room.Description, &room.CreatedBy,
		&room.IsPrivate, &room.MaxMembers, &room.CreatedAt, &room.UpdatedAt,
	)
	
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("conversation not found")
		}
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}
	
	return room, nil
}

// UpdateConversation updates a conversation
func (r *conversationRepository) UpdateConversation(ctx context.Context, room *model.ChatRoom) error {
	room.UpdatedAt = time.Now()
	
	query := `
		UPDATE chat_rooms 
		SET name = $2, description = $3, is_private = $4, max_members = $5, updated_at = $6
		WHERE id = $1
	`
	
	result, err := r.db.Exec(ctx, query,
		room.ID, room.Name, room.Description, room.IsPrivate, room.MaxMembers, room.UpdatedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update conversation: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("conversation not found")
	}
	
	return nil
}

// DeleteConversation soft deletes a conversation (we'll implement this as a hard delete for now)
func (r *conversationRepository) DeleteConversation(ctx context.Context, roomID uuid.UUID) error {
	query := `DELETE FROM chat_rooms WHERE id = $1`
	
	result, err := r.db.Exec(ctx, query, roomID)
	if err != nil {
		return fmt.Errorf("failed to delete conversation: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("conversation not found")
	}
	
	return nil
}

// GetConversationsByUserID returns all conversations for a user
func (r *conversationRepository) GetConversationsByUserID(ctx context.Context, userID uuid.UUID) ([]*model.ChatRoom, error) {
	query := `
		SELECT cr.id, cr.name, cr.description, cr.created_by, cr.is_private, 
		       cr.max_members, cr.created_at, cr.updated_at
		FROM chat_rooms cr
		INNER JOIN room_members rm ON cr.id = rm.room_id
		WHERE rm.user_id = $1 AND rm.left_at IS NULL
		ORDER BY cr.updated_at DESC
	`
	
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversations by user ID: %w", err)
	}
	defer rows.Close()
	
	var conversations []*model.ChatRoom
	for rows.Next() {
		room := &model.ChatRoom{}
		err := rows.Scan(
			&room.ID, &room.Name, &room.Description, &room.CreatedBy,
			&room.IsPrivate, &room.MaxMembers, &room.CreatedAt, &room.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %w", err)
		}
		conversations = append(conversations, room)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating conversations: %w", err)
	}
	
	return conversations, nil
}

// CreateDirectConversation creates a direct conversation between two users
func (r *conversationRepository) CreateDirectConversation(ctx context.Context, participant1, participant2 uuid.UUID) (*model.ChatRoom, error) {
	// Create a direct chat room with a generated name
	room := &model.ChatRoom{
		ID:          uuid.New(),
		Name:        fmt.Sprintf("Direct: %s-%s", participant1.String()[:8], participant2.String()[:8]),
		Description: "Direct conversation",
		CreatedBy:   participant1,
		IsPrivate:   true,
		MaxMembers:  2,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	// Create the conversation
	if err := r.CreateConversation(ctx, room); err != nil {
		return nil, fmt.Errorf("failed to create direct conversation: %w", err)
	}

	// Add both participants as members
	for i, participantID := range []uuid.UUID{participant1, participant2} {
		member := &model.RoomMember{
			ID:       uuid.New(),
			RoomID:   room.ID,
			UserID:   participantID,
			Role:     model.MemberRoleMember,
			JoinedAt: time.Now().UTC(),
		}
		// Make the first participant (creator) an owner
		if i == 0 {
			member.Role = model.MemberRoleOwner
		}

		// Add member (we need to implement this manually here or use a different approach)
		addMemberQuery := `
			INSERT INTO room_members (id, room_id, user_id, role, joined_at)
			VALUES ($1, $2, $3, $4, $5)
		`
		_, err := r.db.Exec(ctx, addMemberQuery,
			member.ID, member.RoomID, member.UserID, member.Role, member.JoinedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add participant %s: %w", participantID, err)
		}
	}

	return room, nil
}

// GetDirectConversation finds existing direct conversation between two users
func (r *conversationRepository) GetDirectConversation(ctx context.Context, participant1, participant2 uuid.UUID) (*model.ChatRoom, error) {
	query := `
		SELECT cr.id, cr.name, cr.description, cr.created_by, cr.is_private, 
		       cr.max_members, cr.created_at, cr.updated_at
		FROM chat_rooms cr
		WHERE cr.max_members = 2 
		  AND cr.is_private = true
		  AND EXISTS (
		      SELECT 1 FROM room_members rm1 
		      WHERE rm1.room_id = cr.id AND rm1.user_id = $1 AND rm1.left_at IS NULL
		  )
		  AND EXISTS (
		      SELECT 1 FROM room_members rm2 
		      WHERE rm2.room_id = cr.id AND rm2.user_id = $2 AND rm2.left_at IS NULL
		  )
		  AND (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = cr.id AND rm.left_at IS NULL) = 2
		LIMIT 1
	`

	room := &model.ChatRoom{}
	err := r.db.QueryRow(ctx, query, participant1, participant2).Scan(
		&room.ID, &room.Name, &room.Description, &room.CreatedBy,
		&room.IsPrivate, &room.MaxMembers, &room.CreatedAt, &room.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("direct conversation not found")
		}
		return nil, fmt.Errorf("failed to get direct conversation: %w", err)
	}

	return room, nil
}

// ListConversationsWithUnread returns conversations with unread counts
func (r *conversationRepository) ListConversationsWithUnread(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ConversationWithUnread, int, error) {
	offset := (page - 1) * size

	// First get the total count
	countQuery := `
		SELECT COUNT(DISTINCT cr.id)
		FROM chat_rooms cr
		INNER JOIN room_members rm ON cr.id = rm.room_id
		WHERE rm.user_id = $1 AND rm.left_at IS NULL
	`

	var total int
	err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count conversations: %w", err)
	}

	// Get conversations with unread counts and last message
	query := `
		SELECT 
			cr.id, cr.name, cr.description, cr.created_by, cr.is_private, 
			cr.max_members, cr.created_at, cr.updated_at,
			COALESCE(unread_counts.unread_count, 0) as unread_count,
			lm.id as last_message_id, lm.user_id as last_message_user_id, 
			lm.content as last_message_content, lm.message_type as last_message_type,
			lm.created_at as last_message_created_at
		FROM chat_rooms cr
		INNER JOIN room_members rm ON cr.id = rm.room_id
		LEFT JOIN (
			SELECT 
				m.room_id,
				COUNT(*) as unread_count
			FROM messages m
			LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
			WHERE m.user_id != $1 AND mr.id IS NULL
			GROUP BY m.room_id
		) unread_counts ON cr.id = unread_counts.room_id
		LEFT JOIN LATERAL (
			SELECT m.id, m.user_id, m.content, m.message_type, m.created_at
			FROM messages m
			WHERE m.room_id = cr.id
			ORDER BY m.created_at DESC
			LIMIT 1
		) lm ON true
		WHERE rm.user_id = $1 AND rm.left_at IS NULL
		ORDER BY cr.updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, userID, size, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list conversations with unread: %w", err)
	}
	defer rows.Close()

	var conversations []*model.ConversationWithUnread
	for rows.Next() {
		convWithUnread := &model.ConversationWithUnread{
			ChatRoom: &model.ChatRoom{},
		}

		var lastMessageID *uuid.UUID
		var lastMessageUserID *uuid.UUID
		var lastMessageContent *string
		var lastMessageType *model.MessageType
		var lastMessageCreatedAt *time.Time

		err := rows.Scan(
			&convWithUnread.ChatRoom.ID, &convWithUnread.ChatRoom.Name, 
			&convWithUnread.ChatRoom.Description, &convWithUnread.ChatRoom.CreatedBy,
			&convWithUnread.ChatRoom.IsPrivate, &convWithUnread.ChatRoom.MaxMembers, 
			&convWithUnread.ChatRoom.CreatedAt, &convWithUnread.ChatRoom.UpdatedAt,
			&convWithUnread.UnreadCount,
			&lastMessageID, &lastMessageUserID, &lastMessageContent, 
			&lastMessageType, &lastMessageCreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conversation with unread: %w", err)
		}

		// Set last message if exists
		if lastMessageID != nil {
			convWithUnread.LastMessage = &model.Message{
				ID:          *lastMessageID,
				RoomID:      convWithUnread.ChatRoom.ID,
				UserID:      *lastMessageUserID,
				Content:     *lastMessageContent,
				MessageType: *lastMessageType,
				CreatedAt:   *lastMessageCreatedAt,
			}
		}

		conversations = append(conversations, convWithUnread)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating conversations with unread: %w", err)
	}

	return conversations, total, nil
}
