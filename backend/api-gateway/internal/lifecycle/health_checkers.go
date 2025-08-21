package lifecycle

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// DatabaseHealthChecker checks database connectivity and basic operations
type DatabaseHealthChecker struct {
	db *sql.DB
}

// NewDatabaseHealthChecker creates a new database health checker
func NewDatabaseHealthChecker(db *sql.DB) *DatabaseHealthChecker {
	return &DatabaseHealthChecker{db: db}
}

// CheckHealth performs database health check
func (dhc *DatabaseHealthChecker) CheckHealth(ctx context.Context) error {
	if dhc.db == nil {
		return fmt.Errorf("database connection is nil")
	}

	// Check if we can ping the database
	if err := dhc.db.PingContext(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	// Check database stats
	stats := dhc.db.Stats()
	if stats.OpenConnections == 0 {
		return fmt.Errorf("no open database connections")
	}

	// Perform a simple query to ensure database is responsive
	var result int
	query := "SELECT 1"
	if err := dhc.db.QueryRowContext(ctx, query).Scan(&result); err != nil {
		return fmt.Errorf("database query failed: %w", err)
	}

	if result != 1 {
		return fmt.Errorf("unexpected database query result: %d", result)
	}

	return nil
}

// RedisHealthChecker checks Redis connectivity and basic operations
type RedisHealthChecker struct {
	client redis.Cmdable
}

// NewRedisHealthChecker creates a new Redis health checker
func NewRedisHealthChecker(client redis.Cmdable) *RedisHealthChecker {
	return &RedisHealthChecker{client: client}
}

// CheckHealth performs Redis health check
func (rhc *RedisHealthChecker) CheckHealth(ctx context.Context) error {
	if rhc.client == nil {
		return fmt.Errorf("redis client is nil")
	}

	// Ping Redis
	pong, err := rhc.client.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}

	if pong != "PONG" {
		return fmt.Errorf("unexpected redis ping response: %s", pong)
	}

	// Test basic set/get operations
	testKey := fmt.Sprintf("health_check_%d", time.Now().Unix())
	testValue := "ok"

	// Set a test value
	if err := rhc.client.Set(ctx, testKey, testValue, time.Minute).Err(); err != nil {
		return fmt.Errorf("redis set operation failed: %w", err)
	}

	// Get the test value
	retrievedValue, err := rhc.client.Get(ctx, testKey).Result()
	if err != nil {
		return fmt.Errorf("redis get operation failed: %w", err)
	}

	if retrievedValue != testValue {
		return fmt.Errorf("redis value mismatch: expected %s, got %s", testValue, retrievedValue)
	}

	// Clean up test key
	rhc.client.Del(ctx, testKey)

	return nil
}

// HTTPServiceHealthChecker checks external HTTP service health
type HTTPServiceHealthChecker struct {
	name    string
	url     string
	client  *http.Client
	timeout time.Duration
	retries int
}

// NewHTTPServiceHealthChecker creates a new HTTP service health checker
func NewHTTPServiceHealthChecker(name, url string) *HTTPServiceHealthChecker {
	return &HTTPServiceHealthChecker{
		name: name,
		url:  url,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		timeout: 5 * time.Second,
		retries: 2,
	}
}

// SetTimeout sets the HTTP request timeout
func (hsc *HTTPServiceHealthChecker) SetTimeout(timeout time.Duration) *HTTPServiceHealthChecker {
	hsc.timeout = timeout
	hsc.client.Timeout = timeout
	return hsc
}

// SetRetries sets the number of retry attempts
func (hsc *HTTPServiceHealthChecker) SetRetries(retries int) *HTTPServiceHealthChecker {
	hsc.retries = retries
	return hsc
}

