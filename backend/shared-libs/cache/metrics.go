package cache

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MetricsCollector collects cache performance metrics
type MetricsCollector struct {
	mu                sync.RWMutex
	operationCounts   map[string]int64
	errorCounts       map[string]int64
	latencies         map[string][]time.Duration
	startTime         time.Time
	maxLatencyBuckets int
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		operationCounts:   make(map[string]int64),
		errorCounts:       make(map[string]int64),
		latencies:         make(map[string][]time.Duration),
		startTime:         time.Now(),
		maxLatencyBuckets: 1000, // Keep last 1000 latency measurements per operation
	}
}

// RecordOperation records a cache operation
func (mc *MetricsCollector) RecordOperation(operation string, duration time.Duration, err error) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	// Count operations
	mc.operationCounts[operation]++

	// Count errors
	if err != nil {
		mc.errorCounts[operation]++
	}

	// Record latency
	if mc.latencies[operation] == nil {
		mc.latencies[operation] = make([]time.Duration, 0, mc.maxLatencyBuckets)
	}

	latencies := mc.latencies[operation]
	if len(latencies) >= mc.maxLatencyBuckets {
		// Remove oldest entry
		latencies = latencies[1:]
	}
	mc.latencies[operation] = append(latencies, duration)
}

// GetMetrics returns current metrics
func (mc *MetricsCollector) GetMetrics() CacheMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	metrics := CacheMetrics{
		OperationCounts:  make(map[string]int64),
		ErrorCounts:      make(map[string]int64),
		AverageLatencies: make(map[string]time.Duration),
		P95Latencies:     make(map[string]time.Duration),
		P99Latencies:     make(map[string]time.Duration),
		Uptime:           time.Since(mc.startTime),
	}

	// Copy operation counts
	for op, count := range mc.operationCounts {
		metrics.OperationCounts[op] = count
	}

	// Copy error counts
	for op, count := range mc.errorCounts {
		metrics.ErrorCounts[op] = count
	}

	// Calculate latency metrics
	for op, latencies := range mc.latencies {
		if len(latencies) > 0 {
			metrics.AverageLatencies[op] = calculateAverage(latencies)
			metrics.P95Latencies[op] = calculatePercentile(latencies, 0.95)
			metrics.P99Latencies[op] = calculatePercentile(latencies, 0.99)
		}
	}

	// Calculate error rates
	metrics.ErrorRates = make(map[string]float64)
	for op, errorCount := range mc.errorCounts {
		totalCount := mc.operationCounts[op]
		if totalCount > 0 {
			metrics.ErrorRates[op] = float64(errorCount) / float64(totalCount)
		}
	}

	return metrics
}

// Reset clears all metrics
func (mc *MetricsCollector) Reset() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.operationCounts = make(map[string]int64)
	mc.errorCounts = make(map[string]int64)
	mc.latencies = make(map[string][]time.Duration)
	mc.startTime = time.Now()
}

// CacheMetrics represents cache performance metrics
type CacheMetrics struct {
	OperationCounts  map[string]int64         `json:"operation_counts"`
	ErrorCounts      map[string]int64         `json:"error_counts"`
	ErrorRates       map[string]float64       `json:"error_rates"`
	AverageLatencies map[string]time.Duration `json:"average_latencies"`
	P95Latencies     map[string]time.Duration `json:"p95_latencies"`
	P99Latencies     map[string]time.Duration `json:"p99_latencies"`
	Uptime           time.Duration            `json:"uptime"`
}

// MonitoredCache wraps a cache interface with metrics collection
type MonitoredCache struct {
	CacheInterface
	collector *MetricsCollector
	name      string
}

// NewMonitoredCache creates a cache with metrics monitoring
func NewMonitoredCache(cache CacheInterface, name string) *MonitoredCache {
	return &MonitoredCache{
		CacheInterface: cache,
		collector:      NewMetricsCollector(),
		name:           name,
	}
}

// Get with metrics
func (mc *MonitoredCache) Get(ctx context.Context, key string) ([]byte, error) {
	start := time.Now()
	result, err := mc.CacheInterface.Get(ctx, key)
	duration := time.Since(start)

	operation := "get"
	if err != nil && IsCacheMiss(err) {
		operation = "get_miss"
	}

	mc.collector.RecordOperation(operation, duration, err)
	return result, err
}

// Set with metrics
func (mc *MonitoredCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	start := time.Now()
	err := mc.CacheInterface.Set(ctx, key, value, ttl)
	duration := time.Since(start)

	mc.collector.RecordOperation("set", duration, err)
	return err
}

// Delete with metrics
func (mc *MonitoredCache) Delete(ctx context.Context, key string) error {
	start := time.Now()
	err := mc.CacheInterface.Delete(ctx, key)
	duration := time.Since(start)

	mc.collector.RecordOperation("delete", duration, err)
	return err
}

// GetMulti with metrics
func (mc *MonitoredCache) GetMulti(ctx context.Context, keys []string) (map[string][]byte, error) {
	start := time.Now()
	result, err := mc.CacheInterface.GetMulti(ctx, keys)
	duration := time.Since(start)

	mc.collector.RecordOperation("get_multi", duration, err)
	return result, err
}

// SetMulti with metrics
func (mc *MonitoredCache) SetMulti(ctx context.Context, items map[string]CacheItem) error {
	start := time.Now()
	err := mc.CacheInterface.SetMulti(ctx, items)
	duration := time.Since(start)

	mc.collector.RecordOperation("set_multi", duration, err)
	return err
}

// DeleteMulti with metrics
func (mc *MonitoredCache) DeleteMulti(ctx context.Context, keys []string) error {
	start := time.Now()
	err := mc.CacheInterface.DeleteMulti(ctx, keys)
	duration := time.Since(start)

	mc.collector.RecordOperation("delete_multi", duration, err)
	return err
}

