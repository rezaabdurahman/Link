package config

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/link-app/api-gateway/internal/loadbalancer"
	"github.com/link-app/api-gateway/internal/retry"
)

// ServiceConfig holds configuration for backend services with load balancing support
type ServiceConfigEnhanced struct {
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

var serviceConfig *ServiceConfigEnhanced

// LoadServicesConfig loads and returns the service configuration
// This function is compatible with the main.go startup sequence
func LoadServicesConfig() (*ServiceConfigEnhanced, error) {
	return GetServiceConfigEnhanced(), nil
}

// GetServiceConfigEnhanced returns the service configuration with load balancing
func GetServiceConfigEnhanced() *ServiceConfigEnhanced {
	if serviceConfig == nil {
		serviceConfig = initializeServiceConfig()
	}
	return serviceConfig
}

// initializeServiceConfig initializes the service configuration
func initializeServiceConfig() *ServiceConfigEnhanced {
	config := &ServiceConfigEnhanced{
		Services: make(map[string]*ServiceLoadBalancer),
	}

	// Initialize each service with its instances
	config.Services["user-svc"] = createServiceLoadBalancer("user-svc", getUserServiceInstances())
	config.Services["location-svc"] = createServiceLoadBalancer("location-svc", getLocationServiceInstances())
	config.Services["chat-svc"] = createServiceLoadBalancer("chat-svc", getChatServiceInstances())
	config.Services["summarygen-svc"] = createServiceLoadBalancer("summarygen-svc", getSummarygenServiceInstances())
	config.Services["discovery-svc"] = createServiceLoadBalancer("discovery-svc", getDiscoveryServiceInstances())
	config.Services["priority-svc"] = createServiceLoadBalancer("priority-svc", getPriorityServiceInstances())
	config.Services["search-svc"] = createServiceLoadBalancer("search-svc", getSearchServiceInstances())
	config.Services["opportunities-svc"] = createServiceLoadBalancer("opportunities-svc", getOpportunitiesServiceInstances())
	config.Services["consent-svc"] = createServiceLoadBalancer("consent-svc", getConsentServiceInstances())
	config.Services["subscription-svc"] = createServiceLoadBalancer("subscription-svc", getSubscriptionServiceInstances())

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

// getSummarygenServiceInstances returns summary generation service instance configurations
func getSummarygenServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("SUMMARYGEN_SVC", "summarygen-svc", 8084, 60*time.Second)
}

// getDiscoveryServiceInstances returns discovery service instance configurations
func getDiscoveryServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("DISCOVERY_SVC", "discovery-svc", 8083, 30*time.Second)
}

// getPriorityServiceInstances returns priority service instance configurations
func getPriorityServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("PRIORITY_SVC", "priority-svc", 8087, 30*time.Second)
}

// getSearchServiceInstances returns search service instance configurations
func getSearchServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("SEARCH_SVC", "search-svc", 8085, 30*time.Second)
}

// getOpportunitiesServiceInstances returns opportunities service instance configurations
func getOpportunitiesServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("OPPORTUNITIES_SVC", "opportunities-svc", 8086, 30*time.Second)
}

// getConsentServiceInstances returns consent service instance configurations
func getConsentServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("CONSENT_SVC", "consent-svc", 8088, 30*time.Second)
}

// getSubscriptionServiceInstances returns subscription service instance configurations
func getSubscriptionServiceInstances() []ServiceInstanceConfig {
	return getServiceInstances("SUBSCRIPTION_SVC", "subscription-svc", 8089, 30*time.Second)
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
	config := GetServiceConfigEnhanced()

	serviceName := ""
	switch {
	case matchesPath(path, "/auth/", "/users/"):
		serviceName = "user-svc"
	case matchesPath(path, "/location/"):
		serviceName = "location-svc"
	case matchesPath(path, "/chat/", "/ws"):
		serviceName = "chat-svc"
	case matchesPath(path, "/summarygen/", "/ai/"):
		serviceName = "summarygen-svc"
	case matchesPath(path, "/broadcasts/", "/discovery/"):
		serviceName = "discovery-svc"
	case matchesPath(path, "/conversations/priority"):
		serviceName = "priority-svc"
	case matchesPath(path, "/search/"):
		serviceName = "search-svc"
	case matchesPath(path, "/opportunities/"):
		serviceName = "opportunities-svc"
	case matchesPath(path, "/consent/"):
		serviceName = "consent-svc"
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
	config := GetServiceConfigEnhanced()

	service, exists := config.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}

	return service, nil
}

