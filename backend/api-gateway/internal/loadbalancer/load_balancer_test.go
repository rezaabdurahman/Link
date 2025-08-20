package loadbalancer

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewLoadBalancer(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	assert.NotNil(t, lb)
	assert.Equal(t, RoundRobin, lb.strategy)
	assert.Equal(t, int64(3), lb.maxFailures)
	assert.Equal(t, 30*time.Second, lb.timeout)
	assert.Equal(t, 60*time.Second, lb.recoveryTimeout)
	assert.Equal(t, 0, len(lb.instances))
}

func TestAddInstance(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	
	assert.Equal(t, 1, len(lb.instances))
	
	instance := lb.instances[0]
	assert.Equal(t, "test-1", instance.ID)
	assert.Equal(t, "http://localhost:8001", instance.URL)
	assert.Equal(t, "http://localhost:8001/health", instance.HealthURL)
	assert.True(t, instance.IsHealthy)
	assert.Equal(t, 1, instance.Weight)
	assert.Equal(t, Closed, instance.State)
}

func TestRemoveInstance(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	lb.AddInstance("test-2", "http://localhost:8002", "http://localhost:8002/health", 1, 30*time.Second)
	
	assert.Equal(t, 2, len(lb.instances))
	
	lb.RemoveInstance("test-1")
	
	assert.Equal(t, 1, len(lb.instances))
	assert.Equal(t, "test-2", lb.instances[0].ID)
	
	// Test removing non-existent instance
	lb.RemoveInstance("non-existent")
	assert.Equal(t, 1, len(lb.instances))
}

func TestRoundRobinSelection(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	lb.AddInstance("test-2", "http://localhost:8002", "http://localhost:8002/health", 1, 30*time.Second)
	lb.AddInstance("test-3", "http://localhost:8003", "http://localhost:8003/health", 1, 30*time.Second)
	
	// Test round-robin selection
	instances := make(map[string]int)
	for i := 0; i < 9; i++ {
		instance, err := lb.GetHealthyInstance()
		require.NoError(t, err)
		require.NotNil(t, instance)
		instances[instance.ID]++
	}
	
	// Each instance should be selected 3 times
	assert.Equal(t, 3, instances["test-1"])
	assert.Equal(t, 3, instances["test-2"])
	assert.Equal(t, 3, instances["test-3"])
}

