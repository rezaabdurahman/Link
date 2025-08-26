package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// RequireRole creates middleware that requires user to have one of the specified roles
func RequireRole(roleNames ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !HasAnyRole(c, roleNames...) {
			c.JSON(http.StatusForbidden, gin.H{
				"error":     "AUTHORIZATION_ERROR",
				"message":   "Insufficient permissions",
				"code":      "ROLE_REQUIRED",
				"required_roles": roleNames,
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequirePermission creates middleware that requires user to have a specific permission
func RequirePermission(permissionName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !HasPermission(c, permissionName) {
			c.JSON(http.StatusForbidden, gin.H{
				"error":     "AUTHORIZATION_ERROR",
				"message":   "Insufficient permissions",
				"code":      "PERMISSION_REQUIRED",
				"required_permission": permissionName,
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireCommunityModerator creates middleware that requires community moderator role
func RequireCommunityModerator() gin.HandlerFunc {
	return RequireRole("community_moderator")
}

// RequireModerator creates middleware that requires community moderator role
func RequireModerator() gin.HandlerFunc {
	return RequireRole("community_moderator")
}

// RequireResourceOwnership creates middleware that checks if user owns the resource or has moderator permissions
func RequireResourceOwnership(resourceUserIDKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Community moderators can access any resource for moderation
		if IsCommunityModerator(c) {
			c.Next()
			return
		}

		// Get the user ID from JWT
		userID, exists := GetUserID(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "AUTHENTICATION_ERROR",
				"message":   "User ID not found in token",
				"code":      "MISSING_USER_ID",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		// Get the resource owner ID from URL parameters
		resourceUserIDStr := c.Param(resourceUserIDKey)
		if resourceUserIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":     "BAD_REQUEST",
				"message":   "Resource user ID parameter missing",
				"code":      "MISSING_RESOURCE_ID",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		// Check if user owns the resource
		if userID.String() != resourceUserIDStr {
			c.JSON(http.StatusForbidden, gin.H{
				"error":     "AUTHORIZATION_ERROR",
				"message":   "Cannot access resource owned by another user",
				"code":      "RESOURCE_OWNERSHIP_REQUIRED",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireFriendshipOrModerator creates middleware that requires friendship between users or moderator permissions
func RequireFriendshipOrModerator(targetUserIDKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Community moderators can access any resource for moderation
		if IsCommunityModerator(c) {
			c.Next()
			return
		}

		// Get the user ID from JWT
		userID, exists := GetUserID(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "AUTHENTICATION_ERROR",
				"message":   "User ID not found in token",
				"code":      "MISSING_USER_ID",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		// Get the target user ID from URL parameters
		targetUserIDStr := c.Param(targetUserIDKey)
		if targetUserIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":     "BAD_REQUEST",
				"message":   "Target user ID parameter missing",
				"code":      "MISSING_TARGET_USER_ID",
				"timestamp": time.Now(),
			})
			c.Abort()
			return
		}

		// Users can access their own resources
		if userID.String() == targetUserIDStr {
			c.Next()
			return
		}

		// TODO: Implement friendship check
		// This would require calling the user service to verify friendship
		// For now, we'll allow community moderators to access
		if IsCommunityModerator(c) {
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":     "AUTHORIZATION_ERROR",
			"message":   "Friendship or elevated permissions required",
			"code":      "FRIENDSHIP_OR_MODERATOR_REQUIRED",
			"timestamp": time.Now(),
		})
		c.Abort()
	}
}

// ConditionalRBAC creates middleware that applies RBAC conditionally based on request context
type ConditionalRBAC struct {
	condition func(*gin.Context) bool
	rbac      gin.HandlerFunc
}

// ConditionalRBACMiddleware applies RBAC middleware only if condition is met
func ConditionalRBACMiddleware(condition func(*gin.Context) bool, rbac gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		if condition(c) {
			rbac(c)
		} else {
			c.Next()
		}
	}
}

// RateLimitByRole applies different rate limits based on user role
func RateLimitByRole(limits map[string]int) gin.HandlerFunc {
	return func(c *gin.Context) {
		roles, exists := GetUserRoles(c)
		if !exists {
			// Apply default rate limit for unauthenticated users
			c.Set("rate_limit", limits["guest"])
			c.Next()
			return
		}

		// Apply rate limit based on highest priority role
		highestRole := "user"
		for _, role := range roles {
			switch role {
			case "community_moderator":
				highestRole = "community_moderator"
				break
			case "premium_user":
				if highestRole == "user" {
					highestRole = "premium_user"
				}
			}
		}
		c.Set("rate_limit", limits[highestRole])

		c.Next()
	}
}