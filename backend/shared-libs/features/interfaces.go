package features

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// FeatureManager is the main interface for feature flag management
type FeatureManager interface {
	// Feature flag evaluation
	EvaluateFlag(ctx context.Context, flagKey string, evalCtx *EvaluationContext) (*FeatureEvaluation, error)
	EvaluateExperiment(ctx context.Context, experimentKey string, evalCtx *EvaluationContext) (*ExperimentEvaluation, error)
	
	// Batch evaluation for performance
	EvaluateFlags(ctx context.Context, flagKeys []string, evalCtx *EvaluationContext) (map[string]*FeatureEvaluation, error)
	
	// Get all flags for a context (for frontend SDK)
	GetAllFlags(ctx context.Context, evalCtx *EvaluationContext) (map[string]*FeatureEvaluation, error)
	
	// Event tracking
	TrackEvent(ctx context.Context, event *FeatureEvent) error
	
	// Cache invalidation
	InvalidateCache(ctx context.Context, keys ...string) error
}

// FeatureRepository handles data persistence for feature flags
type FeatureRepository interface {
	// Feature flags
	GetFeatureFlag(ctx context.Context, key string) (*FeatureFlag, error)
	GetFeatureFlagByID(ctx context.Context, id uuid.UUID) (*FeatureFlag, error)
	GetFeatureFlags(ctx context.Context, archived bool) ([]*FeatureFlag, error)
	CreateFeatureFlag(ctx context.Context, flag *FeatureFlag) error
	UpdateFeatureFlag(ctx context.Context, flag *FeatureFlag) error
	DeleteFeatureFlag(ctx context.Context, id uuid.UUID) error
	
	// Feature flag configs
	GetFeatureFlagConfig(ctx context.Context, flagID, envID uuid.UUID) (*FeatureFlagConfig, error)
	GetFeatureFlagConfigs(ctx context.Context, flagID uuid.UUID) ([]*FeatureFlagConfig, error)
	GetFeatureFlagConfigsForFlag(ctx context.Context, flagID uuid.UUID) ([]*FeatureFlagConfig, error)
	CreateFeatureFlagConfig(ctx context.Context, config *FeatureFlagConfig) error
	UpdateFeatureFlagConfig(ctx context.Context, config *FeatureFlagConfig) error
	CreateOrUpdateFeatureFlagConfig(ctx context.Context, config *FeatureFlagConfig) error
	
	// Experiments
	GetExperiment(ctx context.Context, key string) (*Experiment, error)
	GetExperimentByID(ctx context.Context, id uuid.UUID) (*Experiment, error)
	GetExperiments(ctx context.Context, status ExperimentStatus) ([]*Experiment, error)
	CreateExperiment(ctx context.Context, experiment *Experiment) error
	UpdateExperiment(ctx context.Context, experiment *Experiment) error
	DeleteExperiment(ctx context.Context, id uuid.UUID) error
	
	// Experiment variants
	GetExperimentVariants(ctx context.Context, experimentID uuid.UUID) ([]*ExperimentVariant, error)
	CreateExperimentVariant(ctx context.Context, variant *ExperimentVariant) error
	UpdateExperimentVariant(ctx context.Context, variant *ExperimentVariant) error
	DeleteExperimentVariant(ctx context.Context, id uuid.UUID) error
	
	// User assignments
	GetUserAssignment(ctx context.Context, userID, envID uuid.UUID, flagKey string) (*UserAssignment, error)
	GetUserAssignments(ctx context.Context, userID, envID uuid.UUID) ([]*UserAssignment, error)
	CreateUserAssignment(ctx context.Context, assignment *UserAssignment) error
	UpdateUserAssignment(ctx context.Context, assignment *UserAssignment) error
	
	// User segments
	GetUserSegment(ctx context.Context, key string) (*UserSegment, error)
	GetUserSegments(ctx context.Context) ([]*UserSegment, error)
	CreateUserSegment(ctx context.Context, segment *UserSegment) error
	UpdateUserSegment(ctx context.Context, segment *UserSegment) error
	DeleteUserSegment(ctx context.Context, id uuid.UUID) error
	
	// Environments
	GetEnvironment(ctx context.Context, name string) (*FeatureEnvironment, error)
	GetEnvironments(ctx context.Context) ([]*FeatureEnvironment, error)
	
	// Events
	CreateFeatureEvent(ctx context.Context, event *FeatureEvent) error
	GetFeatureEvents(ctx context.Context, filters *EventFilters) ([]*FeatureEvent, error)
}

// FeatureCache handles caching of feature flag evaluations
type FeatureCache interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	DeletePattern(ctx context.Context, pattern string) error
	Exists(ctx context.Context, key string) (bool, error)
}

// SegmentEvaluator handles user segment evaluation
type SegmentEvaluator interface {
	EvaluateSegment(ctx context.Context, segment *UserSegment, evalCtx *EvaluationContext) (bool, error)
	EvaluateUserInSegments(ctx context.Context, segments []*UserSegment, evalCtx *EvaluationContext) ([]string, error)
}

// AssignmentHasher provides consistent hashing for user assignments
type AssignmentHasher interface {
	Hash(userID string, flagKey string, salt string) int
	HashToPercentage(userID string, flagKey string, salt string) int
}

// EventFilters provides filtering options for event queries
type EventFilters struct {
	UserID        *uuid.UUID         `json:"user_id,omitempty"`
	FeatureFlagID *uuid.UUID         `json:"feature_flag_id,omitempty"`
	ExperimentID  *uuid.UUID         `json:"experiment_id,omitempty"`
	EnvironmentID *uuid.UUID         `json:"environment_id,omitempty"`
	EventType     *string            `json:"event_type,omitempty"`
	StartDate     *time.Time         `json:"start_date,omitempty"`
	EndDate       *time.Time         `json:"end_date,omitempty"`
	Limit         int                `json:"limit"`
	Offset        int                `json:"offset"`
}

// FeatureEvaluator handles the core logic of feature flag evaluation
type FeatureEvaluator interface {
	EvaluateBoolean(ctx context.Context, flag *FeatureFlag, config *FeatureFlagConfig, evalCtx *EvaluationContext) (*FeatureEvaluation, error)
	EvaluatePercentage(ctx context.Context, flag *FeatureFlag, config *FeatureFlagConfig, evalCtx *EvaluationContext) (*FeatureEvaluation, error)
	EvaluateVariant(ctx context.Context, flag *FeatureFlag, config *FeatureFlagConfig, evalCtx *EvaluationContext) (*FeatureEvaluation, error)
	EvaluateExperiment(ctx context.Context, experiment *Experiment, variants []*ExperimentVariant, evalCtx *EvaluationContext) (*ExperimentEvaluation, error)
}