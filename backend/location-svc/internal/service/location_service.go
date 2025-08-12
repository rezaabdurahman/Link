package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/backend/location-svc/internal/config"
	"github.com/link-app/backend/location-svc/internal/dto"
	"github.com/link-app/backend/location-svc/internal/models"
	"github.com/link-app/backend/location-svc/internal/repository"
)

// LocationService interface defines location business operations
type LocationService interface {
	UpdateLocation(ctx context.Context, userID uuid.UUID, req *dto.LocationUpdateRequest) (*dto.LocationResponse, error)
	GetNearbyUsers(ctx context.Context, userID uuid.UUID, req *dto.NearbyRequest) (*dto.NearbyResponse, error)
	GetCurrentLocation(ctx context.Context, userID uuid.UUID) (*dto.LocationResponse, error)
	GetLocationHistory(ctx context.Context, userID uuid.UUID, limit int) ([]dto.LocationResponse, error)
	DeleteUserLocation(ctx context.Context, userID uuid.UUID) error
}

type locationService struct {
	locationRepo  repository.LocationRepository
	privacyRepo   repository.PrivacyRepository
	redisRepo     repository.RedisRepository
}

// NewLocationService creates a new location service
func NewLocationService(
	locationRepo repository.LocationRepository,
	privacyRepo repository.PrivacyRepository,
	redisRepo repository.RedisRepository,
) LocationService {
	return &locationService{
		locationRepo: locationRepo,
		privacyRepo:  privacyRepo,
		redisRepo:    redisRepo,
	}
}

// UpdateLocation updates user's current location
func (s *locationService) UpdateLocation(ctx context.Context, userID uuid.UUID, req *dto.LocationUpdateRequest) (*dto.LocationResponse, error) {
	// Create location model
	location := &models.UserLocation{
		UserID:         userID,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		AccuracyMeters: req.AccuracyMeters,
		AltitudeMeters: req.AltitudeMeters,
		SpeedMps:       req.SpeedMps,
		HeadingDegrees: req.HeadingDegrees,
		LocationSource: models.LocationSourceGPS,
		IsCurrent:      true,
		BatteryLevel:   req.BatteryLevel,
	}

	// Set location source if provided
	if req.LocationSource != nil {
		location.LocationSource = *req.LocationSource
	}

	// Save to PostgreSQL
	if err := s.locationRepo.CreateLocation(location); err != nil {
		return nil, fmt.Errorf("failed to save location to database: %w", err)
	}

	// Update Redis GEO for real-time queries
	if err := s.redisRepo.SetUserLocation(ctx, userID, req.Latitude, req.Longitude); err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: failed to update Redis location: %v\n", err)
	}

	// Publish user available event
	event := &dto.UserAvailableEvent{
		UserID:         userID,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		IsOnline:       true,
		Timestamp:      time.Now(),
		BatteryLevel:   req.BatteryLevel,
		LocationSource: location.LocationSource,
	}

	if err := s.redisRepo.PublishUserAvailable(ctx, event); err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: failed to publish user available event: %v\n", err)
	}

	// Publish location update
	if err := s.redisRepo.PublishLocationUpdate(ctx, userID, req.Latitude, req.Longitude); err != nil {
		fmt.Printf("Warning: failed to publish location update: %v\n", err)
	}

	// Convert to response DTO
	response := &dto.LocationResponse{
		ID:              location.ID,
		UserID:          location.UserID,
		Latitude:        location.Latitude,
		Longitude:       location.Longitude,
		AccuracyMeters:  location.AccuracyMeters,
		AltitudeMeters:  location.AltitudeMeters,
		SpeedMps:        location.SpeedMps,
		HeadingDegrees:  location.HeadingDegrees,
		LocationSource:  location.LocationSource,
		IsCurrent:       location.IsCurrent,
		BatteryLevel:    location.BatteryLevel,
		CreatedAt:       location.CreatedAt,
		UpdatedAt:       location.UpdatedAt,
	}

	return response, nil
}

