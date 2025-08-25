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

// roomMemberRepository implements the RoomMemberRepository interface
type roomMemberRepository struct {
	db *pgxpool.Pool
}

// NewRoomMemberRepository creates a new room member repository
func NewRoomMemberRepository(db *pgxpool.Pool) RoomMemberRepository {
	return &roomMemberRepository{db: db}
}

// AddMember adds a member to a room
func (r *roomMemberRepository) AddMember(ctx context.Context, member *model.RoomMember) error {
	// Set join timestamp if not provided
	if member.JoinedAt.IsZero() {
		member.JoinedAt = time.Now()
	}
	
	query := `
		INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
		VALUES ($1, $2, $3)
	`
	
	_, err := r.db.Exec(ctx, query,
		member.RoomID, member.UserID, member.JoinedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}
	
	return nil
}

// RemoveMember removes a member from a room (hard delete in new schema)
func (r *roomMemberRepository) RemoveMember(ctx context.Context, roomID, userID uuid.UUID) error {
	query := `
		DELETE FROM conversation_participants 
		WHERE conversation_id = $1 AND user_id = $2
	`
	
	result, err := r.db.Exec(ctx, query, roomID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	
	return nil
}

// GetRoomMembers returns all members of a room
func (r *roomMemberRepository) GetRoomMembers(ctx context.Context, roomID uuid.UUID) ([]*model.RoomMember, error) {
	// First get the conversation creator to determine roles
	var creatorID uuid.UUID
	creatorQuery := `SELECT creator_id FROM conversations WHERE id = $1`
	err := r.db.QueryRow(context.Background(), creatorQuery, roomID).Scan(&creatorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation creator: %w", err)
	}
	
	query := `
		SELECT conversation_id, user_id, joined_at
		FROM conversation_participants
		WHERE conversation_id = $1
		ORDER BY joined_at ASC
	`
	
	rows, err := r.db.Query(ctx, query, roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to get room members: %w", err)
	}
	defer rows.Close()
	
	var members []*model.RoomMember
	for rows.Next() {
		member := &model.RoomMember{}
		err := rows.Scan(
			&member.RoomID, &member.UserID, &member.JoinedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan room member: %w", err)
		}
		
		// Set compatibility fields
		member.ID = uuid.New() // Generate ID for compatibility
		member.LeftAt = nil    // No soft delete in new schema
		
		// Determine role based on creator status
		if member.UserID == creatorID {
			member.Role = model.MemberRoleOwner
		} else {
			member.Role = model.MemberRoleMember
		}
		
		members = append(members, member)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating room members: %w", err)
	}
	
	return members, nil
}

// IsUserMember checks if a user is a member of a conversation
func (r *roomMemberRepository) IsUserMember(ctx context.Context, roomID, userID uuid.UUID) (bool, error) {
	query := `
		SELECT 1 FROM conversation_participants 
		WHERE conversation_id = $1 AND user_id = $2
	`
	
	var exists int
	err := r.db.QueryRow(ctx, query, roomID, userID).Scan(&exists)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("failed to check membership: %w", err)
	}
	
	return true, nil
}

// UpdateMemberRole updates a member's role (Note: roles not stored in new schema)
func (r *roomMemberRepository) UpdateMemberRole(ctx context.Context, roomID, userID uuid.UUID, role model.MemberRole) error {
	// In the new normalized schema, roles are determined by creator status
	// This is a no-op for compatibility but we could log or handle differently
	return fmt.Errorf("role updates not supported in normalized schema - roles are determined by creator status")
}
