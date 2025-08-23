package profile

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/cache"
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
	ErrNotFriends             = errors.New("users are not friends")
	// Blocking-related errors
	ErrBlockExists            = errors.New("user is already blocked")
	ErrBlockNotFound          = errors.New("block relationship not found")
	ErrCannotBlockSelf        = errors.New("cannot block yourself")
	ErrInvalidBlockerID       = errors.New("invalid blocker ID")
	ErrInvalidBlockedID       = errors.New("invalid blocked ID")
	ErrUserBlocked            = errors.New("user is blocked")
)

// DTO types for profile service
type UpdateProfileRequest struct {
	FirstName         *string                   `json:"first_name,omitempty" validate:"omitempty,min=1,max=50"`
	LastName          *string                   `json:"last_name,omitempty" validate:"omitempty,min=1,max=50"`
	Bio               *string                   `json:"bio,omitempty" validate:"omitempty,max=500"`
	Location          *string                   `json:"location,omitempty" validate:"omitempty,max=100"`
	ProfilePicture    *string                   `json:"profile_picture,omitempty"`
	DateOfBirth       *time.Time                `json:"date_of_birth,omitempty"`
	Interests         []string                  `json:"interests,omitempty"`
	SocialLinks       []models.SocialLink       `json:"social_links,omitempty"`
	AdditionalPhotos  []string                  `json:"additional_photos,omitempty"`
	PrivacySettings   *models.PrivacySettings   `json:"privacy_settings,omitempty"`
	ProfileVisibility *models.ProfileVisibility `json:"profile_visibility,omitempty"`
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
	CancelFriendRequest(requesterID, requesteeID uuid.UUID) error
	RemoveFriend(userID, friendID uuid.UUID) error
	
	// Blocking
	BlockUser(blockerID, blockedID uuid.UUID) error
	UnblockUser(blockerID, blockedID uuid.UUID) error
	IsBlocked(userA, userB uuid.UUID) (bool, error)
	GetBlockedUsers(userID uuid.UUID, page, limit int) ([]models.PublicUser, error)
	
	// Hidden users management
	GetHiddenUsers(userID uuid.UUID) ([]uuid.UUID, error)
	HideUser(userID, userToHide uuid.UUID) error
	UnhideUser(userID, userToUnhide uuid.UUID) error
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

// cachedProfileService wraps the regular profile service with caching
type cachedProfileService struct {
	ProfileService
	cache cache.SimpleCache
}

// NewCachedProfileService creates a new cached profile service
func NewCachedProfileService(userRepo repository.UserRepository, cacheService cache.SimpleCache) ProfileService {
	baseService := NewProfileService(userRepo)
	return &cachedProfileService{
		ProfileService: baseService,
		cache:         cacheService,
	}
}

// GetUserProfile gets a user's own profile with caching
func (s *cachedProfileService) GetUserProfile(userID uuid.UUID) (*models.ProfileUser, error) {
	cacheKey := fmt.Sprintf("profile:user:%s", userID.String())
	
	// Try to get from cache first
	if cached, err := s.cache.Get(cacheKey); err == nil && cached != nil {
		if profileData, ok := cached.([]byte); ok {
			var profile models.ProfileUser
			if err := json.Unmarshal(profileData, &profile); err == nil {
				return &profile, nil
			}
		}
	}
	
	// Get from underlying service
	profile, err := s.ProfileService.GetUserProfile(userID)
	if err != nil {
		return nil, err
	}
	
	// Cache the result for 15 minutes
	if profileData, err := json.Marshal(profile); err == nil {
		// TODO: Handle cache errors gracefully - don't fail the request if cache fails
		_ = s.cache.Set(cacheKey, profileData, 15*time.Minute)
	}
	
	return profile, nil
}

// GetPublicUserProfile gets a public user profile with caching
func (s *cachedProfileService) GetPublicUserProfile(userID, viewerID uuid.UUID) (*models.PublicUser, error) {
	// For public profiles, we can cache more aggressively
	// For now, just delegate to base service - caching public profiles is more complex 
	// due to viewer-specific data (friend status, mutual friends)
	// TODO: Implement smarter caching strategy for public profiles
	return s.ProfileService.GetPublicUserProfile(userID, viewerID)
}

// UpdateUserProfile updates user profile and invalidates cache
func (s *cachedProfileService) UpdateUserProfile(userID uuid.UUID, req UpdateProfileRequest) (*models.ProfileUser, error) {
	// Update in underlying service
	profile, err := s.ProfileService.UpdateUserProfile(userID, req)
	if err != nil {
		return nil, err
	}
	
	// Invalidate cache
	cacheKey := fmt.Sprintf("profile:user:%s", userID.String())
	// TODO: Handle cache errors gracefully
	_ = s.cache.Delete(cacheKey)
	
	return profile, nil
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

	// Check if there's a blocking relationship between viewer and target user
	if viewerID != uuid.Nil && viewerID != userID {
		blocked, err := s.IsBlocked(viewerID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to check blocking relationship: %w", err)
		}
		if blocked {
			// Return ErrUserNotFound to hide the fact that the user exists
			return nil, ErrUserNotFound
		}
	}

	// Check friend status if viewer is different from user
	var isFriend bool
	if viewerID != uuid.Nil && viewerID != userID {
		var err error
		isFriend, err = s.userRepo.AreFriends(viewerID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to check friendship: %w", err)
		}
	}

	// Use the new privacy-aware conversion that considers friend status
	publicUser := user.ToPublicUserForViewer(isFriend)

	// Add friend status and mutual friends count if viewer is different
	if viewerID != uuid.Nil && viewerID != userID {
		publicUser.IsFriend = isFriend

		// Show mutual friends count based on profile visibility and privacy settings
		showMutualFriends := false
		if user.ProfileVisibility == models.ProfileVisibilityPublic {
			// For public profiles, always show if privacy setting allows
			showMutualFriends = user.PrivacySettings.ShowMutualFriends
		} else if user.ProfileVisibility == models.ProfileVisibilityPrivate {
			if isFriend {
				// For private profiles viewed by friends, always show if privacy setting allows
				showMutualFriends = user.PrivacySettings.ShowMutualFriends
			} else {
				// For private profiles viewed by non-friends, respect granular setting
				showMutualFriends = user.PrivacySettings.ShowMutualFriends
			}
		}

		if showMutualFriends {
			mutualCount, err := s.userRepo.GetMutualFriendsCount(viewerID, userID)
			if err != nil {
				return nil, fmt.Errorf("failed to get mutual friends count: %w", err)
			}
			mutualCountInt := int(mutualCount)
			publicUser.MutualFriends = &mutualCountInt
		}
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
	if req.Interests != nil {
		user.Interests = req.Interests
	}
	if req.SocialLinks != nil {
		user.SocialLinks = req.SocialLinks
	}
	if req.AdditionalPhotos != nil {
		user.AdditionalPhotos = req.AdditionalPhotos
	}
	if req.PrivacySettings != nil {
		user.PrivacySettings = *req.PrivacySettings
	}
	if req.ProfileVisibility != nil {
		user.ProfileVisibility = *req.ProfileVisibility
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

// CancelFriendRequest cancels a pending friend request
func (s *profileService) CancelFriendRequest(requesterID, requesteeID uuid.UUID) error {
	// Prevent canceling requests to self
	if requesterID == requesteeID {
		return ErrCannotSendToSelf
	}

	// Check if requestee exists
	_, err := s.userRepo.GetUserByID(requesteeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get requestee: %w", err)
	}

	// Check if there's a pending friend request to cancel
	hasPending, err := s.userRepo.HasPendingFriendRequest(requesterID, requesteeID)
	if err != nil {
		return fmt.Errorf("failed to check pending requests: %w", err)
	}
	if !hasPending {
		return ErrFriendRequestNotFound
	}

	// Cancel the friend request
	if err := s.userRepo.CancelFriendRequest(requesterID, requesteeID); err != nil {
		return fmt.Errorf("failed to cancel friend request: %w", err)
	}

	return nil
}

// BlockUser blocks a user
func (s *profileService) BlockUser(blockerID, blockedID uuid.UUID) error {
	// Validation
	if blockerID == uuid.Nil {
		return ErrInvalidBlockerID
	}
	if blockedID == uuid.Nil {
		return ErrInvalidBlockedID
	}
	if blockerID == blockedID {
		return ErrCannotBlockSelf
	}

	// Check if user to be blocked exists
	_, err := s.userRepo.GetUserByID(blockedID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get user to block: %w", err)
	}

	// Start a transaction since blocking involves multiple operations
	tx := s.userRepo.BeginTx()
	defer func() {
		if r := recover(); r != nil || err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()

	// Check if already blocked
	blocked, err := models.IsUserBlocked(tx, blockerID, blockedID)
	if err != nil {
		return fmt.Errorf("failed to check if user is blocked: %w", err)
	}
	if blocked {
		return ErrBlockExists
	}

	// Create the block relationship
	_, err = models.BlockUser(tx, blockerID, blockedID)
	if err != nil {
		return fmt.Errorf("failed to block user: %w", err)
	}

	// Remove existing friendship if it exists
	areFriends, err := s.userRepo.AreFriends(blockerID, blockedID)
	if err != nil {
		return fmt.Errorf("failed to check friendship: %w", err)
	}
	if areFriends {
		if err := s.userRepo.DeleteFriendship(blockerID, blockedID); err != nil {
			return fmt.Errorf("failed to remove friendship: %w", err)
		}
	}

	// Cancel any pending friend requests between the users
	hasPending, err := s.userRepo.HasPendingFriendRequest(blockerID, blockedID)
	if err != nil {
		return fmt.Errorf("failed to check pending friend requests: %w", err)
	}
	if hasPending {
		if err := s.userRepo.CancelFriendRequest(blockerID, blockedID); err != nil {
			return fmt.Errorf("failed to cancel outgoing friend request: %w", err)
		}
	}

	// Also cancel any pending requests in the opposite direction
	hasPendingReverse, err := s.userRepo.HasPendingFriendRequest(blockedID, blockerID)
	if err != nil {
		return fmt.Errorf("failed to check reverse pending friend requests: %w", err)
	}
	if hasPendingReverse {
		if err := s.userRepo.CancelFriendRequest(blockedID, blockerID); err != nil {
			return fmt.Errorf("failed to cancel incoming friend request: %w", err)
		}
	}

	return nil
}

// UnblockUser unblocks a user
func (s *profileService) UnblockUser(blockerID, blockedID uuid.UUID) error {
	// Validation
	if blockerID == uuid.Nil {
		return ErrInvalidBlockerID
	}
	if blockedID == uuid.Nil {
		return ErrInvalidBlockedID
	}
	if blockerID == blockedID {
		return ErrCannotBlockSelf
	}

	// Check if user to be unblocked exists
	_, err := s.userRepo.GetUserByID(blockedID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get user to unblock: %w", err)
	}

	// Use a transaction for consistency
	tx := s.userRepo.BeginTx()
	defer func() {
		if r := recover(); r != nil || err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()

	// Remove the block relationship
	if err := models.UnblockUser(tx, blockerID, blockedID); err != nil {
		if errors.Is(err, models.ErrBlockNotFound) {
			return ErrBlockNotFound
		}
		return fmt.Errorf("failed to unblock user: %w", err)
	}

	return nil
}

// IsBlocked checks if there is a blocking relationship between two users (bidirectional)
func (s *profileService) IsBlocked(userA, userB uuid.UUID) (bool, error) {
	if userA == uuid.Nil || userB == uuid.Nil {
		return false, nil
	}

	tx := s.userRepo.BeginTx()
	defer tx.Rollback() // Read-only operation, always rollback

	return models.IsUserBlocked(tx, userA, userB)
}

// GetBlockedUsers returns a list of users blocked by the specified user
func (s *profileService) GetBlockedUsers(userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20 // Default limit
	}

	tx := s.userRepo.BeginTx()
	defer tx.Rollback() // Read-only operation, always rollback

	// Get blocked user relationships
	blockedUsers, err := models.GetBlockedUsersByBlocker(tx, userID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get blocked users: %w", err)
	}

	// Convert to PublicUser format
	result := make([]models.PublicUser, len(blockedUsers))
	for i, blockedUser := range blockedUsers {
		result[i] = blockedUser.Blocked.ToPublicUserWithPrivacy()
	}

	return result, nil
}
// RemoveFriend removes a friendship between two users
func (s *profileService) RemoveFriend(userID, friendID uuid.UUID) error {
	// Prevent self-removal
	if userID == friendID {
		return ErrCannotSendToSelf // Reuse existing error for consistency
	}

	// Check if friend exists
	_, err := s.userRepo.GetUserByID(friendID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get friend: %w", err)
	}

	// Check if they are actually friends
	areFriends, err := s.userRepo.AreFriends(userID, friendID)
	if err != nil {
		return fmt.Errorf("failed to check friendship: %w", err)
	}
	if !areFriends {
		return ErrNotFriends
	}

	// Remove the friendship
	if err := s.userRepo.DeleteFriendship(userID, friendID); err != nil {
		return fmt.Errorf("failed to remove friendship: %w", err)
	}

	return nil
}

// GetHiddenUsers returns the list of users hidden by the specified user
func (s *profileService) GetHiddenUsers(userID uuid.UUID) ([]uuid.UUID, error) {
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user.HiddenUsers, nil
}

// HideUser adds a user to the current user's hidden list
func (s *profileService) HideUser(userID, userToHide uuid.UUID) error {
	// Get the current user
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Verify the user to hide exists
	_, err = s.userRepo.GetUserByID(userToHide)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to verify user to hide exists: %w", err)
	}

	// Add to hidden users list
	user.HideUser(userToHide)

	// Update the user in database
	if err := s.userRepo.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to update user hidden list: %w", err)
	}

	return nil
}

// UnhideUser removes a user from the current user's hidden list
func (s *profileService) UnhideUser(userID, userToUnhide uuid.UUID) error {
	// Get the current user
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Remove from hidden users list
	user.UnhideUser(userToUnhide)

	// Update the user in database
	if err := s.userRepo.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to update user hidden list: %w", err)
	}

	return nil
}

