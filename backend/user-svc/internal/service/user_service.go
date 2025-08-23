package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/config"
	"github.com/link-app/user-svc/internal/models"
	"github.com/link-app/user-svc/internal/repository"
	"github.com/link-app/user-svc/internal/security"
	"gorm.io/gorm"
)

// DTO types for service layer
type RegisterUserRequest struct {
	Email       string     `json:"email" validate:"required,email"`
	Username    string     `json:"username" validate:"required,min=3,max=30"`
	FirstName   string     `json:"first_name" validate:"required,min=1,max=50"`
	LastName    string     `json:"last_name" validate:"required,min=1,max=50"`
	Password    string     `json:"password" validate:"required,min=8"`
	DateOfBirth *time.Time `json:"date_of_birth,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type UpdateProfileRequest struct {
	FirstName      *string    `json:"first_name,omitempty" validate:"omitempty,min=1,max=50"`
	LastName       *string    `json:"last_name,omitempty" validate:"omitempty,min=1,max=50"`
	Bio            *string    `json:"bio,omitempty" validate:"omitempty,max=500"`
	Location       *string    `json:"location,omitempty" validate:"omitempty,max=100"`
	ProfilePicture *string    `json:"profile_picture,omitempty"`
	DateOfBirth    *time.Time `json:"date_of_birth,omitempty"`
}

type AuthResponse struct {
	User    models.ProfileUser `json:"user"`
	Token   *string            `json:"token,omitempty"`
	Message string             `json:"message"`
}

type SendFriendRequestRequest struct {
	RequesteeID uuid.UUID `json:"requestee_id" validate:"required"`
	Message     *string   `json:"message,omitempty" validate:"omitempty,max=200"`
}

// Search service DTOs
type SearchServiceRequest struct {
	Query     string      `json:"query"`
	FriendIDs []uuid.UUID `json:"friend_ids,omitempty"`
	Page      int         `json:"page"`
	Limit     int         `json:"limit"`
}

type SearchServiceUser struct {
	ID             uuid.UUID  `json:"id"`
	Username       string     `json:"username"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	ProfilePicture *string    `json:"profile_picture"`
	Bio            *string    `json:"bio"`
	Location       *string    `json:"location"`
	CreatedAt      time.Time  `json:"created_at"`
	LastLoginAt    *time.Time `json:"last_login_at"`
}

type SearchServiceResponse struct {
	Users []SearchServiceUser `json:"users"`
	Total int                `json:"total"`
}

// Service errors
var (
	ErrUserNotFound         = errors.New("user not found")
	ErrInvalidCredentials   = errors.New("invalid email or password")
	ErrEmailAlreadyExists   = errors.New("email already exists")
	ErrUsernameAlreadyExists = errors.New("username already exists")
	ErrInvalidToken         = errors.New("invalid or expired token")
	ErrFriendRequestExists  = errors.New("friend request already exists")
	ErrAlreadyFriends       = errors.New("users are already friends")
	ErrCannotSendToSelf     = errors.New("cannot send friend request to yourself")
	ErrFriendRequestNotFound = errors.New("friend request not found")
	ErrUnauthorized         = errors.New("unauthorized action")
	ErrSearchServiceUnavailable = errors.New("search service unavailable")
)

// StandaloneUserService interface defines user business operations (legacy - not used)
type StandaloneUserService interface {
	// Authentication
	RegisterUser(req RegisterUserRequest) (*AuthResponse, error)
	LoginUser(req LoginRequest) (*AuthResponse, *models.Session, error)
	RefreshToken(refreshToken string) (*AuthResponse, error)
	LogoutUser(userID uuid.UUID, sessionToken string) error
	
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
	
	// Search
	SearchUsers(query string, userID uuid.UUID, page, limit int) ([]models.PublicUser, error)
	SearchFriends(userID uuid.UUID, q string, page, limit int) ([]models.PublicUser, error)
	
	// Admin
	CleanupExpiredSessions() error
}

type userService struct {
	userRepo       repository.UserRepository
	jwtService     *config.JWTService
	passwordHasher *security.PasswordHasher
}

