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



type LoginRequest struct {
	Email      string `json:"email" validate:"required,email"`
	Password   string `json:"password" validate:"required"`
	DeviceInfo string `json:"device_info,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
	DeviceInfo   string `json:"device_info,omitempty"`
	IPAddress    string `json:"ip_address,omitempty"`
}

type RefreshTokenResponse struct {
	AccessToken  string             `json:"access_token"`
	RefreshToken string             `json:"refresh_token"`
	ExpiresAt    time.Time          `json:"expires_at"`
	User         models.ProfileUser `json:"user"`
}

type AuthResponse struct {
	User    models.ProfileUser `json:"user"`
	Token   *string            `json:"token,omitempty"`
	Message string             `json:"message"`
}

// AuthService interface defines authentication operations
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
	jwtService          *JWTService
	passwordHasher      *security.PasswordHasher
	tokenHasher         *security.TokenHasher
	eventBus            events.EventBus
	onboardingInterface onboarding.OnboardingInterface
	redisClient         *redis.Client
	securityLogger      *EnhancedSecurityLogger
}

// NewAuthService creates a new auth service
func NewAuthService(
	userRepo repository.UserRepository,
	refreshTokenRepo repository.RefreshTokenRepository,
	jwtService *JWTService,
	eventBus events.EventBus,
	onboardingInterface onboarding.OnboardingInterface,
	redisClient *redis.Client,
) AuthService {
	passwordConfig := security.GetPasswordConfig()
	passwordHasher := security.NewPasswordHasher(passwordConfig)
	
	return &authService{
		userRepo:            userRepo,
		refreshTokenRepo:    refreshTokenRepo,
		jwtService:          jwtService,
		passwordHasher:      passwordHasher,
		tokenHasher:         security.NewTokenHasher(),
		eventBus:            eventBus,
		onboardingInterface: onboardingInterface,
		redisClient:         redisClient,
		securityLogger:      NewEnhancedSecurityLogger(redisClient),
	}
}

// RegisterUser registers a new user
func (s *authService) RegisterUser(req RegisterUserRequest) (*AuthResponse, *TokenPair, error) {
	// Validate email uniqueness
	if _, err := s.userRepo.GetUserByEmail(req.Email); err == nil {
		return nil, nil, ErrEmailAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, fmt.Errorf("failed to check email uniqueness: %w", err)
	}

	// Validate username uniqueness
	if _, err := s.userRepo.GetUserByUsername(req.Username); err == nil {
		return nil, nil, ErrUsernameAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, fmt.Errorf("failed to check username uniqueness: %w", err)
	}

	// Hash password using enhanced hasher
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

	// Generate token pair (access + refresh tokens)
	roles := []string{"user"} // Default role for all users
	permissions := []string{} // Add user-specific permissions if needed
	deviceInfo := "web-registration" // Default device info for registration
	
	tokenPair, err := s.jwtService.GenerateTokenPair(user.ID, user.Email, user.Username, roles, permissions, deviceInfo)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	// Store refresh token
	refreshTokenRecord := &repository.RefreshToken{
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(s.jwtService.config.RefreshTokenTTL),
		DeviceInfo: deviceInfo,
		IPAddress:  "unknown", // Will be populated by handler layer
		FamilyID:   tokenPair.FamilyID,
	}

	if err := s.refreshTokenRepo.StoreRefreshToken(ctx, refreshTokenRecord, tokenPair.RefreshToken); err != nil {
		return nil, nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		// Log error but don't fail the registration
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
		// Rehash password with current parameters (synchronous for security)
		if err := s.handlePasswordRehashing(ctx, user, req.Password); err != nil {
			// Log the error but don't fail the login
			s.logSecurityEvent("password_rehash_failed", user.ID.String(), err.Error())
			fmt.Printf("Password rehashing failed for user %s: %v\n", user.ID, err)
		}
	}

	// Generate token pair (access + refresh tokens)
	roles := []string{"user"} // Default role for all users
	permissions := []string{} // Add user-specific permissions if needed
	deviceInfo := req.DeviceInfo
	if deviceInfo == "" {
		deviceInfo = "web-login" // Default device info
	}
	
	tokenPair, err := s.jwtService.GenerateTokenPair(user.ID, user.Email, user.Username, roles, permissions, deviceInfo)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	// Store refresh token
	refreshTokenRecord := &repository.RefreshToken{
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(s.jwtService.config.RefreshTokenTTL),
		DeviceInfo: deviceInfo,
		IPAddress:  req.IPAddress,
		FamilyID:   tokenPair.FamilyID,
	}

	if err := s.refreshTokenRepo.StoreRefreshToken(ctx, refreshTokenRecord, tokenPair.RefreshToken); err != nil {
		return nil, nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		// Log error but don't fail the login
		fmt.Printf("Failed to update last login for user %s: %v\n", user.ID, err)
	}

	return &AuthResponse{
		User:    user.ToProfileUser(),
		Token:   &tokenPair.AccessToken,
		Message: "Login successful",
	}, tokenPair, nil
}

// RefreshTokens implements token refresh with rotation and security measures
func (s *authService) RefreshTokens(req RefreshTokenRequest) (*RefreshTokenResponse, error) {
	ctx := context.Background()
	
	// Validate refresh token structure
	claims, err := s.jwtService.ValidateRefreshTokenWithFamily(req.RefreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Hash token for database lookup
	tokenHash := s.hashToken(req.RefreshToken)

	// Validate family ID from claims
	if claims.FamilyID == "" {
		s.logSecurityEvent("invalid_family_id", claims.Subject, "Refresh token missing family ID")
		return nil, ErrInvalidToken
	}
	if _, err := uuid.Parse(claims.FamilyID); err != nil {
		s.logSecurityEvent("invalid_family_id", claims.Subject, fmt.Sprintf("Malformed family ID: %s", claims.FamilyID))
		return nil, ErrInvalidToken
	}

	// Validate token in database (this also checks cache internally)
	_, err = s.refreshTokenRepo.ValidateRefreshToken(ctx, tokenHash)
	if err != nil {
		// If token is invalid, revoke entire family (rotation attack detection)
		s.refreshTokenRepo.RevokeTokenFamily(ctx, claims.FamilyID)
		s.logSecurityEvent("token_family_revoked", claims.Subject, fmt.Sprintf("Invalid token used, family %s revoked", claims.FamilyID))
		return nil, ErrInvalidToken
	}

	// Parse user ID from claims
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

	// Check token limit for user
	activeTokenCount, err := s.refreshTokenRepo.GetActiveTokenCount(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check active token count: %w", err)
	}
	
	if activeTokenCount >= int64(s.jwtService.config.MaxRefreshTokens) {
		// Clean up oldest tokens if limit exceeded
		s.refreshTokenRepo.RevokeAllUserTokens(ctx, userID)
		s.logSecurityEvent("token_limit_exceeded", userID.String(), "All tokens revoked due to limit exceeded")
	}

	// Generate new token pair (refresh token rotation)
	roles := []string{"user"} // Default role for all users  
	permissions := []string{} // Add user-specific permissions if needed
	deviceInfo := req.DeviceInfo
	if deviceInfo == "" {
		deviceInfo = claims.DeviceInfo // Preserve original device info
	}
	
	newTokenPair, err := s.jwtService.GenerateTokenPair(user.ID, user.Email, user.Username, roles, permissions, deviceInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to generate new token pair: %w", err)
	}

	// Rotate tokens atomically (revoke old + store new in transaction)
	newRefreshTokenRecord := &repository.RefreshToken{
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(s.jwtService.config.RefreshTokenTTL),
		DeviceInfo: deviceInfo,
		IPAddress:  req.IPAddress,
		FamilyID:   newTokenPair.FamilyID,
	}

	if err := s.refreshTokenRepo.RotateRefreshTokenAtomic(ctx, tokenHash, newRefreshTokenRecord, newTokenPair.RefreshToken); err != nil {
		s.logSecurityEvent("token_rotation_failed", userID.String(), fmt.Sprintf("Atomic rotation failed: %v", err))
		return nil, fmt.Errorf("failed to rotate refresh token: %w", err)
	}

	return &RefreshTokenResponse{
		AccessToken:  newTokenPair.AccessToken,
		RefreshToken: newTokenPair.RefreshToken,
		ExpiresAt:    newTokenPair.ExpiresAt,
		User:         user.ToProfileUser(),
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

// CleanupExpiredRefreshTokens removes expired refresh tokens
func (s *authService) CleanupExpiredRefreshTokens() error {
	ctx := context.Background()
	deletedCount, err := s.refreshTokenRepo.CleanupExpiredTokens(ctx)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired refresh tokens: %w", err)
	}
	
	fmt.Printf("Cleaned up %d expired refresh tokens\n", deletedCount)
	return nil
}

// hashToken generates SHA-256 hash of the token for database lookup
func (s *authService) hashToken(token string) string {
	return s.tokenHasher.HashToken(token)
}

// handlePasswordRehashing safely rehashes a password with proper error handling and auditing
func (s *authService) handlePasswordRehashing(ctx context.Context, user *models.User, password string) error {
	// Generate new hash with current security parameters
	newHash, err := s.passwordHasher.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to generate new password hash: %w", err)
	}
	
	// Update the user model
	originalHash := user.PasswordHash
	user.PasswordHash = newHash
	
	// Update in database with transaction support
	if err := s.userRepo.UpdateUser(user); err != nil {
		// Rollback the user model on database failure
		user.PasswordHash = originalHash
		return fmt.Errorf("failed to update password hash in database: %w", err)
	}
	
	// Log successful rehashing for security audit
	s.logSecurityEvent("password_rehashed", user.ID.String(), "Password hash updated with current security parameters")
	
	return nil
}

// logSecurityEvent logs security-related events for monitoring
func (s *authService) logSecurityEvent(event, userID, details string) {
	// Parse details and determine severity
	detailsMap := map[string]interface{}{"details": details}
	severity := SeverityInfo
	
	// Determine severity based on event type
	switch event {
	case "login_failed", "invalid_token", "token_family_revoked":
		severity = SeverityWarning
	case "password_rehash_failed", "suspicious_activity":
		severity = SeverityError
	case "account_compromise", "token_theft_detected":
		severity = SeverityCritical
	}
	
	s.securityLogger.LogSecurityEvent(event, userID, detailsMap, severity)
}
