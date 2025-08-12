package service

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/repository"
)

var (
	ErrInvalidExpirationTime = errors.New("invalid expiration time")
	ErrBroadcastNotFound     = repository.ErrBroadcastNotFound
)

// BroadcastService handles broadcast business logic
type BroadcastService struct {
	repo *repository.BroadcastRepository
}

// NewBroadcastService creates a new broadcast service
func NewBroadcastService(repo *repository.BroadcastRepository) *BroadcastService {
	return &BroadcastService{repo: repo}
}

// GetUserBroadcast retrieves a user's active broadcast
func (s *BroadcastService) GetUserBroadcast(userID uuid.UUID) (*models.Broadcast, error) {
	return s.repo.GetByUserID(userID)
}

// CreateBroadcast creates a new broadcast for a user (replaces any existing active broadcast)
func (s *BroadcastService) CreateBroadcast(userID uuid.UUID, req models.CreateBroadcastRequest) (*models.Broadcast, error) {
	// Validate expiration time
	var expiresAt *time.Time
	if req.ExpiresInHours != nil {
		if *req.ExpiresInHours < 1 || *req.ExpiresInHours > 168 {
			return nil, ErrInvalidExpirationTime
		}
		expiry := time.Now().Add(time.Duration(*req.ExpiresInHours) * time.Hour)
		expiresAt = &expiry
	}

	broadcast := &models.Broadcast{
		UserID:    userID,
		Message:   req.Message,
		IsActive:  true,
		ExpiresAt: expiresAt,
	}

	return s.repo.CreateOrUpdate(broadcast)
}

// UpdateBroadcast updates a user's existing broadcast
func (s *BroadcastService) UpdateBroadcast(userID uuid.UUID, req models.UpdateBroadcastRequest) (*models.Broadcast, error) {
	// Check if user has an active broadcast
	_, err := s.repo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}

	// Validate and calculate expiration time
	var expiresAt *time.Time
	if req.ExpiresInHours != nil {
		if *req.ExpiresInHours < 1 || *req.ExpiresInHours > 168 {
			return nil, ErrInvalidExpirationTime
		}
		expiry := time.Now().Add(time.Duration(*req.ExpiresInHours) * time.Hour)
		expiresAt = &expiry
	}

	return s.repo.Update(userID, req.Message, expiresAt)
}

// DeleteBroadcast deletes (deactivates) a user's broadcast
func (s *BroadcastService) DeleteBroadcast(userID uuid.UUID) error {
	return s.repo.Delete(userID)
}

// HasActiveBroadcast checks if a user has an active broadcast
func (s *BroadcastService) HasActiveBroadcast(userID uuid.UUID) (bool, error) {
	return s.repo.HasActiveBroadcast(userID)
}

// GetBroadcastsForUsers retrieves active broadcasts for multiple users
func (s *BroadcastService) GetBroadcastsForUsers(userIDs []uuid.UUID) ([]models.Broadcast, error) {
	return s.repo.GetActiveBroadcastsForUsers(userIDs)
}

// CleanupExpiredBroadcasts runs cleanup of expired broadcasts
func (s *BroadcastService) CleanupExpiredBroadcasts() error {
	// First deactivate expired broadcasts
	err := s.repo.DeactivateExpired()
	if err != nil {
		return err
	}

	// Then cleanup old inactive broadcasts (older than 30 days)
	return s.repo.CleanupExpiredBroadcasts(30 * 24 * time.Hour)
}

// ValidateCreateRequest validates a create broadcast request
func (s *BroadcastService) ValidateCreateRequest(req models.CreateBroadcastRequest) error {
	if len(req.Message) == 0 {
		return errors.New("message cannot be empty")
	}
	if len(req.Message) > 200 {
		return errors.New("message cannot exceed 200 characters")
	}
	if req.ExpiresInHours != nil {
		if *req.ExpiresInHours < 1 || *req.ExpiresInHours > 168 {
			return ErrInvalidExpirationTime
		}
	}
	return nil
}

// ValidateUpdateRequest validates an update broadcast request
func (s *BroadcastService) ValidateUpdateRequest(req models.UpdateBroadcastRequest) error {
	if len(req.Message) == 0 {
		return errors.New("message cannot be empty")
	}
	if len(req.Message) > 200 {
		return errors.New("message cannot exceed 200 characters")
	}
	if req.ExpiresInHours != nil {
		if *req.ExpiresInHours < 1 || *req.ExpiresInHours > 168 {
			return ErrInvalidExpirationTime
		}
	}
	return nil
}
