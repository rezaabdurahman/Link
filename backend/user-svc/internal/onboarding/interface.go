package onboarding

import (
	"context"

	"github.com/google/uuid"
)

// OnboardingInterface defines the contract that external services (like auth) use to interact with onboarding
// This interface acts as a boundary to ensure all interactions happen through defined methods
// rather than direct struct access, making future service extraction easier
type OnboardingInterface interface {
	// NotifyUserRegistered is called when a new user is registered to initialize their onboarding state
	NotifyUserRegistered(ctx context.Context, userID uuid.UUID, email, username, firstName, lastName string) error
	
	// GetOnboardingStatus retrieves the current onboarding status for a user
	GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error)
	
	// IsOnboardingComplete checks if a user has completed onboarding
	IsOnboardingComplete(ctx context.Context, userID uuid.UUID) (bool, error)
}

// implementation struct implements OnboardingInterface by delegating to the service layer
type implementation struct {
	service Service
}

// NewOnboardingInterface creates a new onboarding interface implementation
func NewOnboardingInterface(service Service) OnboardingInterface {
	return &implementation{
		service: service,
	}
}

// NotifyUserRegistered initializes onboarding state when a user registers
func (i *implementation) NotifyUserRegistered(ctx context.Context, userID uuid.UUID, email, username, firstName, lastName string) error {
	// Start onboarding for the new user
	_, err := i.service.StartOnboarding(ctx, userID)
	if err != nil {
		// Log error but don't fail user registration if onboarding initialization fails
		// This ensures user registration is resilient to onboarding service issues
		return nil // Or return err if you want it to fail registration
	}
	return nil
}

// GetOnboardingStatus retrieves the current onboarding status
func (i *implementation) GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error) {
	return i.service.GetOnboardingStatus(ctx, userID)
}

// IsOnboardingComplete checks if onboarding is complete
func (i *implementation) IsOnboardingComplete(ctx context.Context, userID uuid.UUID) (bool, error) {
	status, err := i.service.GetOnboardingStatus(ctx, userID)
	if err != nil {
		return false, err
	}
	
	return status.Status == OnboardingStatusCompleted, nil
}
