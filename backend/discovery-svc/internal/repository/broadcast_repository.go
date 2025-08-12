package repository

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/models"
	"gorm.io/gorm"
)

var (
	ErrBroadcastNotFound = errors.New("broadcast not found")
)

// BroadcastRepository handles database operations for broadcasts
type BroadcastRepository struct {
	db *gorm.DB
}

// NewBroadcastRepository creates a new broadcast repository
func NewBroadcastRepository(db *gorm.DB) *BroadcastRepository {
	return &BroadcastRepository{db: db}
}

// GetByUserID retrieves a user's active broadcast
func (r *BroadcastRepository) GetByUserID(userID uuid.UUID) (*models.Broadcast, error) {
	var broadcast models.Broadcast
	
	err := r.db.Where("user_id = ? AND is_active = true AND (expires_at IS NULL OR expires_at > ?)", 
		userID, time.Now()).First(&broadcast).Error
		
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrBroadcastNotFound
	}
	
	return &broadcast, err
}

// CreateOrUpdate creates a new broadcast or updates existing one (ensuring only one active broadcast per user)
func (r *BroadcastRepository) CreateOrUpdate(broadcast *models.Broadcast) (*models.Broadcast, error) {
	// Use a transaction to ensure atomicity
	return r.createOrUpdateInTransaction(broadcast)
}

func (r *BroadcastRepository) createOrUpdateInTransaction(broadcast *models.Broadcast) (*models.Broadcast, error) {
	var result *models.Broadcast
	
	err := r.db.Transaction(func(tx *gorm.DB) error {
		// First, deactivate any existing active broadcasts for this user
		err := tx.Model(&models.Broadcast{}).
			Where("user_id = ? AND is_active = true", broadcast.UserID).
			Update("is_active", false).Error
		if err != nil {
			return err
		}
		
		// Create the new broadcast
		err = tx.Create(broadcast).Error
		if err != nil {
			return err
		}
		
		result = broadcast
		return nil
	})
	
	return result, err
}

// Update updates the user's existing active broadcast
func (r *BroadcastRepository) Update(userID uuid.UUID, message string, expiresAt *time.Time) (*models.Broadcast, error) {
	// First check if the broadcast exists
	broadcast, err := r.GetByUserID(userID)
	if err != nil {
		return nil, err
	}
	
	// Update the broadcast
	updates := map[string]interface{}{
		"message":    message,
		"updated_at": time.Now(),
	}
	
	if expiresAt != nil {
		updates["expires_at"] = *expiresAt
	}
	
	err = r.db.Model(broadcast).Updates(updates).Error
	if err != nil {
		return nil, err
	}
	
	// Return the updated broadcast
	return r.GetByUserID(userID)
}

// Delete deactivates a user's broadcast (soft delete - sets is_active to false)
func (r *BroadcastRepository) Delete(userID uuid.UUID) error {
	broadcast, err := r.GetByUserID(userID)
	if err != nil {
		return err
	}
	
	// Just deactivate instead of soft delete to maintain history
	return r.db.Model(broadcast).Update("is_active", false).Error
}

// DeactivateExpired deactivates all expired broadcasts
func (r *BroadcastRepository) DeactivateExpired() error {
	return r.db.Model(&models.Broadcast{}).
		Where("is_active = true AND expires_at IS NOT NULL AND expires_at <= ?", time.Now()).
		Update("is_active", false).Error
}

// GetActiveBroadcastsForUsers retrieves active broadcasts for multiple users (max one per user)
func (r *BroadcastRepository) GetActiveBroadcastsForUsers(userIDs []uuid.UUID) ([]models.Broadcast, error) {
	var broadcasts []models.Broadcast
	
	err := r.db.Where("user_id IN ? AND is_active = true AND (expires_at IS NULL OR expires_at > ?)", 
		userIDs, time.Now()).Find(&broadcasts).Error
		
	return broadcasts, err
}

// HasActiveBroadcast checks if a user has an active broadcast
func (r *BroadcastRepository) HasActiveBroadcast(userID uuid.UUID) (bool, error) {
	var count int64
	
	err := r.db.Model(&models.Broadcast{}).
		Where("user_id = ? AND is_active = true AND (expires_at IS NULL OR expires_at > ?)", 
			userID, time.Now()).Count(&count).Error
			
	return count > 0, err
}

// CleanupExpiredBroadcasts removes old inactive broadcasts (hard delete)
// This should be called periodically by a cleanup job
func (r *BroadcastRepository) CleanupExpiredBroadcasts(olderThan time.Duration) error {
	cutoffTime := time.Now().Add(-olderThan)
	
	return r.db.Unscoped().
		Where("is_active = false AND updated_at < ?", cutoffTime).
		Delete(&models.Broadcast{}).Error
}
