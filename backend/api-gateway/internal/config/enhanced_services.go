package config

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/link-app/api-gateway/internal/loadbalancer"
	"github.com/link-app/api-gateway/internal/retry"
)

// EnhancedServiceConfig holds configuration for backend services with load balancing support
type EnhancedServiceConfig struct {
	Services map[string]*ServiceLoadBalancer
}

// ServiceLoadBalancer manages multiple instances of a service
type ServiceLoadBalancer struct {
	Name         string
	LoadBalancer *loadbalancer.LoadBalancer
	Retrier      *retry.Retrier
	Instances    []ServiceInstanceConfig
}

// ServiceInstanceConfig represents configuration for a single service instance
type ServiceInstanceConfig struct {
	ID        string
	URL       string
	HealthURL string
	Weight    int
	Timeout   time.Duration
}

// LoadBalancerConfig holds load balancer configuration
type LoadBalancerConfig struct {
	Strategy        loadbalancer.LoadBalancingStrategy
	MaxFailures     int64
	Timeout         time.Duration
	RecoveryTimeout time.Duration
}

var enhancedServiceConfig *EnhancedServiceConfig

// LoadEnhancedServicesConfig loads and returns the enhanced service configuration
// This function is compatible with the main.go startup sequence
func LoadEnhancedServicesConfig() (*EnhancedServiceConfig, error) {
	return GetEnhancedServiceConfig(), nil
}

// GetEnhancedServiceConfig returns the enhanced service configuration
func GetEnhancedServiceConfig() *EnhancedServiceConfig {
	if enhancedServiceConfig == nil {
		enhancedServiceConfig = initializeEnhancedServiceConfig()
	}
	return enhancedServiceConfig
}

// initializeEnhancedServiceConfig initializes the enhanced service configuration
func initializeEnhancedServiceConfig() *EnhancedServiceConfig {
	config := &EnhancedServiceConfig{
		Services: make(map[string]*ServiceLoadBalancer),
	}

	// Initialize each service with its instances
	config.Services["user-svc"] = createServiceLoadBalancer("user-svc", getUserServiceInstances())
	config.Services["location-svc"] = createServiceLoadBalancer("location-svc", getLocationServiceInstances())
	config.Services["chat-svc"] = createServiceLoadBalancer("chat-svc", getChatServiceInstances())
	config.Services["ai-svc"] = createServiceLoadBalancer("ai-svc", getAIServiceInstances())
	config.Services["discovery-svc"] = createServiceLoadBalancer("discovery-svc", getDiscoveryServiceInstances())

	// Start health checking for all services
	for _, service := range config.Services {
		service.LoadBalancer.StartHealthChecking()
	}

	return config
}

// createServiceLoadBalancer creates a load balancer for a service with its instances
func createServiceLoadBalancer(serviceName string, instances []ServiceInstanceConfig) *ServiceLoadBalancer {
	// Get load balancer configuration
	lbConfig := getLoadBalancerConfig(serviceName)

	// Create load balancer
	lb := loadbalancer.NewLoadBalancer(
		lbConfig.Strategy,
		lbConfig.MaxFailures,
		lbConfig.Timeout,
		lbConfig.RecoveryTimeout,
	)

	// Add instances to load balancer
	for _, instance := range instances {
		lb.AddInstance(
			instance.ID,
			instance.URL,
			instance.HealthURL,
			instance.Weight,
			instance.Timeout,
		)
	}

	// Create retrier
	retryConfig := getRetryConfig(serviceName)
	retrier := retry.NewRetrier(retryConfig)

	return &ServiceLoadBalancer{
		Name:         serviceName,
		LoadBalancer: lb,
		Retrier:      retrier,
		Instances:    instances,
	}
}

// getUserServiceInstances returns user service instance configurations
func getUserServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("USER_SVC", "user-svc", 8081, 30*time.Second)
}

// getLocationServiceInstances returns location service instance configurations
func getLocationServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("LOCATION_SVC", "location-svc", 8080, 30*time.Second)
}

// getChatServiceInstances returns chat service instance configurations
func getChatServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("CHAT_SVC", "chat-svc", 8082, 30*time.Second)
}

