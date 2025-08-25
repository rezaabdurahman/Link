package features

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// DefaultFeatureManager implements the FeatureManager interface
type DefaultFeatureManager struct {
	repo      FeatureRepository
	cache     FeatureCache
	evaluator FeatureEvaluator
	hasher    AssignmentHasher
	segmentEvaluator SegmentEvaluator
	cacheTTL  time.Duration
	logger    Logger
}

// Logger interface for pluggable logging
type Logger interface {
	Infof(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Warnf(format string, args ...interface{})
}

// DefaultLogger provides a basic logger implementation
type DefaultLogger struct{}

func (l *DefaultLogger) Infof(format string, args ...interface{}) {
	log.Printf("[INFO] "+format, args...)
}

func (l *DefaultLogger) Errorf(format string, args ...interface{}) {
	log.Printf("[ERROR] "+format, args...)
}

func (l *DefaultLogger) Warnf(format string, args ...interface{}) {
	log.Printf("[WARN] "+format, args...)
}

// FeatureManagerConfig holds configuration for the feature manager
type FeatureManagerConfig struct {
	Repository       FeatureRepository
	Cache           FeatureCache
	Evaluator       FeatureEvaluator
	Hasher          AssignmentHasher
	SegmentEvaluator SegmentEvaluator
	CacheTTL        time.Duration
	Logger          Logger
}

// NewFeatureManager creates a new feature manager instance
func NewFeatureManager(config *FeatureManagerConfig) *DefaultFeatureManager {
	logger := config.Logger
	if logger == nil {
		logger = &DefaultLogger{}
	}

	cacheTTL := config.CacheTTL
	if cacheTTL == 0 {
		cacheTTL = 5 * time.Minute
	}

	return &DefaultFeatureManager{
		repo:             config.Repository,
		cache:            config.Cache,
		evaluator:        config.Evaluator,
		hasher:           config.Hasher,
		segmentEvaluator: config.SegmentEvaluator,
		cacheTTL:         cacheTTL,
		logger:           logger,
	}
}

// EvaluateFlag evaluates a single feature flag
func (fm *DefaultFeatureManager) EvaluateFlag(ctx context.Context, flagKey string, evalCtx *EvaluationContext) (*FeatureEvaluation, error) {
	// Check cache first
	cacheKey := fm.buildCacheKey("flag", flagKey, evalCtx)
	if cached, err := fm.getFromCache(ctx, cacheKey); err == nil && cached != nil {
		fm.logger.Infof("Cache hit for flag %s", flagKey)
		return cached, nil
	}

	// Get flag from repository
	flag, err := fm.repo.GetFeatureFlag(ctx, flagKey)
	if err != nil {
		return &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "flag_not_found",
			Timestamp: time.Now(),
		}, fmt.Errorf("failed to get feature flag %s: %w", flagKey, err)
	}

	if flag.Archived {
		result := &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "flag_archived",
			Timestamp: time.Now(),
		}
		fm.cacheEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	// Get environment
	env, err := fm.repo.GetEnvironment(ctx, evalCtx.Environment)
	if err != nil {
		return &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "environment_not_found",
			Timestamp: time.Now(),
		}, fmt.Errorf("failed to get environment %s: %w", evalCtx.Environment, err)
	}

	// Get flag config for environment
	config, err := fm.repo.GetFeatureFlagConfig(ctx, flag.ID, env.ID)
	if err != nil {
		// If no config exists, use default disabled state
		result := &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "no_config",
			Timestamp: time.Now(),
		}
		fm.cacheEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	if !config.Enabled {
		result := &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "flag_disabled",
			Timestamp: time.Now(),
		}
		fm.cacheEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	// Evaluate based on flag type
	var result *FeatureEvaluation
	switch flag.Type {
	case FlagTypeBoolean:
		result, err = fm.evaluator.EvaluateBoolean(ctx, flag, config, evalCtx)
	case FlagTypePercentage:
		result, err = fm.evaluator.EvaluatePercentage(ctx, flag, config, evalCtx)
	case FlagTypeVariant:
		result, err = fm.evaluator.EvaluateVariant(ctx, flag, config, evalCtx)
	default:
		result = &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "unsupported_flag_type",
			Timestamp: time.Now(),
		}
	}

	if err != nil {
		fm.logger.Errorf("Failed to evaluate flag %s: %v", flagKey, err)
		result = &FeatureEvaluation{
			Key:       flagKey,
			Enabled:   false,
			Reason:    "evaluation_error",
			Timestamp: time.Now(),
		}
	}

	// Cache the result
	fm.cacheEvaluation(ctx, cacheKey, result)

	// Track evaluation event
	go fm.trackFlagEvaluation(context.Background(), flag, env, evalCtx, result)

	return result, err
}

