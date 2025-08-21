package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RedisRateLimiterConfig holds configuration for Redis-based rate limiting
type RedisRateLimiterConfig struct {
	RedisClient     *redis.Client
	DefaultLimit    int           // Default requests per window
	DefaultWindow   time.Duration // Default time window
	BurstLimit      int           // Maximum burst requests
	CleanupInterval time.Duration // How often to clean up expired keys
}

// RateLimitRule defines rate limiting rules for specific endpoints or users
type RateLimitRule struct {
	Pattern   string        // URL pattern or user role
	Limit     int           // Requests per window
	Window    time.Duration // Time window
	BurstSize int           // Burst allowance
}

// RedisRateLimiter provides distributed rate limiting using Redis
type RedisRateLimiter struct {
	config *RedisRateLimiterConfig
	rules  map[string]RateLimitRule
	ctx    context.Context
}

// NewRedisRateLimiter creates a new Redis-based rate limiter
func NewRedisRateLimiter(config *RedisRateLimiterConfig) *RedisRateLimiter {
	limiter := &RedisRateLimiter{
		config: config,
		rules:  make(map[string]RateLimitRule),
		ctx:    context.Background(),
	}

	// Add default rules
	limiter.AddRule("auth", RateLimitRule{
		Pattern:   "/auth/",
		Limit:     5, // 5 requests per minute for auth endpoints
		Window:    time.Minute,
		BurstSize: 2,
	})

	limiter.AddRule("api", RateLimitRule{
		Pattern:   "/api/",
		Limit:     100, // 100 requests per minute for API endpoints
		Window:    time.Minute,
		BurstSize: 20,
	})

	return limiter
}

// AddRule adds a new rate limiting rule
func (r *RedisRateLimiter) AddRule(name string, rule RateLimitRule) {
	r.rules[name] = rule
}

// RedisRateLimitMiddleware creates a middleware function for Redis-based rate limiting
func RedisRateLimitMiddleware(limiter *RedisRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get client identifier (IP + User ID if available)
		clientID := limiter.getClientID(c)

		// Find applicable rule
		rule := limiter.findRule(c.Request.URL.Path)

		// Check rate limit using sliding window algorithm
		allowed, remaining, resetTime, err := limiter.checkRateLimit(clientID, rule, c.Request.URL.Path)
		if err != nil {
			// Log error but don't block request on Redis errors
			c.Header("X-RateLimit-Error", "rate-limit-check-failed")
			c.Next()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(rule.Limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime, 10))

		if !allowed {
			retryAfter := resetTime - time.Now().Unix()
			if retryAfter < 0 {
				retryAfter = int64(rule.Window.Seconds())
			}

			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "RATE_LIMIT_ERROR",
				"message":     "Rate limit exceeded",
				"code":        "TOO_MANY_REQUESTS",
				"retry_after": retryAfter,
				"limit":       rule.Limit,
				"window":      rule.Window.String(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// getClientID creates a unique identifier for the client
func (r *RedisRateLimiter) getClientID(c *gin.Context) string {
	// Use user ID if authenticated, otherwise fall back to IP
	if userID, exists := c.Get("user_id"); exists {
		return fmt.Sprintf("user:%v", userID)
	}

	// Get real IP (considering proxies)
	clientIP := c.ClientIP()
	return fmt.Sprintf("ip:%s", clientIP)
}

// findRule finds the appropriate rate limiting rule for a path
func (r *RedisRateLimiter) findRule(path string) RateLimitRule {
	// Check specific rules first
	for _, rule := range r.rules {
		if matchesPattern(path, rule.Pattern) {
			return rule
		}
	}

	// Return default rule
	return RateLimitRule{
		Limit:     r.config.DefaultLimit,
		Window:    r.config.DefaultWindow,
		BurstSize: r.config.BurstLimit,
	}
}

// checkRateLimit implements sliding window rate limiting using Redis
func (r *RedisRateLimiter) checkRateLimit(clientID string, rule RateLimitRule, path string) (allowed bool, remaining int, resetTime int64, err error) {
	now := time.Now()
	window := rule.Window
	limit := rule.Limit

	// Redis key for this client and window
	key := fmt.Sprintf("rate_limit:%s:%d", clientID, now.Truncate(window).Unix())

	pipe := r.config.RedisClient.Pipeline()

	// Increment counter for current window
	incr := pipe.Incr(r.ctx, key)
	// Set expiration for the key
	pipe.Expire(r.ctx, key, window+time.Minute) // Extra minute for cleanup

	// Also check previous window for smoother rate limiting
	prevWindow := now.Add(-window).Truncate(window).Unix()
	prevKey := fmt.Sprintf("rate_limit:%s:%d", clientID, prevWindow)
	prevCount := pipe.Get(r.ctx, prevKey)

	// Execute pipeline
	_, err = pipe.Exec(r.ctx)
	if err != nil {
		return false, 0, 0, err
	}

	// Get current window count
	currentCount, err := incr.Result()
	if err != nil {
		return false, 0, 0, err
	}

	// Get previous window count (ignore error if key doesn't exist)
	var prevCountVal int64 = 0
	if prevCountResult, err := prevCount.Result(); err == nil {
		if parsed, parseErr := strconv.ParseInt(prevCountResult, 10, 64); parseErr == nil {
			prevCountVal = parsed
		}
	}

	// Sliding window calculation
	// Weight the previous window based on how much time has passed
	timeIntoWindow := float64(now.Sub(now.Truncate(window))) / float64(window)
	weightedPrevCount := float64(prevCountVal) * (1.0 - timeIntoWindow)

	totalRequests := float64(currentCount) + weightedPrevCount

	// Check if limit is exceeded
	if totalRequests > float64(limit) {
		return false, 0, now.Truncate(window).Add(window).Unix(), nil
	}

	remaining = limit - int(totalRequests)
	if remaining < 0 {
		remaining = 0
	}

	resetTime = now.Truncate(window).Add(window).Unix()

	return true, remaining, resetTime, nil
}

// matchesPattern checks if a path matches a pattern (simple prefix matching)
func matchesPattern(path, pattern string) bool {
	if pattern == "*" {
		return true
	}

	// Simple prefix matching - could be enhanced with regex or glob patterns
	if len(pattern) <= len(path) {
		return path[:len(pattern)] == pattern
	}

	return false
}

// CleanupExpiredKeys removes expired rate limiting keys (call periodically)
func (r *RedisRateLimiter) CleanupExpiredKeys() error {
	// Redis handles expiration automatically, but we can implement
	// additional cleanup logic here if needed
	return nil
}