// getAIServiceInstances returns AI service instance configurations
func getAIServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("AI_SVC", "ai-svc", 8084, 60*time.Second)
}

// getDiscoveryServiceInstances returns discovery service instance configurations
func getDiscoveryServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("DISCOVERY_SVC", "discovery-svc", 8083, 30*time.Second)
}


// getServiceInstances creates service instance configurations from environment variables
func getServiceInstances(envPrefix, defaultServiceName string, defaultPort int, defaultTimeout time.Duration) []ServiceInstanceConfig {
	// Check for multiple instances configuration
	instancesEnv := getEnv(envPrefix+"_INSTANCES", "")

	var instances []ServiceInstanceConfig

	if instancesEnv != "" {
		// Parse multiple instances from environment variable
		// Format: "instance1:host1:port1,instance2:host2:port2"
		instancePairs := strings.Split(instancesEnv, ",")

		for i, pair := range instancePairs {
			parts := strings.Split(strings.TrimSpace(pair), ":")
			if len(parts) >= 2 {
				id := parts[0]
				host := parts[1]
				port := defaultPort

				if len(parts) >= 3 {
					if p, err := strconv.Atoi(parts[2]); err == nil {
						port = p
					}
				}

				url := fmt.Sprintf("http://%s:%d", host, port)
				healthURL := fmt.Sprintf("http://%s:%d/health/live", host, port)

				instances = append(instances, ServiceInstanceConfig{
					ID:        id,
					URL:       url,
					HealthURL: healthURL,
					Weight:    1, // Equal weight by default
					Timeout:   defaultTimeout,
				})
			} else {
				// Fallback to default naming for malformed entries
				instances = append(instances, ServiceInstanceConfig{
					ID:        fmt.Sprintf("%s-%d", defaultServiceName, i+1),
					URL:       fmt.Sprintf("http://%s:%d", defaultServiceName, defaultPort),
					HealthURL: fmt.Sprintf("http://%s:%d/health/live", defaultServiceName, defaultPort),
					Weight:    1,
					Timeout:   defaultTimeout,
				})
			}
		}
	} else {
		// Single instance configuration (backward compatibility)
		url := getEnv(envPrefix+"_URL", fmt.Sprintf("http://%s:%d", defaultServiceName, defaultPort))
		healthURL := getEnv(envPrefix+"_HEALTH_URL", fmt.Sprintf("http://%s:%d/health/live", defaultServiceName, defaultPort))
		timeout := time.Duration(getEnvAsInt(envPrefix+"_TIMEOUT", int(defaultTimeout/time.Second))) * time.Second

		instances = append(instances, ServiceInstanceConfig{
			ID:        fmt.Sprintf("%s-1", defaultServiceName),
			URL:       url,
			HealthURL: healthURL,
			Weight:    1,
			Timeout:   timeout,
		})
	}

	return instances
}

// getLoadBalancerConfig returns load balancer configuration for a service
func getLoadBalancerConfig(serviceName string) LoadBalancerConfig {
	envPrefix := strings.ToUpper(strings.ReplaceAll(serviceName, "-", "_"))

	// Default strategy is round robin
	strategy := loadbalancer.RoundRobin
	strategyStr := getEnv(envPrefix+"_LB_STRATEGY", "round-robin")

	switch strings.ToLower(strategyStr) {
	case "random":
		strategy = loadbalancer.Random
	case "least-connections":
		strategy = loadbalancer.LeastConnections
	}

	maxFailures := int64(getEnvAsInt(envPrefix+"_LB_MAX_FAILURES", 5))
	timeout := time.Duration(getEnvAsInt(envPrefix+"_LB_TIMEOUT", 30)) * time.Second
	recoveryTimeout := time.Duration(getEnvAsInt(envPrefix+"_LB_RECOVERY_TIMEOUT", 60)) * time.Second

	return LoadBalancerConfig{
		Strategy:        strategy,
		MaxFailures:     maxFailures,
		Timeout:         timeout,
		RecoveryTimeout: recoveryTimeout,
	}
}

