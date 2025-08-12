package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Availability represents a user's availability status
type Availability struct {
	ID              uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID          uuid.UUID      `json:"user_id" gorm:"type:uuid;not null;unique;index"`
	IsAvailable     bool           `json:"is_available" gorm:"default:false;index"`
	LastAvailableAt *time.Time     `json:"last_available_at,omitempty" gorm:"index"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

// TableName returns the table name for the Availability model
func (Availability) TableName() string {
	return "user_availability"
}

// BeforeCreate sets up the availability before creating
func (a *Availability) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// SetAvailable marks the user as available and updates the timestamp
func (a *Availability) SetAvailable() {
	a.IsAvailable = true
	now := time.Now()
	a.LastAvailableAt = &now
}

// SetUnavailable marks the user as unavailable
func (a *Availability) SetUnavailable() {
	a.IsAvailable = false
	// Note: We keep LastAvailableAt as is to track when they were last available
}

// UpdateAvailabilityRequest represents the request to update availability
type UpdateAvailabilityRequest struct {
	IsAvailable bool `json:"is_available" binding:"required"`
}

// AvailabilityResponse represents the response for availability operations
type AvailabilityResponse struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	IsAvailable     bool       `json:"is_available"`
	LastAvailableAt *time.Time `json:"last_available_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// PublicAvailabilityResponse represents the public response for availability operations
type PublicAvailabilityResponse struct {
	UserID          uuid.UUID  `json:"user_id"`
	IsAvailable     bool       `json:"is_available"`
	LastAvailableAt *time.Time `json:"last_available_at,omitempty"`
}

// ToResponse converts an Availability model to AvailabilityResponse
func (a *Availability) ToResponse() AvailabilityResponse {
	return AvailabilityResponse{
		ID:              a.ID,
		UserID:          a.UserID,
		IsAvailable:     a.IsAvailable,
		LastAvailableAt: a.LastAvailableAt,
		CreatedAt:       a.CreatedAt,
		UpdatedAt:       a.UpdatedAt,
	}
}

// ToPublicResponse converts an Availability model to PublicAvailabilityResponse
func (a *Availability) ToPublicResponse() PublicAvailabilityResponse {
	return PublicAvailabilityResponse{
		UserID:          a.UserID,
		IsAvailable:     a.IsAvailable,
		LastAvailableAt: a.LastAvailableAt,
	}
}
