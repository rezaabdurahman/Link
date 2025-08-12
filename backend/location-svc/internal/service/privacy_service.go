package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/link-app/backend/location-svc/internal/config"
	"github.com/link-app/backend/location-svc/internal/dto"
	"github.com/link-app/backend/location-svc/internal/models"
	"github.com/link-app/backend/location-svc/internal/repository"
)

// PrivacyService interface defines privacy settings operations
type PrivacyService interface {
	CreatePrivacySettings(ctx context.Context, userID uuid.UUID) (*dto.PrivacySettingsResponse, error)
	UpdatePrivacySettings(ctx context.Context, userID uuid.UUID, req *dto.PrivacySettingsUpdateRequest) (*dto.PrivacySettingsResponse, error)
	GetPrivacySettings(ctx context.Context, userID uuid.UUID) (*dto.PrivacySettingsResponse, error)
	DeletePrivacySettings(ctx context.Context, userID uuid.UUID) error
}

type privacyService struct {
	privacyRepo repository.PrivacyRepository
	redisRepo   repository.RedisRepository
}

// NewPrivacyService creates a new privacy service
func NewPrivacyService(
	privacyRepo repository.PrivacyRepository,
	redisRepo repository.RedisRepository,
) PrivacyService {
	return &privacyService{
		privacyRepo: privacyRepo,
		redisRepo:   redisRepo,
	}
}

// CreatePrivacySettings creates default privacy settings for a new user
func (s *privacyService) CreatePrivacySettings(ctx context.Context, userID uuid.UUID) (*dto.PrivacySettingsResponse, error) {
	// Check if settings already exist
	existing, err := s.privacyRepo.GetPrivacySettings(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing privacy settings: %w", err)
	}
	
	if existing != nil {
		return s.convertToDTO(existing), nil
	}

	// Create default settings
	settings := &models.PrivacySettings{
		UserID:                    userID,
		LocationSharingEnabled:    true,
		VisibilityRadiusMeters:    1000,
		ShareWithFriendsOnly:      false,
		SharePreciseLocation:      false,
		GhostModeEnabled:          false,
		AutoGhostModeHours:        nil,
		ShareLocationHistory:      false,
		AllowFriendRequestsNearby: true,
	}

	if err := s.privacyRepo.CreatePrivacySettings(settings); err != nil {
		return nil, fmt.Errorf("failed to create privacy settings: %w", err)
	}

	// Cache the settings
	if err := s.redisRepo.SetPrivacyCache(ctx, userID, settings, config.PrivacyCacheTTL); err != nil {
		fmt.Printf("Warning: failed to cache privacy settings: %v\n", err)
	}

	return s.convertToDTO(settings), nil
}

// UpdatePrivacySettings updates user's privacy settings
func (s *privacyService) UpdatePrivacySettings(ctx context.Context, userID uuid.UUID, req *dto.PrivacySettingsUpdateRequest) (*dto.PrivacySettingsResponse, error) {
	// Get existing settings
	existingSettings, err := s.privacyRepo.GetPrivacySettings(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing privacy settings: %w", err)
	}

	// Create new settings if they don't exist
	if existingSettings == nil {
		return s.CreatePrivacySettings(ctx, userID)
	}

	// Update fields if provided
	if req.LocationSharingEnabled != nil {
		existingSettings.LocationSharingEnabled = *req.LocationSharingEnabled
	}
	if req.VisibilityRadiusMeters != nil {
		existingSettings.VisibilityRadiusMeters = *req.VisibilityRadiusMeters
	}
	if req.ShareWithFriendsOnly != nil {
		existingSettings.ShareWithFriendsOnly = *req.ShareWithFriendsOnly
	}
	if req.SharePreciseLocation != nil {
		existingSettings.SharePreciseLocation = *req.SharePreciseLocation
	}
	if req.GhostModeEnabled != nil {
		existingSettings.GhostModeEnabled = *req.GhostModeEnabled
	}
	if req.AutoGhostModeHours != nil {
		existingSettings.AutoGhostModeHours = req.AutoGhostModeHours
	}
	if req.ShareLocationHistory != nil {
		existingSettings.ShareLocationHistory = *req.ShareLocationHistory
	}
	if req.AllowFriendRequestsNearby != nil {
		existingSettings.AllowFriendRequestsNearby = *req.AllowFriendRequestsNearby
	}

	// Save to database
	if err := s.privacyRepo.UpdatePrivacySettings(userID, existingSettings); err != nil {
		return nil, fmt.Errorf("failed to update privacy settings: %w", err)
	}

	// Update cache
	if err := s.redisRepo.SetPrivacyCache(ctx, userID, existingSettings, config.PrivacyCacheTTL); err != nil {
		fmt.Printf("Warning: failed to update privacy cache: %v\n", err)
	}

	return s.convertToDTO(existingSettings), nil
}

// GetPrivacySettings retrieves user's privacy settings
func (s *privacyService) GetPrivacySettings(ctx context.Context, userID uuid.UUID) (*dto.PrivacySettingsResponse, error) {
	// Try cache first
	var cachedSettings models.PrivacySettings
	if err := s.redisRepo.GetPrivacyCache(ctx, userID, &cachedSettings); err == nil {
		return s.convertToDTO(&cachedSettings), nil
	}

	// Get from database
	settings, err := s.privacyRepo.GetPrivacySettings(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get privacy settings: %w", err)
	}

	if settings == nil {
		// Create default settings for new user
		return s.CreatePrivacySettings(ctx, userID)
	}

	// Cache the settings
	if err := s.redisRepo.SetPrivacyCache(ctx, userID, settings, config.PrivacyCacheTTL); err != nil {
		fmt.Printf("Warning: failed to cache privacy settings: %v\n", err)
	}

	return s.convertToDTO(settings), nil
}

// DeletePrivacySettings removes user's privacy settings
func (s *privacyService) DeletePrivacySettings(ctx context.Context, userID uuid.UUID) error {
	// Delete from database
	if err := s.privacyRepo.DeletePrivacySettings(userID); err != nil {
		return fmt.Errorf("failed to delete privacy settings: %w", err)
	}

	// Remove from cache
	cacheKey := config.RedisKeyPrivacyCache + userID.String()
	if err := s.redisRepo.DeleteLocationCache(ctx, cacheKey); err != nil {
		fmt.Printf("Warning: failed to delete privacy cache: %v\n", err)
	}

	return nil
}

// convertToDTO converts model to DTO
func (s *privacyService) convertToDTO(settings *models.PrivacySettings) *dto.PrivacySettingsResponse {
	return &dto.PrivacySettingsResponse{
		ID:                        settings.ID,
		UserID:                    settings.UserID,
		LocationSharingEnabled:    settings.LocationSharingEnabled,
		VisibilityRadiusMeters:    settings.VisibilityRadiusMeters,
		ShareWithFriendsOnly:      settings.ShareWithFriendsOnly,
		SharePreciseLocation:      settings.SharePreciseLocation,
		GhostModeEnabled:          settings.GhostModeEnabled,
		AutoGhostModeHours:        settings.AutoGhostModeHours,
		ShareLocationHistory:      settings.ShareLocationHistory,
		AllowFriendRequestsNearby: settings.AllowFriendRequestsNearby,
		CreatedAt:                 settings.CreatedAt,
		UpdatedAt:                 settings.UpdatedAt,
	}
}
