package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	ServiceTokenHeader     = "X-Service-Token"
	ServiceSignatureHeader = "X-Service-Signature"
	ServiceTimestampHeader = "X-Service-Timestamp"
	ServiceIDHeader        = "X-Service-ID"
	RequestTimeWindow      = 300 // 5 minutes
)

// ServiceAuthConfig holds configuration for service-to-service authentication
type ServiceAuthConfig struct {
	ServiceID     string
	ServiceSecret string
}

// GetServiceAuthConfig returns service auth configuration from environment
func GetServiceAuthConfig() *ServiceAuthConfig {
	return &ServiceAuthConfig{
		ServiceID:     getEnv("SERVICE_ID", "api-gateway"),
		ServiceSecret: getEnv("SERVICE_SECRET", "change-this-service-secret"),
	}
}

// ServiceAuthMiddleware adds authentication headers for outgoing requests to services
func ServiceAuthMiddleware(config *ServiceAuthConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Add service authentication headers for downstream services
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		
		// Create signature: HMAC-SHA256(service_id + timestamp + request_path, service_secret)
		message := fmt.Sprintf("%s%s%s", config.ServiceID, timestamp, c.Request.URL.Path)
		signature := createHMACSignature(message, config.ServiceSecret)
		
		// Set headers for downstream services
		c.Header(ServiceIDHeader, config.ServiceID)
		c.Header(ServiceTimestampHeader, timestamp)
		c.Header(ServiceSignatureHeader, signature)
		
		c.Next()
	}
}

// ValidateServiceAuthMiddleware validates incoming requests from other services
func ValidateServiceAuthMiddleware(config *ServiceAuthConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip validation for public endpoints
		if isPublicServiceEndpoint(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Extract service auth headers
		serviceID := c.GetHeader(ServiceIDHeader)
		timestamp := c.GetHeader(ServiceTimestampHeader)
		signature := c.GetHeader(ServiceSignatureHeader)

		if serviceID == "" || timestamp == "" || signature == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "SERVICE_AUTH_ERROR",
				"message": "Missing service authentication headers",
				"code":    "MISSING_SERVICE_AUTH",
			})
			c.Abort()
			return
		}

		// Validate timestamp (prevent replay attacks)
		if !isValidTimestamp(timestamp) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "SERVICE_AUTH_ERROR",
				"message": "Invalid or expired timestamp",
				"code":    "INVALID_TIMESTAMP",
			})
			c.Abort()
			return
		}

		// Validate signature
		expectedMessage := fmt.Sprintf("%s%s%s", serviceID, timestamp, c.Request.URL.Path)
		expectedSignature := createHMACSignature(expectedMessage, config.ServiceSecret)
		
		if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "SERVICE_AUTH_ERROR",
				"message": "Invalid service signature",
				"code":    "INVALID_SIGNATURE",
			})
			c.Abort()
			return
		}

		// Set validated service ID in context
		c.Set("service_id", serviceID)
		c.Next()
	}
}

// createHMACSignature creates an HMAC-SHA256 signature
func createHMACSignature(message, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// isValidTimestamp checks if the timestamp is within the allowed time window
func isValidTimestamp(timestampStr string) bool {
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return false
	}

	now := time.Now().Unix()
	diff := now - timestamp

	// Allow requests within the time window (both past and future for clock skew)
	return diff >= -RequestTimeWindow && diff <= RequestTimeWindow
}

// isPublicServiceEndpoint checks if an endpoint is public for service access
func isPublicServiceEndpoint(path string) bool {
	publicServiceEndpoints := []string{
		"/health",
		"/metrics",
		"/ready",
	}

	for _, endpoint := range publicServiceEndpoints {
		if path == endpoint {
			return true
		}
	}

	return false
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