func TestRandomSelection(t *testing.T) {
	lb := NewLoadBalancer(Random, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	lb.AddInstance("test-2", "http://localhost:8002", "http://localhost:8002/health", 1, 30*time.Second)
	
	// Test random selection (just ensure it works, randomness is hard to test deterministically)
	instances := make(map[string]int)
	for i := 0; i < 100; i++ {
		instance, err := lb.GetHealthyInstance()
		require.NoError(t, err)
		require.NotNil(t, instance)
		instances[instance.ID]++
	}
	
	// Both instances should be selected at least once in 100 attempts
	assert.Greater(t, instances["test-1"], 0)
	assert.Greater(t, instances["test-2"], 0)
}

func TestLeastConnectionsSelection(t *testing.T) {
	lb := NewLoadBalancer(LeastConnections, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	lb.AddInstance("test-2", "http://localhost:8002", "http://localhost:8002/health", 1, 30*time.Second)
	
	// Simulate connections on test-1
	lb.IncrementConnections(lb.instances[0])
	lb.IncrementConnections(lb.instances[0])
	
	// Should select test-2 as it has fewer connections
	instance, err := lb.GetHealthyInstance()
	require.NoError(t, err)
	assert.Equal(t, "test-2", instance.ID)
}

func TestCircuitBreakerSuccess(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	instance := lb.instances[0]
	
	// Simulate some failures
	instance.FailureCount = 2
	instance.State = Closed
	
	// Record success
	lb.RecordSuccess(instance)
	
	assert.Equal(t, int64(0), instance.FailureCount)
	assert.Equal(t, Closed, instance.State)
}

func TestCircuitBreakerFailure(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	instance := lb.instances[0]
	
	// Record failures until circuit breaker opens
	for i := 0; i < 3; i++ {
		lb.RecordFailure(instance)
	}
	
	assert.Equal(t, int64(3), instance.FailureCount)
	assert.Equal(t, Open, instance.State)
	assert.False(t, instance.IsHealthy)
}

func TestCircuitBreakerRecovery(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 1*time.Millisecond) // Short recovery timeout
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	instance := lb.instances[0]
	
	// Open the circuit breaker
	for i := 0; i < 3; i++ {
		lb.RecordFailure(instance)
	}
	
	assert.Equal(t, Open, instance.State)
	
	// Wait for recovery timeout
	time.Sleep(2 * time.Millisecond)
	
	// Reset health for testing
	instance.IsHealthy = true
	
	// Should move to half-open state when getting healthy instances
	healthy := lb.getHealthyInstances()
	
	// Check if instance was considered (moved to half-open)
	assert.Equal(t, HalfOpen, instance.State)
	assert.Equal(t, 1, len(healthy))
}

func TestGetAvailableInstanceCount(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	assert.Equal(t, 0, lb.GetAvailableInstanceCount())
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	lb.AddInstance("test-2", "http://localhost:8002", "http://localhost:8002/health", 1, 30*time.Second)
	
	assert.Equal(t, 2, lb.GetAvailableInstanceCount())
	
	// Mark one as unhealthy
	lb.instances[0].IsHealthy = false
	
	assert.Equal(t, 1, lb.GetAvailableInstanceCount())
}

func TestSelectInstance(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	// Test with no instances
	instance, err := lb.SelectInstance()
	assert.Error(t, err)
	assert.Nil(t, instance)
	
	// Add an instance
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	
	instance, err = lb.SelectInstance()
	assert.NoError(t, err)
	assert.NotNil(t, instance)
	assert.Equal(t, "test-1", instance.ID)
}

func TestRecordResult(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	instance := lb.instances[0]
	
	// Simulate some failures
	instance.FailureCount = 2
	
	// Record successful result
	lb.RecordResult("test-1", true, 100*time.Millisecond)
	
	assert.Equal(t, int64(0), instance.FailureCount)
	assert.Equal(t, Closed, instance.State)
	
	// Record failed result
	lb.RecordResult("test-1", false, 100*time.Millisecond)
	
	assert.Equal(t, int64(1), instance.FailureCount)
	
	// Test with non-existent instance
	lb.RecordResult("non-existent", true, 100*time.Millisecond)
	// Should not panic
}

func TestGetCircuitBreakerState(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	
	// Initial state should be closed
	state := lb.GetCircuitBreakerState("test-1")
	assert.Equal(t, Closed, state)
	
	// Open the circuit breaker
	for i := 0; i < 3; i++ {
		lb.RecordFailure(lb.instances[0])
	}
	
	state = lb.GetCircuitBreakerState("test-1")
	assert.Equal(t, Open, state)
	
	// Test with non-existent instance
	state = lb.GetCircuitBreakerState("non-existent")
	assert.Equal(t, Closed, state) // Default state
}

func TestGetStats(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	lb.AddInstance("test-1", "http://localhost:8001", "http://localhost:8001/health", 1, 30*time.Second)
	lb.AddInstance("test-2", "http://localhost:8002", "http://localhost:8002/health", 1, 30*time.Second)
	
	// Mark one as unhealthy
	lb.instances[1].IsHealthy = false
	
	stats := lb.GetStats()
	
	assert.Equal(t, "RoundRobin", stats["strategy"])
	assert.Equal(t, 2, stats["total_instances"])
	assert.Equal(t, 1, stats["healthy_instances"])
	assert.Contains(t, stats, "instances")
	
	instances := stats["instances"].([]map[string]interface{})
	assert.Equal(t, 2, len(instances))
	
	// Check first instance stats
	assert.Equal(t, "test-1", instances[0]["id"])
	assert.Equal(t, "http://localhost:8001", instances[0]["url"])
	assert.Equal(t, true, instances[0]["is_healthy"])
	assert.Equal(t, "Closed", instances[0]["circuit_breaker_state"])
}

func TestConcurrentAccess(t *testing.T) {
	lb := NewLoadBalancer(RoundRobin, 3, 30*time.Second, 60*time.Second)
	
	// Add multiple instances
	for i := 0; i < 5; i++ {
		lb.AddInstance(
			fmt.Sprintf("test-%d", i),
			fmt.Sprintf("http://localhost:800%d", i),
			fmt.Sprintf("http://localhost:800%d/health", i),
			1,
			30*time.Second,
		)
	}
	
	var wg sync.WaitGroup
	results := make([]string, 0, 100)
	var resultsMutex sync.Mutex
	
	// Simulate concurrent requests
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			
			instance, err := lb.GetHealthyInstance()
			if err == nil && instance != nil {
				resultsMutex.Lock()
				results = append(results, instance.ID)
				resultsMutex.Unlock()
			}
		}()
	}
	
	wg.Wait()
	
	// Should have received 100 results
	assert.Equal(t, 100, len(results))
	
	// All instances should have been selected
	instanceCounts := make(map[string]int)
	for _, instanceID := range results {
		instanceCounts[instanceID]++
	}
	
	assert.Equal(t, 5, len(instanceCounts)) // All 5 instances selected
}

func TestEnumStrings(t *testing.T) {
	// Test LoadBalancingStrategy String method
	assert.Equal(t, "RoundRobin", RoundRobin.String())
	assert.Equal(t, "Random", Random.String())
	assert.Equal(t, "LeastConnections", LeastConnections.String())
	assert.Equal(t, "Unknown", LoadBalancingStrategy(999).String())
	
	// Test CircuitBreakerState String method
	assert.Equal(t, "Closed", Closed.String())
	assert.Equal(t, "Open", Open.String())
	assert.Equal(t, "HalfOpen", HalfOpen.String())
	assert.Equal(t, "Unknown", CircuitBreakerState(999).String())
}
