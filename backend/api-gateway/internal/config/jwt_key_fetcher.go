package config

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	sharedConfig "github.com/link-app/shared-libs/config"
)

// PublicKeyInfo represents public key information from user-svc
type PublicKeyInfo struct {
	KeyID     string `json:"key_id"`
	PublicKey string `json:"public_key"` // PEM encoded
	Algorithm string `json:"algorithm"`
	ExpiresAt string `json:"expires_at"`
}

// JWKSResponse represents the JSON Web Key Set response
type JWKSResponse struct {
	Keys []PublicKeyInfo `json:"keys"`
}

// PublicKeyFetcher handles fetching public keys from user-svc
type PublicKeyFetcher struct {
	userServiceURL string
	httpClient     *http.Client
	keyCache       map[string]*rsa.PublicKey
	cacheExpiry    map[string]time.Time
	cacheMutex     sync.RWMutex
	cacheTTL       time.Duration
}

// NewPublicKeyFetcher creates a new public key fetcher
func NewPublicKeyFetcher(userServiceURL string, cacheTTL time.Duration) *PublicKeyFetcher {
	return &PublicKeyFetcher{
		userServiceURL: userServiceURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		keyCache:    make(map[string]*rsa.PublicKey),
		cacheExpiry: make(map[string]time.Time),
		cacheTTL:    cacheTTL,
	}
}

// GetPublicKey retrieves a public key by ID with caching
func (pkf *PublicKeyFetcher) GetPublicKey(keyID string) (*rsa.PublicKey, error) {
	// Check cache first
	pkf.cacheMutex.RLock()
	if publicKey, exists := pkf.keyCache[keyID]; exists {
		if expiry, hasExpiry := pkf.cacheExpiry[keyID]; hasExpiry && time.Now().Before(expiry) {
			pkf.cacheMutex.RUnlock()
			return publicKey, nil
		}
	}
	pkf.cacheMutex.RUnlock()
	
	// Fetch from user service
	publicKey, err := pkf.fetchPublicKeyFromUserService(keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch public key: %w", err)
	}
	
	// Cache the key
	pkf.cacheMutex.Lock()
	pkf.keyCache[keyID] = publicKey
	pkf.cacheExpiry[keyID] = time.Now().Add(pkf.cacheTTL)
	pkf.cacheMutex.Unlock()
	
	return publicKey, nil
}

// fetchPublicKeyFromUserService fetches public key from user-svc JWKS endpoint
func (pkf *PublicKeyFetcher) fetchPublicKeyFromUserService(keyID string) (*rsa.PublicKey, error) {
	// Construct JWKS endpoint URL
	jwksURL := fmt.Sprintf("%s/auth/jwks", pkf.userServiceURL)
	
	// Make HTTP request
	resp, err := pkf.httpClient.Get(jwksURL)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: failed to fetch JWKS", resp.StatusCode)
	}
	
	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}
	
	// Parse JWKS response
	var jwksResp JWKSResponse
	if err := json.Unmarshal(body, &jwksResp); err != nil {
		return nil, fmt.Errorf("failed to parse JWKS response: %w", err)
	}
	
	// Find the requested key
	for _, keyInfo := range jwksResp.Keys {
		if keyInfo.KeyID == keyID {
			return pkf.parsePublicKeyFromPEM(keyInfo.PublicKey)
		}
	}
	
	return nil, fmt.Errorf("key not found: %s", keyID)
}

// parsePublicKeyFromPEM parses RSA public key from PEM format
func (pkf *PublicKeyFetcher) parsePublicKeyFromPEM(pemData string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}
	
	pubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}
	
	rsaPubKey, ok := pubKey.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("key is not an RSA public key")
	}
	
	return rsaPubKey, nil
}

