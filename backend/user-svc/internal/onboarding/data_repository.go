package onboarding

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OnboardingDataRepository defines the interface for onboarding-specific data access
// This repository abstracts access to onboarding data stored in the shared users table
// When extracting to a separate service, this can be replaced with a dedicated database
type OnboardingDataRepository interface {
	// OnboardingProgress operations
	CreateOnboardingProgress(progress *OnboardingProgress) error
	GetOnboardingProgressByUserID(userID uuid.UUID) (*OnboardingProgress, error)
	UpdateOnboardingProgress(progress *OnboardingProgress) error
	DeleteOnboardingProgress(userID uuid.UUID) error
	
	// UserPreferences operations  
	CreateUserPreferences(preferences *UserPreferences) error
	GetUserPreferencesByUserID(userID uuid.UUID) (*UserPreferences, error)
	UpdateUserPreferences(preferences *UserPreferences) error
	DeleteUserPreferences(userID uuid.UUID) error
	
	// Batch operations for data migration
	GetAllOnboardingProgress(limit, offset int) ([]OnboardingProgress, error)
	GetAllUserPreferences(limit, offset int) ([]UserPreferences, error)
}

// gormOnboardingDataRepository implements OnboardingDataRepository using GORM
// This implementation stores onboarding data in the same database as users
// but provides a clear boundary for future extraction
type gormOnboardingDataRepository struct {
	db *gorm.DB
}

// NewGormOnboardingDataRepository creates a new GORM-based onboarding data repository
func NewGormOnboardingDataRepository(db *gorm.DB) OnboardingDataRepository {
	return &gormOnboardingDataRepository{db: db}
}

// CreateOnboardingProgress creates a new onboarding progress record
func (r *gormOnboardingDataRepository) CreateOnboardingProgress(progress *OnboardingProgress) error {
	if err := r.db.Create(progress).Error; err != nil {
		return fmt.Errorf("failed to create onboarding progress: %w", err)
	}
	return nil
}

// GetOnboardingProgressByUserID retrieves onboarding progress by user ID
func (r *gormOnboardingDataRepository) GetOnboardingProgressByUserID(userID uuid.UUID) (*OnboardingProgress, error) {
	var progress OnboardingProgress
	err := r.db.Where("user_id = ?", userID).First(&progress).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOnboardingProgressNotFound
		}
		return nil, fmt.Errorf("failed to get onboarding progress: %w", err)
	}
	return &progress, nil
}

// UpdateOnboardingProgress updates an existing onboarding progress record
func (r *gormOnboardingDataRepository) UpdateOnboardingProgress(progress *OnboardingProgress) error {
	if err := r.db.Save(progress).Error; err != nil {
		return fmt.Errorf("failed to update onboarding progress: %w", err)
	}
	return nil
}

// DeleteOnboardingProgress deletes onboarding progress for a user
func (r *gormOnboardingDataRepository) DeleteOnboardingProgress(userID uuid.UUID) error {
	if err := r.db.Where("user_id = ?", userID).Delete(&OnboardingProgress{}).Error; err != nil {
		return fmt.Errorf("failed to delete onboarding progress: %w", err)
	}
	return nil
}

// CreateUserPreferences creates a new user preferences record
func (r *gormOnboardingDataRepository) CreateUserPreferences(preferences *UserPreferences) error {
	if err := r.db.Create(preferences).Error; err != nil {
		return fmt.Errorf("failed to create user preferences: %w", err)
	}
	return nil
}

// GetUserPreferencesByUserID retrieves user preferences by user ID
func (r *gormOnboardingDataRepository) GetUserPreferencesByUserID(userID uuid.UUID) (*UserPreferences, error) {
	var preferences UserPreferences
	err := r.db.Where("user_id = ?", userID).First(&preferences).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserPreferencesNotFound
		}
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}
	return &preferences, nil
}

// UpdateUserPreferences updates existing user preferences
func (r *gormOnboardingDataRepository) UpdateUserPreferences(preferences *UserPreferences) error {
	if err := r.db.Save(preferences).Error; err != nil {
		return fmt.Errorf("failed to update user preferences: %w", err)
	}
	return nil
}

// DeleteUserPreferences deletes user preferences for a user
func (r *gormOnboardingDataRepository) DeleteUserPreferences(userID uuid.UUID) error {
	if err := r.db.Where("user_id = ?", userID).Delete(&UserPreferences{}).Error; err != nil {
		return fmt.Errorf("failed to delete user preferences: %w", err)
	}
	return nil
}

// GetAllOnboardingProgress retrieves all onboarding progress records for batch processing
func (r *gormOnboardingDataRepository) GetAllOnboardingProgress(limit, offset int) ([]OnboardingProgress, error) {
	var progressList []OnboardingProgress
	err := r.db.Order("created_at").Limit(limit).Offset(offset).Find(&progressList).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get all onboarding progress: %w", err)
	}
	return progressList, nil
}

// GetAllUserPreferences retrieves all user preferences records for batch processing
func (r *gormOnboardingDataRepository) GetAllUserPreferences(limit, offset int) ([]UserPreferences, error) {
	var preferencesList []UserPreferences
	err := r.db.Order("created_at").Limit(limit).Offset(offset).Find(&preferencesList).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get all user preferences: %w", err)
	}
	return preferencesList, nil
}
