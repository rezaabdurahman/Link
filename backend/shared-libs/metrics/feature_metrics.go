package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Feature flag evaluation metrics
	FlagEvaluationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "feature_flag_evaluations_total",
			Help: "Total number of feature flag evaluations",
		},
		[]string{"flag_key", "enabled", "reason", "environment"},
	)

	FlagEvaluationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "feature_flag_evaluation_duration_seconds",
			Help:    "Duration of feature flag evaluations",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"flag_key", "environment"},
	)

	FlagEvaluationErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "feature_flag_evaluation_errors_total",
			Help: "Total number of feature flag evaluation errors",
		},
		[]string{"flag_key", "error_type", "environment"},
	)

	// Experiment evaluation metrics
	ExperimentEvaluationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "experiment_evaluations_total",
			Help: "Total number of experiment evaluations",
		},
		[]string{"experiment_key", "variant", "in_experiment", "reason", "environment"},
	)

	ExperimentConversions = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "experiment_conversions_total",
			Help: "Total number of experiment conversions",
		},
		[]string{"experiment_key", "variant", "conversion_type", "environment"},
	)

	// Cache metrics
	FeatureCacheHitsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "feature_cache_hits_total",
			Help: "Total number of cache hits for features",
		},
		[]string{"cache_type", "key_type"},
	)

	FeatureCacheMissesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "feature_cache_misses_total",
			Help: "Total number of cache misses for features",
		},
		[]string{"cache_type", "key_type"},
	)
)

// Helper functions for recording feature-specific metrics

// RecordFlagEvaluation records metrics for feature flag evaluation
func RecordFlagEvaluation(flagKey string, enabled bool, reason string, environment string, duration time.Duration) {
	FlagEvaluationsTotal.WithLabelValues(flagKey, boolToString(enabled), reason, environment).Inc()
	FlagEvaluationDuration.WithLabelValues(flagKey, environment).Observe(duration.Seconds())
}

// RecordFlagEvaluationError records metrics for feature flag evaluation errors
func RecordFlagEvaluationError(flagKey string, errorType string, environment string) {
	FlagEvaluationErrors.WithLabelValues(flagKey, errorType, environment).Inc()
}

// RecordExperimentEvaluation records metrics for experiment evaluation
func RecordExperimentEvaluation(experimentKey string, variant string, inExperiment bool, reason string, environment string, duration time.Duration) {
	ExperimentEvaluationsTotal.WithLabelValues(experimentKey, variant, boolToString(inExperiment), reason, environment).Inc()
}

// RecordExperimentConversion records metrics for experiment conversions
func RecordExperimentConversion(experimentKey string, variant string, conversionType string, environment string) {
	ExperimentConversions.WithLabelValues(experimentKey, variant, conversionType, environment).Inc()
}

// RecordFeatureCacheHit records cache hit metrics
func RecordFeatureCacheHit(cacheType string, keyType string) {
	FeatureCacheHitsTotal.WithLabelValues(cacheType, keyType).Inc()
}

// RecordFeatureCacheMiss records cache miss metrics
func RecordFeatureCacheMiss(cacheType string, keyType string) {
	FeatureCacheMissesTotal.WithLabelValues(cacheType, keyType).Inc()
}

// Helper function to convert bool to string
func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}