// RefreshAllKeys refreshes all cached keys
func (pkf *PublicKeyFetcher) RefreshAllKeys() error {
	// Fetch all keys from JWKS endpoint
	jwksURL := fmt.Sprintf("%s/auth/jwks", pkf.userServiceURL)
	
	resp, err := pkf.httpClient.Get(jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d: failed to fetch JWKS", resp.StatusCode)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}
	
	var jwksResp JWKSResponse
	if err := json.Unmarshal(body, &jwksResp); err != nil {
		return fmt.Errorf("failed to parse JWKS: %w", err)
	}
	
	// Update cache with all keys
	pkf.cacheMutex.Lock()
	defer pkf.cacheMutex.Unlock()
	
	for _, keyInfo := range jwksResp.Keys {
		publicKey, err := pkf.parsePublicKeyFromPEM(keyInfo.PublicKey)
		if err != nil {
			continue // Skip invalid keys
		}
		
		pkf.keyCache[keyInfo.KeyID] = publicKey
		pkf.cacheExpiry[keyInfo.KeyID] = time.Now().Add(pkf.cacheTTL)
	}
	
	return nil
}

// CleanupExpiredKeys removes expired keys from cache
func (pkf *PublicKeyFetcher) CleanupExpiredKeys() {
	pkf.cacheMutex.Lock()
	defer pkf.cacheMutex.Unlock()
	
	now := time.Now()
	for keyID, expiry := range pkf.cacheExpiry {
		if now.After(expiry) {
			delete(pkf.keyCache, keyID)
			delete(pkf.cacheExpiry, keyID)
		}
	}
}

// Enhanced JWTValidator with RSA support
type EnhancedJWTValidator struct {
	config         *JWTConfig
	keyFetcher     *PublicKeyFetcher
	legacyMode     bool // Support both HMAC and RSA during migration
}

// NewEnhancedJWTValidator creates a new enhanced JWT validator with RSA support
func NewEnhancedJWTValidator(config *JWTConfig, userServiceURL string) *EnhancedJWTValidator {
	keyFetcher := NewPublicKeyFetcher(userServiceURL, 5*time.Minute) // 5-minute cache TTL
	
	return &EnhancedJWTValidator{
		config:     config,
		keyFetcher: keyFetcher,
		legacyMode: true, // Enable legacy HMAC support during migration
	}
}

// ValidateAccessToken validates and parses an access token with RSA support
func (ejv *EnhancedJWTValidator) ValidateAccessToken(tokenString string) (*Claims, error) {
	return ejv.ValidateAccessTokenWithPlatform(tokenString, "")
}

// ValidateAccessTokenWithPlatform validates access token with platform awareness and RSA support
func (ejv *EnhancedJWTValidator) ValidateAccessTokenWithPlatform(tokenString, platform string) (*Claims, error) {
	// Determine expected audience based on platform
	expectedAudiences := []string{"link-app"}
	if platform != "" {
		expectedAudiences = append(expectedAudiences, fmt.Sprintf("link-app-%s", platform))
	}
	
	// First, try RSA validation (new tokens)
	if claims, err := ejv.validateWithRSA(tokenString, expectedAudiences); err == nil {
		return claims, nil
	}
	
	// Fallback to HMAC validation (legacy tokens) if legacy mode is enabled
	if ejv.legacyMode {
		if claims, err := ejv.validateWithHMAC(tokenString, expectedAudiences); err == nil {
			return claims, nil
		}
	}
	
	return nil, fmt.Errorf("token validation failed with all methods")
}

// validateWithRSA validates token using RSA public key
func (ejv *EnhancedJWTValidator) validateWithRSA(tokenString string, expectedAudiences []string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Check signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		
		// Get key ID from header
		keyID, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("missing or invalid key ID in token header")
		}
		
		// Fetch public key
		publicKey, err := ejv.keyFetcher.GetPublicKey(keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to get public key: %w", err)
		}
		
		return publicKey, nil
	}, jwt.WithIssuer(ejv.config.Issuer))
	
	if err != nil {
		return nil, fmt.Errorf("RSA token validation failed: %w", err)
	}
	
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		// Validate audience
		if err := ejv.validateAudience(claims, expectedAudiences); err != nil {
			return nil, fmt.Errorf("audience validation failed: %w", err)
		}
		return claims, nil
	}
	
	return nil, fmt.Errorf("invalid RSA token")
}

// validateWithHMAC validates token using HMAC (legacy support)
func (ejv *EnhancedJWTValidator) validateWithHMAC(tokenString string, expectedAudiences []string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(ejv.config.Secret), nil
	}, jwt.WithIssuer(ejv.config.Issuer))
	
	if err != nil {
		return nil, fmt.Errorf("HMAC token validation failed: %w", err)
	}
	
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		// Validate audience
		if err := ejv.validateAudience(claims, expectedAudiences); err != nil {
			return nil, fmt.Errorf("audience validation failed: %w", err)
		}
		return claims, nil
	}
	
	return nil, fmt.Errorf("invalid HMAC token")
}

// validateAudience checks if token audience matches any of the expected audiences
func (ejv *EnhancedJWTValidator) validateAudience(claims *Claims, expectedAudiences []string) error {
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
func (ejv *EnhancedJWTValidator) ExtractTokenFromRequest(authHeader, cookieValue string) string {
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

// DisableLegacyMode disables HMAC token support (call after RSA migration is complete)
func (ejv *EnhancedJWTValidator) DisableLegacyMode() {
	ejv.legacyMode = false
}

// RefreshKeys manually refreshes the public key cache
func (ejv *EnhancedJWTValidator) RefreshKeys() error {
	return ejv.keyFetcher.RefreshAllKeys()
}

// CreateEnhancedJWTValidator creates a new enhanced JWT validator with proper configuration
func CreateEnhancedJWTValidator() (*EnhancedJWTValidator, error) {
	jwtConfig := GetJWTConfig()
	userServiceURL := sharedConfig.GetEnv("USER_SERVICE_URL", "http://user-svc:8080")
	
	validator := NewEnhancedJWTValidator(jwtConfig, userServiceURL)
	
	// Start key refresh goroutine
	go func() {
		ticker := time.NewTicker(time.Minute) // Refresh keys every minute
		defer ticker.Stop()
		
		for range ticker.C {
			validator.keyFetcher.CleanupExpiredKeys()
		}
	}()
	
	return validator, nil
}