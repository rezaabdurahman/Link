package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/events"
	"github.com/link-app/user-svc/internal/models"
	"github.com/link-app/user-svc/internal/onboarding"
	"github.com/link-app/user-svc/internal/repository"
	"github.com/link-app/user-svc/internal/security"
	"gorm.io/gorm"
)

// Auth service errors
var (
	ErrUserNotFound         = errors.New("user not found")
	ErrInvalidCredentials   = errors.New("invalid email or password")
	ErrEmailAlreadyExists   = errors.New("email already exists")
	ErrUsernameAlreadyExists = errors.New("username already exists")
	ErrInvalidToken         = errors.New("invalid or expired token")
)

// DTO types for auth service
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

type AuthResponse struct {
	User    models.ProfileUser `json:"user"`
	Token   *string            `json:"token,omitempty"`
	Message string             `json:"message"`
}

// AuthService interface defines authentication operations
type AuthService interface {
	RegisterUser(req RegisterUserRequest) (*AuthResponse, error)
	LoginUser(req LoginRequest) (*AuthResponse, *models.Session, error)
	RefreshToken(refreshToken string) (*AuthResponse, error)
	LogoutUser(userID uuid.UUID, sessionToken string) error
	CleanupExpiredSessions() error
}

type authService struct {
	userRepo            repository.UserRepository
	jwtService          *JWTService
	passwordHasher      *security.PasswordHasher
	eventBus            events.EventBus
	onboardingInterface onboarding.OnboardingInterface
}

// NewAuthService creates a new auth service
func NewAuthService(
	userRepo repository.UserRepository, 
	jwtService *JWTService,
	eventBus events.EventBus,
	onboardingInterface onboarding.OnboardingInterface,
) AuthService {
	passwordConfig := security.GetPasswordConfig()
	passwordHasher := security.NewPasswordHasher(passwordConfig)
	
	return &authService{
		userRepo:            userRepo,
		jwtService:          jwtService,
		passwordHasher:      passwordHasher,
		eventBus:            eventBus,
		onboardingInterface: onboardingInterface,
	}
}

// RegisterUser registers a new user
func (s *authService) RegisterUser(req RegisterUserRequest) (*AuthResponse, error) {
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

	// Publish UserRegistered event
	ctx := context.Background()
	userRegisteredEvent := events.NewUserRegisteredEvent(
		user.ID, user.Email, user.Username, user.FirstName, user.LastName, user.DateOfBirth,
	)
	if err := s.eventBus.Publish(ctx, userRegisteredEvent); err != nil {
		// Log error but don't fail registration
		fmt.Printf("Failed to publish user registered event: %v\n", err)
	}

	// Notify onboarding service through interface (decoupled call)
	if err := s.onboardingInterface.NotifyUserRegistered(
		ctx, user.ID, user.Email, user.Username, user.FirstName, user.LastName,
	); err != nil {
		// Log error but don't fail registration - onboarding initialization is not critical
		fmt.Printf("Failed to initialize onboarding for user %s: %v\n", user.ID, err)
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
func (s *authService) LoginUser(req LoginRequest) (*AuthResponse, *models.Session, error) {
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
func (s *authService) RefreshToken(refreshToken string) (*AuthResponse, error) {
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
func (s *authService) LogoutUser(userID uuid.UUID, sessionToken string) error {
	// Delete the specific session
	if err := s.userRepo.DeleteSession(sessionToken); err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

// CleanupExpiredSessions removes expired sessions
func (s *authService) CleanupExpiredSessions() error {
	if err := s.userRepo.CleanupExpiredSessions(); err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}
	return nil
}
