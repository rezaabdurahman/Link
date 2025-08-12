package repository

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/link-app/backend/location-svc/internal/models"
	"gorm.io/gorm"
)

// PrivacyRepository interface defines privacy settings operations
type PrivacyRepository interface {
	CreatePrivacySettings(settings *models.PrivacySettings) error
	UpdatePrivacySettings(userID uuid.UUID, settings *models.PrivacySettings) error
	GetPrivacySettings(userID uuid.UUID) (*models.PrivacySettings, error)
	GetPrivacySettingsBatch(userIDs []uuid.UUID) ([]models.PrivacySettings, error)
	DeletePrivacySettings(userID uuid.UUID) error
}

type privacyRepository struct {
	db *gorm.DB
}

// NewPrivacyRepository creates a new privacy repository
func NewPrivacyRepository(db *gorm.DB) PrivacyRepository {
	return &privacyRepository{
		db: db,
	}
}

// CreatePrivacySettings creates new privacy settings for a user
func (r *privacyRepository) CreatePrivacySettings(settings *models.PrivacySettings) error {
	if err := r.db.Create(settings).Error; err != nil {
		return fmt.Errorf("failed to create privacy settings: %w", err)
	}
	return nil
}

// UpdatePrivacySettings updates existing privacy settings
func (r *privacyRepository) UpdatePrivacySettings(userID uuid.UUID, settings *models.PrivacySettings) error {
	settings.UserID = userID
	
	if err := r.db.Save(settings).Error; err != nil {
		return fmt.Errorf("failed to update privacy settings: %w", err)
	}
	return nil
}

// GetPrivacySettings retrieves privacy settings for a user
func (r *privacyRepository) GetPrivacySettings(userID uuid.UUID) (*models.PrivacySettings, error) {
	var settings models.PrivacySettings
	
	if err := r.db.Where("user_id = ?", userID).First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get privacy settings: %w", err)
	}

	return &settings, nil
}

// GetPrivacySettingsBatch retrieves privacy settings for multiple users
func (r *privacyRepository) GetPrivacySettingsBatch(userIDs []uuid.UUID) ([]models.PrivacySettings, error) {
	var settings []models.PrivacySettings
	
	if err := r.db.Where("user_id IN ?", userIDs).Find(&settings).Error; err != nil {
		return nil, fmt.Errorf("failed to get batch privacy settings: %w", err)
	}

	return settings, nil
}

// DeletePrivacySettings deletes privacy settings for a user
func (r *privacyRepository) DeletePrivacySettings(userID uuid.UUID) error {
	if err := r.db.Where("user_id = ?", userID).Delete(&models.PrivacySettings{}).Error; err != nil {
		return fmt.Errorf("failed to delete privacy settings: %w", err)
	}
	return nil
}
