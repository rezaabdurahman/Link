package loadbalancer

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"
)

// HealthChecker performs periodic health checks on service instances
type HealthChecker struct {
	loadBalancer   *LoadBalancer
	checkInterval  time.Duration
	requestTimeout time.Duration
	httpClient     *http.Client
	stopChan       chan struct{}
	wg             sync.WaitGroup
	isRunning      bool
	mutex          sync.Mutex
}

// HealthCheckResult represents the result of a health check
type HealthCheckResult struct {
	InstanceID string
	IsHealthy  bool
	Error      error
	Duration   time.Duration
	StatusCode int
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(lb *LoadBalancer) *HealthChecker {
	return &HealthChecker{
		loadBalancer:   lb,
		checkInterval:  30 * time.Second, // Check every 30 seconds
		requestTimeout: 5 * time.Second,  // 5 second timeout per health check
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 2,
				IdleConnTimeout:     30 * time.Second,
			},
		},
		stopChan: make(chan struct{}),
	}
}

// Start begins the health checking process
func (hc *HealthChecker) Start() {
	hc.mutex.Lock()
	defer hc.mutex.Unlock()

	if hc.isRunning {
		return
	}

	hc.isRunning = true
	hc.wg.Add(1)

	go hc.healthCheckLoop()

	log.Println("Health checker started")
}

// Stop stops the health checking process
func (hc *HealthChecker) Stop() {
	hc.mutex.Lock()
	if !hc.isRunning {
		hc.mutex.Unlock()
		return
	}
	hc.isRunning = false
	hc.mutex.Unlock()

	close(hc.stopChan)
	hc.wg.Wait()

	log.Println("Health checker stopped")
}

// healthCheckLoop is the main health checking loop
func (hc *HealthChecker) healthCheckLoop() {
	defer hc.wg.Done()

	ticker := time.NewTicker(hc.checkInterval)
	defer ticker.Stop()

	// Perform initial health check
	hc.performHealthChecks()

	for {
		select {
		case <-ticker.C:
			hc.performHealthChecks()
		case <-hc.stopChan:
			return
		}
	}
}

// performHealthChecks checks the health of all service instances
func (hc *HealthChecker) performHealthChecks() {
	instances := hc.loadBalancer.GetAllInstances()
	if len(instances) == 0 {
		return
	}

	// Create a channel to collect results
	resultsChan := make(chan HealthCheckResult, len(instances))

	// Start health checks for all instances concurrently
	for _, instance := range instances {
		go hc.checkInstanceHealth(instance, resultsChan)
	}

	// Collect results
	for i := 0; i < len(instances); i++ {
		result := <-resultsChan
		hc.processHealthCheckResult(result)
	}

	close(resultsChan)
}

// checkInstanceHealth performs a health check on a single instance
func (hc *HealthChecker) checkInstanceHealth(instance *ServiceInstance, resultsChan chan<- HealthCheckResult) {
	startTime := time.Now()

	result := HealthCheckResult{
		InstanceID: instance.ID,
		IsHealthy:  false,
		Duration:   0,
		StatusCode: 0,
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), hc.requestTimeout)
	defer cancel()

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", instance.HealthURL, nil)
	if err != nil {
		result.Error = err
		result.Duration = time.Since(startTime)
		resultsChan <- result
		return
	}

	// Add health check headers
	req.Header.Set("User-Agent", "API-Gateway-HealthChecker/1.0")
	req.Header.Set("Accept", "application/json, text/plain, */*")

	// Perform the request
	resp, err := hc.httpClient.Do(req)
	if err != nil {
		result.Error = err
		result.Duration = time.Since(startTime)
		resultsChan <- result
		return
	}
	defer resp.Body.Close()

	result.Duration = time.Since(startTime)
	result.StatusCode = resp.StatusCode

	// Consider 2xx status codes as healthy
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		result.IsHealthy = true
	}

	resultsChan <- result
}

// processHealthCheckResult processes the result of a health check
func (hc *HealthChecker) processHealthCheckResult(result HealthCheckResult) {
	// Find the instance
	instances := hc.loadBalancer.GetAllInstances()
	for _, instance := range instances {
		if instance.ID == result.InstanceID {
			hc.updateInstanceHealth(instance, result)
			break
		}
	}
}

// updateInstanceHealth updates the health status of an instance
func (hc *HealthChecker) updateInstanceHealth(instance *ServiceInstance, result HealthCheckResult) {
	instance.mutex.Lock()
	defer instance.mutex.Unlock()

	previousHealth := instance.IsHealthy
	instance.IsHealthy = result.IsHealthy

	// Log health status changes
	if previousHealth != result.IsHealthy {
		if result.IsHealthy {
			log.Printf("Instance %s (%s) is now HEALTHY (took %v, status: %d)",
				instance.ID, instance.URL, result.Duration, result.StatusCode)

			// If instance becomes healthy, reset circuit breaker if it was open
			if instance.State == Open || instance.State == HalfOpen {
				instance.State = Closed
				instance.FailureCount = 0
				log.Printf("Circuit breaker for instance %s reset to CLOSED", instance.ID)
			}
		} else {
			log.Printf("Instance %s (%s) is now UNHEALTHY (took %v, error: %v, status: %d)",
				instance.ID, instance.URL, result.Duration, result.Error, result.StatusCode)
		}
	}

	// If health check failed, record it as a failure for circuit breaker
	if !result.IsHealthy {
		// Don't use the load balancer's RecordFailure method here as it decrements connections
		// and we're not handling a request failure, just a health check failure
		instance.FailureCount++
		instance.LastFailureTime = time.Now()

		// Open circuit breaker if too many failures
		if instance.FailureCount >= hc.loadBalancer.maxFailures && instance.State == Closed {
			instance.State = Open
			log.Printf("Circuit breaker for instance %s opened due to health check failures", instance.ID)
		}
	}
}

// SetCheckInterval sets the interval between health checks
func (hc *HealthChecker) SetCheckInterval(interval time.Duration) {
	hc.mutex.Lock()
	defer hc.mutex.Unlock()

	hc.checkInterval = interval
}

// SetRequestTimeout sets the timeout for individual health check requests
func (hc *HealthChecker) SetRequestTimeout(timeout time.Duration) {
	hc.mutex.Lock()
	defer hc.mutex.Unlock()

	hc.requestTimeout = timeout
	hc.httpClient.Timeout = timeout
}

// GetHealthCheckStats returns statistics about health checks
func (hc *HealthChecker) GetHealthCheckStats() map[string]interface{} {
	hc.mutex.Lock()
	defer hc.mutex.Unlock()

	instances := hc.loadBalancer.GetAllInstances()
	instanceStats := make([]map[string]interface{}, len(instances))

	healthyCount := 0
	for i, instance := range instances {
		instance.mutex.RLock()
		if instance.IsHealthy {
			healthyCount++
		}

		instanceStats[i] = map[string]interface{}{
			"id":                    instance.ID,
			"url":                   instance.URL,
			"health_url":            instance.HealthURL,
			"is_healthy":            instance.IsHealthy,
			"failure_count":         instance.FailureCount,
			"circuit_breaker_state": instance.State.String(),
			"last_failure_time":     instance.LastFailureTime,
		}
		instance.mutex.RUnlock()
	}

	return map[string]interface{}{
		"is_running":          hc.isRunning,
		"check_interval":      hc.checkInterval.String(),
		"request_timeout":     hc.requestTimeout.String(),
		"total_instances":     len(instances),
		"healthy_instances":   healthyCount,
		"unhealthy_instances": len(instances) - healthyCount,
		"instances":           instanceStats,
	}
}
