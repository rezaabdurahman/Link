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
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// Core auth service - simplified and consolidated
type AuthService interface {
	RegisterUser(req RegisterUserRequest) (*AuthResponse, *TokenPair, error)
	LoginUser(req LoginRequest) (*AuthResponse, *TokenPair, error)
	RefreshTokens(req RefreshTokenRequest) (*RefreshTokenResponse, error)
	LogoutUser(userID uuid.UUID, sessionToken string) error
	CleanupExpiredSessions() error
	CleanupExpiredRefreshTokens() error
}

type authService struct {
	userRepo            repository.UserRepository
	refreshTokenRepo    repository.RefreshTokenRepository
	jwtService          JWTService
	passwordHasher      *security.PasswordHasher
	tokenHasher         *security.TokenHasher
	eventBus            events.EventBus
	onboardingInterface onboarding.OnboardingInterface
	redisClient         *redis.Client
}

// Note: newAuthService is now in auth.go as part of the compatibility layer

// RegisterUser registers a new user
func (s *authService) RegisterUser(req RegisterUserRequest) (*AuthResponse, *TokenPair, error) {
	// Validate email uniqueness
	if _, err := s.userRepo.GetUserByEmail(req.Email); err == nil {
		return nil, nil, ErrEmailAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, fmt.Errorf("failed to check email uniqueness: %w", err)
	}

	// Validate username uniqueness if provided
	if req.Username != "" {
		if _, err := s.userRepo.GetUserByUsername(req.Username); err == nil {
			return nil, nil, ErrUsernameAlreadyExists
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, fmt.Errorf("failed to check username uniqueness: %w", err)
		}
	}

	// Hash password
	hashedPassword, err := s.passwordHasher.HashPassword(req.Password)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to hash password: %w", err)
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
		return nil, nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Publish UserRegistered event
	ctx := context.Background()
	userRegisteredEvent := events.NewUserRegisteredEvent(
		user.ID, user.Email, user.Username, user.FirstName, user.LastName, user.DateOfBirth,
	)
	if err := s.eventBus.Publish(ctx, userRegisteredEvent); err != nil {
		fmt.Printf("Failed to publish user registered event: %v\n", err)
	}

	// Notify onboarding service
	if err := s.onboardingInterface.NotifyUserRegistered(
		ctx, user.ID, user.Email, user.Username, user.FirstName, user.LastName,
	); err != nil {
		fmt.Printf("Failed to initialize onboarding for user %s: %v\n", user.ID, err)
	}

	// Generate token pair with platform detection
	platform := detectPlatform(req.Platform, req.DeviceInfo)
	tokenPair, err := s.jwtService.GenerateTokenPair(user.ID, user.Email, user.Username, []string{"user"}, []string{}, platform)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	// Store refresh token
	refreshTokenRecord := &repository.RefreshToken{
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(s.jwtService.GetRefreshTokenTTL()),
		DeviceInfo: req.DeviceInfo,
		IPAddress:  req.IPAddress,
		FamilyID:   tokenPair.FamilyID,
	}

	if err := s.refreshTokenRepo.StoreRefreshToken(ctx, refreshTokenRecord, tokenPair.RefreshToken); err != nil {
		return nil, nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		fmt.Printf("Failed to update last login for user %s: %v\n", user.ID, err)
	}

	return &AuthResponse{
		User:    user.ToProfileUser(),
		Token:   &tokenPair.AccessToken,
		Message: "Registration successful",
	}, tokenPair, nil
}

// LoginUser authenticates a user
func (s *authService) LoginUser(req LoginRequest) (*AuthResponse, *TokenPair, error) {
	ctx := context.Background()

	// Get user by email
	user, err := s.userRepo.GetUserByEmail(strings.ToLower(req.Email))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Verify password
	isValid, err := s.passwordHasher.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil {
		return nil, nil, fmt.Errorf("password verification failed: %w", err)
	}
	if !isValid {
		return nil, nil, ErrInvalidCredentials
	}

	// Check if password should be rehashed
	if s.passwordHasher.ShouldRehash(user.PasswordHash) {
		if err := s.handlePasswordRehashing(ctx, user, req.Password); err != nil {
			fmt.Printf("Password rehashing failed for user %s: %v\n", user.ID, err)
		}
	}

	// Generate token pair with platform detection
	platform := detectPlatform(req.Platform, req.DeviceInfo)
	tokenPair, err := s.jwtService.GenerateTokenPair(user.ID, user.Email, user.Username, []string{"user"}, []string{}, platform)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	// Store refresh token
	refreshTokenRecord := &repository.RefreshToken{
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(s.jwtService.GetRefreshTokenTTL()),
		DeviceInfo: req.DeviceInfo,
		IPAddress:  req.IPAddress,
		FamilyID:   tokenPair.FamilyID,
	}

	if err := s.refreshTokenRepo.StoreRefreshToken(ctx, refreshTokenRecord, tokenPair.RefreshToken); err != nil {
		return nil, nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		fmt.Printf("Failed to update last login for user %s: %v\n", user.ID, err)
	}

	// Store device info for mobile platforms (for future push notifications)
	if platform != "web" && req.DeviceID != "" {
		if err := s.storeDeviceInfo(ctx, user.ID, req.DeviceID, platform, req.DeviceInfo); err != nil {
			fmt.Printf("Failed to store device info for user %s: %v\n", user.ID, err)
		}
	}

	return &AuthResponse{
		User:    user.ToProfileUser(),
		Token:   &tokenPair.AccessToken,
		Message: "Login successful",
	}, tokenPair, nil
}