// GetNearbyUsers finds users near the specified location
func (s *locationService) GetNearbyUsers(ctx context.Context, userID uuid.UUID, req *dto.NearbyRequest) (*dto.NearbyResponse, error) {
	limit := 50 // default limit
	if req.Limit != nil && *req.Limit > 0 && *req.Limit <= 100 {
		limit = *req.Limit
	}

	// Check cache first
	cacheKey := fmt.Sprintf("nearby_%f_%f_%d_%s", req.Latitude, req.Longitude, req.RadiusMeters, userID.String())
	var cachedResponse dto.NearbyResponse
	if err := s.redisRepo.GetLocationCache(ctx, cacheKey, &cachedResponse); err == nil && len(cachedResponse.Users) > 0 {
		return &cachedResponse, nil
	}

	// Try Redis GEO first for real-time data
	var nearbyUsers []dto.NearbyUserResponse
	redisUsers, err := s.redisRepo.GetNearbyUsers(ctx, req.Latitude, req.Longitude, float64(req.RadiusMeters), "m", int64(limit))
	if err == nil && len(redisUsers) > 0 {
		// Process Redis results
		for _, user := range redisUsers {
			if user.Name == userID.String() {
				continue // Skip self
			}

			nearbyUserID, err := uuid.Parse(user.Name)
			if err != nil {
				continue
			}

			// Check privacy settings
			if !s.canUserSeeLocation(ctx, userID, nearbyUserID, req.FriendsOnly) {
				continue
			}

			nearbyUser := dto.NearbyUserResponse{
				UserID:         nearbyUserID,
				DistanceMeters: user.Dist,
				LastSeenAt:     time.Now(),
				IsOnline:       true,
			}

			// Add coordinates if user allows precise location
			if s.canSharePreciseLocation(ctx, nearbyUserID) {
				nearbyUser.ApproximateLatitude = &user.Longitude
				nearbyUser.ApproximateLongitude = &user.Latitude
			}

			nearbyUsers = append(nearbyUsers, nearbyUser)
		}
	} else {
		// Fallback to PostgreSQL
		dbUsers, err := s.locationRepo.GetNearbyUsers(req.Latitude, req.Longitude, req.RadiusMeters, limit, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get nearby users: %w", err)
		}

		for _, user := range dbUsers {
			// Check privacy settings
			if !s.canUserSeeLocation(ctx, userID, user.UserID, req.FriendsOnly) {
				continue
			}

			// Parse last seen time
			lastSeenAt, _ := time.Parse(time.RFC3339, user.LastSeenAt)

			nearbyUser := dto.NearbyUserResponse{
				UserID:         user.UserID,
				DistanceMeters: user.DistanceMeters,
				LastSeenAt:     lastSeenAt,
				IsOnline:       time.Since(lastSeenAt) < 5*time.Minute, // Consider online if seen in last 5 minutes
			}

			// Add coordinates if user allows precise location
			if s.canSharePreciseLocation(ctx, user.UserID) {
				nearbyUser.ApproximateLatitude = &user.Latitude
				nearbyUser.ApproximateLongitude = &user.Longitude
			}

			nearbyUsers = append(nearbyUsers, nearbyUser)
		}
	}

	response := &dto.NearbyResponse{
		Users:      nearbyUsers,
		Total:      len(nearbyUsers),
		RadiusUsed: req.RadiusMeters,
	}

	// Cache the response
	if err := s.redisRepo.SetLocationCache(ctx, cacheKey, response, config.NearbyCacheTTL); err != nil {
		fmt.Printf("Warning: failed to cache nearby response: %v\n", err)
	}

	return response, nil
}

// GetCurrentLocation retrieves user's current location
func (s *locationService) GetCurrentLocation(ctx context.Context, userID uuid.UUID) (*dto.LocationResponse, error) {
	location, err := s.locationRepo.GetCurrentLocation(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current location: %w", err)
	}

	if location == nil {
		return nil, nil
	}

	response := &dto.LocationResponse{
		ID:              location.ID,
		UserID:          location.UserID,
		Latitude:        location.Latitude,
		Longitude:       location.Longitude,
		AccuracyMeters:  location.AccuracyMeters,
		AltitudeMeters:  location.AltitudeMeters,
		SpeedMps:        location.SpeedMps,
		HeadingDegrees:  location.HeadingDegrees,
		LocationSource:  location.LocationSource,
		IsCurrent:       location.IsCurrent,
		BatteryLevel:    location.BatteryLevel,
		CreatedAt:       location.CreatedAt,
		UpdatedAt:       location.UpdatedAt,
	}

	return response, nil
}

