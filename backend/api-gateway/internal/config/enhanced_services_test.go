package config

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/link-app/api-gateway/internal/loadbalancer"
)

func TestEnhancedServiceConfigInitialization(t *testing.T) {
	// Test basic initialization
	config := GetEnhancedServiceConfig()

	require.NotNil(t, config)
	require.NotNil(t, config.Services)

	// Should have all expected services
	expectedServices := []string{
		"user-svc", "location-svc", "chat-svc", "ai-svc",
		"discovery-svc",
	}

	assert.Equal(t, len(expectedServices), len(config.Services))

	for _, serviceName := range expectedServices {
		assert.Contains(t, config.Services, serviceName)

		service := config.Services[serviceName]
		require.NotNil(t, service)
		assert.Equal(t, serviceName, service.Name)
		assert.NotNil(t, service.LoadBalancer)
		assert.NotNil(t, service.Retrier)
		assert.NotEmpty(t, service.Instances)
	}
}

func TestGetLoadBalancer(t *testing.T) {
	config := GetEnhancedServiceConfig()

	// Test getting existing load balancer
	lb, err := config.GetLoadBalancer("user-svc")
	require.NoError(t, err)
	require.NotNil(t, lb)

	// Test getting non-existent load balancer
	_, err = config.GetLoadBalancer("non-existent-svc")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestGetRetrier(t *testing.T) {
	config := GetEnhancedServiceConfig()

	// Test getting existing retrier
	retrier, err := config.GetRetrier("user-svc")
	require.NoError(t, err)
	require.NotNil(t, retrier)

	// Test getting non-existent retrier
	_, err = config.GetRetrier("non-existent-svc")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestServiceInstanceConfigFromEnv(t *testing.T) {
	// Test with environment variables
	originalEnvs := map[string]string{}

	// Save original environment
	envVars := []string{
		"USER_SVC_INSTANCES", "USER_SVC_URL", "USER_SVC_HEALTH_URL", "USER_SVC_TIMEOUT",
	}
	for _, env := range envVars {
		originalEnvs[env] = os.Getenv(env)
	}

	// Clean up after test
	defer func() {
		for _, env := range envVars {
			if val, exists := originalEnvs[env]; exists && val != "" {
				os.Setenv(env, val)
			} else {
				os.Unsetenv(env)
			}
		}
	}()

	// Test single instance from URL
	os.Setenv("USER_SVC_URL", "http://test-user-svc:9090")
	os.Setenv("USER_SVC_HEALTH_URL", "http://test-user-svc:9090/health")
	os.Setenv("USER_SVC_TIMEOUT", "45")

	instances := getUserServiceInstances()

	assert.Len(t, instances, 1)
	assert.Equal(t, "user-svc-1", instances[0].ID)
	assert.Equal(t, "http://test-user-svc:9090", instances[0].URL)
	assert.Equal(t, "http://test-user-svc:9090/health", instances[0].HealthURL)
	assert.Equal(t, 45*time.Second, instances[0].Timeout)

	// Test multiple instances from INSTANCES variable
	os.Unsetenv("USER_SVC_URL")
	os.Unsetenv("USER_SVC_HEALTH_URL")
	os.Setenv("USER_SVC_INSTANCES", "instance1:host1:8081,instance2:host2:8082,instance3:host3")

	instances = getUserServiceInstances()

	assert.Len(t, instances, 3)

	// First instance
	assert.Equal(t, "instance1", instances[0].ID)
	assert.Equal(t, "http://host1:8081", instances[0].URL)
	assert.Equal(t, "http://host1:8081/health/live", instances[0].HealthURL)

	// Second instance
	assert.Equal(t, "instance2", instances[1].ID)
	assert.Equal(t, "http://host2:8082", instances[1].URL)
	assert.Equal(t, "http://host2:8082/health/live", instances[1].HealthURL)

	// Third instance (uses default port)
	assert.Equal(t, "instance3", instances[2].ID)
	assert.Equal(t, "http://host3:8081", instances[2].URL)
	assert.Equal(t, "http://host3:8081/health/live", instances[2].HealthURL)
}

func TestLoadBalancerConfigFromEnv(t *testing.T) {
	// Test default configuration
	config := getLoadBalancerConfig("test-service")

	assert.Equal(t, loadbalancer.RoundRobin, config.Strategy)
	assert.Equal(t, int64(5), config.MaxFailures)
	assert.Equal(t, 30*time.Second, config.Timeout)
	assert.Equal(t, 60*time.Second, config.RecoveryTimeout)

	// Test custom configuration via environment
	originalEnvs := map[string]string{}
	envVars := []string{
		"TEST_SERVICE_LB_STRATEGY", "TEST_SERVICE_LB_MAX_FAILURES",
		"TEST_SERVICE_LB_TIMEOUT", "TEST_SERVICE_LB_RECOVERY_TIMEOUT",
	}

	// Save original environment
	for _, env := range envVars {
		originalEnvs[env] = os.Getenv(env)
	}

	// Clean up after test
	defer func() {
		for _, env := range envVars {
			if val, exists := originalEnvs[env]; exists && val != "" {
				os.Setenv(env, val)
			} else {
				os.Unsetenv(env)
			}
		}
	}()

	// Set custom values
	os.Setenv("TEST_SERVICE_LB_STRATEGY", "least-connections")
	os.Setenv("TEST_SERVICE_LB_MAX_FAILURES", "10")
	os.Setenv("TEST_SERVICE_LB_TIMEOUT", "45")
	os.Setenv("TEST_SERVICE_LB_RECOVERY_TIMEOUT", "120")

	config = getLoadBalancerConfig("test-service")

	assert.Equal(t, loadbalancer.LeastConnections, config.Strategy)
	assert.Equal(t, int64(10), config.MaxFailures)
	assert.Equal(t, 45*time.Second, config.Timeout)
	assert.Equal(t, 120*time.Second, config.RecoveryTimeout)
}

func TestRetryConfigFromEnv(t *testing.T) {
	// Test default retry configuration
	config := getRetryConfig("test-service")

	assert.Equal(t, 3, config.MaxRetries)
	assert.Equal(t, 100*time.Millisecond, config.BaseDelay)
	assert.Equal(t, 5*time.Second, config.MaxDelay)
	assert.True(t, config.Jitter)

	// Test custom configuration via environment
	originalEnvs := map[string]string{}
	envVars := []string{
		"TEST_SERVICE_RETRY_MAX", "TEST_SERVICE_RETRY_BASE_DELAY",
		"TEST_SERVICE_RETRY_MAX_DELAY", "TEST_SERVICE_RETRY_JITTER",
		"TEST_SERVICE_RETRY_PROFILE",
	}

	// Save original environment
	for _, env := range envVars {
		originalEnvs[env] = os.Getenv(env)
	}

	// Clean up after test
	defer func() {
		for _, env := range envVars {
			if val, exists := originalEnvs[env]; exists && val != "" {
				os.Setenv(env, val)
			} else {
				os.Unsetenv(env)
			}
		}
	}()

	// Test aggressive profile
	os.Setenv("TEST_SERVICE_RETRY_PROFILE", "aggressive")
	os.Setenv("TEST_SERVICE_RETRY_MAX", "7")
	os.Setenv("TEST_SERVICE_RETRY_BASE_DELAY", "50")
	os.Setenv("TEST_SERVICE_RETRY_MAX_DELAY", "10000")
	os.Setenv("TEST_SERVICE_RETRY_JITTER", "false")

	config = getRetryConfig("test-service")

	assert.Equal(t, 7, config.MaxRetries)
	assert.Equal(t, 50*time.Millisecond, config.BaseDelay)
	assert.Equal(t, 10*time.Second, config.MaxDelay)
	assert.False(t, config.Jitter)

	// Test conservative profile
	os.Setenv("TEST_SERVICE_RETRY_PROFILE", "conservative")

	config = getRetryConfig("test-service")

	// Should still override with custom values
	assert.Equal(t, 7, config.MaxRetries)
}

func TestRouteToServiceLoadBalancer(t *testing.T) {
	tests := []struct {
		path        string
		expected    string
		shouldError bool
	}{
		{"/auth/login", "user-svc", false},
		{"/users/123", "user-svc", false},
		{"/location/nearby", "location-svc", false},
		{"/chat/messages", "chat-svc", false},
		{"/ws", "chat-svc", false},
		{"/ai/complete", "ai-svc", false},
		{"/broadcasts/latest", "discovery-svc", false},
		{"/discovery/search", "discovery-svc", false},
		{"/unknown/path", "", true},
		{"/", "", true},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			service, err := RouteToServiceLoadBalancer(test.path)

			if test.shouldError {
				assert.Error(t, err)
				assert.Nil(t, service)
			} else {
				require.NoError(t, err)
				require.NotNil(t, service)
				assert.Equal(t, test.expected, service.Name)
			}
		})
	}
}

