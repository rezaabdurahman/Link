package features

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DefaultFeatureEvaluator implements the FeatureEvaluator interface
type DefaultFeatureEvaluator struct {
	hasher           AssignmentHasher
	segmentEvaluator SegmentEvaluator
	repo             FeatureRepository
}

// NewFeatureEvaluator creates a new feature evaluator
func NewFeatureEvaluator(hasher AssignmentHasher, segmentEvaluator SegmentEvaluator, repo FeatureRepository) *DefaultFeatureEvaluator {
	return &DefaultFeatureEvaluator{
		hasher:           hasher,
		segmentEvaluator: segmentEvaluator,
		repo:             repo,
	}
}

// EvaluateBoolean evaluates a boolean feature flag
func (e *DefaultFeatureEvaluator) EvaluateBoolean(ctx context.Context, flag *FeatureFlag, config *FeatureFlagConfig, evalCtx *EvaluationContext) (*FeatureEvaluation, error) {
	// Check targeting rules first
	if len(config.TargetingRules) > 0 {
		targetingResult, err := e.evaluateTargetingRules(ctx, config.TargetingRules, evalCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate targeting rules: %w", err)
		}
		
		if targetingResult != nil {
			return &FeatureEvaluation{
				Key:       flag.Key,
				Enabled:   *targetingResult,
				Value:     *targetingResult,
				Reason:    "targeting_rule",
				Timestamp: time.Now(),
			}, nil
		}
	}

	// Default to flag enabled state
	return &FeatureEvaluation{
		Key:       flag.Key,
		Enabled:   config.Enabled,
		Value:     config.Enabled,
		Reason:    "default",
		Timestamp: time.Now(),
	}, nil
}

// EvaluatePercentage evaluates a percentage-based feature flag
func (e *DefaultFeatureEvaluator) EvaluatePercentage(ctx context.Context, flag *FeatureFlag, config *FeatureFlagConfig, evalCtx *EvaluationContext) (*FeatureEvaluation, error) {
	// Check targeting rules first
	if len(config.TargetingRules) > 0 {
		targetingResult, err := e.evaluateTargetingRules(ctx, config.TargetingRules, evalCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate targeting rules: %w", err)
		}
		
		if targetingResult != nil {
			return &FeatureEvaluation{
				Key:       flag.Key,
				Enabled:   *targetingResult,
				Value:     *targetingResult,
				Reason:    "targeting_rule",
				Timestamp: time.Now(),
			}, nil
		}
	}

	// Check for existing sticky assignment
	if evalCtx.UserID != nil {
		env, err := e.repo.GetEnvironment(ctx, evalCtx.Environment)
		if err == nil {
			if assignment, err := e.repo.GetUserAssignment(ctx, *evalCtx.UserID, env.ID, flag.Key); err == nil && assignment != nil {
				enabled := assignment.FeatureFlagID != nil
				return &FeatureEvaluation{
					Key:       flag.Key,
					Enabled:   enabled,
					Value:     enabled,
					Reason:    "sticky_assignment",
					Timestamp: time.Now(),
				}, nil
			}
		}
	}

	// Use percentage rollout
	rollout := 0
	if config.RolloutPercentage != nil {
		rollout = *config.RolloutPercentage
	}

	enabled := false
	reason := "rollout_excluded"

	if evalCtx.UserID != nil && rollout > 0 {
		userHash := e.hasher.HashToPercentage(evalCtx.UserID.String(), flag.Key, flag.ID.String())
		if userHash <= rollout {
			enabled = true
			reason = "rollout_included"
		}

		// Create sticky assignment
		go e.createUserAssignment(context.Background(), *evalCtx.UserID, flag, enabled, evalCtx.Environment)
	}

	return &FeatureEvaluation{
		Key:       flag.Key,
		Enabled:   enabled,
		Value:     enabled,
		Reason:    reason,
		Timestamp: time.Now(),
	}, nil
}

