package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/api-gateway/internal/config"
)

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// AuthMiddleware provides JWT authentication for API Gateway
func AuthMiddleware(jwtValidator *config.JWTValidator, jwtConfig *config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if this is a public endpoint
		if config.IsPublicEndpoint(c.Request.Method, c.Request.URL.Path) {
			c.Next()
			return
		}

		// Extract token from request
		authHeader := c.GetHeader("Authorization")
		cookieValue, _ := c.Cookie(jwtConfig.CookieName)
		token := jwtValidator.ExtractTokenFromRequest(authHeader, cookieValue)

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "AUTHENTICATION_ERROR",
				"message":   "Authorization token required",
				"code":      "MISSING_TOKEN",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		// Detect platform for mobile-specific token validation
		platform := c.GetHeader("X-Platform")
		if platform == "" {
			platform = "web" // Default to web if no platform specified
		}

		// Validate token with platform awareness
		claims, err := jwtValidator.ValidateAccessTokenWithPlatform(token, platform)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "AUTHENTICATION_ERROR",
				"message":   "Invalid or expired token",
				"code":      "INVALID_TOKEN",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		// Set user context in gin context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_username", claims.Username)
		c.Set("user_roles", claims.Roles)
		c.Set("user_permissions", claims.Permissions)
		c.Set("jwt_id", claims.ID)
		c.Set("platform", platform)

		// Set user context headers for downstream services
		c.Header("X-User-ID", claims.UserID.String())
		c.Header("X-User-Email", claims.Email)
		c.Header("X-User-Name", claims.Username)
		c.Header("X-Platform", platform)
		
		// Forward mobile-specific headers to downstream services
		if deviceFingerprint := c.GetHeader("X-Device-Fingerprint"); deviceFingerprint != "" {
			c.Header("X-Device-Fingerprint", deviceFingerprint)
		}
		if deviceID := c.GetHeader("X-Device-ID"); deviceID != "" {
			c.Header("X-Device-ID", deviceID)
		}
		
		// Convert roles and permissions to comma-separated strings for headers
		if len(claims.Roles) > 0 {
			c.Header("X-User-Roles", strings.Join(claims.Roles, ","))
		}
		if len(claims.Permissions) > 0 {
			c.Header("X-User-Permissions", strings.Join(claims.Permissions, ","))
		}

		c.Next()
	}
}

// CORSMiddleware handles CORS for the API Gateway
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// In development, allow all origins. In production, specify allowed origins
		allowedOrigins := []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://localhost:8080",
			"https://link-app.com",
		}

		// Check if origin is allowed
		originAllowed := false
		for _, allowed := range allowedOrigins {
			if origin == allowed {
				originAllowed = true
				break
			}
		}

		if originAllowed || getEnv("ENVIRONMENT", "development") == "development" {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, X-User-Email, X-User-Name, X-Requested-With, X-Platform, X-Device-Fingerprint, X-Refresh-Token, X-Device-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400") // 24 hours

		// Handle preflight OPTIONS requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RequestLoggingMiddleware logs incoming requests
func RequestLoggingMiddleware() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("[GATEWAY] %s - [%s] \"%s %s %s\" %d %s \"%s\" \"%s\" %s\n",
			param.ClientIP,
			param.TimeStamp.Format("02/Jan/2006:15:04:05 -0700"),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.Request.Referer(),
			param.ErrorMessage,
		)
	})
}

// RateLimitingMiddleware provides basic rate limiting
func RateLimitingMiddleware() gin.HandlerFunc {
	// This is a simple in-memory rate limiter
	// In production, you'd want to use Redis or another distributed store
	clients := make(map[string][]time.Time)
	mutex := &sync.Mutex{}

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		now := time.Now()
		windowSize := time.Minute
		maxRequests := 100

		mutex.Lock()
		defer mutex.Unlock()

		// Clean old entries
		if requests, exists := clients[clientIP]; exists {
			var validRequests []time.Time
			for _, requestTime := range requests {
				if now.Sub(requestTime) < windowSize {
					validRequests = append(validRequests, requestTime)
				}
			}
			clients[clientIP] = validRequests
		}

		// Check rate limit
		currentRequests := len(clients[clientIP])
		if currentRequests >= maxRequests {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "RATE_LIMIT_ERROR",
				"message":     "Too many requests",
				"code":        "TOO_MANY_REQUESTS",
				"retry_after": 60,
			})
			c.Abort()
			return
		}

		// Add current request
		clients[clientIP] = append(clients[clientIP], now)

		c.Next()
	}
}

// GetUserID extracts user ID from gin context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}

	id, ok := userID.(uuid.UUID)
	if !ok {
		return uuid.Nil, false
	}

	return id, true
}

// GetUserEmail extracts user email from gin context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get("user_email")
	if !exists {
		return "", false
	}

	emailStr, ok := email.(string)
	if !ok {
		return "", false
	}

	return emailStr, true
}

// GetUserRoles extracts user roles from gin context
func GetUserRoles(c *gin.Context) ([]string, bool) {
	roles, exists := c.Get("user_roles")
	if !exists {
		return nil, false
	}

	roleSlice, ok := roles.([]string)
	if !ok {
		return nil, false
	}

	return roleSlice, true
}

// GetUserPermissions extracts user permissions from gin context
func GetUserPermissions(c *gin.Context) ([]string, bool) {
	permissions, exists := c.Get("user_permissions")
	if !exists {
		return nil, false
	}

	permissionSlice, ok := permissions.([]string)
	if !ok {
		return nil, false
	}

	return permissionSlice, true
}

// HasRole checks if user has a specific role
func HasRole(c *gin.Context, roleName string) bool {
	roles, exists := GetUserRoles(c)
	if !exists {
		return false
	}

	for _, role := range roles {
		if role == roleName {
			return true
		}
	}
	return false
}

// HasAnyRole checks if user has any of the specified roles
func HasAnyRole(c *gin.Context, roleNames ...string) bool {
	for _, roleName := range roleNames {
		if HasRole(c, roleName) {
			return true
		}
	}
	return false
}

// HasPermission checks if user has a specific permission
func HasPermission(c *gin.Context, permissionName string) bool {
	permissions, exists := GetUserPermissions(c)
	if !exists {
		return false
	}

	for _, permission := range permissions {
		if permission == permissionName {
			return true
		}
	}
	return false
}

// IsCommunityModerator checks if user has community moderator role
func IsCommunityModerator(c *gin.Context) bool {
	return HasRole(c, "community_moderator")
}

// IsModerator checks if user has community moderator role
func IsModerator(c *gin.Context) bool {
	return HasRole(c, "community_moderator")
}
