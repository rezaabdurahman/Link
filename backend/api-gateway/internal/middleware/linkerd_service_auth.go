package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// LinkerdServiceAuthMiddleware - CORRECTED IMPLEMENTATION
// 
// Key Insight: Linkerd has ALREADY authenticated the service via mTLS
// We just need to extract the identity for authorization decisions
func LinkerdServiceAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip service auth if this is a user request (user JWT already validated)
		if userID, exists := c.Get("user_id"); exists && userID != nil {
			c.Set("is_user_request", true)
			c.Header("X-Request-Type", "user")
			c.Next()
			return
		}

		// Check if this is a public endpoint
		if isPublicServiceEndpoint(c.Request.URL.Path) {
			c.Set("is_public_endpoint", true)
			c.Next()
			return
		}

		// Extract Linkerd service identity (INFORMATIONAL ONLY)
		// If this header exists, Linkerd has ALREADY validated the mTLS certificate
		clientID := c.GetHeader("l5d-client-id")
		connectionSecure := c.GetHeader("l5d-connection-secure") 
		
		// Key Insight: If we're here, the connection was already authenticated by Linkerd
		// The l5d-client-id header is just for authorization decisions
		
		if clientID != "" && connectionSecure == "true" {
			// Extract service name from Linkerd identity (for logging/authorization)
			serviceName := extractServiceNameFromLinkerdID(clientID)
			
			// Log the authenticated service (for audit)
			logServiceAuthEvent("LINKERD_SERVICE_AUTHENTICATED", serviceName, 
				c.Request.URL.Path, c.Request.Method, clientID, c.ClientIP())
			
			// Set service context (NO VALIDATION NEEDED - Linkerd already did it)
			c.Set("service_name", serviceName)
			c.Set("linkerd_client_id", clientID)
			c.Set("is_service_request", true)
			
			// Propagate identity to downstream services
			c.Header("X-Service-Name", serviceName)
			c.Header("X-Linkerd-Identity", clientID)
			c.Header("X-Request-Type", "service")
		} else {
			// No Linkerd identity - could be:
			// 1. Direct call bypassing service mesh (not allowed)
			// 2. Request from outside cluster
			// 3. Linkerd not properly configured
			
			logServiceAuthEvent("NO_SERVICE_MESH_IDENTITY", "", c.Request.URL.Path, 
				c.Request.Method, "Request not from authenticated service mesh", c.ClientIP())
			
			// IMPORTANT: This is the security boundary
			// Only allow requests that came through the service mesh
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "SERVICE_MESH_REQUIRED",
				"message":   "Requests must come through authenticated service mesh",
				"code":      "NO_MESH_IDENTITY",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireServiceIdentity - Authorization (not authentication)
func RequireServiceIdentity(allowedServices ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for user requests
		if isUserRequest, exists := c.Get("is_user_request"); exists && isUserRequest.(bool) {
			c.Next()
			return
		}

		// Get the service name (already authenticated by Linkerd)
		serviceName, exists := c.Get("service_name")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":     "AUTHORIZATION_ERROR",
				"message":   "Service identity required for authorization",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		serviceNameStr := serviceName.(string)
		
		// Authorization check (not authentication - that's already done)
		if len(allowedServices) > 0 {
			allowed := false
			for _, allowedService := range allowedServices {
				if serviceNameStr == allowedService {
					allowed = true
					break
				}
			}
			
			if !allowed {
				logServiceAuthEvent("SERVICE_AUTHORIZATION_DENIED", serviceNameStr,
					c.Request.URL.Path, c.Request.Method, 
					"Service not in allowed list", c.ClientIP())
				
				c.JSON(http.StatusForbidden, gin.H{
					"error":           "AUTHORIZATION_ERROR", 
					"message":         "Service not authorized for this endpoint",
					"service":         serviceNameStr,
					"allowed_services": allowedServices,
					"timestamp":       time.Now(),
				})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// Helper functions

// extractServiceNameFromLinkerdID extracts service name from Linkerd client ID
func extractServiceNameFromLinkerdID(clientID string) string {
	// Expected format: "service-account.namespace.serviceaccount.identity.linkerd.cluster.local"
	// Example: "link-user-service-sa.link-services.serviceaccount.identity.linkerd.cluster.local"
	
	parts := strings.Split(clientID, ".")
	if len(parts) < 2 {
		return "unknown"
	}
	
	serviceAccount := parts[0]
	
	// Map service accounts to service names (same as before)
	serviceAccountMappings := map[string]string{
		"link-api-gateway-sa":     "api-gateway",
		"link-user-service-sa":    "user-svc", 
		"link-chat-service-sa":    "chat-svc",
		"link-ai-service-sa":      "ai-svc",
		"link-discovery-service-sa": "discovery-svc",
		"link-search-service-sa":  "search-svc",
		"link-feature-service-sa": "feature-svc",
	}
	
	if serviceName, exists := serviceAccountMappings[serviceAccount]; exists {
		return serviceName
	}
	
	// Fallback parsing
	if strings.HasPrefix(serviceAccount, "link-") && strings.HasSuffix(serviceAccount, "-sa") {
		// Remove "link-" prefix and "-sa" suffix
		middle := serviceAccount[5 : len(serviceAccount)-3]
		if strings.HasSuffix(middle, "-service") {
			baseName := middle[:len(middle)-8] // Remove "-service"
			return baseName + "-svc"
		}
		return middle
	}
	
	return serviceAccount // fallback to raw service account name
}

// isPublicServiceEndpoint checks if endpoint doesn't require service auth
func isPublicServiceEndpoint(path string) bool {
	publicEndpoints := []string{
		"/health",
		"/health/live", 
		"/health/ready",
		"/metrics",
		"/favicon.ico",
		"/robots.txt",
		// Auth endpoints (for user login)
		"/api/v1/auth/login",
		"/api/v1/auth/register", 
		"/api/v1/auth/refresh",
	}
	
	for _, endpoint := range publicEndpoints {
		if path == endpoint {
			return true
		}
	}
	
	// Pattern matching for public paths
	publicPrefixes := []string{
		"/static/",
		"/.well-known/",
		"/docs/", // API documentation
	}
	
	for _, prefix := range publicPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	
	return false
}

// logServiceAuthEvent logs service authentication events
func logServiceAuthEvent(event, serviceName, path, method, details, clientIP string) {
	log.WithFields(log.Fields{
		"event":        event,
		"service_name": serviceName, 
		"path":         path,
		"method":       method,
		"client_ip":    clientIP,
		"details":      details,
		"timestamp":    time.Now().Unix(),
		"component":    "linkerd_service_auth",
	}).Info("Service mesh authentication event")
}