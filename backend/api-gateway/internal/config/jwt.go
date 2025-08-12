package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JWTConfig holds JWT configuration for the API Gateway
type JWTConfig struct {
	Secret           string
	AccessTokenTTL   time.Duration
	Issuer           string
	CookieName       string
	CookieSecure     bool
	CookieHTTPOnly   bool
	CookieSameSite   string
}

// GetJWTConfig returns JWT configuration from environment variables
func GetJWTConfig() *JWTConfig {
	return &JWTConfig{
		Secret:           getEnv("JWT_SECRET", "your-secret-key-change-this-in-production"),
		AccessTokenTTL:   time.Hour,                            // 1 hour for access tokens
		Issuer:           getEnv("JWT_ISSUER", "user-svc"),
		CookieName:       getEnv("JWT_COOKIE_NAME", "link_auth"),
		CookieSecure:     getEnv("ENVIRONMENT", "development") == "production",
		CookieHTTPOnly:   true,
		CookieSameSite:   getEnv("JWT_COOKIE_SAMESITE", "strict"),
	}
}

// Claims represents the JWT claims structure
type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
	jwt.RegisteredClaims
}

// JWTValidator provides JWT token validation for API Gateway
type JWTValidator struct {
	config *JWTConfig
}

// NewJWTValidator creates a new JWT validator
func NewJWTValidator(config *JWTConfig) *JWTValidator {
	return &JWTValidator{
		config: config,
	}
}

// ValidateAccessToken validates and parses an access token
func (j *JWTValidator) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.config.Secret), nil
	}, jwt.WithIssuer(j.config.Issuer), jwt.WithAudience("link-app"))

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// ExtractTokenFromRequest extracts JWT token from various sources
func (j *JWTValidator) ExtractTokenFromRequest(authHeader, cookieValue string) string {
	// Check Authorization header first (Bearer token)
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// Check cookie as fallback
	if cookieValue != "" {
		return cookieValue
	}

	return ""
}

// IsPublicEndpoint checks if an endpoint doesn't require authentication
func IsPublicEndpoint(method, path string) bool {
	publicEndpoints := map[string][]string{
		"POST": {
			"/auth/register",
			"/auth/login",
		},
		"GET": {
			"/health",
			"/users/profile/", // Public user profiles (will check if path contains /users/profile/)
		},
		"OPTIONS": {"*"}, // Allow all OPTIONS requests for CORS
	}

	if endpoints, exists := publicEndpoints[method]; exists {
		for _, endpoint := range endpoints {
			if endpoint == "*" {
				return true
			}
			if endpoint == path {
				return true
			}
			// Special case for user profile paths
			if strings.Contains(endpoint, "/users/profile/") && strings.HasPrefix(path, "/users/profile/") {
				return true
			}
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
