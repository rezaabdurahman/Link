package features

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// FeatureFlag represents a feature flag configuration
type FeatureFlag struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Key         string     `json:"key" db:"key"`
	Name        string     `json:"name" db:"name"`
	Description *string    `json:"description,omitempty" db:"description"`
	Type        FlagType   `json:"type" db:"type"`
	Enabled     bool       `json:"enabled" db:"enabled"`
	Archived    bool       `json:"archived" db:"archived"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy   *string    `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy   *string    `json:"updated_by,omitempty" db:"updated_by"`
}

// FlagType defines the different types of feature flags
type FlagType string

const (
	FlagTypeBoolean    FlagType = "boolean"
	FlagTypePercentage FlagType = "percentage"
	FlagTypeVariant    FlagType = "variant"
	FlagTypeExperiment FlagType = "experiment"
)

// FeatureEnvironment represents different deployment environments
type FeatureEnvironment struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description,omitempty" db:"description"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// FeatureFlagConfig holds environment-specific configuration
type FeatureFlagConfig struct {
	ID                 uuid.UUID               `json:"id" db:"id"`
	FeatureFlagID      uuid.UUID              `json:"feature_flag_id" db:"feature_flag_id"`
	EnvironmentID      uuid.UUID              `json:"environment_id" db:"environment_id"`
	Enabled            bool                   `json:"enabled" db:"enabled"`
	RolloutPercentage  *int                   `json:"rollout_percentage,omitempty" db:"rollout_percentage"`
	TargetingRules     map[string]interface{} `json:"targeting_rules" db:"targeting_rules"`
	CreatedAt          time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at" db:"updated_at"`
}

// Experiment represents an A/B test experiment
type Experiment struct {
	ID                uuid.UUID        `json:"id" db:"id"`
	Key               string           `json:"key" db:"key"`
	Name              string           `json:"name" db:"name"`
	Description       *string          `json:"description,omitempty" db:"description"`
	FeatureFlagID     *uuid.UUID       `json:"feature_flag_id,omitempty" db:"feature_flag_id"`
	Status            ExperimentStatus `json:"status" db:"status"`
	StartDate         *time.Time       `json:"start_date,omitempty" db:"start_date"`
	EndDate           *time.Time       `json:"end_date,omitempty" db:"end_date"`
	TrafficAllocation int              `json:"traffic_allocation" db:"traffic_allocation"`
	CreatedAt         time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at" db:"updated_at"`
	CreatedBy         *string          `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy         *string          `json:"updated_by,omitempty" db:"updated_by"`
	Variants          []ExperimentVariant `json:"variants,omitempty"`
}

// ExperimentStatus defines the lifecycle states of an experiment
type ExperimentStatus string

const (
	ExperimentStatusDraft     ExperimentStatus = "draft"
	ExperimentStatusRunning   ExperimentStatus = "running"
	ExperimentStatusPaused    ExperimentStatus = "paused"
	ExperimentStatusCompleted ExperimentStatus = "completed"
	ExperimentStatusArchived  ExperimentStatus = "archived"
)

// ExperimentVariant represents a variant in an A/B test
type ExperimentVariant struct {
	ID           uuid.UUID               `json:"id" db:"id"`
	ExperimentID uuid.UUID              `json:"experiment_id" db:"experiment_id"`
	Key          string                 `json:"key" db:"key"`
	Name         string                 `json:"name" db:"name"`
	Description  *string                `json:"description,omitempty" db:"description"`
	Weight       int                    `json:"weight" db:"weight"`
	IsControl    bool                   `json:"is_control" db:"is_control"`
	Payload      map[string]interface{} `json:"payload" db:"payload"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
}