// RefreshTokens refreshes access and refresh tokens
func (s *authService) RefreshTokens(req RefreshTokenRequest) (*RefreshTokenResponse, error) {
	ctx := context.Background()

	// Validate refresh token
	claims, err := s.jwtService.ValidateRefreshTokenWithFamily(req.RefreshToken, "")
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Hash token for database lookup
	tokenHash := s.hashToken(req.RefreshToken)

	// Validate family ID
	if claims.FamilyID == "" {
		return nil, ErrInvalidToken
	}

	// Validate token in database
	_, err = s.refreshTokenRepo.ValidateRefreshToken(ctx, tokenHash)
	if err != nil {
		// Revoke entire family on invalid token (rotation attack detection)
		s.refreshTokenRepo.RevokeTokenFamily(ctx, claims.FamilyID)
		return nil, ErrInvalidToken
	}

	// Parse user ID
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Get user details
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check token limit
	activeTokenCount, err := s.refreshTokenRepo.GetActiveTokenCount(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check active token count: %w", err)
	}

	if activeTokenCount >= int64(s.jwtService.GetMaxRefreshTokens()) {
		s.refreshTokenRepo.RevokeAllUserTokens(ctx, userID)
		return nil, ErrTooManyTokens
	}

	// Generate new token pair
	platform := detectPlatform(req.Platform, req.DeviceInfo)
	tokenPair, err := s.jwtService.GenerateTokenPair(user.ID, user.Email, user.Username, []string{"user"}, []string{}, platform)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	// Revoke old token and store new one atomically
	if err := s.refreshTokenRepo.RevokeRefreshToken(ctx, tokenHash); err != nil {
		return nil, fmt.Errorf("failed to revoke old token: %w", err)
	}

	refreshTokenRecord := &repository.RefreshToken{
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(s.jwtService.GetRefreshTokenTTL()),
		DeviceInfo: req.DeviceInfo,
		IPAddress:  req.IPAddress,
		FamilyID:   tokenPair.FamilyID,
	}

	if err := s.refreshTokenRepo.StoreRefreshToken(ctx, refreshTokenRecord, tokenPair.RefreshToken); err != nil {
		return nil, fmt.Errorf("failed to store new token: %w", err)
	}

	return &RefreshTokenResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresAt:    tokenPair.ExpiresAt,
		User:         user.ToProfileUser(),
	}, nil
}

// LogoutUser logs out a user
func (s *authService) LogoutUser(userID uuid.UUID, sessionToken string) error {
	ctx := context.Background()

	if sessionToken != "" {
		tokenHash := s.hashToken(sessionToken)
		return s.refreshTokenRepo.RevokeRefreshToken(ctx, tokenHash)
	}

	// If no specific token provided, revoke all user tokens
	return s.refreshTokenRepo.RevokeAllUserTokens(ctx, userID)
}

// CleanupExpiredSessions cleans up expired sessions
func (s *authService) CleanupExpiredSessions() error {
	ctx := context.Background()
	_, err := s.refreshTokenRepo.CleanupExpiredTokens(ctx)
	return err
}

// CleanupExpiredRefreshTokens cleans up expired refresh tokens
func (s *authService) CleanupExpiredRefreshTokens() error {
	return s.CleanupExpiredSessions() // Same operation
}

// Helper functions

func (s *authService) handlePasswordRehashing(ctx context.Context, user *models.User, password string) error {
	newHash, err := s.passwordHasher.HashPassword(password)
	if err != nil {
		return err
	}

	user.PasswordHash = newHash
	return s.userRepo.UpdateUser(user)
}

func (s *authService) hashToken(token string) string {
	return s.tokenHasher.HashToken(token)
}

func (s *authService) storeDeviceInfo(ctx context.Context, userID uuid.UUID, deviceID, platform, deviceInfo string) error {
	// Simple device info storage - can be enhanced later
	// For now, just log it for future push notification implementation
	fmt.Printf("Device info stored - User: %s, Device: %s, Platform: %s\n", userID, deviceID, platform)
	return nil
}

// Platform detection - simple but effective
func detectPlatform(platformHeader, deviceInfo string) string {
	// Check explicit platform header first (from mobile apps)
	switch strings.ToLower(platformHeader) {
	case "ios":
		return "ios"
	case "android":
		return "android"
	case "mobile":
		// Detect specific mobile platform from device info
		if strings.Contains(strings.ToLower(deviceInfo), "iphone") ||
			strings.Contains(strings.ToLower(deviceInfo), "ipad") {
			return "ios"
		}
		if strings.Contains(strings.ToLower(deviceInfo), "android") {
			return "android"
		}
		return "mobile"
	default:
		return "web"
	}
}
