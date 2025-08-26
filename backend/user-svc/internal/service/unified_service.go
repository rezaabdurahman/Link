package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/auth"
	"github.com/link-app/user-svc/internal/models"
	"github.com/link-app/user-svc/internal/onboarding"
	"github.com/link-app/user-svc/internal/profile"
)

// UserService interface now serves as a unified interface that combines all domain services
// This preserves backward compatibility while enforcing modular boundaries
type UserService interface {
	AuthService
	ProfileService
	OnboardingService
}

// AuthService interface defines authentication operations
type AuthService interface {
	RegisterUser(req auth.RegisterUserRequest) (*auth.AuthResponse, error)
	LoginUser(req auth.LoginRequest) (*auth.AuthResponse, *models.Session, error)
	RefreshToken(refreshToken string) (*auth.AuthResponse, error)
	LogoutUser(userID uuid.UUID, sessionToken string) error
	CleanupExpiredSessions() error
}

// ProfileService interface defines user profile operations
type ProfileService interface {
	GetUserProfile(userID uuid.UUID) (*models.ProfileUser, error)
	GetPublicUserProfile(userID, viewerID uuid.UUID) (*models.PublicUser, error)
	UpdateUserProfile(userID uuid.UUID, req profile.UpdateProfileRequest) (*models.ProfileUser, error)
	GetUserFriends(userID uuid.UUID, page, limit int) ([]models.PublicUser, error)
	GetFriendRequests(userID uuid.UUID, page, limit int) ([]models.FriendRequest, error)
	SendFriendRequest(requesterID uuid.UUID, req profile.SendFriendRequestRequest) error
	RespondToFriendRequest(requestID, userID uuid.UUID, accept bool) error
	CancelFriendRequest(requesterID, requesteeID uuid.UUID) error
	RemoveFriend(userID, friendID uuid.UUID) error
	SearchUsers(query string, userID uuid.UUID, page, limit int) ([]models.PublicUser, error)
	
}

// OnboardingService interface defines onboarding operations
type OnboardingService interface {
	StartOnboarding(ctx context.Context, userID uuid.UUID) (*onboarding.OnboardingStatusResponse, error)
	GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*onboarding.OnboardingStatusResponse, error)
	CompleteStep(ctx context.Context, userID uuid.UUID, step onboarding.OnboardingStep) (*onboarding.OnboardingStatusResponse, error)
	SkipOnboarding(ctx context.Context, userID uuid.UUID) (*onboarding.OnboardingStatusResponse, error)
	UpdatePreferences(ctx context.Context, userID uuid.UUID, req onboarding.UpdatePreferencesRequest) (*onboarding.UserPreferences, error)
	GetPreferences(ctx context.Context, userID uuid.UUID) (*onboarding.UserPreferences, error)
}

// unifiedUserService implements the UserService interface by delegating to individual domain services
type unifiedUserService struct {
	authService       auth.AuthService
	profileService    profile.ProfileService
	onboardingService onboarding.Service
}

// NewUnifiedUserService creates a new unified user service that delegates to individual domain services
func NewUnifiedUserService(
	authService auth.AuthService,
	profileService profile.ProfileService,
	onboardingService onboarding.Service,
) UserService {
	return &unifiedUserService{
		authService:       authService,
		profileService:    profileService,
		onboardingService: onboardingService,
	}
}

// Auth methods - delegate to auth service
func (s *unifiedUserService) RegisterUser(req auth.RegisterUserRequest) (*auth.AuthResponse, error) {
	return s.authService.RegisterUser(req)
}

func (s *unifiedUserService) LoginUser(req auth.LoginRequest) (*auth.AuthResponse, *models.Session, error) {
	return s.authService.LoginUser(req)
}

func (s *unifiedUserService) RefreshToken(refreshToken string) (*auth.AuthResponse, error) {
	return s.authService.RefreshToken(refreshToken)
}

func (s *unifiedUserService) LogoutUser(userID uuid.UUID, sessionToken string) error {
	return s.authService.LogoutUser(userID, sessionToken)
}

func (s *unifiedUserService) CleanupExpiredSessions() error {
	return s.authService.CleanupExpiredSessions()
}

// Profile methods - delegate to profile service
func (s *unifiedUserService) GetUserProfile(userID uuid.UUID) (*models.ProfileUser, error) {
	return s.profileService.GetUserProfile(userID)
}

func (s *unifiedUserService) GetPublicUserProfile(userID, viewerID uuid.UUID) (*models.PublicUser, error) {
	return s.profileService.GetPublicUserProfile(userID, viewerID)
}

func (s *unifiedUserService) UpdateUserProfile(userID uuid.UUID, req profile.UpdateProfileRequest) (*models.ProfileUser, error) {
	return s.profileService.UpdateUserProfile(userID, req)
}

func (s *unifiedUserService) GetUserFriends(userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
	return s.profileService.GetUserFriends(userID, page, limit)
}

func (s *unifiedUserService) GetFriendRequests(userID uuid.UUID, page, limit int) ([]models.FriendRequest, error) {
	return s.profileService.GetFriendRequests(userID, page, limit)
}

func (s *unifiedUserService) SendFriendRequest(requesterID uuid.UUID, req profile.SendFriendRequestRequest) error {
	return s.profileService.SendFriendRequest(requesterID, req)
}

func (s *unifiedUserService) RespondToFriendRequest(requestID, userID uuid.UUID, accept bool) error {
	return s.profileService.RespondToFriendRequest(requestID, userID, accept)
}

func (s *unifiedUserService) CancelFriendRequest(requesterID, requesteeID uuid.UUID) error {
	return s.profileService.CancelFriendRequest(requesterID, requesteeID)
}

func (s *unifiedUserService) RemoveFriend(userID, friendID uuid.UUID) error {
	return s.profileService.RemoveFriend(userID, friendID)
}

func (s *unifiedUserService) SearchUsers(query string, userID uuid.UUID, page, limit int) ([]models.PublicUser, error) {
	// SearchUsers is not implemented in profile service yet
	return []models.PublicUser{}, nil
}
// Onboarding methods - delegate to onboarding service
func (s *unifiedUserService) StartOnboarding(ctx context.Context, userID uuid.UUID) (*onboarding.OnboardingStatusResponse, error) {
	return s.onboardingService.StartOnboarding(ctx, userID)
}

func (s *unifiedUserService) GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*onboarding.OnboardingStatusResponse, error) {
	return s.onboardingService.GetOnboardingStatus(ctx, userID)
}

func (s *unifiedUserService) CompleteStep(ctx context.Context, userID uuid.UUID, step onboarding.OnboardingStep) (*onboarding.OnboardingStatusResponse, error) {
	return s.onboardingService.CompleteStep(ctx, userID, step)
}

func (s *unifiedUserService) SkipOnboarding(ctx context.Context, userID uuid.UUID) (*onboarding.OnboardingStatusResponse, error) {
	return s.onboardingService.SkipOnboarding(ctx, userID)
}

func (s *unifiedUserService) UpdatePreferences(ctx context.Context, userID uuid.UUID, req onboarding.UpdatePreferencesRequest) (*onboarding.UserPreferences, error) {
	return s.onboardingService.UpdatePreferences(ctx, userID, req)
}

func (s *unifiedUserService) GetPreferences(ctx context.Context, userID uuid.UUID) (*onboarding.UserPreferences, error) {
	return s.onboardingService.GetPreferences(ctx, userID)
}

