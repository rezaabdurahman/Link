package events

import (
	"time"

	"github.com/google/uuid"
)

// Event type constants
const (
	UserRegisteredEventType          = "user.registered"
	UserOnboardingStartedEventType   = "user.onboarding.started"
	UserOnboardingProgressedEventType = "user.onboarding.progressed"
	UserOnboardedEventType           = "user.onboarded"
	UserOnboardingSkippedEventType   = "user.onboarding.skipped"
)

// UserRegisteredEvent is emitted when a new user is registered
type UserRegisteredEvent struct {
	BaseEvent
}

// UserRegisteredEventData represents the data for a user registered event
type UserRegisteredEventData struct {
	UserID      uuid.UUID  `json:"user_id"`
	Email       string     `json:"email"`
	Username    string     `json:"username"`
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	DateOfBirth *time.Time `json:"date_of_birth,omitempty"`
	RegisteredAt time.Time `json:"registered_at"`
}

// NewUserRegisteredEvent creates a new user registered event
func NewUserRegisteredEvent(userID uuid.UUID, email, username, firstName, lastName string, dateOfBirth *time.Time) UserRegisteredEvent {
	data := UserRegisteredEventData{
		UserID:       userID,
		Email:        email,
		Username:     username,
		FirstName:    firstName,
		LastName:     lastName,
		DateOfBirth:  dateOfBirth,
		RegisteredAt: time.Now().UTC(),
	}

	return UserRegisteredEvent{
		BaseEvent: NewBaseEvent(UserRegisteredEventType, userID.String(), data),
	}
}

// UserOnboardingStartedEvent is emitted when a user starts the onboarding process
type UserOnboardingStartedEvent struct {
	BaseEvent
}

// UserOnboardingStartedEventData represents the data for a user onboarding started event
type UserOnboardingStartedEventData struct {
	UserID    uuid.UUID `json:"user_id"`
	StartedAt time.Time `json:"started_at"`
}

// NewUserOnboardingStartedEvent creates a new user onboarding started event
func NewUserOnboardingStartedEvent(userID uuid.UUID, startedAt time.Time) UserOnboardingStartedEvent {
	data := UserOnboardingStartedEventData{
		UserID:    userID,
		StartedAt: startedAt,
	}

	return UserOnboardingStartedEvent{
		BaseEvent: NewBaseEvent(UserOnboardingStartedEventType, userID.String(), data),
	}
}

// UserOnboardingProgressedEvent is emitted when a user completes a step in onboarding
type UserOnboardingProgressedEvent struct {
	BaseEvent
}

// UserOnboardingProgressedEventData represents the data for a user onboarding progressed event
type UserOnboardingProgressedEventData struct {
	UserID         uuid.UUID `json:"user_id"`
	CompletedStep  string    `json:"completed_step"`
	CurrentStep    *string   `json:"current_step"`
	CompletedSteps []string  `json:"completed_steps"`
	ProgressedAt   time.Time `json:"progressed_at"`
}

// NewUserOnboardingProgressedEvent creates a new user onboarding progressed event
func NewUserOnboardingProgressedEvent(userID uuid.UUID, completedStep string, currentStep *string, completedSteps []string) UserOnboardingProgressedEvent {
	data := UserOnboardingProgressedEventData{
		UserID:         userID,
		CompletedStep:  completedStep,
		CurrentStep:    currentStep,
		CompletedSteps: completedSteps,
		ProgressedAt:   time.Now().UTC(),
	}

	return UserOnboardingProgressedEvent{
		BaseEvent: NewBaseEvent(UserOnboardingProgressedEventType, userID.String(), data),
	}
}

// UserOnboardedEvent is emitted when a user completes the onboarding process
type UserOnboardedEvent struct {
	BaseEvent
}

// UserOnboardedEventData represents the data for a user onboarded event
type UserOnboardedEventData struct {
	UserID        uuid.UUID `json:"user_id"`
	CompletedAt   time.Time `json:"completed_at"`
	StartedAt     time.Time `json:"started_at"`
	Duration      string    `json:"duration"` // Human readable duration
	CompletedSteps []string `json:"completed_steps"`
}

// NewUserOnboardedEvent creates a new user onboarded event
func NewUserOnboardedEvent(userID uuid.UUID, startedAt, completedAt time.Time, completedSteps []string) UserOnboardedEvent {
	duration := completedAt.Sub(startedAt).String()

	data := UserOnboardedEventData{
		UserID:         userID,
		CompletedAt:    completedAt,
		StartedAt:      startedAt,
		Duration:       duration,
		CompletedSteps: completedSteps,
	}

	return UserOnboardedEvent{
		BaseEvent: NewBaseEvent(UserOnboardedEventType, userID.String(), data),
	}
}

// UserOnboardingSkippedEvent is emitted when a user skips the onboarding process
type UserOnboardingSkippedEvent struct {
	BaseEvent
}

// UserOnboardingSkippedEventData represents the data for a user onboarding skipped event
type UserOnboardingSkippedEventData struct {
	UserID       uuid.UUID `json:"user_id"`
	SkippedAt    time.Time `json:"skipped_at"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	PartialSteps []string  `json:"partial_steps"` // Steps that were completed before skipping
}

// NewUserOnboardingSkippedEvent creates a new user onboarding skipped event
func NewUserOnboardingSkippedEvent(userID uuid.UUID, startedAt *time.Time, partialSteps []string) UserOnboardingSkippedEvent {
	data := UserOnboardingSkippedEventData{
		UserID:       userID,
		SkippedAt:    time.Now().UTC(),
		StartedAt:    startedAt,
		PartialSteps: partialSteps,
	}

	return UserOnboardingSkippedEvent{
		BaseEvent: NewBaseEvent(UserOnboardingSkippedEventType, userID.String(), data),
	}
}
