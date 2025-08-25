package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Cache metrics (generic, not feature-specific)
	CacheHitsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_type", "key_type"},
	)

	CacheMissesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_type", "key_type"},
	)

	// Service health metrics (generic)
	ServiceHealthStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "service_health_status",
			Help: "Health status of service (1 = healthy, 0 = unhealthy)",
		},
		[]string{"component"},
	)
)

// Helper functions for recording generic metrics

// RecordCacheHit records cache hit metrics
func RecordCacheHit(cacheType string, keyType string) {
	CacheHitsTotal.WithLabelValues(cacheType, keyType).Inc()
}

// RecordCacheMiss records cache miss metrics
func RecordCacheMiss(cacheType string, keyType string) {
	CacheMissesTotal.WithLabelValues(cacheType, keyType).Inc()
}

// UpdateServiceHealth updates service health metrics
func UpdateServiceHealth(component string, healthy bool) {
	if healthy {
		ServiceHealthStatus.WithLabelValues(component).Set(1)
	} else {
		ServiceHealthStatus.WithLabelValues(component).Set(0)
	}
}