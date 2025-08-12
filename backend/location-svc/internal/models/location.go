package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserLocation represents a user's location data
type UserLocation struct {
	ID              uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID          uuid.UUID      `json:"user_id" gorm:"not null;index"`
	Latitude        float64        `json:"latitude" gorm:"not null;type:decimal(10,8)"`
	Longitude       float64        `json:"longitude" gorm:"not null;type:decimal(11,8)"`
	Geom            string         `json:"-" gorm:"type:geometry(POINT,4326)"`
	AccuracyMeters  *int           `json:"accuracy_meters,omitempty" gorm:"check:accuracy_meters >= 0"`
	AltitudeMeters  *float64       `json:"altitude_meters,omitempty" gorm:"type:decimal(8,2)"`
	SpeedMps        *float64       `json:"speed_mps,omitempty" gorm:"type:decimal(5,2);check:speed_mps >= 0"`
	HeadingDegrees  *int           `json:"heading_degrees,omitempty" gorm:"check:heading_degrees >= 0 AND heading_degrees < 360"`
	LocationSource  string         `json:"location_source" gorm:"default:'gps';size:20"`
	IsCurrent       bool           `json:"is_current" gorm:"not null;default:false"`
	BatteryLevel    *int           `json:"battery_level,omitempty" gorm:"check:battery_level >= 0 AND battery_level <= 100"`
	CreatedAt       time.Time      `json:"created_at" gorm:"not null"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"not null"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

// PrivacySettings represents user's location privacy preferences
type PrivacySettings struct {
	ID                        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID                    uuid.UUID      `json:"user_id" gorm:"not null;uniqueIndex"`
	LocationSharingEnabled    bool           `json:"location_sharing_enabled" gorm:"not null;default:true"`
	VisibilityRadiusMeters    int            `json:"visibility_radius_meters" gorm:"not null;default:1000;check:visibility_radius_meters >= 0 AND visibility_radius_meters <= 50000"`
	ShareWithFriendsOnly      bool           `json:"share_with_friends_only" gorm:"not null;default:false"`
	SharePreciseLocation      bool           `json:"share_precise_location" gorm:"not null;default:false"`
	GhostModeEnabled          bool           `json:"ghost_mode_enabled" gorm:"not null;default:false"`
	AutoGhostModeHours        *int           `json:"auto_ghost_mode_hours,omitempty" gorm:"check:auto_ghost_mode_hours >= 0 AND auto_ghost_mode_hours <= 168"`
	ShareLocationHistory      bool           `json:"share_location_history" gorm:"not null;default:false"`
	AllowFriendRequestsNearby bool           `json:"allow_friend_requests_nearby" gorm:"not null;default:true"`
	CreatedAt                 time.Time      `json:"created_at" gorm:"not null"`
	UpdatedAt                 time.Time      `json:"updated_at" gorm:"not null"`
	DeletedAt                 gorm.DeletedAt `json:"-" gorm:"index"`
}

// ProximityEvent represents when users come near each other
type ProximityEvent struct {
	ID                        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID                    uuid.UUID      `json:"user_id" gorm:"not null;index"`
	OtherUserID               uuid.UUID      `json:"other_user_id" gorm:"not null;index"`
	DistanceMeters            float64        `json:"distance_meters" gorm:"not null;type:decimal(8,2);check:distance_meters >= 0"`
	EventType                 string         `json:"event_type" gorm:"not null;default:'entered';size:20;check:event_type IN ('entered','exited')"`
	InteractionDurationSeconds *int          `json:"interaction_duration_seconds,omitempty" gorm:"check:interaction_duration_seconds >= 0"`
	LocationLat               *float64       `json:"location_lat,omitempty" gorm:"type:decimal(10,8);check:location_lat >= -90 AND location_lat <= 90"`
	LocationLon               *float64       `json:"location_lon,omitempty" gorm:"type:decimal(11,8);check:location_lon >= -180 AND location_lon <= 180"`
	LocationGeom              string         `json:"-" gorm:"type:geometry(POINT,4326)"`
	WasNotified               bool           `json:"was_notified" gorm:"not null;default:false"`
	CreatedAt                 time.Time      `json:"created_at" gorm:"not null"`
	UpdatedAt                 time.Time      `json:"updated_at" gorm:"not null"`
	DeletedAt                 gorm.DeletedAt `json:"-" gorm:"index"`
}

// LocationSource constants
const (
	LocationSourceGPS     = "gps"
	LocationSourceNetwork = "network"
	LocationSourcePassive = "passive"
)

// EventType constants  
const (
	EventTypeEntered = "entered"
	EventTypeExited  = "exited"
)

// TableName sets the insert table name for UserLocation struct
func (UserLocation) TableName() string {
	return "user_locations"
}

// TableName sets the insert table name for PrivacySettings struct
func (PrivacySettings) TableName() string {
	return "privacy_settings"
}

// TableName sets the insert table name for ProximityEvent struct
func (ProximityEvent) TableName() string {
	return "proximity_events"
}

// BeforeCreate will set a UUID rather than numeric ID
func (ul *UserLocation) BeforeCreate(tx *gorm.DB) error {
	if ul.ID == uuid.Nil {
		ul.ID = uuid.New()
	}
	return nil
}

// BeforeCreate will set a UUID rather than numeric ID
func (ps *PrivacySettings) BeforeCreate(tx *gorm.DB) error {
	if ps.ID == uuid.Nil {
		ps.ID = uuid.New()
	}
	return nil
}

// BeforeCreate will set a UUID rather than numeric ID
func (pe *ProximityEvent) BeforeCreate(tx *gorm.DB) error {
	if pe.ID == uuid.Nil {
		pe.ID = uuid.New()
	}
	return nil
}
