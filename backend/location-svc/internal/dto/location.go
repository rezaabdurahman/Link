package dto

import (
	"time"

	"github.com/google/uuid"
)

// LocationUpdateRequest represents location update data
type LocationUpdateRequest struct {
	Latitude        float64  `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude       float64  `json:"longitude" validate:"required,min=-180,max=180"`
	AccuracyMeters  *int     `json:"accuracy_meters,omitempty" validate:"omitempty,min=0"`
	AltitudeMeters  *float64 `json:"altitude_meters,omitempty"`
	SpeedMps        *float64 `json:"speed_mps,omitempty" validate:"omitempty,min=0"`
	HeadingDegrees  *int     `json:"heading_degrees,omitempty" validate:"omitempty,min=0,max=359"`
	LocationSource  *string  `json:"location_source,omitempty" validate:"omitempty,oneof=gps network passive"`
	BatteryLevel    *int     `json:"battery_level,omitempty" validate:"omitempty,min=0,max=100"`
}

// NearbyRequest represents proximity query parameters
type NearbyRequest struct {
	Latitude      float64 `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude     float64 `json:"longitude" validate:"required,min=-180,max=180"`
	RadiusMeters  int     `json:"radius_meters" validate:"required,min=1,max=50000"`
	Limit         *int    `json:"limit,omitempty" validate:"omitempty,min=1,max=100"`
	FriendsOnly   *bool   `json:"friends_only,omitempty"`
}

// LocationResponse represents location data in responses
type LocationResponse struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	Latitude        float64    `json:"latitude"`
	Longitude       float64    `json:"longitude"`
	AccuracyMeters  *int       `json:"accuracy_meters,omitempty"`
	AltitudeMeters  *float64   `json:"altitude_meters,omitempty"`
	SpeedMps        *float64   `json:"speed_mps,omitempty"`
	HeadingDegrees  *int       `json:"heading_degrees,omitempty"`
	LocationSource  string     `json:"location_source"`
	IsCurrent       bool       `json:"is_current"`
	BatteryLevel    *int       `json:"battery_level,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// NearbyUserResponse represents a user found in proximity
type NearbyUserResponse struct {
	UserID            uuid.UUID  `json:"user_id"`
	DistanceMeters    float64    `json:"distance_meters"`
	LastSeenAt        time.Time  `json:"last_seen_at"`
	IsOnline          bool       `json:"is_online"`
	// Optional user details (if user has appropriate permissions)
	Username          *string    `json:"username,omitempty"`
	FirstName         *string    `json:"first_name,omitempty"`
	LastName          *string    `json:"last_name,omitempty"`
	ProfilePictureURL *string    `json:"profile_picture_url,omitempty"`
	// Approximate location (if user allows precise location sharing)
	ApproximateLatitude  *float64   `json:"approximate_latitude,omitempty"`
	ApproximateLongitude *float64   `json:"approximate_longitude,omitempty"`
}

// NearbyResponse represents the response for proximity queries
type NearbyResponse struct {
	Users       []NearbyUserResponse `json:"users"`
	Total       int                  `json:"total"`
	RadiusUsed  int                  `json:"radius_used"`
}

// PrivacySettingsUpdateRequest represents privacy settings update data
type PrivacySettingsUpdateRequest struct {
	LocationSharingEnabled    *bool `json:"location_sharing_enabled,omitempty"`
	VisibilityRadiusMeters    *int  `json:"visibility_radius_meters,omitempty" validate:"omitempty,min=0,max=50000"`
	ShareWithFriendsOnly      *bool `json:"share_with_friends_only,omitempty"`
	SharePreciseLocation      *bool `json:"share_precise_location,omitempty"`
	GhostModeEnabled          *bool `json:"ghost_mode_enabled,omitempty"`
	AutoGhostModeHours        *int  `json:"auto_ghost_mode_hours,omitempty" validate:"omitempty,min=0,max=168"`
	ShareLocationHistory      *bool `json:"share_location_history,omitempty"`
	AllowFriendRequestsNearby *bool `json:"allow_friend_requests_nearby,omitempty"`
}

// PrivacySettingsResponse represents privacy settings data in responses
type PrivacySettingsResponse struct {
	ID                        uuid.UUID `json:"id"`
	UserID                    uuid.UUID `json:"user_id"`
	LocationSharingEnabled    bool      `json:"location_sharing_enabled"`
	VisibilityRadiusMeters    int       `json:"visibility_radius_meters"`
	ShareWithFriendsOnly      bool      `json:"share_with_friends_only"`
	SharePreciseLocation      bool      `json:"share_precise_location"`
	GhostModeEnabled          bool      `json:"ghost_mode_enabled"`
	AutoGhostModeHours        *int      `json:"auto_ghost_mode_hours,omitempty"`
	ShareLocationHistory      bool      `json:"share_location_history"`
	AllowFriendRequestsNearby bool      `json:"allow_friend_requests_nearby"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

// ProximityEventResponse represents proximity event data in responses
type ProximityEventResponse struct {
	ID                        uuid.UUID  `json:"id"`
	UserID                    uuid.UUID  `json:"user_id"`
	OtherUserID               uuid.UUID  `json:"other_user_id"`
	DistanceMeters            float64    `json:"distance_meters"`
	EventType                 string     `json:"event_type"`
	InteractionDurationSeconds *int      `json:"interaction_duration_seconds,omitempty"`
	LocationLat               *float64   `json:"location_lat,omitempty"`
	LocationLon               *float64   `json:"location_lon,omitempty"`
	WasNotified               bool       `json:"was_notified"`
	CreatedAt                 time.Time  `json:"created_at"`
}

// UserAvailableEvent represents a Redis pub/sub event for user availability
type UserAvailableEvent struct {
	UserID         uuid.UUID  `json:"user_id"`
	Latitude       float64    `json:"latitude"`
	Longitude      float64    `json:"longitude"`
	IsOnline       bool       `json:"is_online"`
	Timestamp      time.Time  `json:"timestamp"`
	BatteryLevel   *int       `json:"battery_level,omitempty"`
	LocationSource string     `json:"location_source"`
}

// ErrorResponse represents error responses
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// SuccessResponse represents success responses
type SuccessResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
