package repository

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/models"
	"gorm.io/gorm"
)

// AvailabilityRepository handles database operations for user availability
type AvailabilityRepository struct {
	db *gorm.DB
}

// NewAvailabilityRepository creates a new availability repository
func NewAvailabilityRepository(db *gorm.DB) *AvailabilityRepository {
	return &AvailabilityRepository{
		db: db,
	}
}

// GetByUserID gets the availability status for a specific user
func (r *AvailabilityRepository) GetByUserID(userID uuid.UUID) (*models.Availability, error) {
	var availability models.Availability
	err := r.db.Where("user_id = ?", userID).First(&availability).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // Return nil if not found, not an error
		}
		return nil, fmt.Errorf("failed to get availability for user %s: %w", userID, err)
	}
	return &availability, nil
}

// CreateOrUpdate creates a new availability record or updates an existing one
func (r *AvailabilityRepository) CreateOrUpdate(availability *models.Availability) error {
	// Use UPSERT (ON CONFLICT) to handle create or update
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var existingAvailability models.Availability
		err := tx.Where("user_id = ?", availability.UserID).First(&existingAvailability).Error
		
		if err == gorm.ErrRecordNotFound {
			// Create new record
			return tx.Create(availability).Error
		} else if err != nil {
			return fmt.Errorf("failed to check existing availability: %w", err)
		}
		
		// Update existing record
		availability.ID = existingAvailability.ID
		availability.CreatedAt = existingAvailability.CreatedAt
		return tx.Save(availability).Error
	})
	
	if err != nil {
		return fmt.Errorf("failed to create or update availability for user %s: %w", availability.UserID, err)
	}
	
	return nil
}

// GetAvailableUsers gets all users who are currently available
func (r *AvailabilityRepository) GetAvailableUsers(limit int, offset int) ([]models.Availability, error) {
	var availabilities []models.Availability
	query := r.db.Where("is_available = ?", true)
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}
	
	err := query.Order("last_available_at DESC").Find(&availabilities).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get available users: %w", err)
	}
	
	return availabilities, nil
}

// CountAvailableUsers counts the total number of available users
func (r *AvailabilityRepository) CountAvailableUsers() (int64, error) {
	var count int64
	err := r.db.Model(&models.Availability{}).Where("is_available = ?", true).Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to count available users: %w", err)
	}
	return count, nil
}

// DeleteByUserID deletes the availability record for a specific user
func (r *AvailabilityRepository) DeleteByUserID(userID uuid.UUID) error {
	err := r.db.Where("user_id = ?", userID).Delete(&models.Availability{}).Error
	if err != nil {
		return fmt.Errorf("failed to delete availability for user %s: %w", userID, err)
	}
	return nil
}
