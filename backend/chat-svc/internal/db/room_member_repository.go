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
	// Generate UUID if not provided
	if member.ID == uuid.Nil {
		member.ID = uuid.New()
	}
	
	// Set join timestamp if not provided
	if member.JoinedAt.IsZero() {
		member.JoinedAt = time.Now()
	}
	
	query := `
		INSERT INTO room_members (id, room_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	
	_, err := r.db.Exec(ctx, query,
		member.ID, member.RoomID, member.UserID, member.Role, member.JoinedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}
	
	return nil
}

// RemoveMember removes a member from a room (soft delete)
func (r *roomMemberRepository) RemoveMember(ctx context.Context, roomID, userID uuid.UUID) error {
	query := `
		UPDATE room_members 
		SET left_at = $3
		WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
	`
	
	result, err := r.db.Exec(ctx, query, roomID, userID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("member not found or already removed")
	}
	
	return nil
}

// GetRoomMembers returns all active members of a room
func (r *roomMemberRepository) GetRoomMembers(ctx context.Context, roomID uuid.UUID) ([]*model.RoomMember, error) {
	query := `
		SELECT id, room_id, user_id, role, joined_at, left_at
		FROM room_members
		WHERE room_id = $1 AND left_at IS NULL
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
			&member.ID, &member.RoomID, &member.UserID,
			&member.Role, &member.JoinedAt, &member.LeftAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan room member: %w", err)
		}
		members = append(members, member)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating room members: %w", err)
	}
	
	return members, nil
}

// IsUserMember checks if a user is an active member of a room
func (r *roomMemberRepository) IsUserMember(ctx context.Context, roomID, userID uuid.UUID) (bool, error) {
	query := `
		SELECT 1 FROM room_members 
		WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
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

// UpdateMemberRole updates a member's role in a room
func (r *roomMemberRepository) UpdateMemberRole(ctx context.Context, roomID, userID uuid.UUID, role model.MemberRole) error {
	query := `
		UPDATE room_members 
		SET role = $3
		WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
	`
	
	result, err := r.db.Exec(ctx, query, roomID, userID, role)
	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}
	
	if result.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	
	return nil
}
