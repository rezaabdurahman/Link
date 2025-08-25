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
		SELECT COUNT(DISTINCT c.id)
		FROM conversations c
		INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
		WHERE cp.user_id = $1
	`
	
	var total int
	err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count conversations: %w", err)
	}
	
	// Get the paginated conversations
	query := `
		SELECT c.id, c.type, c.creator_id, c.created_at
		FROM conversations c
		INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
		WHERE cp.user_id = $1
		ORDER BY c.created_at DESC
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
			&room.ID, &room.Type, &room.CreatedBy, &room.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conversation: %w", err)
		}
		
		// Set compatibility fields based on conversation type
		room.UpdatedAt = room.CreatedAt
		switch room.Type {
		case model.ConversationTypeDirect:
			room.Name = "Direct Conversation"
			room.IsPrivate = true
			room.MaxMembers = 2
		case model.ConversationTypeGroup:
			room.Name = "Group Conversation"
			room.IsPrivate = false
			room.MaxMembers = 100
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
		INSERT INTO conversations (id, type, creator_id, created_at)
		VALUES ($1, $2, $3, $4)
	`
	
	_, err := r.db.Exec(ctx, query,
		room.ID, room.Type, room.CreatedBy, room.CreatedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}
	
	return nil
}

// GetConversationByID retrieves a conversation by ID
func (r *conversationRepository) GetConversationByID(ctx context.Context, roomID uuid.UUID) (*model.ChatRoom, error) {
	query := `
		SELECT id, type, creator_id, created_at
		FROM conversations
		WHERE id = $1
	`
	
	room := &model.ChatRoom{}
	err := r.db.QueryRow(ctx, query, roomID).Scan(
		&room.ID, &room.Type, &room.CreatedBy, &room.CreatedAt,
	)
	
	if err == nil {
		// Set compatibility fields
		room.UpdatedAt = room.CreatedAt
		switch room.Type {
		case model.ConversationTypeDirect:
			room.Name = "Direct Conversation"
			room.IsPrivate = true
			room.MaxMembers = 2
		case model.ConversationTypeGroup:
			room.Name = "Group Conversation"
			room.IsPrivate = false
			room.MaxMembers = 100
		}
	}
	
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
		UPDATE conversations 
		SET type = $2
		WHERE id = $1
	`
	
	result, err := r.db.Exec(ctx, query,
		room.ID, room.Type,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update conversation: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("conversation not found")
	}
	
	return nil
}

// DeleteConversation deletes a conversation (cascade will handle participants)
func (r *conversationRepository) DeleteConversation(ctx context.Context, roomID uuid.UUID) error {
	query := `DELETE FROM conversations WHERE id = $1`
	
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
		SELECT c.id, c.type, c.creator_id, c.created_at
		FROM conversations c
		INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
		WHERE cp.user_id = $1
		ORDER BY c.created_at DESC
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
			&room.ID, &room.Type, &room.CreatedBy, &room.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %w", err)
		}
		
		// Set compatibility fields based on conversation type
		room.UpdatedAt = room.CreatedAt
		switch room.Type {
		case model.ConversationTypeDirect:
			room.Name = "Direct Conversation"
			room.IsPrivate = true
			room.MaxMembers = 2
		case model.ConversationTypeGroup:
			room.Name = "Group Conversation"
			room.IsPrivate = false
			room.MaxMembers = 100
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

		// Add participant to conversation_participants table
		addMemberQuery := `
			INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
			VALUES ($1, $2, $3)
		`
		_, err := r.db.Exec(ctx, addMemberQuery,
			member.RoomID, member.UserID, member.JoinedAt,
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
		SELECT c.id, c.type, c.creator_id, c.created_at
		FROM conversations c
		WHERE c.type = 'direct'
		  AND EXISTS (
		      SELECT 1 FROM conversation_participants cp1 
		      WHERE cp1.conversation_id = c.id AND cp1.user_id = $1
		  )
		  AND EXISTS (
		      SELECT 1 FROM conversation_participants cp2 
		      WHERE cp2.conversation_id = c.id AND cp2.user_id = $2
		  )
		  AND (SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = c.id) = 2
		LIMIT 1
	`

	room := &model.ChatRoom{}
	err := r.db.QueryRow(ctx, query, participant1, participant2).Scan(
		&room.ID, &room.Type, &room.CreatedBy, &room.CreatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("direct conversation not found")
		}
		return nil, fmt.Errorf("failed to get direct conversation: %w", err)
	}
	
	// Set compatibility fields for direct conversation
	room.UpdatedAt = room.CreatedAt
	room.Name = "Direct Conversation"
	room.IsPrivate = true
	room.MaxMembers = 2

	return room, nil
}

// ListConversationsWithUnread returns conversations with unread counts
func (r *conversationRepository) ListConversationsWithUnread(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ConversationWithUnread, int, error) {
	offset := (page - 1) * size

	// First get the total count
	countQuery := `
		SELECT COUNT(DISTINCT c.id)
		FROM conversations c
		INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
		WHERE cp.user_id = $1
	`

	var total int
	err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count conversations: %w", err)
	}

	// Get conversations with unread counts and last message
	query := `
		SELECT 
			c.id, c.type, c.creator_id, c.created_at,
			COALESCE(unread_counts.unread_count, 0) as unread_count,
			lm.id as last_message_id, lm.sender_id as last_message_sender_id, 
			lm.content as last_message_content, lm.type as last_message_type,
			lm.created_at as last_message_created_at
		FROM conversations c
		INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
		LEFT JOIN (
			SELECT 
				m.conversation_id,
				COUNT(*) as unread_count
			FROM messages m
			LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
			WHERE m.sender_id != $1 AND mr.message_id IS NULL
			GROUP BY m.conversation_id
		) unread_counts ON c.id = unread_counts.conversation_id
		LEFT JOIN LATERAL (
			SELECT m.id, m.sender_id, m.content, m.type, m.created_at
			FROM messages m
			WHERE m.conversation_id = c.id
			ORDER BY m.created_at DESC
			LIMIT 1
		) lm ON true
		WHERE cp.user_id = $1
		ORDER BY c.created_at DESC
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
			Conversation: &model.Conversation{},
		}

		var lastMessageID *uuid.UUID
		var lastMessageSenderID *uuid.UUID
		var lastMessageContent *string
		var lastMessageType *model.MessageType
		var lastMessageCreatedAt *time.Time

		err := rows.Scan(
			&convWithUnread.Conversation.ID, &convWithUnread.Conversation.Type, 
			&convWithUnread.Conversation.CreatorID, &convWithUnread.Conversation.CreatedAt,
			&convWithUnread.UnreadCount,
			&lastMessageID, &lastMessageSenderID, &lastMessageContent, 
			&lastMessageType, &lastMessageCreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conversation with unread: %w", err)
		}

		// Set last message if exists
		if lastMessageID != nil {
			convWithUnread.LastMessage = &model.Message{
				ID:             *lastMessageID,
				ConversationID: convWithUnread.Conversation.ID,
				SenderID:       *lastMessageSenderID,
				Content:        *lastMessageContent,
				Type:           *lastMessageType,
				CreatedAt:      *lastMessageCreatedAt,
			}
			// Set compatibility fields
			convWithUnread.LastMessage.SetCompatibilityFields()
		}

		conversations = append(conversations, convWithUnread)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating conversations with unread: %w", err)
	}

	return conversations, total, nil
}
