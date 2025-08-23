package config

import (
	"fmt"
	"strings"
	"time"
)

// K8sServiceConfig holds Kubernetes service discovery configuration
type K8sServiceConfig struct {
	Services map[string]*K8sService
}

// K8sService represents a Kubernetes service configuration
type K8sService struct {
	Name         string
	URL          string
	HealthPath   string
	Timeout      time.Duration
	Namespace    string
}

var k8sServiceConfig *K8sServiceConfig

// GetK8sServiceConfig returns the Kubernetes service configuration
func GetK8sServiceConfig() *K8sServiceConfig {
	if k8sServiceConfig == nil {
		k8sServiceConfig = initializeK8sServiceConfig()
	}
	return k8sServiceConfig
}

// ResetK8sServiceConfig resets the configuration (for testing)
func ResetK8sServiceConfig() {
	k8sServiceConfig = nil
}

// initializeK8sServiceConfig initializes the Kubernetes service configuration
func initializeK8sServiceConfig() *K8sServiceConfig {
	namespace := getEnv("K8S_NAMESPACE", "link-services")
	clusterDomain := getEnv("K8S_CLUSTER_DOMAIN", "svc.cluster.local")
	
	config := &K8sServiceConfig{
		Services: make(map[string]*K8sService),
	}

	// Check if we have explicit service URLs (for Docker Compose local dev)
	// If not, use K8s service discovery
	config.Services["user-svc"] = createServiceConfig(
		"user-svc", "USER_SVC_URL", namespace, clusterDomain, 8080, 30*time.Second)
	
	config.Services["chat-svc"] = createServiceConfig(
		"chat-svc", "CHAT_SVC_URL", namespace, clusterDomain, 8080, 30*time.Second)
	
	config.Services["discovery-svc"] = createServiceConfig(
		"discovery-svc", "DISCOVERY_SVC_URL", namespace, clusterDomain, 8080, 30*time.Second)
	
	config.Services["ai-svc"] = createServiceConfig(
		"ai-svc", "AI_SVC_URL", namespace, clusterDomain, 8080, 60*time.Second)
	
	config.Services["search-svc"] = createServiceConfig(
		"search-svc", "SEARCH_SVC_URL", namespace, clusterDomain, 8080, 30*time.Second)

	return config
}

// createServiceConfig creates a service config with fallback to env vars or K8s discovery
func createServiceConfig(serviceName, envVar, namespace, clusterDomain string, port int, timeout time.Duration) *K8sService {
	// Check if explicit URL is provided (for Docker Compose)
	if explicitURL := getEnv(envVar, ""); explicitURL != "" {
		return &K8sService{
			Name:         serviceName,
			URL:          explicitURL,
			HealthPath:   "/health/ready",
			Timeout:      timeout,
			Namespace:    namespace,
		}
	}
	
	// Fallback to K8s service discovery
	return &K8sService{
		Name:         serviceName,
		URL:          buildK8sServiceURL(serviceName, namespace, clusterDomain, port),
		HealthPath:   "/health/ready",
		Timeout:      timeout,
		Namespace:    namespace,
	}
}

// buildK8sServiceURL constructs the Kubernetes service DNS URL
func buildK8sServiceURL(serviceName, namespace, clusterDomain string, port int) string {
	return fmt.Sprintf("http://%s.%s.%s:%d", serviceName, namespace, clusterDomain, port)
}

// GetK8sService returns a specific Kubernetes service configuration
func GetK8sService(serviceName string) (*K8sService, error) {
	config := GetK8sServiceConfig()
	
	service, exists := config.Services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}
	
	return service, nil
}

// RouteToK8sService determines which Kubernetes service should handle a request
func RouteToK8sService(path string) (*K8sService, error) {
	serviceName := ""
	switch {
	case matchesPath(path, "/auth/", "/users/"):
		serviceName = "user-svc"
	case matchesPath(path, "/chat/", "/ws"):
		serviceName = "chat-svc"
	case matchesPath(path, "/ai/"):
		serviceName = "ai-svc"
	case matchesPath(path, "/broadcasts/", "/discovery/", "/cues/"):
		serviceName = "discovery-svc"
	case matchesPath(path, "/search"):
		serviceName = "search-svc"
	default:
		return nil, fmt.Errorf("no service found for path: %s", path)
	}

	return GetK8sService(serviceName)
}

// matchesPath checks if a path matches any of the given patterns
func matchesPath(path string, patterns ...string) bool {
	for _, pattern := range patterns {
		if strings.HasPrefix(path, pattern) {
			return true
		}
	}
	return false
}