// NewUserService creates a new user service
func NewUserService(userRepo repository.UserRepository, jwtService *config.JWTService) StandaloneUserService {
	passwordConfig := security.GetPasswordConfig()
	passwordHasher := security.NewPasswordHasher(passwordConfig)
	
	return &userService{
		userRepo:       userRepo,
		jwtService:     jwtService,
		passwordHasher: passwordHasher,
	}
}

// RegisterUser registers a new user
func (s *userService) RegisterUser(req RegisterUserRequest) (*AuthResponse, error) {
	// Validate email uniqueness
	if _, err := s.userRepo.GetUserByEmail(req.Email); err == nil {
		return nil, ErrEmailAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check email uniqueness: %w", err)
	}

	// Validate username uniqueness
	if _, err := s.userRepo.GetUserByUsername(req.Username); err == nil {
		return nil, ErrUsernameAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check username uniqueness: %w", err)
	}

	// Hash password using enhanced hasher
	hashedPassword, err := s.passwordHasher.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:        strings.ToLower(req.Email),
		Username:     req.Username,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		DateOfBirth:  req.DateOfBirth,
		PasswordHash: hashedPassword,
		IsActive:     true,
	}

	if err := s.userRepo.CreateUser(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Generate JWT token
	token, err := s.jwtService.GenerateAccessToken(user.ID, user.Email, user.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		// Log error but don't fail the registration
		fmt.Printf("Failed to update last login for user %s: %v\n", user.ID, err)
	}

	return &AuthResponse{
		User:    user.ToProfileUser(),
		Token:   &token,
		Message: "Registration successful",
	}, nil
}

// LoginUser authenticates a user
func (s *userService) LoginUser(req LoginRequest) (*AuthResponse, *models.Session, error) {
	// Get user by email
	user, err := s.userRepo.GetUserByEmail(strings.ToLower(req.Email))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Verify password using enhanced hasher
	isValid, err := s.passwordHasher.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil {
		return nil, nil, fmt.Errorf("password verification failed: %w", err)
	}
	if !isValid {
		return nil, nil, ErrInvalidCredentials
	}

	// Check if password should be rehashed with updated parameters
	if s.passwordHasher.ShouldRehash(user.PasswordHash) {
		// Rehash password with current parameters
		newHash, err := s.passwordHasher.HashPassword(req.Password)
		if err == nil {
			user.PasswordHash = newHash
			// Update in database asynchronously (don't fail login if this fails)
			go func() {
				if updateErr := s.userRepo.UpdateUser(user); updateErr != nil {
					fmt.Printf("Failed to update password hash for user %s: %v\n", user.ID, updateErr)
				}
			}()
		}
	}

	// Generate JWT token
	token, err := s.jwtService.GenerateAccessToken(user.ID, user.Email, user.Username)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Get token ID for session tracking
	tokenID, err := s.jwtService.GetTokenID(token)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get token ID: %w", err)
	}

	// Create session record
	session := &models.Session{
		UserID:    user.ID,
		Token:     tokenID,
		ExpiresAt: time.Now().Add(time.Hour), // 1 hour expiry
	}

	if err := s.userRepo.CreateSession(session); err != nil {
		return nil, nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		// Log error but don't fail the login
		fmt.Printf("Failed to update last login for user %s: %v\n", user.ID, err)
	}

	return &AuthResponse{
		User:    user.ToProfileUser(),
		Token:   &token,
		Message: "Login successful",
	}, session, nil
}

// RefreshToken generates a new access token
func (s *userService) RefreshToken(refreshToken string) (*AuthResponse, error) {
	// Validate refresh token
	claims, err := s.jwtService.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Parse user ID
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Get user
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Generate new access token
	token, err := s.jwtService.GenerateAccessToken(user.ID, user.Email, user.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		User:    user.ToProfileUser(),
		Token:   &token,
		Message: "Token refreshed successfully",
	}, nil
}

