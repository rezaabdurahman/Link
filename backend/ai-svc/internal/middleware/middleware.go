package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"

	"github.com/link-app/ai-svc/internal/model"
)

// JWTClaims represents the claims in a JWT token
type JWTClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	Email    string    `json:"email"`
	Name     string    `json:"name"`
	Role     string    `json:"role,omitempty"`
	jwt.RegisteredClaims
}

// RateLimiter implements per-user rate limiting
type RateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*rate.Limiter
	rate     rate.Limit
	burst    int
	cleanup  time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerMinute int, burst int) *RateLimiter {
	r := float64(requestsPerMinute) / 60 // Convert to requests per second
	rl := &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     rate.Limit(r),
		burst:    burst,
		cleanup:  time.Minute * 5, // Clean up unused limiters every 5 minutes
	}

	// Start cleanup goroutine
	go rl.cleanupExpiredLimiters()
	
	return rl
}

// GetLimiter returns or creates a rate limiter for a specific user
func (rl *RateLimiter) GetLimiter(userID string) *rate.Limiter {
	rl.mu.RLock()
	limiter, exists := rl.limiters[userID]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		// Double-check in case another goroutine created it
		if limiter, exists = rl.limiters[userID]; !exists {
			limiter = rate.NewLimiter(rl.rate, rl.burst)
			rl.limiters[userID] = limiter
		}
		rl.mu.Unlock()
	}

	return limiter
}

// cleanupExpiredLimiters removes unused rate limiters to prevent memory leaks
func (rl *RateLimiter) cleanupExpiredLimiters() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for userID, limiter := range rl.limiters {
			// Remove limiters that haven't been used in the cleanup period
			if limiter.Allow() { // This checks if there are available tokens
				// If the limiter is at full capacity, it hasn't been used recently
				if limiter.Tokens() == float64(rl.burst) {
					delete(rl.limiters, userID)
				}
			}
		}
		rl.mu.Unlock()
	}
}

// JWTAuth returns a middleware that validates JWT tokens
func JWTAuth(jwtSecret string, logger *zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				logger.Warn().
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Missing Authorization header")
				writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authorization header required", nil, logger)
				return
			}

			// Check if it's a Bearer token
			tokenString := ""
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenString = authHeader[7:]
			} else {
				logger.Warn().
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Invalid Authorization header format")
				writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authorization header must be Bearer token", nil, logger)
				return
			}

			// Parse and validate JWT token
			token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
				// Validate signing method
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})

			if err != nil {
				logger.Warn().
					Err(err).
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Invalid JWT token")
				writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid token", map[string]string{"details": err.Error()}, logger)
				return
			}

			// Extract claims
			claims, ok := token.Claims.(*JWTClaims)
			if !ok || !token.Valid {
				logger.Warn().
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Invalid token claims")
				writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid token claims", nil, logger)
				return
			}

			// Add user info to context
			ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
			ctx = context.WithValue(ctx, "user_email", claims.Email)
			ctx = context.WithValue(ctx, "user_name", claims.Name)
			ctx = context.WithValue(ctx, "user_role", claims.Role)

			logger.Debug().
				Str("user_id", claims.UserID.String()).
				Str("user_email", claims.Email).
				Str("path", r.URL.Path).
				Msg("JWT token validated successfully")

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RateLimit returns a middleware that implements per-user rate limiting
func RateLimit(rateLimiter *RateLimiter, logger *zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get user ID from context (set by JWT middleware)
			userID, ok := r.Context().Value("user_id").(uuid.UUID)
			if !ok {
				logger.Error().
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("User ID not found in context for rate limiting")
				writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Authentication context error", nil, logger)
				return
			}

			// Check rate limit
			limiter := rateLimiter.GetLimiter(userID.String())
			if !limiter.Allow() {
				logger.Warn().
					Str("user_id", userID.String()).
					Str("path", r.URL.Path).
					Str("method", r.Method).
					Msg("Rate limit exceeded")

				// Add rate limit headers
				w.Header().Set("X-RateLimit-Limit", strconv.Itoa(int(rateLimiter.rate*60))) // Convert back to requests per minute
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10))

				writeErrorResponse(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Try again later.", map[string]string{
					"limit": strconv.Itoa(int(rateLimiter.rate * 60)),
					"window": "60 seconds",
				}, logger)
				return
			}

			// Add rate limit info to headers
			remaining := int(limiter.Tokens())
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(int(rateLimiter.rate*60)))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))

			logger.Debug().
				Str("user_id", userID.String()).
				Int("remaining_requests", remaining).
				Str("path", r.URL.Path).
				Msg("Rate limit check passed")

			next.ServeHTTP(w, r)
		})
	}
}