// GetMetrics returns collected metrics
func (mc *MonitoredCache) GetMetrics() CacheMetrics {
	return mc.collector.GetMetrics()
}

// ResetMetrics resets collected metrics
func (mc *MonitoredCache) ResetMetrics() {
	mc.collector.Reset()
}

// PrometheusExporter exports cache metrics in Prometheus format
type PrometheusExporter struct {
	caches map[string]*MonitoredCache
	mu     sync.RWMutex
}

// NewPrometheusExporter creates a new Prometheus exporter
func NewPrometheusExporter() *PrometheusExporter {
	return &PrometheusExporter{
		caches: make(map[string]*MonitoredCache),
	}
}

// RegisterCache registers a cache for metrics export
func (pe *PrometheusExporter) RegisterCache(name string, cache *MonitoredCache) {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	pe.caches[name] = cache
}

// ExportMetrics exports metrics in Prometheus format
func (pe *PrometheusExporter) ExportMetrics() string {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	var output string

	for cacheName, cache := range pe.caches {
		metrics := cache.GetMetrics()

		// Export operation counts
		for operation, count := range metrics.OperationCounts {
			output += fmt.Sprintf("cache_operations_total{cache=\"%s\",operation=\"%s\"} %d\n",
				cacheName, operation, count)
		}

		// Export error counts
		for operation, count := range metrics.ErrorCounts {
			output += fmt.Sprintf("cache_errors_total{cache=\"%s\",operation=\"%s\"} %d\n",
				cacheName, operation, count)
		}

		// Export error rates
		for operation, rate := range metrics.ErrorRates {
			output += fmt.Sprintf("cache_error_rate{cache=\"%s\",operation=\"%s\"} %.4f\n",
				cacheName, operation, rate)
		}

		// Export latencies
		for operation, latency := range metrics.AverageLatencies {
			output += fmt.Sprintf("cache_latency_average_seconds{cache=\"%s\",operation=\"%s\"} %.6f\n",
				cacheName, operation, latency.Seconds())
		}

		for operation, latency := range metrics.P95Latencies {
			output += fmt.Sprintf("cache_latency_p95_seconds{cache=\"%s\",operation=\"%s\"} %.6f\n",
				cacheName, operation, latency.Seconds())
		}

		for operation, latency := range metrics.P99Latencies {
			output += fmt.Sprintf("cache_latency_p99_seconds{cache=\"%s\",operation=\"%s\"} %.6f\n",
				cacheName, operation, latency.Seconds())
		}

		// Export uptime
		output += fmt.Sprintf("cache_uptime_seconds{cache=\"%s\"} %.0f\n",
			cacheName, metrics.Uptime.Seconds())
	}

	return output
}

// HealthChecker provides cache health checking
type HealthChecker struct {
	cache       CacheInterface
	testKey     string
	testValue   []byte
	timeout     time.Duration
	lastChecked time.Time
	lastStatus  bool
	mu          sync.RWMutex
}

// NewHealthChecker creates a new cache health checker
func NewHealthChecker(cache CacheInterface) *HealthChecker {
	return &HealthChecker{
		cache:     cache,
		testKey:   "health_check_" + fmt.Sprintf("%d", time.Now().Unix()),
		testValue: []byte("ping"),
		timeout:   5 * time.Second,
	}
}

// Check performs a health check
func (hc *HealthChecker) Check(ctx context.Context) (bool, error) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, hc.timeout)
	defer cancel()

	// Test basic connectivity
	if err := hc.cache.Ping(timeoutCtx); err != nil {
		hc.lastStatus = false
		hc.lastChecked = time.Now()
		return false, fmt.Errorf("ping failed: %w", err)
	}

	// Test write operation
	if err := hc.cache.Set(timeoutCtx, hc.testKey, hc.testValue, time.Minute); err != nil {
		hc.lastStatus = false
		hc.lastChecked = time.Now()
		return false, fmt.Errorf("set operation failed: %w", err)
	}

	// Test read operation
	data, err := hc.cache.Get(timeoutCtx, hc.testKey)
	if err != nil {
		hc.lastStatus = false
		hc.lastChecked = time.Now()
		return false, fmt.Errorf("get operation failed: %w", err)
	}

	// Verify data
	if string(data) != string(hc.testValue) {
		hc.lastStatus = false
		hc.lastChecked = time.Now()
		return false, fmt.Errorf("data mismatch: expected %s, got %s", hc.testValue, data)
	}

	// Clean up test key
	if err := hc.cache.Delete(timeoutCtx, hc.testKey); err != nil {
		// Log but don't fail health check for cleanup failure
		fmt.Printf("Warning: Failed to clean up health check key: %v\n", err)
	}

	hc.lastStatus = true
	hc.lastChecked = time.Now()
	return true, nil
}

// GetLastStatus returns the last health check status
func (hc *HealthChecker) GetLastStatus() (bool, time.Time) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return hc.lastStatus, hc.lastChecked
}

// Utility functions for metrics calculation

func calculateAverage(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	var total time.Duration
	for _, d := range durations {
		total += d
	}

	return total / time.Duration(len(durations))
}

func calculatePercentile(durations []time.Duration, percentile float64) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	// Sort durations (simple bubble sort for small arrays)
	sorted := make([]time.Duration, len(durations))
	copy(sorted, durations)

	for i := 0; i < len(sorted); i++ {
		for j := 0; j < len(sorted)-1-i; j++ {
			if sorted[j] > sorted[j+1] {
				sorted[j], sorted[j+1] = sorted[j+1], sorted[j]
			}
		}
	}

	index := int(float64(len(sorted)-1) * percentile)
	return sorted[index]
}