// EvaluateVariant evaluates a variant-based feature flag
func (e *DefaultFeatureEvaluator) EvaluateVariant(ctx context.Context, flag *FeatureFlag, config *FeatureFlagConfig, evalCtx *EvaluationContext) (*FeatureEvaluation, error) {
	// Check targeting rules first
	if len(config.TargetingRules) > 0 {
		targetingResult, err := e.evaluateTargetingRules(ctx, config.TargetingRules, evalCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate targeting rules: %w", err)
		}
		
		if targetingResult != nil {
			variant := "control"
			if *targetingResult {
				variant = "treatment"
			}
			
			return &FeatureEvaluation{
				Key:       flag.Key,
				Enabled:   *targetingResult,
				Value:     variant,
				Variant:   &variant,
				Reason:    "targeting_rule",
				Timestamp: time.Now(),
			}, nil
		}
	}

	// For variant flags, we need to implement variant selection logic
	// This is a simplified implementation - in practice, you'd define variants in the config
	variant := "control"
	enabled := false
	
	if evalCtx.UserID != nil && config.RolloutPercentage != nil && *config.RolloutPercentage > 0 {
		userHash := e.hasher.HashToPercentage(evalCtx.UserID.String(), flag.Key, flag.ID.String())
		if userHash <= *config.RolloutPercentage {
			enabled = true
			// Simple A/B split - in practice, you'd have more sophisticated variant selection
			if userHash <= (*config.RolloutPercentage / 2) {
				variant = "variant_a"
			} else {
				variant = "variant_b"
			}
		}
	}

	return &FeatureEvaluation{
		Key:       flag.Key,
		Enabled:   enabled,
		Value:     variant,
		Variant:   &variant,
		Reason:    "variant_assignment",
		Timestamp: time.Now(),
	}, nil
}

// EvaluateExperiment evaluates an A/B test experiment
func (e *DefaultFeatureEvaluator) EvaluateExperiment(ctx context.Context, experiment *Experiment, variants []*ExperimentVariant, evalCtx *EvaluationContext) (*ExperimentEvaluation, error) {
	// Check if user is in experiment traffic allocation
	if evalCtx.UserID == nil {
		return &ExperimentEvaluation{
			Key:          experiment.Key,
			InExperiment: false,
			Reason:       "no_user_id",
			Timestamp:    time.Now(),
		}, nil
	}

	// Check for existing sticky assignment
	env, err := e.repo.GetEnvironment(ctx, evalCtx.Environment)
	if err != nil {
		return nil, fmt.Errorf("failed to get environment: %w", err)
	}

	if assignment, err := e.repo.GetUserAssignment(ctx, *evalCtx.UserID, env.ID, experiment.Key); err == nil && assignment != nil {
		if assignment.VariantID != nil {
			// Find the variant
			var selectedVariant *ExperimentVariant
			for _, variant := range variants {
				if variant.ID == *assignment.VariantID {
					selectedVariant = variant
					break
				}
			}

			if selectedVariant != nil {
				variantKey := selectedVariant.Key
				return &ExperimentEvaluation{
					Key:          experiment.Key,
					VariantID:    &selectedVariant.ID,
					Variant:      &variantKey,
					Payload:      selectedVariant.Payload,
					InExperiment: true,
					Reason:       "sticky_assignment",
					Timestamp:    time.Now(),
				}, nil
			}
		}
	}

	// Check traffic allocation
	trafficHash := e.hasher.HashToPercentage(evalCtx.UserID.String(), experiment.Key, experiment.ID.String())
	if trafficHash > experiment.TrafficAllocation {
		return &ExperimentEvaluation{
			Key:          experiment.Key,
			InExperiment: false,
			Reason:       "traffic_excluded",
			Timestamp:    time.Now(),
		}, nil
	}

	// Calculate total weight
	totalWeight := 0
	for _, variant := range variants {
		totalWeight += variant.Weight
	}

	if totalWeight == 0 {
		return &ExperimentEvaluation{
			Key:          experiment.Key,
			InExperiment: false,
			Reason:       "no_variant_weights",
			Timestamp:    time.Now(),
		}, nil
	}

	// Select variant based on weights
	variantHash := e.hasher.Hash(evalCtx.UserID.String(), experiment.Key, experiment.ID.String()) % totalWeight
	cumulativeWeight := 0
	var selectedVariant *ExperimentVariant

	for _, variant := range variants {
		cumulativeWeight += variant.Weight
		if variantHash < cumulativeWeight {
			selectedVariant = variant
			break
		}
	}

	if selectedVariant == nil {
		return &ExperimentEvaluation{
			Key:          experiment.Key,
			InExperiment: false,
			Reason:       "no_variant_selected",
			Timestamp:    time.Now(),
		}, nil
	}

	// Create sticky assignment
	go e.createExperimentAssignment(context.Background(), *evalCtx.UserID, experiment, selectedVariant, evalCtx.Environment)

	variantKey := selectedVariant.Key
	return &ExperimentEvaluation{
		Key:          experiment.Key,
		VariantID:    &selectedVariant.ID,
		Variant:      &variantKey,
		Payload:      selectedVariant.Payload,
		InExperiment: true,
		Reason:       "variant_assignment",
		Timestamp:    time.Now(),
	}, nil
}