// getRetryConfig returns retry configuration for a service
func getRetryConfig(serviceName string) *retry.RetryConfig {
	envPrefix := strings.ToUpper(strings.ReplaceAll(serviceName, "-", "_"))

	maxRetries := getEnvAsInt(envPrefix+"_RETRY_MAX", 3)
	baseDelayMs := getEnvAsInt(envPrefix+"_RETRY_BASE_DELAY", 100)
	maxDelayMs := getEnvAsInt(envPrefix+"_RETRY_MAX_DELAY", 5000)
	jitter := getEnv(envPrefix+"_RETRY_JITTER", "true") == "true"

	// Use default retryable errors, but allow customization
	profileStr := getEnv(envPrefix+"_RETRY_PROFILE", "default")

	var config *retry.RetryConfig
	switch strings.ToLower(profileStr) {
	case "aggressive":
		config = retry.AggressiveRetryConfig()
	case "conservative":
		config = retry.ConservativeRetryConfig()
	default:
		config = retry.DefaultRetryConfig()
	}

	// Override with specific values if provided
	config.MaxRetries = maxRetries
	config.BaseDelay = time.Duration(baseDelayMs) * time.Millisecond
	config.MaxDelay = time.Duration(maxDelayMs) * time.Millisecond
	config.Jitter = jitter

	return config
}

// RouteToServiceLoadBalancer determines which service load balancer should handle a request
func RouteToServiceLoadBalancer(path string) (*ServiceLoadBalancer, error) {
	config := GetEnhancedServiceConfig()

	serviceName := ""
	switch {
	case matchesPath(path, "/auth/", "/users/"):
		serviceName = "user-svc"
	case matchesPath(path, "/location/"):
		serviceName = "location-svc"
	case matchesPath(path, "/chat/", "/ws"):
		serviceName = "chat-svc"
	case matchesPath(path, "/ai/"):
		serviceName = "ai-svc"
	case matchesPath(path, "/broadcasts/", "/discovery/"):
		serviceName = "discovery-svc"
	case matchesPath(path, "/search/"):
		serviceName = "search-svc"
	case matchesPath(path, "/opportunities/"):
		serviceName = "opportunities-svc"
	default:
		return nil, fmt.Errorf("no service found for path: %s", path)
	}

	service, exists := config.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not configured", serviceName)
	}

	return service, nil
}

// GetServiceLoadBalancer returns a specific service load balancer
func GetServiceLoadBalancer(serviceName string) (*ServiceLoadBalancer, error) {
	config := GetEnhancedServiceConfig()

	service, exists := config.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}

	return service, nil
}

// GetAllServiceLoadBalancers returns all service load balancers
func GetAllServiceLoadBalancers() map[string]*ServiceLoadBalancer {
	config := GetEnhancedServiceConfig()

	// Return a copy to prevent external modification
	services := make(map[string]*ServiceLoadBalancer)
	for name, service := range config.Services {
		services[name] = service
	}

	return services
}

// GetLoadBalancerStats returns statistics for all load balancers
func GetLoadBalancerStats() map[string]interface{} {
	config := GetEnhancedServiceConfig()

	stats := make(map[string]interface{})
	for serviceName, service := range config.Services {
		lbStats := service.LoadBalancer.GetStats()
		retryStats := service.Retrier.GetStats()

		stats[serviceName] = map[string]interface{}{
			"load_balancer": lbStats,
			"retry":         retryStats,
		}
	}

	return stats
}

// GetLoadBalancer returns the load balancer for a specific service
func (c *EnhancedServiceConfig) GetLoadBalancer(serviceName string) (*loadbalancer.LoadBalancer, error) {
	service, exists := c.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}
	return service.LoadBalancer, nil
}

// GetRetrier returns the retrier for a specific service
func (c *EnhancedServiceConfig) GetRetrier(serviceName string) (*retry.Retrier, error) {
	service, exists := c.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}
	return service.Retrier, nil
}

// StopAllHealthCheckers stops health checking for all services
func StopAllHealthCheckers() {
	config := GetEnhancedServiceConfig()

	for _, service := range config.Services {
		service.LoadBalancer.StopHealthChecking()
	}
}
