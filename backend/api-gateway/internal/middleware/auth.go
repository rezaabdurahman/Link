package middleware

import (
	"fmt"
	"net/http"
	"os"
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

		// Validate token
		claims, err := jwtValidator.ValidateAccessToken(token)
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
		c.Set("jwt_id", claims.ID)

		// Set user context headers for downstream services
		c.Header("X-User-ID", claims.UserID.String())
		c.Header("X-User-Email", claims.Email)
		c.Header("X-User-Name", claims.Username)

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
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, X-User-Email, X-User-Name, X-Requested-With")
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
				"error":      "RATE_LIMIT_ERROR",
				"message":    "Too many requests",
				"code":       "TOO_MANY_REQUESTS",
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

