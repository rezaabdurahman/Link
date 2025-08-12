package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Broadcast represents a user's broadcast message
type Broadcast struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID    uuid.UUID      `json:"user_id" gorm:"type:uuid;not null;index"`
	Message   string         `json:"message" gorm:"type:varchar(200);not null"`
	IsActive  bool           `json:"is_active" gorm:"default:true;index"`
	ExpiresAt *time.Time     `json:"expires_at,omitempty" gorm:"index"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// TableName returns the table name for the Broadcast model
func (Broadcast) TableName() string {
	return "broadcasts"
}

// BeforeCreate sets up the broadcast before creating
func (b *Broadcast) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	
	// Set default expiration to 24 hours if not provided
	if b.ExpiresAt == nil {
		expiresAt := time.Now().Add(24 * time.Hour)
		b.ExpiresAt = &expiresAt
	}
	
	return nil
}

// IsExpired checks if the broadcast has expired
func (b *Broadcast) IsExpired() bool {
	if b.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*b.ExpiresAt)
}

// CreateBroadcastRequest represents the request to create a broadcast
type CreateBroadcastRequest struct {
	Message         string `json:"message" binding:"required,min=1,max=200"`
	ExpiresInHours *int   `json:"expires_in_hours,omitempty" binding:"omitempty,min=1,max=168"`
}

// UpdateBroadcastRequest represents the request to update a broadcast
type UpdateBroadcastRequest struct {
	Message         string `json:"message" binding:"required,min=1,max=200"`
	ExpiresInHours *int   `json:"expires_in_hours,omitempty" binding:"omitempty,min=1,max=168"`
}

// BroadcastResponse represents the response for broadcast operations
type BroadcastResponse struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Message   string     `json:"message"`
	IsActive  bool       `json:"is_active"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// PublicBroadcastResponse represents the public response for broadcast operations
type PublicBroadcastResponse struct {
	UserID    uuid.UUID `json:"user_id"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToResponse converts a Broadcast model to BroadcastResponse
func (b *Broadcast) ToResponse() BroadcastResponse {
	return BroadcastResponse{
		ID:        b.ID,
		UserID:    b.UserID,
		Message:   b.Message,
		IsActive:  b.IsActive,
		ExpiresAt: b.ExpiresAt,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

// ToPublicResponse converts a Broadcast model to PublicBroadcastResponse
func (b *Broadcast) ToPublicResponse() PublicBroadcastResponse {
	return PublicBroadcastResponse{
		UserID:    b.UserID,
		Message:   b.Message,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}