// CheckHealth performs HTTP service health check
func (hsc *HTTPServiceHealthChecker) CheckHealth(ctx context.Context) error {
	var lastErr error

	for attempt := 0; attempt <= hsc.retries; attempt++ {
		if attempt > 0 {
			// Brief delay between retries
			select {
			case <-time.After(100 * time.Millisecond):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		req, err := http.NewRequestWithContext(ctx, "GET", hsc.url, nil)
		if err != nil {
			lastErr = fmt.Errorf("failed to create request for %s: %w", hsc.name, err)
			continue
		}

		req.Header.Set("User-Agent", "API-Gateway-Health-Checker/1.0")
		req.Header.Set("X-Health-Check", "true")

		resp, err := hsc.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("%s health check request failed: %w", hsc.name, err)
			continue
		}

		resp.Body.Close()

		// Consider 2xx and 3xx as healthy responses
		if resp.StatusCode >= 200 && resp.StatusCode < 400 {
			return nil
		}

		lastErr = fmt.Errorf("%s health check returned status %d", hsc.name, resp.StatusCode)
	}

	return lastErr
}

// CompositeHealthChecker combines multiple health checkers
type CompositeHealthChecker struct {
	checkers map[string]HealthChecker
}

// NewCompositeHealthChecker creates a new composite health checker
func NewCompositeHealthChecker() *CompositeHealthChecker {
	return &CompositeHealthChecker{
		checkers: make(map[string]HealthChecker),
	}
}

// Add adds a health checker to the composite
func (chc *CompositeHealthChecker) Add(name string, checker HealthChecker) *CompositeHealthChecker {
	chc.checkers[name] = checker
	return chc
}

// CheckHealth runs all composite health checks
func (chc *CompositeHealthChecker) CheckHealth(ctx context.Context) error {
	errors := make(map[string]error)

	for name, checker := range chc.checkers {
		if err := checker.CheckHealth(ctx); err != nil {
			errors[name] = err
		}
	}

	if len(errors) == 0 {
		return nil
	}

	// Create composite error message
	errorMsg := fmt.Sprintf("composite health check failed (%d/%d checks failed):", len(errors), len(chc.checkers))
	for name, err := range errors {
		errorMsg += fmt.Sprintf(" %s: %v;", name, err)
	}

	return fmt.Errorf(errorMsg)
}

// LoadBalancerHealthChecker checks load balancer service health
type LoadBalancerHealthChecker struct {
	serviceName string
	getStats    func() map[string]interface{}
}

// NewLoadBalancerHealthChecker creates a new load balancer health checker
func NewLoadBalancerHealthChecker(serviceName string, getStats func() map[string]interface{}) *LoadBalancerHealthChecker {
	return &LoadBalancerHealthChecker{
		serviceName: serviceName,
		getStats:    getStats,
	}
}

// CheckHealth performs load balancer health check
func (lhc *LoadBalancerHealthChecker) CheckHealth(ctx context.Context) error {
	if lhc.getStats == nil {
		return fmt.Errorf("load balancer stats function is nil")
	}

	stats := lhc.getStats()
	if stats == nil {
		return fmt.Errorf("load balancer stats are nil")
	}

	// Check if we have healthy instances
	healthyInstances, ok := stats["healthy_instances"].(int)
	if !ok {
		return fmt.Errorf("invalid healthy_instances type in stats")
	}

	totalInstances, ok := stats["total_instances"].(int)
	if !ok {
		return fmt.Errorf("invalid total_instances type in stats")
	}

	if totalInstances == 0 {
		return fmt.Errorf("no instances configured for service %s", lhc.serviceName)
	}

	if healthyInstances == 0 {
		return fmt.Errorf("no healthy instances available for service %s (0/%d)", lhc.serviceName, totalInstances)
	}

	// Warn if less than 50% of instances are healthy
	if float64(healthyInstances)/float64(totalInstances) < 0.5 {
		return fmt.Errorf("service %s is degraded: only %d/%d instances are healthy",
			lhc.serviceName, healthyInstances, totalInstances)
	}

	return nil
}

// DependencyHealthChecker checks critical service dependencies
type DependencyHealthChecker struct {
	dependencies map[string]HealthChecker
	critical     map[string]bool // marks which dependencies are critical
}

// NewDependencyHealthChecker creates a new dependency health checker
func NewDependencyHealthChecker() *DependencyHealthChecker {
	return &DependencyHealthChecker{
		dependencies: make(map[string]HealthChecker),
		critical:     make(map[string]bool),
	}
}

// AddCritical adds a critical dependency (failure fails the entire health check)
func (dhc *DependencyHealthChecker) AddCritical(name string, checker HealthChecker) *DependencyHealthChecker {
	dhc.dependencies[name] = checker
	dhc.critical[name] = true
	return dhc
}

// AddOptional adds an optional dependency (failure is logged but doesn't fail health check)
func (dhc *DependencyHealthChecker) AddOptional(name string, checker HealthChecker) *DependencyHealthChecker {
	dhc.dependencies[name] = checker
	dhc.critical[name] = false
	return dhc
}

// CheckHealth performs dependency health checks
func (dhc *DependencyHealthChecker) CheckHealth(ctx context.Context) error {
	var criticalErrors []string
	var optionalErrors []string

	for name, checker := range dhc.dependencies {
		err := checker.CheckHealth(ctx)
		if err != nil {
			if dhc.critical[name] {
				criticalErrors = append(criticalErrors, fmt.Sprintf("%s: %v", name, err))
			} else {
				optionalErrors = append(optionalErrors, fmt.Sprintf("%s: %v", name, err))
			}
		}
	}

	// Log optional dependency failures (but don't fail the check)
	for _, optErr := range optionalErrors {
		fmt.Printf("Optional dependency warning: %s\n", optErr)
	}

	// Fail if any critical dependencies are unhealthy
	if len(criticalErrors) > 0 {
		return fmt.Errorf("critical dependencies unhealthy: %v", criticalErrors)
	}

	return nil
}