// LogoutUser logs out a user by invalidating their session
func (s *userService) LogoutUser(userID uuid.UUID, sessionToken string) error {
	// Delete the specific session
	if err := s.userRepo.DeleteSession(sessionToken); err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

// GetUserProfile gets a user's own profile
func (s *userService) GetUserProfile(userID uuid.UUID) (*models.ProfileUser, error) {
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
func (s *userService) GetPublicUserProfile(userID, viewerID uuid.UUID) (*models.PublicUser, error) {
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
		mutualCountInt := int(mutualCount)
		publicUser.MutualFriends = &mutualCountInt
	}

	return &publicUser, nil
}

// UpdateUserProfile updates a user's profile
func (s *userService) UpdateUserProfile(userID uuid.UUID, req UpdateProfileRequest) (*models.ProfileUser, error) {
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
func (s *userService) GetUserFriends(userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
	offset := (page - 1) * limit
	friends, err := s.userRepo.GetUserFriends(userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get friends: %w", err)
	}
	return friends, nil
}

// GetFriendRequests gets pending friend requests for a user
func (s *userService) GetFriendRequests(userID uuid.UUID, page, limit int) ([]models.FriendRequest, error) {
	offset := (page - 1) * limit
	requests, err := s.userRepo.GetFriendRequests(userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get friend requests: %w", err)
	}
	return requests, nil
}

// SendFriendRequest sends a friend request
func (s *userService) SendFriendRequest(requesterID uuid.UUID, req SendFriendRequestRequest) error {
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
func (s *userService) RespondToFriendRequest(requestID, userID uuid.UUID, accept bool) error {
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
func (s *userService) CancelFriendRequest(requesterID, requesteeID uuid.UUID) error {
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

// SearchUsers searches for users by name or username
func (s *userService) SearchUsers(query string, userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
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

// SearchFriends searches for users within the user's friend list
func (s *userService) SearchFriends(userID uuid.UUID, q string, page, limit int) ([]models.PublicUser, error) {
	// Validate and sanitize query
	query := strings.TrimSpace(q)
	if query == "" {
		return []models.PublicUser{}, nil
	}

	// a. Fetch friendIDs via repo helper
	friendIDs, err := s.userRepo.GetFriendIDs(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get friend IDs: %w", err)
	}

	// b. If len(friendIDs)==0 → return empty slice
	if len(friendIDs) == 0 {
		return []models.PublicUser{}, nil
	}

	// c. Call search-svc with query string and friendIDs filter (HTTP client with timeout)
	searchReq := SearchServiceRequest{
		Query:     query,
		FriendIDs: friendIDs,
		Page:      page,
		Limit:     limit,
	}

	searchResponse, err := s.callSearchService(searchReq)
	if err != nil {
		return nil, fmt.Errorf("search service call failed: %w", err)
	}

	// d. Map search-svc JSON to models.PublicUser
	result := make([]models.PublicUser, 0, len(searchResponse.Users))
	for _, searchUser := range searchResponse.Users {
		publicUser := models.PublicUser{
			ID:             searchUser.ID,
			Username:       searchUser.Username,
			FirstName:      searchUser.FirstName,
			LastName:       searchUser.LastName,
			ProfilePicture: searchUser.ProfilePicture,
			Bio:            searchUser.Bio,
			Location:       searchUser.Location,
			CreatedAt:      searchUser.CreatedAt,
			LastLoginAt:    searchUser.LastLoginAt,
			IsFriend:       true, // All results are friends since we filtered by friendIDs
		}
		result = append(result, publicUser)
	}

	// e. Return slice
	return result, nil
}

// callSearchService makes HTTP request to search service
func (s *userService) callSearchService(req SearchServiceRequest) (*SearchServiceResponse, error) {
	// Get search service URL from environment, default to localhost for development
	searchServiceURL := os.Getenv("SEARCH_SERVICE_URL")
	if searchServiceURL == "" {
		searchServiceURL = "http://localhost:8080" // Default for development
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Marshal request to JSON
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", searchServiceURL+"/api/v1/search/friends", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("User-Agent", "user-svc/1.0")

	// Make the request
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSearchServiceUnavailable, err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status code %d", ErrSearchServiceUnavailable, resp.StatusCode)
	}

	// Parse response
	var searchResponse SearchServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &searchResponse, nil
}

// CleanupExpiredSessions removes expired sessions
func (s *userService) CleanupExpiredSessions() error {
	if err := s.userRepo.CleanupExpiredSessions(); err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}
	return nil
}
