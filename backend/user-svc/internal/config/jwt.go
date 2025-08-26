package config

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	sharedconfig "github.com/link-app/shared-libs/config"
)

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret           string
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	Issuer           string
	CookieName       string
	CookieSecure     bool
	CookieHTTPOnly   bool
	CookieSameSite   string
}

// GetJWTConfig returns JWT configuration from environment variables
func GetJWTConfig() *JWTConfig {
	return &JWTConfig{
		Secret:           sharedconfig.GetJWTSecret(),
		AccessTokenTTL:   time.Hour,                            // 1 hour for access tokens
		RefreshTokenTTL:  time.Hour * 24 * 30,                 // 30 days for refresh tokens
		Issuer:           sharedconfig.GetEnv("JWT_ISSUER", "user-svc"),
		CookieName:       sharedconfig.GetEnv("JWT_COOKIE_NAME", "link_auth"),
		CookieSecure:     sharedconfig.GetEnv("ENVIRONMENT", "development") == "production",
		CookieHTTPOnly:   true,
		CookieSameSite:   sharedconfig.GetEnv("JWT_COOKIE_SAMESITE", "strict"),
	}
}

// Claims represents the JWT claims structure
type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
	jwt.RegisteredClaims
}

// JWTService provides JWT token operations
type JWTService struct {
	config *JWTConfig
}

// NewJWTService creates a new JWT service
func NewJWTService(config *JWTConfig) *JWTService {
	return &JWTService{
		config: config,
	}
}

// GenerateAccessToken generates a new access token
func (j *JWTService) GenerateAccessToken(userID uuid.UUID, email, username string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   userID,
		Email:    email,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Issuer:    j.config.Issuer,
			Subject:   userID.String(),
			Audience:  jwt.ClaimStrings{"link-app"},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.config.AccessTokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(j.config.Secret))
}

// GenerateRefreshToken generates a new refresh token
func (j *JWTService) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		ID:        uuid.New().String(),
		Issuer:    j.config.Issuer,
		Subject:   userID.String(),
		Audience:  jwt.ClaimStrings{"link-app-refresh"},
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(j.config.RefreshTokenTTL)),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(j.config.Secret))
}

// ValidateAccessToken validates and parses an access token
func (j *JWTService) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.config.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// ValidateRefreshToken validates a refresh token
func (j *JWTService) ValidateRefreshToken(tokenString string) (*jwt.RegisteredClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.config.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse refresh token: %w", err)
	}

	if claims, ok := token.Claims.(*jwt.RegisteredClaims); ok && token.Valid {
		// Verify audience for refresh token
		valid := false
		for _, aud := range claims.Audience {
			if aud == "link-app-refresh" {
				valid = true
				break
			}
		}
		if !valid {
			return nil, fmt.Errorf("invalid token audience")
		}
		return claims, nil
	}

	return nil, fmt.Errorf("invalid refresh token")
}

// GetTokenID extracts the JTI (JWT ID) from a token string
func (j *JWTService) GetTokenID(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(j.config.Secret), nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		if jti, exists := claims["jti"].(string); exists {
			return jti, nil
		}
	}

	return "", fmt.Errorf("no JTI found in token")
}
