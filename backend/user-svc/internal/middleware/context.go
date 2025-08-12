package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ExtractUserContext extracts user context from gateway-provided headers
// The API Gateway validates JWT and forwards user info via headers
func ExtractUserContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract user information from headers set by API Gateway
		userID := c.GetHeader("X-User-ID")
		userEmail := c.GetHeader("X-User-Email")
		userName := c.GetHeader("X-User-Name")

		// Set user information in context if available
		if userID != "" {
			if parsedID, err := uuid.Parse(userID); err == nil {
				c.Set("user_id", parsedID)
			}
		}
		if userEmail != "" {
			c.Set("user_email", userEmail)
		}
		if userName != "" {
			c.Set("user_name", userName)
		}

		c.Next()
	}
}

// RequireAuth ensures user is authenticated (headers from gateway)
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "AUTHENTICATION_ERROR",
				"message": "Authentication required - missing user context",
				"code":    "AUTH_REQUIRED",
			})
			c.Abort()
			return
		}

		// Validate UUID format
		if _, err := uuid.Parse(userID); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "AUTHENTICATION_ERROR",
				"message": "Invalid user context",
				"code":    "INVALID_USER_CONTEXT",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetUserID extracts user ID from context
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

// GetUserIDFromHeader extracts user ID directly from header (fallback)
func GetUserIDFromHeader(c *gin.Context) (uuid.UUID, bool) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		return uuid.Nil, false
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, false
	}

	return userID, true
}