// ExperimentConfig holds environment-specific experiment configuration
type ExperimentConfig struct {
	ID            uuid.UUID `json:"id" db:"id"`
	ExperimentID  uuid.UUID `json:"experiment_id" db:"experiment_id"`
	EnvironmentID uuid.UUID `json:"environment_id" db:"environment_id"`
	Enabled       bool      `json:"enabled" db:"enabled"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// UserAssignment tracks user assignments for consistent delivery
type UserAssignment struct {
	ID            uuid.UUID               `json:"id" db:"id"`
	UserID        uuid.UUID              `json:"user_id" db:"user_id"`
	FeatureFlagID *uuid.UUID             `json:"feature_flag_id,omitempty" db:"feature_flag_id"`
	ExperimentID  *uuid.UUID             `json:"experiment_id,omitempty" db:"experiment_id"`
	VariantID     *uuid.UUID             `json:"variant_id,omitempty" db:"variant_id"`
	EnvironmentID uuid.UUID              `json:"environment_id" db:"environment_id"`
	AssignedAt    time.Time              `json:"assigned_at" db:"assigned_at"`
	Sticky        bool                   `json:"sticky" db:"sticky"`
	Context       map[string]interface{} `json:"context" db:"context"`
}

// UserSegment defines user targeting criteria
type UserSegment struct {
	ID          uuid.UUID                `json:"id" db:"id"`
	Key         string                   `json:"key" db:"key"`
	Name        string                   `json:"name" db:"name"`
	Description *string                  `json:"description,omitempty" db:"description"`
	Conditions  []map[string]interface{} `json:"conditions" db:"conditions"`
	CreatedAt   time.Time                `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at" db:"updated_at"`
	CreatedBy   *string                  `json:"created_by,omitempty" db:"created_by"`
}

// FeatureEvent represents analytics events for feature usage
type FeatureEvent struct {
	ID            uuid.UUID               `json:"id" db:"id"`
	EventType     string                 `json:"event_type" db:"event_type"`
	UserID        *uuid.UUID             `json:"user_id,omitempty" db:"user_id"`
	FeatureFlagID *uuid.UUID             `json:"feature_flag_id,omitempty" db:"feature_flag_id"`
	ExperimentID  *uuid.UUID             `json:"experiment_id,omitempty" db:"experiment_id"`
	VariantID     *uuid.UUID             `json:"variant_id,omitempty" db:"variant_id"`
	EnvironmentID uuid.UUID              `json:"environment_id" db:"environment_id"`
	Properties    map[string]interface{} `json:"properties" db:"properties"`
	Timestamp     time.Time              `json:"timestamp" db:"timestamp"`
}

// EvaluationContext provides context for feature flag evaluation
type EvaluationContext struct {
	UserID      *uuid.UUID             `json:"user_id,omitempty"`
	Environment string                 `json:"environment"`
	UserAttributes map[string]interface{} `json:"user_attributes,omitempty"`
	Custom      map[string]interface{} `json:"custom,omitempty"`
}

// FeatureEvaluation represents the result of evaluating a feature flag
type FeatureEvaluation struct {
	Key       string      `json:"key"`
	Enabled   bool        `json:"enabled"`
	Value     interface{} `json:"value,omitempty"`
	Variant   *string     `json:"variant,omitempty"`
	Reason    string      `json:"reason"`
	Timestamp time.Time   `json:"timestamp"`
}

// ExperimentEvaluation represents the result of evaluating an experiment
type ExperimentEvaluation struct {
	Key       string                 `json:"key"`
	VariantID *uuid.UUID             `json:"variant_id,omitempty"`
	Variant   *string                `json:"variant,omitempty"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
	InExperiment bool                `json:"in_experiment"`
	Reason    string                 `json:"reason"`
	Timestamp time.Time              `json:"timestamp"`
}

// Custom JSON marshaling for JSONB fields
func (f *FeatureFlagConfig) MarshalTargetingRules() ([]byte, error) {
	return json.Marshal(f.TargetingRules)
}

func (f *FeatureFlagConfig) UnmarshalTargetingRules(data []byte) error {
	return json.Unmarshal(data, &f.TargetingRules)
}

func (v *ExperimentVariant) MarshalPayload() ([]byte, error) {
	return json.Marshal(v.Payload)
}

func (v *ExperimentVariant) UnmarshalPayload(data []byte) error {
	return json.Unmarshal(data, &v.Payload)
}

func (u *UserAssignment) MarshalContext() ([]byte, error) {
	return json.Marshal(u.Context)
}

func (u *UserAssignment) UnmarshalContext(data []byte) error {
	return json.Unmarshal(data, &u.Context)
}

func (s *UserSegment) MarshalConditions() ([]byte, error) {
	return json.Marshal(s.Conditions)
}

func (s *UserSegment) UnmarshalConditions(data []byte) error {
	return json.Unmarshal(data, &s.Conditions)
}

func (e *FeatureEvent) MarshalProperties() ([]byte, error) {
	return json.Marshal(e.Properties)
}

func (e *FeatureEvent) UnmarshalProperties(data []byte) error {
	return json.Unmarshal(data, &e.Properties)
}