// RequestLogger returns a middleware that logs HTTP requests with structured data
func RequestLogger(logger *zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap the ResponseWriter to capture status code and response size
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			// Extract user info from context if available
			userID := ""
			userEmail := ""
			if uid, ok := r.Context().Value("user_id").(uuid.UUID); ok {
				userID = uid.String()
			}
			if email, ok := r.Context().Value("user_email").(string); ok {
				userEmail = email
			}

			// Call next handler
			next.ServeHTTP(ww, r)

			duration := time.Since(start)

			// Log request with structured data
			logEvent := logger.Info().
				Str("method", r.Method).
				Str("url", r.URL.String()).
				Str("user_agent", r.UserAgent()).
				Str("remote_addr", getClientIP(r)).
				Int("status", ww.Status()).
				Int("bytes_written", ww.BytesWritten()).
				Dur("duration", duration).
				Str("request_id", middleware.GetReqID(r.Context()))

			if userID != "" {
				logEvent.Str("user_id", userID)
			}
			if userEmail != "" {
				logEvent.Str("user_email", userEmail)
			}

			// Add different log levels based on status code
			if ww.Status() >= 500 {
				logEvent = logger.Error().
					Str("method", r.Method).
					Str("url", r.URL.String()).
					Int("status", ww.Status()).
					Dur("duration", duration).
					Str("request_id", middleware.GetReqID(r.Context()))
			} else if ww.Status() >= 400 {
				logEvent = logger.Warn().
					Str("method", r.Method).
					Str("url", r.URL.String()).
					Int("status", ww.Status()).
					Dur("duration", duration).
					Str("request_id", middleware.GetReqID(r.Context()))
			}

			logEvent.Msg("HTTP request completed")
		})
	}
}

// PanicRecovery returns a middleware that recovers from panics and logs them
func PanicRecovery(logger *zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// Extract user info from context if available
					userID := ""
					if uid, ok := r.Context().Value("user_id").(uuid.UUID); ok {
						userID = uid.String()
					}

					logger.Error().
						Interface("panic", err).
						Str("method", r.Method).
						Str("url", r.URL.String()).
						Str("user_id", userID).
						Str("request_id", middleware.GetReqID(r.Context())).
						Stack().
						Msg("Panic recovered")

					// Return 500 error to client
					writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error", map[string]string{
						"request_id": middleware.GetReqID(r.Context()),
					}, logger)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// writeErrorResponse writes a standardized error response
func writeErrorResponse(w http.ResponseWriter, statusCode int, errorCode, message string, details map[string]string, logger *zerolog.Logger) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	errorResponse := model.ErrorResponse{
		Error:   errorCode,
		Message: message,
		Code:    errorCode,
		Details: details,
	}

	// Use json encoding
	if err := json.NewEncoder(w).Encode(errorResponse); err != nil {
		logger.Error().Err(err).Msg("Failed to encode error response")
		// Fallback to simple error message
		w.Write([]byte(`{"error":"internal_error","message":"Failed to encode response"}`)) 
	}
}

// getClientIP extracts the client IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (from load balancers/proxies)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// Get the first IP in the chain
		if idx := strings.Index(forwarded, ","); idx != -1 {
			return strings.TrimSpace(forwarded[:idx])
		}
		return strings.TrimSpace(forwarded)
	}

	// Check X-Real-IP header (from reverse proxies)
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return strings.TrimSpace(realIP)
	}

	// Fallback to RemoteAddr
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
		return r.RemoteAddr[:idx]
	}
	return r.RemoteAddr
}

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (uuid.UUID, error) {
	if userID, ok := ctx.Value("user_id").(uuid.UUID); ok {
		return userID, nil
	}
	return uuid.Nil, fmt.Errorf("user ID not found in context")
}

// GetUserEmailFromContext extracts the user email from the request context
func GetUserEmailFromContext(ctx context.Context) (string, error) {
	if email, ok := ctx.Value("user_email").(string); ok {
		return email, nil
	}
	return "", fmt.Errorf("user email not found in context")
}

// GetUserNameFromContext extracts the user name from the request context
func GetUserNameFromContext(ctx context.Context) (string, error) {
	if name, ok := ctx.Value("user_name").(string); ok {
		return name, nil
	}
	return "", fmt.Errorf("user name not found in context")
}