// Helper methods

func (e *DefaultFeatureEvaluator) evaluateTargetingRules(ctx context.Context, rules map[string]interface{}, evalCtx *EvaluationContext) (*bool, error) {
	// Check for segment-based targeting
	if segments, ok := rules["segments"].([]interface{}); ok && len(segments) > 0 {
		for _, segmentInterface := range segments {
			if segmentKey, ok := segmentInterface.(string); ok {
				segment, err := e.repo.GetUserSegment(ctx, segmentKey)
				if err != nil {
					continue
				}

				inSegment, err := e.segmentEvaluator.EvaluateSegment(ctx, segment, evalCtx)
				if err != nil {
					continue
				}

				if inSegment {
					enabled := true
					return &enabled, nil
				}
			}
		}
	}

	// Check for user ID targeting
	if userIDs, ok := rules["user_ids"].([]interface{}); ok && evalCtx.UserID != nil {
		userIDStr := evalCtx.UserID.String()
		for _, userIDInterface := range userIDs {
			if targetUserID, ok := userIDInterface.(string); ok && targetUserID == userIDStr {
				enabled := true
				return &enabled, nil
			}
		}
	}

	// Check for attribute-based targeting
	if attributes, ok := rules["attributes"].(map[string]interface{}); ok && evalCtx.UserAttributes != nil {
		for key, expectedValue := range attributes {
			if userValue, exists := evalCtx.UserAttributes[key]; exists {
				if userValue == expectedValue {
					enabled := true
					return &enabled, nil
				}
			}
		}
	}

	return nil, nil
}

func (e *DefaultFeatureEvaluator) createUserAssignment(ctx context.Context, userID uuid.UUID, flag *FeatureFlag, enabled bool, environment string) {
	env, err := e.repo.GetEnvironment(ctx, environment)
	if err != nil {
		return
	}

	var flagID *uuid.UUID
	if enabled {
		flagID = &flag.ID
	}

	assignment := &UserAssignment{
		UserID:        userID,
		FeatureFlagID: flagID,
		EnvironmentID: env.ID,
		AssignedAt:    time.Now(),
		Sticky:        true,
		Context:       map[string]interface{}{
			"assigned_by": "evaluator",
			"flag_key":    flag.Key,
		},
	}

	e.repo.CreateUserAssignment(ctx, assignment)
}

func (e *DefaultFeatureEvaluator) createExperimentAssignment(ctx context.Context, userID uuid.UUID, experiment *Experiment, variant *ExperimentVariant, environment string) {
	env, err := e.repo.GetEnvironment(ctx, environment)
	if err != nil {
		return
	}

	assignment := &UserAssignment{
		UserID:        userID,
		ExperimentID:  &experiment.ID,
		VariantID:     &variant.ID,
		EnvironmentID: env.ID,
		AssignedAt:    time.Now(),
		Sticky:        true,
		Context:       map[string]interface{}{
			"assigned_by":    "evaluator",
			"experiment_key": experiment.Key,
			"variant_key":    variant.Key,
		},
	}

	e.repo.CreateUserAssignment(ctx, assignment)
}