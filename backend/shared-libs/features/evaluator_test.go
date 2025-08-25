package features

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFlagEvaluator_EvaluateBoolean(t *testing.T) {
	evaluator := &FlagEvaluator{}
	
	t.Run("should evaluate enabled boolean flag as true", func(t *testing.T) {
		flag := &FeatureFlag{
			Key:     "test_flag",
			Type:    FlagTypeBoolean,
			Enabled: true,
			Value:   "true",
		}

		evalCtx := &EvaluationContext{
			UserID: "user-123",
		}

		result := evaluator.EvaluateFlag(flag, evalCtx)

		assert.True(t, result.Enabled)
		assert.Equal(t, true, result.Value)
		assert.Equal(t, "FLAG_ENABLED", result.Reason)
	})

	t.Run("should evaluate disabled boolean flag as false", func(t *testing.T) {
		flag := &FeatureFlag{
			Key:     "test_flag",
			Type:    FlagTypeBoolean,
			Enabled: false,
			Value:   "false",
		}

		evalCtx := &EvaluationContext{
			UserID: "user-123",
		}

		result := evaluator.EvaluateFlag(flag, evalCtx)

		assert.False(t, result.Enabled)
		assert.Equal(t, false, result.Value)
		assert.Equal(t, "FLAG_DISABLED", result.Reason)
	})
}

func TestFlagEvaluator_EvaluatePercentage(t *testing.T) {
	evaluator := &FlagEvaluator{}

	t.Run("should evaluate percentage rollout consistently", func(t *testing.T) {
		flag := &FeatureFlag{
			Key:     "percentage_flag",
			Type:    FlagTypePercentage,
			Enabled: true,
			Value:   "50", // 50% rollout
		}

		evalCtx := &EvaluationContext{
			UserID: "consistent-user-id",
		}

		// Evaluate multiple times with same user - should be consistent
		results := make([]bool, 10)
		for i := 0; i < 10; i++ {
			result := evaluator.EvaluateFlag(flag, evalCtx)
			results[i] = result.Value.(bool)
		}

		// All results should be the same for the same user
		for i := 1; i < len(results); i++ {
			assert.Equal(t, results[0], results[i], "Results should be consistent for same user")
		}
	})

	t.Run("should respect percentage bounds", func(t *testing.T) {
		// Test 0% rollout
		flag := &FeatureFlag{
			Key:     "zero_percent",
			Type:    FlagTypePercentage,
			Enabled: true,
			Value:   "0",
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateFlag(flag, evalCtx)
		assert.False(t, result.Value.(bool))

		// Test 100% rollout
		flag.Value = "100"
		result = evaluator.EvaluateFlag(flag, evalCtx)
		assert.True(t, result.Value.(bool))
	})
}

func TestFlagEvaluator_EvaluateVariant(t *testing.T) {
	evaluator := &FlagEvaluator{}

	t.Run("should select variant based on user hash", func(t *testing.T) {
		flag := &FeatureFlag{
			Key:     "variant_flag",
			Type:    FlagTypeVariant,
			Enabled: true,
			Value:   `{"variants": [{"name": "red", "weight": 50}, {"name": "blue", "weight": 50}]}`,
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateFlag(flag, evalCtx)

		assert.True(t, result.Enabled)
		assert.Contains(t, []string{"red", "blue"}, result.Variant)
		assert.Equal(t, "VARIANT_ASSIGNED", result.Reason)
	})

	t.Run("should handle single variant", func(t *testing.T) {
		flag := &FeatureFlag{
			Key:     "single_variant_flag",
			Type:    FlagTypeVariant,
			Enabled: true,
			Value:   `{"variants": [{"name": "only", "weight": 100}]}`,
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateFlag(flag, evalCtx)

		assert.True(t, result.Enabled)
		assert.Equal(t, "only", result.Variant)
	})

	t.Run("should handle invalid variant JSON", func(t *testing.T) {
		flag := &FeatureFlag{
			Key:     "invalid_variant_flag",
			Type:    FlagTypeVariant,
			Enabled: true,
			Value:   `invalid json`,
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateFlag(flag, evalCtx)

		assert.False(t, result.Enabled)
		assert.Equal(t, false, result.Value)
		assert.Contains(t, result.Reason, "EVALUATION_ERROR")
	})
}

func TestExperimentEvaluator_EvaluateExperiment(t *testing.T) {
	evaluator := &ExperimentEvaluator{}

	t.Run("should assign variant based on weights", func(t *testing.T) {
		experiment := &Experiment{
			Key:               "test_experiment",
			Status:            ExperimentStatusActive,
			TrafficAllocation: 100,
			Variants: []ExperimentVariant{
				{Name: "control", Weight: 50, Config: `{"version": "old"}`},
				{Name: "treatment", Weight: 50, Config: `{"version": "new"}`},
			},
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateExperiment(experiment, evalCtx)

		assert.True(t, result.InExperiment)
		assert.Contains(t, []string{"control", "treatment"}, result.Variant)
		assert.Equal(t, "USER_IN_EXPERIMENT", result.Reason)
	})

	t.Run("should handle traffic allocation", func(t *testing.T) {
		experiment := &Experiment{
			Key:               "low_traffic_experiment",
			Status:            ExperimentStatusActive,
			TrafficAllocation: 0, // No traffic
			Variants: []ExperimentVariant{
				{Name: "control", Weight: 50, Config: `{"version": "old"}`},
				{Name: "treatment", Weight: 50, Config: `{"version": "new"}`},
			},
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateExperiment(experiment, evalCtx)

		assert.False(t, result.InExperiment)
		assert.Equal(t, "control", result.Variant)
		assert.Equal(t, "NOT_IN_TRAFFIC", result.Reason)
	})

	t.Run("should handle inactive experiment", func(t *testing.T) {
		experiment := &Experiment{
			Key:               "inactive_experiment",
			Status:            ExperimentStatusInactive,
			TrafficAllocation: 100,
			Variants: []ExperimentVariant{
				{Name: "control", Weight: 100, Config: `{"version": "old"}`},
			},
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateExperiment(experiment, evalCtx)

		assert.False(t, result.InExperiment)
		assert.Equal(t, "control", result.Variant)
		assert.Equal(t, "EXPERIMENT_INACTIVE", result.Reason)
	})

	t.Run("should handle experiment without variants", func(t *testing.T) {
		experiment := &Experiment{
			Key:               "no_variants_experiment",
			Status:            ExperimentStatusActive,
			TrafficAllocation: 100,
			Variants:          []ExperimentVariant{},
		}

		evalCtx := &EvaluationContext{
			UserID: "test-user",
		}

		result := evaluator.EvaluateExperiment(experiment, evalCtx)

		assert.False(t, result.InExperiment)
		assert.Equal(t, "control", result.Variant)
		assert.Equal(t, "NO_VARIANTS", result.Reason)
	})
}