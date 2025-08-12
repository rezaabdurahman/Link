package onboarding

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/events"
)

// Service errors
var (
	ErrOnboardingAlreadyCompleted = errors.New("onboarding already completed")
	ErrOnboardingAlreadySkipped   = errors.New("onboarding already skipped")
	ErrInvalidStep               = errors.New("invalid onboarding step")
	ErrStepNotCompleted          = errors.New("previous step not completed")
)

// DTO types for service layer
type StartOnboardingRequest struct {
	UserID uuid.UUID `json:"user_id" validate:"required"`
}

type CompleteStepRequest struct {
	Step OnboardingStep `json:"step" validate:"required"`
}

type UpdatePreferencesRequest struct {
	EmailNotifications *bool   `json:"email_notifications,omitempty"`
	PushNotifications  *bool   `json:"push_notifications,omitempty"`
	FriendRequests     *bool   `json:"friend_requests,omitempty"`
	ActivityUpdates    *bool   `json:"activity_updates,omitempty"`
	NewsletterOptIn    *bool   `json:"newsletter_opt_in,omitempty"`
	PrivacyLevel       *string `json:"privacy_level,omitempty" validate:"omitempty,oneof=public friends private"`
}

type OnboardingStatusResponse struct {
	UserID         uuid.UUID        `json:"user_id"`
	Status         OnboardingStatus `json:"status"`
	CurrentStep    *OnboardingStep  `json:"current_step"`
	CompletedSteps []string         `json:"completed_steps"`
	StartedAt      *time.Time       `json:"started_at"`
	CompletedAt    *time.Time       `json:"completed_at"`
	NextStep       *OnboardingStep  `json:"next_step,omitempty"`
}

// Service defines the interface for onboarding business operations
type Service interface {
	// Core onboarding operations
	StartOnboarding(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error)
	GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error)
	CompleteStep(ctx context.Context, userID uuid.UUID, step OnboardingStep) (*OnboardingStatusResponse, error)
	SkipOnboarding(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error)

	// Preferences management
	UpdatePreferences(ctx context.Context, userID uuid.UUID, req UpdatePreferencesRequest) (*UserPreferences, error)
	GetPreferences(ctx context.Context, userID uuid.UUID) (*UserPreferences, error)
}

// service implements the Service interface
type service struct {
	repo     Repository
	eventBus events.EventBus
}

// NewService creates a new onboarding service
func NewService(repo Repository, eventBus events.EventBus) Service {
	return &service{
		repo:     repo,
		eventBus: eventBus,
	}
}

// getStepOrder returns the order of steps in the onboarding process
func (s *service) getStepOrder() []OnboardingStep {
	return []OnboardingStep{
		StepProfileSetup,
		StepPreferences,
		StepFindFriends,
		StepNotifications,
		StepTutorial,
	}
}

// getNextStep determines the next step in the onboarding process
func (s *service) getNextStep(completedSteps []string) *OnboardingStep {
	stepOrder := s.getStepOrder()
	completedMap := make(map[string]bool)
	for _, step := range completedSteps {
		completedMap[step] = true
	}

	for _, step := range stepOrder {
		if !completedMap[string(step)] {
			return &step
		}
	}
	return nil
}

// isValidStep checks if the provided step is valid
func (s *service) isValidStep(step OnboardingStep) bool {
	validSteps := s.getStepOrder()
	for _, validStep := range validSteps {
		if step == validStep {
			return true
		}
	}
	return false
}

// StartOnboarding starts the onboarding process for a user
func (s *service) StartOnboarding(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error) {
	// Check if onboarding already exists
	existing, err := s.repo.GetOnboardingProgressByUserID(userID)
	if err != nil && !errors.Is(err, ErrOnboardingProgressNotFound) {
		return nil, fmt.Errorf("failed to check existing onboarding: %w", err)
	}

	if existing != nil {
		if existing.Status == OnboardingStatusCompleted {
			return nil, ErrOnboardingAlreadyCompleted
		}
		if existing.Status == OnboardingStatusSkipped {
			return nil, ErrOnboardingAlreadySkipped
		}
		// If in progress or pending, return current status
		return s.progressToResponse(existing), nil
	}

	// Create new onboarding progress
	startedAt := time.Now().UTC()
	firstStep := s.getStepOrder()[0]

	progress := &OnboardingProgress{
		UserID:         userID,
		Status:         OnboardingStatusInProgress,
		CurrentStep:    &firstStep,
		CompletedSteps: []string{},
		StartedAt:      &startedAt,
	}

	if err := s.repo.CreateOnboardingProgress(progress); err != nil {
		return nil, fmt.Errorf("failed to create onboarding progress: %w", err)
	}

	// Emit domain event
	event := events.NewUserOnboardingStartedEvent(userID, startedAt)
	if err := s.eventBus.Publish(ctx, event); err != nil {
		// Log error but don't fail the operation
		fmt.Printf("Failed to publish onboarding started event: %v\n", err)
	}

	return s.progressToResponse(progress), nil
}

