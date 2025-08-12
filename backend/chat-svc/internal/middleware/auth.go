package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/config"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UserEmailKey contextKey = "user_email"
	UserNameKey  contextKey = "user_name"
)

// Claims represents JWT claims compatible with user-svc and gateway
type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
	jwt.RegisteredClaims
}

// AuthMiddleware provides JWT authentication middleware
type AuthMiddleware struct {
	jwtSecret []byte
	logger    *logrus.Logger
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(cfg *config.Config, logger *logrus.Logger) *AuthMiddleware {
	return &AuthMiddleware{
		jwtSecret: []byte(cfg.JWT.Secret),
		logger:    logger,
	}
}

// Middleware returns the JWT authentication middleware
// Supports both direct JWT validation and gateway-forwarded headers
func (a *AuthMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// First, check if gateway has already validated JWT and forwarded user context via headers
		if userID := r.Header.Get("X-User-ID"); userID != "" {
			// Gateway has already validated JWT - extract user info from headers
			a.handleGatewayAuth(w, r, next)
			return
		}

		// No gateway headers - perform direct JWT validation
		token := a.extractToken(r)
		if token == "" {
			a.writeUnauthorized(w, "Authentication required - missing token")
			return
		}

		claims, err := a.validateToken(token)
		if err != nil {
			a.logger.WithError(err).Debug("Invalid JWT token")
			a.writeUnauthorized(w, "Invalid authorization token")
			return
		}

		// Add user info to request context
		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
		ctx = context.WithValue(ctx, UserNameKey, claims.Username)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// handleGatewayAuth processes authentication when user context is forwarded by gateway
func (a *AuthMiddleware) handleGatewayAuth(w http.ResponseWriter, r *http.Request, next http.Handler) {
	userIDStr := r.Header.Get("X-User-ID")
	userEmail := r.Header.Get("X-User-Email")
	userName := r.Header.Get("X-User-Name")

	// Validate user ID format
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		a.logger.WithError(err).Warn("Invalid user ID from gateway")
		a.writeUnauthorized(w, "Invalid user context")
		return
	}

	// Set user information in context
	ctx := context.WithValue(r.Context(), UserIDKey, userID)
	if userEmail != "" {
		ctx = context.WithValue(ctx, UserEmailKey, userEmail)
	}
	if userName != "" {
		ctx = context.WithValue(ctx, UserNameKey, userName)
	}

	next.ServeHTTP(w, r.WithContext(ctx))
}

// extractToken extracts JWT token from Authorization header or cookies
func (a *AuthMiddleware) extractToken(r *http.Request) string {
	// Try Authorization header first (Bearer token)
	if token := extractTokenFromHeader(r); token != "" {
		return token
	}

	// Try gateway-issued cookie as fallback
	if cookie, err := r.Cookie("link_auth"); err == nil {
		return cookie.Value
	}

	return ""
}

// ValidateWebSocketToken validates JWT token for WebSocket connections
func (a *AuthMiddleware) ValidateWebSocketToken(token string) (*Claims, error) {
	return a.validateToken(token)
}

// validateToken validates and parses JWT token
func (a *AuthMiddleware) validateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Validate the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return a.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}

	return claims, nil
}

// extractTokenFromHeader extracts JWT token from Authorization header
func extractTokenFromHeader(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	// Check for Bearer prefix
	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(authHeader, bearerPrefix) {
		return ""
	}

	return strings.TrimPrefix(authHeader, bearerPrefix)
}

// GetUserIDFromContext extracts user ID from request context
func GetUserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(UserIDKey).(uuid.UUID)
	return userID, ok
}

// GetUserEmailFromContext extracts user email from request context
func GetUserEmailFromContext(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(UserEmailKey).(string)
	return email, ok
}

// GetUserNameFromContext extracts user name from request context
func GetUserNameFromContext(ctx context.Context) (string, bool) {
	userName, ok := ctx.Value(UserNameKey).(string)
	return userName, ok
}

// RequireAuth creates middleware that ensures user is authenticated
func (a *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return a.Middleware(next)
}

// writeUnauthorized writes an unauthorized error response
func (a *AuthMiddleware) writeUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	response := `{"error":"` + message + `","code":401}`
	w.Write([]byte(response))
}
