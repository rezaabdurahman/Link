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

// SearchAvailableUsersRequest represents the request to search available users
type SearchAvailableUsersRequest struct {
	Query  string `json:"query" form:"query" binding:"required,min=1,max=500"`
	Limit  *int   `json:"limit,omitempty" form:"limit" binding:"omitempty,min=1,max=100"`
	Offset *int   `json:"offset,omitempty" form:"offset" binding:"omitempty,min=0"`
}

// SearchAvailableUsersResponse represents the response for searching available users
type SearchAvailableUsersResponse struct {
	Data       []EnhancedPublicAvailabilityResponse `json:"data"`
	Pagination PaginationResponse                   `json:"pagination"`
	SearchMeta SearchMetaResponse                   `json:"search_meta,omitempty"`
	Warnings   []string                             `json:"warnings,omitempty"`
}

// EnhancedPublicAvailabilityResponse includes search scoring information
type EnhancedPublicAvailabilityResponse struct {
	UserID          uuid.UUID  `json:"user_id"`
	IsAvailable     bool       `json:"is_available"`
	LastAvailableAt *time.Time `json:"last_available_at,omitempty"`
	SearchScore     *float64   `json:"search_score,omitempty"`
	MatchReasons    []string   `json:"match_reasons,omitempty"`
}

// PaginationResponse represents pagination metadata
type PaginationResponse struct {
	Total      int64 `json:"total"`
	Limit      int   `json:"limit"`
	Offset     int   `json:"offset"`
	HasMore    bool  `json:"has_more"`
	TotalPages int64 `json:"total_pages"`
}

// SearchMetaResponse represents search metadata
type SearchMetaResponse struct {
	QueryProcessed  string `json:"query_processed"`
	TotalCandidates int    `json:"total_candidates"`
	SearchTimeMs    int    `json:"search_time_ms"`
	SearchEnabled   bool   `json:"search_enabled"`
}