// GetOnboardingStatus retrieves the current onboarding status for a user
func (s *service) GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error) {
	progress, err := s.repo.GetOnboardingProgressByUserID(userID)
	if err != nil {
		if errors.Is(err, ErrOnboardingProgressNotFound) {
			// User hasn't started onboarding yet
			return &OnboardingStatusResponse{
				UserID:         userID,
				Status:         OnboardingStatusPending,
				CompletedSteps: []string{},
				NextStep:       &s.getStepOrder()[0],
			}, nil
		}
		return nil, fmt.Errorf("failed to get onboarding progress: %w", err)
	}

	return s.progressToResponse(progress), nil
}

// CompleteStep marks a step as completed and advances the onboarding process
func (s *service) CompleteStep(ctx context.Context, userID uuid.UUID, step OnboardingStep) (*OnboardingStatusResponse, error) {
	if !s.isValidStep(step) {
		return nil, ErrInvalidStep
	}

	progress, err := s.repo.GetOnboardingProgressByUserID(userID)
	if err != nil {
		if errors.Is(err, ErrOnboardingProgressNotFound) {
			// Auto-start onboarding if not started
			if _, err := s.StartOnboarding(ctx, userID); err != nil {
				return nil, fmt.Errorf("failed to auto-start onboarding: %w", err)
			}
			progress, err = s.repo.GetOnboardingProgressByUserID(userID)
			if err != nil {
				return nil, fmt.Errorf("failed to get newly created onboarding progress: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to get onboarding progress: %w", err)
		}
	}

	if progress.Status == OnboardingStatusCompleted {
		return nil, ErrOnboardingAlreadyCompleted
	}

	if progress.Status == OnboardingStatusSkipped {
		return nil, ErrOnboardingAlreadySkipped
	}

	// Check if step is already completed
	for _, completedStep := range progress.CompletedSteps {
		if completedStep == string(step) {
			// Already completed, just return current status
			return s.progressToResponse(progress), nil
		}
	}

	// Add the step to completed steps
	progress.CompletedSteps = append(progress.CompletedSteps, string(step))
	
	// Determine next step
	nextStep := s.getNextStep(progress.CompletedSteps)
	progress.CurrentStep = nextStep

	// Check if all steps are completed
	if nextStep == nil {
		progress.Status = OnboardingStatusCompleted
		completedAt := time.Now().UTC()
		progress.CompletedAt = &completedAt
	}

	if err := s.repo.UpdateOnboardingProgress(progress); err != nil {
		return nil, fmt.Errorf("failed to update onboarding progress: %w", err)
	}

	// Emit domain events
	if progress.Status == OnboardingStatusCompleted {
		event := events.NewUserOnboardedEvent(userID, *progress.StartedAt, *progress.CompletedAt, progress.CompletedSteps)
		if err := s.eventBus.Publish(ctx, event); err != nil {
			fmt.Printf("Failed to publish user onboarded event: %v\n", err)
		}
	} else {
		var nextStepStr *string
		if nextStep != nil {
			nextStepString := string(*nextStep)
			nextStepStr = &nextStepString
		}
		event := events.NewUserOnboardingProgressedEvent(userID, string(step), nextStepStr, progress.CompletedSteps)
		if err := s.eventBus.Publish(ctx, event); err != nil {
			fmt.Printf("Failed to publish onboarding progressed event: %v\n", err)
		}
	}

	return s.progressToResponse(progress), nil
}

// SkipOnboarding allows a user to skip the onboarding process
func (s *service) SkipOnboarding(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error) {
	progress, err := s.repo.GetOnboardingProgressByUserID(userID)
	if err != nil {
		if errors.Is(err, ErrOnboardingProgressNotFound) {
			// Create minimal progress record for skipping
			progress = &OnboardingProgress{
				UserID:         userID,
				CompletedSteps: []string{},
			}
		} else {
			return nil, fmt.Errorf("failed to get onboarding progress: %w", err)
		}
	}

	if progress.Status == OnboardingStatusCompleted {
		return nil, ErrOnboardingAlreadyCompleted
	}

	if progress.Status == OnboardingStatusSkipped {
		return nil, ErrOnboardingAlreadySkipped
	}

	// Update progress to skipped
	progress.Status = OnboardingStatusSkipped
	progress.CurrentStep = nil
	skippedAt := time.Now().UTC()
	progress.CompletedAt = &skippedAt

	// Save or update the progress
	if progress.ID == uuid.Nil {
		if err := s.repo.CreateOnboardingProgress(progress); err != nil {
			return nil, fmt.Errorf("failed to create onboarding progress: %w", err)
		}
	} else {
		if err := s.repo.UpdateOnboardingProgress(progress); err != nil {
			return nil, fmt.Errorf("failed to update onboarding progress: %w", err)
		}
	}

	// Emit domain event
	event := events.NewUserOnboardingSkippedEvent(userID, progress.StartedAt, progress.CompletedSteps)
	if err := s.eventBus.Publish(ctx, event); err != nil {
		fmt.Printf("Failed to publish onboarding skipped event: %v\n", err)
	}

	return s.progressToResponse(progress), nil
}

// UpdatePreferences updates user preferences during onboarding
func (s *service) UpdatePreferences(ctx context.Context, userID uuid.UUID, req UpdatePreferencesRequest) (*UserPreferences, error) {
	// Get existing preferences or create new ones
	preferences, err := s.repo.GetUserPreferencesByUserID(userID)
	if err != nil && !errors.Is(err, ErrUserPreferencesNotFound) {
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}

	if preferences == nil {
		// Create new preferences with defaults
		preferences = &UserPreferences{
			UserID:             userID,
			EmailNotifications: true,
			PushNotifications:  true,
			FriendRequests:     true,
			ActivityUpdates:    true,
			NewsletterOptIn:    false,
			PrivacyLevel:       "friends",
		}
	}

	// Update fields if provided
	if req.EmailNotifications != nil {
		preferences.EmailNotifications = *req.EmailNotifications
	}
	if req.PushNotifications != nil {
		preferences.PushNotifications = *req.PushNotifications
	}
	if req.FriendRequests != nil {
		preferences.FriendRequests = *req.FriendRequests
	}
	if req.ActivityUpdates != nil {
		preferences.ActivityUpdates = *req.ActivityUpdates
	}
	if req.NewsletterOptIn != nil {
		preferences.NewsletterOptIn = *req.NewsletterOptIn
	}
	if req.PrivacyLevel != nil {
		preferences.PrivacyLevel = *req.PrivacyLevel
	}

	// Save preferences
	if preferences.ID == uuid.Nil {
		if err := s.repo.CreateUserPreferences(preferences); err != nil {
			return nil, fmt.Errorf("failed to create user preferences: %w", err)
		}
	} else {
		if err := s.repo.UpdateUserPreferences(preferences); err != nil {
			return nil, fmt.Errorf("failed to update user preferences: %w", err)
		}
	}

	return preferences, nil
}

// GetPreferences retrieves user preferences
func (s *service) GetPreferences(ctx context.Context, userID uuid.UUID) (*UserPreferences, error) {
	preferences, err := s.repo.GetUserPreferencesByUserID(userID)
	if err != nil {
		if errors.Is(err, ErrUserPreferencesNotFound) {
			// Return default preferences
			return &UserPreferences{
				UserID:             userID,
				EmailNotifications: true,
				PushNotifications:  true,
				FriendRequests:     true,
				ActivityUpdates:    true,
				NewsletterOptIn:    false,
				PrivacyLevel:       "friends",
			}, nil
		}
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}

	return preferences, nil
}

// progressToResponse converts OnboardingProgress to OnboardingStatusResponse
func (s *service) progressToResponse(progress *OnboardingProgress) *OnboardingStatusResponse {
	response := &OnboardingStatusResponse{
		UserID:         progress.UserID,
		Status:         progress.Status,
		CurrentStep:    progress.CurrentStep,
		CompletedSteps: progress.CompletedSteps,
		StartedAt:      progress.StartedAt,
		CompletedAt:    progress.CompletedAt,
	}

	// Add next step if not completed or skipped
	if progress.Status == OnboardingStatusInProgress || progress.Status == OnboardingStatusPending {
		response.NextStep = s.getNextStep(progress.CompletedSteps)
	}

	return response
}