func TestGetServiceLoadBalancer(t *testing.T) {
	// Test existing service
	service, err := GetServiceLoadBalancer("user-svc")
	require.NoError(t, err)
	require.NotNil(t, service)
	assert.Equal(t, "user-svc", service.Name)

	// Test non-existent service
	_, err = GetServiceLoadBalancer("non-existent-svc")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestGetAllServiceLoadBalancers(t *testing.T) {
	services := GetAllServiceLoadBalancers()

	require.NotNil(t, services)
	assert.Len(t, services, 5) // Should have all 5 services

	expectedServices := []string{
		"user-svc", "location-svc", "chat-svc", "ai-svc",
		"discovery-svc",
	}

	for _, serviceName := range expectedServices {
		assert.Contains(t, services, serviceName)
		assert.Equal(t, serviceName, services[serviceName].Name)
	}
}

func TestGetLoadBalancerStats(t *testing.T) {
	stats := GetLoadBalancerStats()

	require.NotNil(t, stats)
	assert.Len(t, stats, 5) // Should have stats for all 5 services

	// Check structure of stats for one service
	userServiceStats, exists := stats["user-svc"]
	require.True(t, exists)

	serviceStatsMap := userServiceStats.(map[string]interface{})
	assert.Contains(t, serviceStatsMap, "load_balancer")
	assert.Contains(t, serviceStatsMap, "retry")

	// Load balancer stats should contain expected fields
	lbStats := serviceStatsMap["load_balancer"].(map[string]interface{})
	assert.Contains(t, lbStats, "strategy")
	assert.Contains(t, lbStats, "total_instances")
	assert.Contains(t, lbStats, "healthy_instances")
}

func TestEnvParsing(t *testing.T) {
	// Test getEnv function
	originalValue := os.Getenv("TEST_ENV_VAR")
	defer func() {
		if originalValue != "" {
			os.Setenv("TEST_ENV_VAR", originalValue)
		} else {
			os.Unsetenv("TEST_ENV_VAR")
		}
	}()

	// Test default value
	value := getEnv("TEST_ENV_VAR", "default_value")
	assert.Equal(t, "default_value", value)

	// Test actual value
	os.Setenv("TEST_ENV_VAR", "actual_value")
	value = getEnv("TEST_ENV_VAR", "default_value")
	assert.Equal(t, "actual_value", value)

	// Test getEnvAsInt function
	originalIntValue := os.Getenv("TEST_INT_VAR")
	defer func() {
		if originalIntValue != "" {
			os.Setenv("TEST_INT_VAR", originalIntValue)
		} else {
			os.Unsetenv("TEST_INT_VAR")
		}
	}()

	// Test default value
	intValue := getEnvAsInt("TEST_INT_VAR", 42)
	assert.Equal(t, 42, intValue)

	// Test actual value
	os.Setenv("TEST_INT_VAR", "123")
	intValue = getEnvAsInt("TEST_INT_VAR", 42)
	assert.Equal(t, 123, intValue)

	// Test invalid value (should return default)
	os.Setenv("TEST_INT_VAR", "invalid")
	intValue = getEnvAsInt("TEST_INT_VAR", 42)
	assert.Equal(t, 42, intValue)
}
