package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/dto"
	"golang.org/x/time/rate"
)

// AuthRequired middleware ensures user authentication via headers from API Gateway
// Enhanced with privacy and availability checks
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		userEmail := c.GetHeader("X-User-Email")

		if userID == "" || userEmail == "" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "UNAUTHORIZED",
				Message: "User authentication required",
			})
			c.Abort()
			return
		}

		// Validate UUID format
		if _, err := uuid.Parse(userID); err != nil {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "INVALID_USER_ID",
				Message: "Invalid user ID format",
			})
			c.Abort()
			return
		}

		// PRIVACY SAFEGUARD: Check profile visibility
		visibility := c.GetHeader("X-User-Visibility")
		if visibility == "private" {
			c.JSON(http.StatusForbidden, dto.ErrorResponse{
				Error:   "PRIVATE_PROFILE",
				Message: "Private profiles cannot be searched or indexed",
			})
			c.Abort()
			return
		}

		// AVAILABILITY SAFEGUARD: Check user availability
		isAvailable := c.GetHeader("X-User-Available")
		if isAvailable != "true" {
			c.JSON(http.StatusForbidden, dto.ErrorResponse{
				Error:   "USER_UNAVAILABLE",
				Message: "Only available users can be searched or indexed",
			})
			c.Abort()
			return
		}

		// Set user context
		c.Set("user_id", userID)
		c.Set("user_email", userEmail)
		c.Set("user_name", c.GetHeader("X-User-Name"))
		c.Set("user_visibility", visibility)
		c.Set("user_available", isAvailable)

		c.Next()
	}
}

// ServiceAuthRequired middleware ensures service-to-service authentication
func ServiceAuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "UNAUTHORIZED",
				Message: "Service authentication required",
			})
			c.Abort()
			return
		}

		// Extract Bearer token
		bearerToken := strings.TrimPrefix(authHeader, "Bearer ")
		if bearerToken == authHeader {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "INVALID_AUTH_FORMAT",
				Message: "Authorization header must use Bearer format",
			})
			c.Abort()
			return
		}

		// Validate service token
		expectedToken := os.Getenv("SERVICE_AUTH_TOKEN")
		if expectedToken == "" {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
				Error:   "CONFIGURATION_ERROR",
				Message: "Service authentication not configured",
			})
			c.Abort()
			return
		}

		if bearerToken != expectedToken {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "INVALID_TOKEN",
				Message: "Invalid service token",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimiterStore manages per-user rate limiters
type RateLimiterStore struct {
	limiters map[string]*rate.Limiter
	limit    rate.Limit
	burst    int
}

// NewRateLimiterStore creates a new rate limiter store
func NewRateLimiterStore(requestsPerMinute int) *RateLimiterStore {
	return &RateLimiterStore{
		limiters: make(map[string]*rate.Limiter),
		limit:    rate.Limit(float64(requestsPerMinute) / 60.0), // Convert to per-second
		burst:    requestsPerMinute / 10, // Allow burst of 10% of per-minute limit
	}
}

// GetLimiter returns a rate limiter for the given user ID
func (store *RateLimiterStore) GetLimiter(userID string) *rate.Limiter {
	limiter, exists := store.limiters[userID]
	if !exists {
		limiter = rate.NewLimiter(store.limit, store.burst)
		store.limiters[userID] = limiter
	}
	return limiter
}

// RateLimit middleware implements per-user rate limiting (50 QPM per user)
func RateLimit(store *RateLimiterStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "UNAUTHORIZED",
				Message: "User ID required for rate limiting",
			})
			c.Abort()
			return
		}

		limiter := store.GetLimiter(userID.(string))
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()

		if !limiter.AllowN(ctx.Done(), 1) {
			c.Header("X-RateLimit-Limit", strconv.Itoa(int(store.limit*60))) // Show per-minute limit
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("Retry-After", "60")
			
			c.JSON(http.StatusTooManyRequests, dto.ErrorResponse{
				Error:   "RATE_LIMIT_EXCEEDED",
				Message: "Search rate limit exceeded (50 requests per minute)",
			})
			c.Abort()
			return
		}

		// Set rate limit headers
		remaining := int(limiter.TokensAt(time.Now()))
		c.Header("X-RateLimit-Limit", strconv.Itoa(int(store.limit*60)))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))

		c.Next()
	}
}
