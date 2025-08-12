package service

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/repository"
)

// AvailabilityService handles business logic for user availability
type AvailabilityService struct {
	availabilityRepo *repository.AvailabilityRepository
}

// NewAvailabilityService creates a new availability service
func NewAvailabilityService(availabilityRepo *repository.AvailabilityRepository) *AvailabilityService {
	return &AvailabilityService{
		availabilityRepo: availabilityRepo,
	}
}

// GetUserAvailability gets the availability status for a specific user
func (s *AvailabilityService) GetUserAvailability(userID uuid.UUID) (*models.Availability, error) {
	availability, err := s.availabilityRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user availability: %w", err)
	}
	
	// If no availability record exists, create a default one (unavailable)
	if availability == nil {
		availability = &models.Availability{
			UserID:      userID,
			IsAvailable: false,
		}
		
		err = s.availabilityRepo.CreateOrUpdate(availability)
		if err != nil {
			return nil, fmt.Errorf("failed to create default availability record: %w", err)
		}
	}
	
	return availability, nil
}

// UpdateUserAvailability updates the availability status for a specific user
func (s *AvailabilityService) UpdateUserAvailability(userID uuid.UUID, isAvailable bool) (*models.Availability, error) {
	// Get existing availability or create a new one
	availability, err := s.availabilityRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing availability: %w", err)
	}
	
	if availability == nil {
		availability = &models.Availability{
			UserID: userID,
		}
	}
	
	// Update availability status
	if isAvailable {
		availability.SetAvailable()
	} else {
		availability.SetUnavailable()
	}
	
	// Save to database
	err = s.availabilityRepo.CreateOrUpdate(availability)
	if err != nil {
		return nil, fmt.Errorf("failed to update availability: %w", err)
	}
	
	return availability, nil
}

// GetAvailableUsers gets a paginated list of users who are currently available
func (s *AvailabilityService) GetAvailableUsers(limit, offset int) ([]models.Availability, int64, error) {
	// Validate pagination parameters
	if limit <= 0 {
		limit = 50 // Default limit
	}
	if limit > 100 {
		limit = 100 // Max limit
	}
	if offset < 0 {
		offset = 0
	}
	
	// Get available users
	availabilities, err := s.availabilityRepo.GetAvailableUsers(limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get available users: %w", err)
	}
	
	// Get total count
	totalCount, err := s.availabilityRepo.CountAvailableUsers()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count available users: %w", err)
	}
	
	return availabilities, totalCount, nil
}

// HandleUserHeartbeat updates the user's availability based on a heartbeat
// This could be called periodically to keep users marked as available
func (s *AvailabilityService) HandleUserHeartbeat(userID uuid.UUID) (*models.Availability, error) {
	// Get existing availability
	availability, err := s.availabilityRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing availability: %w", err)
	}
	
	if availability == nil {
		// Create new availability record as available
		availability = &models.Availability{
			UserID: userID,
		}
		availability.SetAvailable()
	} else if availability.IsAvailable {
		// Update the last available timestamp if already available
		now := time.Now()
		availability.LastAvailableAt = &now
	} else {
		// If user was unavailable, mark them as available
		availability.SetAvailable()
	}
	
	// Save to database
	err = s.availabilityRepo.CreateOrUpdate(availability)
	if err != nil {
		return nil, fmt.Errorf("failed to update availability via heartbeat: %w", err)
	}
	
	return availability, nil
}

// CleanupStaleAvailability marks users as unavailable if they haven't sent a heartbeat recently
// This should be called periodically (e.g., every 5 minutes) to clean up stale availability
func (s *AvailabilityService) CleanupStaleAvailability(staleThreshold time.Duration) error {
	// This would require a custom query to find users who are marked as available
	// but haven't updated their last_available_at within the threshold
	// For now, we'll leave this as a TODO for future implementation
	
	// TODO: Implement stale availability cleanup
	// This could be done with a raw SQL query or by getting all available users
	// and checking their last_available_at timestamps
	
	return nil
}

// RemoveUserAvailability removes the availability record for a user (e.g., when user is deleted)
func (s *AvailabilityService) RemoveUserAvailability(userID uuid.UUID) error {
	err := s.availabilityRepo.DeleteByUserID(userID)
	if err != nil {
		return fmt.Errorf("failed to remove user availability: %w", err)
	}
	return nil
}
