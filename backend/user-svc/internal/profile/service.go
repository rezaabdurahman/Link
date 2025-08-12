package profile

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/models"
	"github.com/link-app/user-svc/internal/repository"
	"gorm.io/gorm"
)

// Profile service errors
var (
	ErrUserNotFound           = errors.New("user not found")
	ErrFriendRequestExists    = errors.New("friend request already exists")
	ErrAlreadyFriends         = errors.New("users are already friends")
	ErrCannotSendToSelf       = errors.New("cannot send friend request to yourself")
	ErrFriendRequestNotFound  = errors.New("friend request not found")
	ErrUnauthorized           = errors.New("unauthorized action")
)

// DTO types for profile service
type UpdateProfileRequest struct {
	FirstName      *string    `json:"first_name,omitempty" validate:"omitempty,min=1,max=50"`
	LastName       *string    `json:"last_name,omitempty" validate:"omitempty,min=1,max=50"`
	Bio            *string    `json:"bio,omitempty" validate:"omitempty,max=500"`
	Location       *string    `json:"location,omitempty" validate:"omitempty,max=100"`
	ProfilePicture *string    `json:"profile_picture,omitempty"`
	DateOfBirth    *time.Time `json:"date_of_birth,omitempty"`
}

type SendFriendRequestRequest struct {
	RequesteeID uuid.UUID `json:"requestee_id" validate:"required"`
	Message     *string   `json:"message,omitempty" validate:"omitempty,max=200"`
}

// ProfileService interface defines user profile operations
type ProfileService interface {
	// User profile
	GetUserProfile(userID uuid.UUID) (*models.ProfileUser, error)
	GetPublicUserProfile(userID, viewerID uuid.UUID) (*models.PublicUser, error)
	UpdateUserProfile(userID uuid.UUID, req UpdateProfileRequest) (*models.ProfileUser, error)
	
	// Friends
	GetUserFriends(userID uuid.UUID, page, limit int) ([]models.PublicUser, error)
	GetFriendRequests(userID uuid.UUID, page, limit int) ([]models.FriendRequest, error)
	SendFriendRequest(requesterID uuid.UUID, req SendFriendRequestRequest) error
	RespondToFriendRequest(requestID, userID uuid.UUID, accept bool) error
	
	// Search
	SearchUsers(query string, userID uuid.UUID, page, limit int) ([]models.PublicUser, error)
}

type profileService struct {
	userRepo repository.UserRepository
}

// NewProfileService creates a new profile service
func NewProfileService(userRepo repository.UserRepository) ProfileService {
	return &profileService{
		userRepo: userRepo,
	}
}

// GetUserProfile gets a user's own profile
func (s *profileService) GetUserProfile(userID uuid.UUID) (*models.ProfileUser, error) {
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	profile := user.ToProfileUser()
	return &profile, nil
}

// GetPublicUserProfile gets a public user profile with friend status
func (s *profileService) GetPublicUserProfile(userID, viewerID uuid.UUID) (*models.PublicUser, error) {
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	publicUser := user.ToPublicUser()

	// Add friend status and mutual friends count if viewer is different
	if viewerID != uuid.Nil && viewerID != userID {
		isFriend, err := s.userRepo.AreFriends(viewerID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to check friendship: %w", err)
		}
		publicUser.IsFriend = isFriend

		mutualCount, err := s.userRepo.GetMutualFriendsCount(viewerID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get mutual friends count: %w", err)
		}
		publicUser.MutualFriends = int(mutualCount)
	}

	return &publicUser, nil
}

// UpdateUserProfile updates a user's profile
func (s *profileService) UpdateUserProfile(userID uuid.UUID, req UpdateProfileRequest) (*models.ProfileUser, error) {
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Update fields if provided
	if req.FirstName != nil {
		user.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}
	if req.Bio != nil {
		user.Bio = req.Bio
	}
	if req.Location != nil {
		user.Location = req.Location
	}
	if req.ProfilePicture != nil {
		user.ProfilePicture = req.ProfilePicture
	}
	if req.DateOfBirth != nil {
		user.DateOfBirth = req.DateOfBirth
	}

	if err := s.userRepo.UpdateUser(user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	profile := user.ToProfileUser()
	return &profile, nil
}

// GetUserFriends gets a user's friends list
func (s *profileService) GetUserFriends(userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
	offset := (page - 1) * limit
	friends, err := s.userRepo.GetUserFriends(userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get friends: %w", err)
	}
	return friends, nil
}

// GetFriendRequests gets pending friend requests for a user
func (s *profileService) GetFriendRequests(userID uuid.UUID, page, limit int) ([]models.FriendRequest, error) {
	offset := (page - 1) * limit
	requests, err := s.userRepo.GetFriendRequests(userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get friend requests: %w", err)
	}
	return requests, nil
}

// SendFriendRequest sends a friend request
func (s *profileService) SendFriendRequest(requesterID uuid.UUID, req SendFriendRequestRequest) error {
	// Prevent self-friend requests
	if requesterID == req.RequesteeID {
		return ErrCannotSendToSelf
	}

	// Check if requestee exists
	_, err := s.userRepo.GetUserByID(req.RequesteeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get requestee: %w", err)
	}

	// Check if already friends
	areFriends, err := s.userRepo.AreFriends(requesterID, req.RequesteeID)
	if err != nil {
		return fmt.Errorf("failed to check friendship: %w", err)
	}
	if areFriends {
		return ErrAlreadyFriends
	}

	// Check if friend request already exists
	hasPending, err := s.userRepo.HasPendingFriendRequest(requesterID, req.RequesteeID)
	if err != nil {
		return fmt.Errorf("failed to check pending requests: %w", err)
	}
	if hasPending {
		return ErrFriendRequestExists
	}

	// Create friend request
	friendRequest := &models.FriendRequest{
		RequesterID: requesterID,
		RequesteeID: req.RequesteeID,
		Message:     req.Message,
		Status:      models.FriendRequestPending,
	}

	if err := s.userRepo.CreateFriendRequest(friendRequest); err != nil {
		return fmt.Errorf("failed to create friend request: %w", err)
	}

	return nil
}

// RespondToFriendRequest accepts or declines a friend request
func (s *profileService) RespondToFriendRequest(requestID, userID uuid.UUID, accept bool) error {
	// Get friend request
	friendRequest, err := s.userRepo.GetFriendRequest(requestID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrFriendRequestNotFound
		}
		return fmt.Errorf("failed to get friend request: %w", err)
	}

	// Verify user is the requestee
	if friendRequest.RequesteeID != userID {
		return ErrUnauthorized
	}

	// Update request status
	var status models.FriendRequestStatus
	if accept {
		status = models.FriendRequestAccepted
	} else {
		status = models.FriendRequestDeclined
	}

	if err := s.userRepo.UpdateFriendRequest(requestID, status); err != nil {
		return fmt.Errorf("failed to update friend request: %w", err)
	}

	// If accepted, create friendship
	if accept {
		if err := s.userRepo.CreateFriendship(friendRequest.RequesterID, friendRequest.RequesteeID); err != nil {
			return fmt.Errorf("failed to create friendship: %w", err)
		}
	}

	return nil
}

// SearchUsers searches for users by name or username
func (s *profileService) SearchUsers(query string, userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
	if strings.TrimSpace(query) == "" {
		return []models.PublicUser{}, nil
	}

	offset := (page - 1) * limit
	users, err := s.userRepo.SearchUsers(strings.TrimSpace(query), userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}

	return users, nil
}
