package db

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewRepository creates a new repository with all implementations
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		Conversations: NewConversationRepository(db),
		Messages:      NewMessageRepository(db),
		RoomMembers:   NewRoomMemberRepository(db),
	}
}
