package onboarding

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrOnboardingProgressNotFound = errors.New("onboarding progress not found")
	ErrUserPreferencesNotFound    = errors.New("user preferences not found")
)

// Repository defines the interface for onboarding data access
type Repository interface {
	// OnboardingProgress operations
	CreateOnboardingProgress(progress *OnboardingProgress) error
	GetOnboardingProgressByUserID(userID uuid.UUID) (*OnboardingProgress, error)
	UpdateOnboardingProgress(progress *OnboardingProgress) error

	// UserPreferences operations
	CreateUserPreferences(preferences *UserPreferences) error
	GetUserPreferencesByUserID(userID uuid.UUID) (*UserPreferences, error)
	UpdateUserPreferences(preferences *UserPreferences) error
}

// gormRepository implements the Repository interface using GORM
// This now delegates to OnboardingDataRepository to provide a clear boundary
type gormRepository struct {
	dataRepo OnboardingDataRepository
}

// NewGormRepository creates a new GORM-based onboarding repository
func NewGormRepository(db *gorm.DB) Repository {
	dataRepo := NewGormOnboardingDataRepository(db)
	return &gormRepository{dataRepo: dataRepo}
}

// CreateOnboardingProgress creates a new onboarding progress record
func (r *gormRepository) CreateOnboardingProgress(progress *OnboardingProgress) error {
	return r.dataRepo.CreateOnboardingProgress(progress)
}

// GetOnboardingProgressByUserID retrieves onboarding progress by user ID
func (r *gormRepository) GetOnboardingProgressByUserID(userID uuid.UUID) (*OnboardingProgress, error) {
	return r.dataRepo.GetOnboardingProgressByUserID(userID)
}

// UpdateOnboardingProgress updates an existing onboarding progress record
func (r *gormRepository) UpdateOnboardingProgress(progress *OnboardingProgress) error {
	return r.dataRepo.UpdateOnboardingProgress(progress)
}

// CreateUserPreferences creates a new user preferences record
func (r *gormRepository) CreateUserPreferences(preferences *UserPreferences) error {
	return r.dataRepo.CreateUserPreferences(preferences)
}

// GetUserPreferencesByUserID retrieves user preferences by user ID
func (r *gormRepository) GetUserPreferencesByUserID(userID uuid.UUID) (*UserPreferences, error) {
	return r.dataRepo.GetUserPreferencesByUserID(userID)
}

// UpdateUserPreferences updates existing user preferences
func (r *gormRepository) UpdateUserPreferences(preferences *UserPreferences) error {
	return r.dataRepo.UpdateUserPreferences(preferences)
}
