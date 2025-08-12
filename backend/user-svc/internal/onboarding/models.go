package onboarding

import (
	"time"

	"github.com/google/uuid"
)

// OnboardingStatus represents the current onboarding status of a user
type OnboardingStatus string

const (
	OnboardingStatusPending    OnboardingStatus = "pending"
	OnboardingStatusInProgress OnboardingStatus = "in_progress"
	OnboardingStatusCompleted  OnboardingStatus = "completed"
	OnboardingStatusSkipped    OnboardingStatus = "skipped"
)

// OnboardingStep represents an individual step in the onboarding process
type OnboardingStep string

const (
	StepProfileSetup     OnboardingStep = "profile_setup"
	StepPreferences      OnboardingStep = "preferences"
	StepFindFriends      OnboardingStep = "find_friends"
	StepNotifications    OnboardingStep = "notifications"
	StepTutorial         OnboardingStep = "tutorial"
)

// OnboardingProgress tracks a user's progress through onboarding
type OnboardingProgress struct {
	ID            uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID        uuid.UUID        `json:"user_id" gorm:"type:uuid;not null;uniqueIndex"`
	Status        OnboardingStatus `json:"status" gorm:"type:varchar(20);default:'pending'"`
	CurrentStep   *OnboardingStep  `json:"current_step" gorm:"type:varchar(50)"`
	CompletedSteps []string         `json:"completed_steps" gorm:"type:jsonb"`
	StartedAt     *time.Time       `json:"started_at"`
	CompletedAt   *time.Time       `json:"completed_at"`
	CreatedAt     time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
}

// UserPreferences represents user preferences set during onboarding
type UserPreferences struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID           uuid.UUID `json:"user_id" gorm:"type:uuid;not null;uniqueIndex"`
	EmailNotifications   bool      `json:"email_notifications" gorm:"default:true"`
	PushNotifications    bool      `json:"push_notifications" gorm:"default:true"`
	FriendRequests       bool      `json:"friend_requests" gorm:"default:true"`
	ActivityUpdates      bool      `json:"activity_updates" gorm:"default:true"`
	NewsletterOptIn      bool      `json:"newsletter_opt_in" gorm:"default:false"`
	PrivacyLevel         string    `json:"privacy_level" gorm:"type:varchar(20);default:'friends'"` // public, friends, private
	CreatedAt            time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt            time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// OnboardingStep represents the completion status of individual steps
type CompletedSteps struct {
	ProfileSetup  bool `json:"profile_setup"`
	Preferences   bool `json:"preferences"`
	FindFriends   bool `json:"find_friends"`
	Notifications bool `json:"notifications"`
	Tutorial      bool `json:"tutorial"`
}
