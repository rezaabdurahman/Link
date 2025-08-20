package loadbalancer

import (
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// LoadBalancingStrategy defines the strategy for load balancing
type LoadBalancingStrategy int

const (
	RoundRobin LoadBalancingStrategy = iota
	Random
	LeastConnections
)

// ServiceInstance represents a single instance of a backend service
type ServiceInstance struct {
	ID        string
	URL       string
	HealthURL string
	IsHealthy bool
	Weight    int
	Timeout   time.Duration
	
	// Circuit breaker state
	FailureCount    int64
	LastFailureTime time.Time
	State          CircuitBreakerState
	
	// Connection tracking
	ActiveConnections int64
	
	// Mutex for thread-safe operations
	mutex sync.RWMutex
}

// CircuitBreakerState represents the state of the circuit breaker
type CircuitBreakerState int

const (
	StateClosed CircuitBreakerState = iota // Normal operation
	StateOpen                              // Circuit breaker is open, requests fail fast
	StateHalfOpen                          // Testing if service is back to normal
	
	// Aliases for backward compatibility
	Closed   = StateClosed
	Open     = StateOpen
	HalfOpen = StateHalfOpen
)

// LoadBalancer manages multiple service instances with health checking and load balancing
type LoadBalancer struct {
	instances      []*ServiceInstance
	strategy       LoadBalancingStrategy
	roundRobinIdx  int64
	healthChecker  *HealthChecker
	
	// Circuit breaker configuration
	maxFailures      int64
	timeout          time.Duration
	recoveryTimeout  time.Duration
	
	mutex sync.RWMutex
}

// NewLoadBalancer creates a new load balancer
func NewLoadBalancer(strategy LoadBalancingStrategy, maxFailures int64, timeout, recoveryTimeout time.Duration) *LoadBalancer {
	lb := &LoadBalancer{
		instances:       make([]*ServiceInstance, 0),
		strategy:        strategy,
		maxFailures:     maxFailures,
		timeout:         timeout,
		recoveryTimeout: recoveryTimeout,
		roundRobinIdx:   0,
	}
	
	// Initialize health checker
	lb.healthChecker = NewHealthChecker(lb)
	
	return lb
}

// AddInstance adds a new service instance to the load balancer
func (lb *LoadBalancer) AddInstance(id, url, healthURL string, weight int, timeout time.Duration) {
	lb.mutex.Lock()
	defer lb.mutex.Unlock()
	
	instance := &ServiceInstance{
		ID:        id,
		URL:       url,
		HealthURL: healthURL,
		IsHealthy: true,
		Weight:    weight,
		Timeout:   timeout,
		State:     Closed,
	}
	
	lb.instances = append(lb.instances, instance)
}

// RemoveInstance removes a service instance from the load balancer
func (lb *LoadBalancer) RemoveInstance(id string) {
	lb.mutex.Lock()
	defer lb.mutex.Unlock()
	
	for i, instance := range lb.instances {
		if instance.ID == id {
			lb.instances = append(lb.instances[:i], lb.instances[i+1:]...)
			break
		}
	}
}

// GetHealthyInstance returns a healthy service instance using the configured strategy
func (lb *LoadBalancer) GetHealthyInstance() (*ServiceInstance, error) {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	healthyInstances := lb.getHealthyInstances()
	if len(healthyInstances) == 0 {
		return nil, fmt.Errorf("no healthy instances available")
	}
	
	switch lb.strategy {
	case RoundRobin:
		return lb.roundRobinSelect(healthyInstances), nil
	case Random:
		return lb.randomSelect(healthyInstances), nil
	case LeastConnections:
		return lb.leastConnectionsSelect(healthyInstances), nil
	default:
		return lb.roundRobinSelect(healthyInstances), nil
	}
}

// getHealthyInstances returns all healthy and available instances
func (lb *LoadBalancer) getHealthyInstances() []*ServiceInstance {
	var healthy []*ServiceInstance
	
	for _, instance := range lb.instances {
		instance.mutex.RLock()
		isHealthy := instance.IsHealthy
		state := instance.State
		lastFailure := instance.LastFailureTime
		instance.mutex.RUnlock()
		
		// Check circuit breaker state
		if state == Open {
			// Check if recovery timeout has passed
			if time.Since(lastFailure) > lb.recoveryTimeout {
				// Move to half-open state
				instance.mutex.Lock()
				instance.State = HalfOpen
				instance.mutex.Unlock()
			} else {
				continue // Skip this instance
			}
		}
		
		if isHealthy {
			healthy = append(healthy, instance)
		}
	}
	
	return healthy
}

// roundRobinSelect implements round-robin load balancing
func (lb *LoadBalancer) roundRobinSelect(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	idx := atomic.AddInt64(&lb.roundRobinIdx, 1) % int64(len(instances))
	return instances[idx]
}

// randomSelect implements random load balancing
func (lb *LoadBalancer) randomSelect(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	idx := rand.Intn(len(instances))
	return instances[idx]
}

// leastConnectionsSelect implements least connections load balancing
func (lb *LoadBalancer) leastConnectionsSelect(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	var selected *ServiceInstance
	minConnections := int64(^uint64(0) >> 1) // Max int64
	
	for _, instance := range instances {
		connections := atomic.LoadInt64(&instance.ActiveConnections)
		if connections < minConnections {
			minConnections = connections
			selected = instance
		}
	}
	
	return selected
}

// RecordSuccess records a successful request for circuit breaker
func (lb *LoadBalancer) RecordSuccess(instance *ServiceInstance) {
	instance.mutex.Lock()
	defer instance.mutex.Unlock()
	
	// Reset failure count and close circuit breaker
	instance.FailureCount = 0
	instance.State = Closed
	
	// Decrement active connections
	atomic.AddInt64(&instance.ActiveConnections, -1)
}

// RecordFailure records a failed request for circuit breaker
func (lb *LoadBalancer) RecordFailure(instance *ServiceInstance) {
	instance.mutex.Lock()
	defer instance.mutex.Unlock()
	
	// Increment failure count
	atomic.AddInt64(&instance.FailureCount, 1)
	instance.LastFailureTime = time.Now()
	
	// Check if we should open the circuit breaker
	if instance.FailureCount >= lb.maxFailures {
		instance.State = Open
		// Mark instance as unhealthy
		instance.IsHealthy = false
	} else if instance.State == HalfOpen {
		// If we're in half-open and still failing, go back to open
		instance.State = Open
		instance.IsHealthy = false
	}
	
	// Decrement active connections
	atomic.AddInt64(&instance.ActiveConnections, -1)
}

// IncrementConnections increments the active connection count
func (lb *LoadBalancer) IncrementConnections(instance *ServiceInstance) {
	atomic.AddInt64(&instance.ActiveConnections, 1)
}

// GetAllInstances returns all instances for monitoring purposes
func (lb *LoadBalancer) GetAllInstances() []*ServiceInstance {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	// Return a copy to avoid race conditions
	instances := make([]*ServiceInstance, len(lb.instances))
	copy(instances, lb.instances)
	return instances
}

// StartHealthChecking starts the health checking goroutine
func (lb *LoadBalancer) StartHealthChecking() {
	lb.healthChecker.Start()
}

// StopHealthChecking stops the health checking goroutine
func (lb *LoadBalancer) StopHealthChecking() {
	lb.healthChecker.Stop()
}

// GetAvailableInstanceCount returns the number of healthy instances
func (lb *LoadBalancer) GetAvailableInstanceCount() int {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	return len(lb.getHealthyInstances())
}

// SelectInstance selects an instance using the load balancing strategy (alias for GetHealthyInstance)
func (lb *LoadBalancer) SelectInstance() (*ServiceInstance, error) {
	return lb.GetHealthyInstance()
}

// RecordResult records the result of a request for circuit breaker and load balancer metrics
func (lb *LoadBalancer) RecordResult(instanceID string, success bool, duration time.Duration) {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	// Find the instance
	for _, instance := range lb.instances {
		if instance.ID == instanceID {
			if success {
				lb.RecordSuccess(instance)
			} else {
				lb.RecordFailure(instance)
			}
			break
		}
	}
}

// GetCircuitBreakerState returns the current circuit breaker state for an instance
func (lb *LoadBalancer) GetCircuitBreakerState(instanceID string) CircuitBreakerState {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	for _, instance := range lb.instances {
		if instance.ID == instanceID {
			instance.mutex.RLock()
			state := instance.State
			instance.mutex.RUnlock()
			return state
		}
	}
	
	// Return closed state if instance not found
	return Closed
}

// GetStats returns load balancer statistics
func (lb *LoadBalancer) GetStats() map[string]interface{} {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	totalInstances := len(lb.instances)
	healthyInstances := len(lb.getHealthyInstances())
	
	instanceStats := make([]map[string]interface{}, len(lb.instances))
	for i, instance := range lb.instances {
		instance.mutex.RLock()
		instanceStats[i] = map[string]interface{}{
			"id":                  instance.ID,
			"url":                 instance.URL,
			"is_healthy":          instance.IsHealthy,
			"failure_count":       instance.FailureCount,
			"circuit_breaker_state": instance.State.String(),
			"active_connections":  atomic.LoadInt64(&instance.ActiveConnections),
			"last_failure_time":   instance.LastFailureTime,
		}
		instance.mutex.RUnlock()
	}
	
	return map[string]interface{}{
		"strategy":           lb.strategy.String(),
		"total_instances":    totalInstances,
		"healthy_instances":  healthyInstances,
		"round_robin_index":  atomic.LoadInt64(&lb.roundRobinIdx),
		"instances":          instanceStats,
	}
}

// String methods for enums
func (s LoadBalancingStrategy) String() string {
	switch s {
	case RoundRobin:
		return "RoundRobin"
	case Random:
		return "Random"
	case LeastConnections:
		return "LeastConnections"
	default:
		return "Unknown"
	}
}

func (s CircuitBreakerState) String() string {
	switch s {
	case Closed:
		return "Closed"
	case Open:
		return "Open"
	case HalfOpen:
		return "HalfOpen"
	default:
		return "Unknown"
	}
}
