package config

import (
	"fmt"
)

// ServiceConfig holds configuration for backend services
type ServiceConfig struct {
	UserService      ServiceEndpoint
	LocationService  ServiceEndpoint
	ChatService      ServiceEndpoint
	AIService        ServiceEndpoint
	DiscoveryService ServiceEndpoint
}

// ServiceEndpoint represents a backend service endpoint
type ServiceEndpoint struct {
	URL       string
	HealthURL string
	Timeout   int // seconds
}

// GetServiceConfig returns service configuration from environment
func GetServiceConfig() *ServiceConfig {
	return &ServiceConfig{
		UserService: ServiceEndpoint{
			URL:       getEnv("USER_SVC_URL", "http://user-svc:8080"),
			HealthURL: getEnv("USER_SVC_HEALTH_URL", "http://user-svc:8080/health"),
			Timeout:   getEnvAsInt("USER_SVC_TIMEOUT", 30),
		},
		LocationService: ServiceEndpoint{
			URL:       getEnv("LOCATION_SVC_URL", "http://location-svc:8080"),
			HealthURL: getEnv("LOCATION_SVC_HEALTH_URL", "http://location-svc:8080/health"),
			Timeout:   getEnvAsInt("LOCATION_SVC_TIMEOUT", 30),
		},
		ChatService: ServiceEndpoint{
			URL:       getEnv("CHAT_SVC_URL", "http://chat-svc:8080"),
			HealthURL: getEnv("CHAT_SVC_HEALTH_URL", "http://chat-svc:8080/health"),
			Timeout:   getEnvAsInt("CHAT_SVC_TIMEOUT", 30),
		},
		AIService: ServiceEndpoint{
			URL:       getEnv("AI_SVC_URL", "http://ai-svc:8000"),
			HealthURL: getEnv("AI_SVC_HEALTH_URL", "http://ai-svc:8000/health"),
			Timeout:   getEnvAsInt("AI_SVC_TIMEOUT", 60),
		},
		DiscoveryService: ServiceEndpoint{
			URL:       getEnv("DISCOVERY_SVC_URL", "http://discovery-svc:8080"),
			HealthURL: getEnv("DISCOVERY_SVC_HEALTH_URL", "http://discovery-svc:8080/health"),
			Timeout:   getEnvAsInt("DISCOVERY_SVC_TIMEOUT", 30),
		},
	}
}

// RouteToService determines which service should handle a request based on path
func RouteToService(path string) (ServiceEndpoint, error) {
	config := GetServiceConfig()

	switch {
	case matchesPath(path, "/auth/", "/users/"):
		return config.UserService, nil
	case matchesPath(path, "/location/"):
		return config.LocationService, nil
	case matchesPath(path, "/chat/", "/ws"):
		return config.ChatService, nil
	case matchesPath(path, "/ai/"):
		return config.AIService, nil
	case matchesPath(path, "/broadcasts/", "/discovery/"):
		return config.DiscoveryService, nil
	default:
		return ServiceEndpoint{}, fmt.Errorf("no service found for path: %s", path)
	}
}

// matchesPath checks if a path matches any of the given prefixes
func matchesPath(path string, prefixes ...string) bool {
	for _, prefix := range prefixes {
		if len(path) >= len(prefix) && path[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}

// TransformPath transforms gateway paths to service paths
func TransformPath(gatewayPath string) string {
	// Most paths are direct pass-through, but we can transform them here if needed
	// For example: /auth/login -> /api/v1/auth/login

	// Add /api/v1 prefix if not already present
	if len(gatewayPath) > 0 && gatewayPath[0] == '/' && gatewayPath != "/health" {
		if len(gatewayPath) < 7 || gatewayPath[:7] != "/api/v1" {
			return "/api/v1" + gatewayPath
		}
	}

	return gatewayPath
}
