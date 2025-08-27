package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	sharedConfig "github.com/link-app/shared-libs/config"
)

// JWTConfig holds JWT configuration for the API Gateway
type JWTConfig struct {
	Secret         string
	AccessTokenTTL time.Duration
	Issuer         string
	CookieName     string
	CookieSecure   bool
	CookieHTTPOnly bool
	CookieSameSite string
}

// GetJWTConfig returns JWT configuration using shared secrets management
func GetJWTConfig() *JWTConfig {
	return &JWTConfig{
		Secret:         sharedConfig.GetJWTSecret(), // Use shared secrets management
		AccessTokenTTL: time.Hour,                   // 1 hour for access tokens
		Issuer:         sharedConfig.GetEnv("JWT_ISSUER", "user-svc"),
		CookieName:     sharedConfig.GetEnv("JWT_COOKIE_NAME", "link_auth"),
		CookieSecure:   sharedConfig.GetEnv("ENVIRONMENT", "development") == "production",
		CookieHTTPOnly: true,
		CookieSameSite: sharedConfig.GetEnv("JWT_COOKIE_SAMESITE", "strict"),
	}
}

// Claims represents the JWT claims structure
type Claims struct {
	UserID      uuid.UUID `json:"user_id"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	Roles       []string  `json:"roles"`       // User role names
	Permissions []string  `json:"permissions"` // User permission names
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
	return j.ValidateAccessTokenWithPlatform(tokenString, "")
}

// ValidateAccessTokenWithPlatform validates and parses an access token for a specific platform
func (j *JWTValidator) ValidateAccessTokenWithPlatform(tokenString, platform string) (*Claims, error) {
	// Determine expected audience based on platform
	expectedAudiences := []string{"link-app"}
	if platform != "" {
		expectedAudiences = append(expectedAudiences, fmt.Sprintf("link-app-%s", platform))
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.config.Secret), nil
	}, jwt.WithIssuer(j.config.Issuer))

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		// Validate audience manually for flexibility with mobile platforms
		if err := j.validateAudience(claims, expectedAudiences); err != nil {
			return nil, fmt.Errorf("invalid audience: %w", err)
		}
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// validateAudience checks if token audience matches any of the expected audiences
func (j *JWTValidator) validateAudience(claims *Claims, expectedAudiences []string) error {
	if len(claims.Audience) == 0 {
		return fmt.Errorf("token has no audience")
	}

	for _, tokenAud := range claims.Audience {
		for _, expectedAud := range expectedAudiences {
			if tokenAud == expectedAud {
				return nil
			}
		}
	}

	return fmt.Errorf("audience mismatch: expected one of %v, got %v", expectedAudiences, claims.Audience)
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
			"/auth/refresh",                    // Refresh endpoint should be public
			"/auth/mobile/login",               // Mobile login endpoint
			"/auth/mobile/refresh",             // Mobile token refresh
			"/auth/mobile/refresh/background",  // Background refresh for mobile
		},
		"GET": {
			"/health",
			"/metrics",                         // Prometheus metrics endpoint
			"/users/profile/",                  // Public user profiles (will check if path contains /users/profile/)
			"/auth/mobile/policy/",             // Platform policy endpoints (will check if path contains /auth/mobile/policy/)
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
			// Special case for mobile policy paths
			if strings.Contains(endpoint, "/auth/mobile/policy/") && strings.HasPrefix(path, "/auth/mobile/policy/") {
				return true
			}
		}
	}

	return false
}