// GetLocationHistory retrieves user's location history
func (s *locationService) GetLocationHistory(ctx context.Context, userID uuid.UUID, limit int) ([]dto.LocationResponse, error) {
	locations, err := s.locationRepo.GetLocationHistory(userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get location history: %w", err)
	}

	var responses []dto.LocationResponse
	for _, location := range locations {
		response := dto.LocationResponse{
			ID:              location.ID,
			UserID:          location.UserID,
			Latitude:        location.Latitude,
			Longitude:       location.Longitude,
			AccuracyMeters:  location.AccuracyMeters,
			AltitudeMeters:  location.AltitudeMeters,
			SpeedMps:        location.SpeedMps,
			HeadingDegrees:  location.HeadingDegrees,
			LocationSource:  location.LocationSource,
			IsCurrent:       location.IsCurrent,
			BatteryLevel:    location.BatteryLevel,
			CreatedAt:       location.CreatedAt,
			UpdatedAt:       location.UpdatedAt,
		}
		responses = append(responses, response)
	}

	return responses, nil
}

// DeleteUserLocation removes user's location data
func (s *locationService) DeleteUserLocation(ctx context.Context, userID uuid.UUID) error {
	// Remove from Redis
	if err := s.redisRepo.RemoveUserLocation(ctx, userID); err != nil {
		fmt.Printf("Warning: failed to remove user from Redis: %v\n", err)
	}

	// Clear current location in database (keep history for analytics)
	if err := s.locationRepo.ClearOldLocations(userID); err != nil {
		return fmt.Errorf("failed to clear user locations: %w", err)
	}

	return nil
}

// Helper method to check if user can see another user's location
func (s *locationService) canUserSeeLocation(ctx context.Context, viewerID, targetUserID uuid.UUID, friendsOnly *bool) bool {
	// Get target user's privacy settings (with caching)
	var privacySettings models.PrivacySettings
	if err := s.redisRepo.GetPrivacyCache(ctx, targetUserID, &privacySettings); err != nil {
		// Cache miss, get from database
		settings, err := s.privacyRepo.GetPrivacySettings(targetUserID)
		if err != nil || settings == nil {
			// Default privacy settings if not found
			return true
		}
		privacySettings = *settings
		
		// Cache the settings
		s.redisRepo.SetPrivacyCache(ctx, targetUserID, privacySettings, config.PrivacyCacheTTL)
	}

	// Check if location sharing is disabled
	if !privacySettings.LocationSharingEnabled {
		return false
	}

	// Check ghost mode
	if privacySettings.GhostModeEnabled {
		return false
	}

	// Check friends-only setting
	if privacySettings.ShareWithFriendsOnly || (friendsOnly != nil && *friendsOnly) {
		// TODO: Implement friendship check with user service
		return s.areFriends(ctx, viewerID, targetUserID)
	}

	return true
}

// Helper method to check if user can share precise location
func (s *locationService) canSharePreciseLocation(ctx context.Context, userID uuid.UUID) bool {
	var privacySettings models.PrivacySettings
	if err := s.redisRepo.GetPrivacyCache(ctx, userID, &privacySettings); err != nil {
		settings, err := s.privacyRepo.GetPrivacySettings(userID)
		if err != nil || settings == nil {
			return false
		}
		privacySettings = *settings
		s.redisRepo.SetPrivacyCache(ctx, userID, privacySettings, config.PrivacyCacheTTL)
	}

	return privacySettings.SharePreciseLocation
}

// Helper method to check friendship status
func (s *locationService) areFriends(ctx context.Context, userID1, userID2 uuid.UUID) bool {
	// TODO: Implement friendship check with user service via HTTP client or gRPC
	// For now, return true as placeholder
	return true
}