// GetAllServiceLoadBalancers returns all service load balancers
func GetAllServiceLoadBalancers() map[string]*ServiceLoadBalancer {
	config := GetServiceConfigEnhanced()

	// Return a copy to prevent external modification
	services := make(map[string]*ServiceLoadBalancer)
	for name, service := range config.Services {
		services[name] = service
	}

	return services
}

// GetLoadBalancerStats returns statistics for all load balancers
func GetLoadBalancerStats() map[string]interface{} {
	config := GetServiceConfigEnhanced()

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
func (c *ServiceConfigEnhanced) GetLoadBalancer(serviceName string) (*loadbalancer.LoadBalancer, error) {
	service, exists := c.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}
	return service.LoadBalancer, nil
}

// GetRetrier returns the retrier for a specific service
func (c *ServiceConfigEnhanced) GetRetrier(serviceName string) (*retry.Retrier, error) {
	service, exists := c.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}
	return service.Retrier, nil
}

// StopAllHealthCheckers stops health checking for all services
func StopAllHealthCheckers() {
	config := GetServiceConfigEnhanced()

	for _, service := range config.Services {
		service.LoadBalancer.StopHealthChecking()
	}
}

// Compatibility layer for simple service configuration access

// ServiceConfig holds configuration for backend services (simple access interface)
type ServiceConfig struct {
	UserService          ServiceEndpoint
	LocationService      ServiceEndpoint
	ChatService          ServiceEndpoint
	SummarygenService    ServiceEndpoint
	AIService            ServiceEndpoint // Deprecated: use SummarygenService
	DiscoveryService     ServiceEndpoint
	PriorityService      ServiceEndpoint
	SearchService        ServiceEndpoint
	OpportunitiesService ServiceEndpoint
	ConsentService       ServiceEndpoint
}

// ServiceEndpoint represents a backend service endpoint
type ServiceEndpoint struct {
	URL       string
	HealthURL string
	Timeout   int // seconds
}

// GetServiceConfig returns service configuration
func GetServiceConfig() *ServiceConfig {
	config := GetServiceConfigEnhanced()
	
	return &ServiceConfig{
		UserService:          getServiceEndpoint(config, "user-svc"),
		LocationService:      getServiceEndpoint(config, "location-svc"),
		ChatService:          getServiceEndpoint(config, "chat-svc"),
		SummarygenService:    getServiceEndpoint(config, "summarygen-svc"),
		AIService:            getServiceEndpoint(config, "summarygen-svc"), // Legacy compatibility
		DiscoveryService:     getServiceEndpoint(config, "discovery-svc"),
		PriorityService:      getServiceEndpoint(config, "priority-svc"),
		SearchService:        getServiceEndpoint(config, "search-svc"),
		OpportunitiesService: getServiceEndpoint(config, "opportunities-svc"),
		ConsentService:       getServiceEndpoint(config, "consent-svc"),
	}
}

// getServiceEndpoint converts enhanced service to legacy ServiceEndpoint
func getServiceEndpoint(config *ServiceConfigEnhanced, serviceName string) ServiceEndpoint {
	service, exists := config.Services[serviceName]
	if !exists || len(service.Instances) == 0 {
		return ServiceEndpoint{}
	}
	
	// Use first instance for legacy compatibility
	instance := service.Instances[0]
	return ServiceEndpoint{
		URL:       instance.URL,
		HealthURL: instance.HealthURL,
		Timeout:   int(instance.Timeout.Seconds()),
	}
}

// RouteToService determines which service should handle a request
func RouteToService(path string) (ServiceEndpoint, error) {
	serviceLoadBalancer, err := RouteToServiceLoadBalancer(path)
	if err != nil {
		return ServiceEndpoint{}, err
	}
	
	// Get the next available instance
	instance, err := serviceLoadBalancer.LoadBalancer.GetNextInstance()
	if err != nil {
		return ServiceEndpoint{}, err
	}
	
	return ServiceEndpoint{
		URL:       instance.URL,
		HealthURL: instance.HealthURL,
		Timeout:   int(instance.Timeout.Seconds()),
	}, nil
}

// TransformPath transforms gateway paths to service paths
func TransformPath(gatewayPath string) string {
	// Add /api/v1 prefix if not already present
	if len(gatewayPath) > 0 && gatewayPath[0] == '/' && gatewayPath != "/health" {
		if len(gatewayPath) < 7 || gatewayPath[:7] != "/api/v1" {
			return "/api/v1" + gatewayPath
		}
	}
	
	return gatewayPath
}