// EvaluateExperiment evaluates an A/B test experiment
func (fm *DefaultFeatureManager) EvaluateExperiment(ctx context.Context, experimentKey string, evalCtx *EvaluationContext) (*ExperimentEvaluation, error) {
	// Check cache first
	cacheKey := fm.buildCacheKey("experiment", experimentKey, evalCtx)
	if cached, err := fm.getExperimentFromCache(ctx, cacheKey); err == nil && cached != nil {
		fm.logger.Infof("Cache hit for experiment %s", experimentKey)
		return cached, nil
	}

	// Get experiment from repository
	experiment, err := fm.repo.GetExperiment(ctx, experimentKey)
	if err != nil {
		return &ExperimentEvaluation{
			Key:          experimentKey,
			InExperiment: false,
			Reason:       "experiment_not_found",
			Timestamp:    time.Now(),
		}, fmt.Errorf("failed to get experiment %s: %w", experimentKey, err)
	}

	if experiment.Status != ExperimentStatusRunning {
		result := &ExperimentEvaluation{
			Key:          experimentKey,
			InExperiment: false,
			Reason:       "experiment_not_running",
			Timestamp:    time.Now(),
		}
		fm.cacheExperimentEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	// Check if experiment is within date range
	now := time.Now()
	if experiment.StartDate != nil && now.Before(*experiment.StartDate) {
		result := &ExperimentEvaluation{
			Key:          experimentKey,
			InExperiment: false,
			Reason:       "experiment_not_started",
			Timestamp:    time.Now(),
		}
		fm.cacheExperimentEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	if experiment.EndDate != nil && now.After(*experiment.EndDate) {
		result := &ExperimentEvaluation{
			Key:          experimentKey,
			InExperiment: false,
			Reason:       "experiment_ended",
			Timestamp:    time.Now(),
		}
		fm.cacheExperimentEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	// Get variants
	variants, err := fm.repo.GetExperimentVariants(ctx, experiment.ID)
	if err != nil || len(variants) == 0 {
		result := &ExperimentEvaluation{
			Key:          experimentKey,
			InExperiment: false,
			Reason:       "no_variants",
			Timestamp:    time.Now(),
		}
		fm.cacheExperimentEvaluation(ctx, cacheKey, result)
		return result, nil
	}

	// Evaluate experiment
	result, err := fm.evaluator.EvaluateExperiment(ctx, experiment, variants, evalCtx)
	if err != nil {
		fm.logger.Errorf("Failed to evaluate experiment %s: %v", experimentKey, err)
		result = &ExperimentEvaluation{
			Key:          experimentKey,
			InExperiment: false,
			Reason:       "evaluation_error",
			Timestamp:    time.Now(),
		}
	}

	// Cache the result
	fm.cacheExperimentEvaluation(ctx, cacheKey, result)

	// Track evaluation event
	go fm.trackExperimentEvaluation(context.Background(), experiment, evalCtx, result)

	return result, err
}

// EvaluateFlags evaluates multiple feature flags in batch
func (fm *DefaultFeatureManager) EvaluateFlags(ctx context.Context, flagKeys []string, evalCtx *EvaluationContext) (map[string]*FeatureEvaluation, error) {
	results := make(map[string]*FeatureEvaluation)
	
	for _, key := range flagKeys {
		result, err := fm.EvaluateFlag(ctx, key, evalCtx)
		if err != nil {
			fm.logger.Errorf("Failed to evaluate flag %s: %v", key, err)
		}
		results[key] = result
	}
	
	return results, nil
}

// GetAllFlags returns all feature flags for a context (for frontend SDK)
func (fm *DefaultFeatureManager) GetAllFlags(ctx context.Context, evalCtx *EvaluationContext) (map[string]*FeatureEvaluation, error) {
	// Get all non-archived flags
	flags, err := fm.repo.GetFeatureFlags(ctx, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get feature flags: %w", err)
	}

	flagKeys := make([]string, len(flags))
	for i, flag := range flags {
		flagKeys[i] = flag.Key
	}

	return fm.EvaluateFlags(ctx, flagKeys, evalCtx)
}

// TrackEvent tracks a feature event
func (fm *DefaultFeatureManager) TrackEvent(ctx context.Context, event *FeatureEvent) error {
	return fm.repo.CreateFeatureEvent(ctx, event)
}

// InvalidateCache invalidates cache entries
func (fm *DefaultFeatureManager) InvalidateCache(ctx context.Context, keys ...string) error {
	for _, key := range keys {
		if err := fm.cache.DeletePattern(ctx, "*"+key+"*"); err != nil {
			fm.logger.Errorf("Failed to invalidate cache for key %s: %v", key, err)
		}
	}
	return nil
}

// Helper methods

func (fm *DefaultFeatureManager) buildCacheKey(prefix, key string, evalCtx *EvaluationContext) string {
	userID := "anonymous"
	if evalCtx.UserID != nil {
		userID = evalCtx.UserID.String()
	}
	return fmt.Sprintf("%s:%s:%s:%s", prefix, evalCtx.Environment, key, userID)
}

func (fm *DefaultFeatureManager) getFromCache(ctx context.Context, key string) (*FeatureEvaluation, error) {
	data, err := fm.cache.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	var evaluation FeatureEvaluation
	if err := json.Unmarshal(data, &evaluation); err != nil {
		return nil, err
	}

	return &evaluation, nil
}

func (fm *DefaultFeatureManager) getExperimentFromCache(ctx context.Context, key string) (*ExperimentEvaluation, error) {
	data, err := fm.cache.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	var evaluation ExperimentEvaluation
	if err := json.Unmarshal(data, &evaluation); err != nil {
		return nil, err
	}

	return &evaluation, nil
}

func (fm *DefaultFeatureManager) cacheEvaluation(ctx context.Context, key string, evaluation *FeatureEvaluation) {
	data, err := json.Marshal(evaluation)
	if err != nil {
		fm.logger.Errorf("Failed to marshal evaluation for caching: %v", err)
		return
	}

	if err := fm.cache.Set(ctx, key, data, fm.cacheTTL); err != nil {
		fm.logger.Errorf("Failed to cache evaluation: %v", err)
	}
}

func (fm *DefaultFeatureManager) cacheExperimentEvaluation(ctx context.Context, key string, evaluation *ExperimentEvaluation) {
	data, err := json.Marshal(evaluation)
	if err != nil {
		fm.logger.Errorf("Failed to marshal experiment evaluation for caching: %v", err)
		return
	}

	if err := fm.cache.Set(ctx, key, data, fm.cacheTTL); err != nil {
		fm.logger.Errorf("Failed to cache experiment evaluation: %v", err)
	}
}

func (fm *DefaultFeatureManager) trackFlagEvaluation(ctx context.Context, flag *FeatureFlag, env *FeatureEnvironment, evalCtx *EvaluationContext, result *FeatureEvaluation) {
	event := &FeatureEvent{
		EventType:     "flag_evaluated",
		UserID:        evalCtx.UserID,
		FeatureFlagID: &flag.ID,
		EnvironmentID: env.ID,
		Properties: map[string]interface{}{
			"flag_key": flag.Key,
			"enabled":  result.Enabled,
			"reason":   result.Reason,
		},
		Timestamp: time.Now(),
	}

	if err := fm.repo.CreateFeatureEvent(ctx, event); err != nil {
		fm.logger.Errorf("Failed to track flag evaluation event: %v", err)
	}
}

func (fm *DefaultFeatureManager) trackExperimentEvaluation(ctx context.Context, experiment *Experiment, evalCtx *EvaluationContext, result *ExperimentEvaluation) {
	event := &FeatureEvent{
		EventType:     "experiment_evaluated",
		UserID:        evalCtx.UserID,
		ExperimentID:  &experiment.ID,
		VariantID:     result.VariantID,
		Properties: map[string]interface{}{
			"experiment_key": experiment.Key,
			"in_experiment":  result.InExperiment,
			"variant":        result.Variant,
			"reason":         result.Reason,
		},
		Timestamp: time.Now(),
	}

	if err := fm.repo.CreateFeatureEvent(ctx, event); err != nil {
		fm.logger.Errorf("Failed to track experiment evaluation event: %v", err)
	}
}