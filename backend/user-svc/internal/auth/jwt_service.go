package auth

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/config"
	"github.com/link-app/user-svc/internal/repository"
	"github.com/link-app/user-svc/internal/security"
	sharedConfig "github.com/link-app/shared-libs/config"
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
	TokenFamily      bool // Enable token families for rotation
	MaxRefreshTokens int  // Max active refresh tokens per user
}

// GetJWTConfig returns JWT configuration using shared secrets management
func GetJWTConfig() *JWTConfig {
	return &JWTConfig{
		Secret:           sharedConfig.GetJWTSecret(), // Use shared secrets management
		AccessTokenTTL:   time.Hour,                   // 1 hour for access tokens
		RefreshTokenTTL:  time.Hour * 24 * 30,         // 30 days for refresh tokens
		Issuer:           sharedConfig.GetEnv("JWT_ISSUER", "user-svc"),
		CookieName:       sharedConfig.GetEnv("JWT_COOKIE_NAME", "link_auth"),
		CookieSecure:     sharedConfig.GetEnv("ENVIRONMENT", "development") == "production",
		CookieHTTPOnly:   true,
		CookieSameSite:   sharedConfig.GetEnv("JWT_COOKIE_SAMESITE", "strict"),
		TokenFamily:      true, // Enable token families for security
		MaxRefreshTokens: 5,    // Max 5 active refresh tokens per user
	}
}

// GetMobileAuthConfig returns mobile auth configuration
func (c *JWTConfig) GetMobileAuthConfig() *config.MobileAuthConfig {
	return config.GetMobileAuthConfig()
}

// Claims represents the JWT claims structure
type Claims struct {
	UserID      uuid.UUID `json:"user_id"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	Roles       []string  `json:"roles"`       // User role names
	Permissions []string  `json:"permissions"` // User permission names
	Platform    string    `json:"platform"`    // Platform: web, ios, android, mobile - ADDED FOR UNIFIED AUTH
	jwt.RegisteredClaims
}

// RefreshTokenClaims represents refresh token specific claims
type RefreshTokenClaims struct {
	FamilyID         string  `json:"fam"`          // Token family for rotation detection
	DeviceInfo       string  `json:"dev,omitempty"` // Device fingerprint
	Platform         string  `json:"plt,omitempty"` // Platform: ios, android, web
	DeviceID         string  `json:"did,omitempty"` // Device identifier
	RiskScore        float64 `json:"risk,omitempty"` // Risk assessment score
	BiometricEnabled bool    `json:"bio,omitempty"` // Biometric authentication
	jwt.RegisteredClaims
}

// TokenPair represents access and refresh token pair
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	FamilyID     string    `json:"-"` // Internal use only
	Platform     string    `json:"platform,omitempty"`
	DeviceID     string    `json:"device_id,omitempty"`
	RiskScore    float64   `json:"risk_score,omitempty"`
}

// MobileTokenResponse extends TokenPair with mobile-specific fields
type MobileTokenResponse struct {
	AccessToken           string                              `json:"access_token"`
	RefreshToken          string                              `json:"refresh_token"`
	AccessTokenExpiresAt  time.Time                           `json:"access_token_expires_at"`
	RefreshTokenExpiresAt time.Time                           `json:"refresh_token_expires_at"`
	DeviceSession         *repository.MobileDeviceSession    `json:"device_session,omitempty"`
	TokenPolicy           *repository.TokenPolicy            `json:"token_policy,omitempty"`
	FamilyID              string                              `json:"-"` // Internal use only
	Platform              string                              `json:"platform,omitempty"`
	DeviceID              string                              `json:"device_id,omitempty"`
	RiskScore             float64                             `json:"risk_score,omitempty"`
}

// JWTService provides JWT token operations
type JWTService struct {
	config        *JWTConfig
	tokenHasher   *security.TokenHasher
	mobileConfig  *config.MobileAuthConfig
	fingerprinter *security.DeviceFingerprinter
	keyManager    JWTKeyManager // RSA key management for secure token signing
}

// NewJWTService creates a new JWT service
func NewJWTService(config *JWTConfig, keyManager JWTKeyManager) *JWTService {
	return &JWTService{
		config:        config,
		tokenHasher:   security.NewTokenHasher(),
		mobileConfig:  config.GetMobileAuthConfig(),
		fingerprinter: security.NewDeviceFingerprinter(),
		keyManager:    keyManager,
	}
}

// NewJWTServiceWithMobile creates a new JWT service with mobile configuration
func NewJWTServiceWithMobile(config *JWTConfig, mobileConfig *config.MobileAuthConfig, keyManager JWTKeyManager) *JWTService {
	return &JWTService{
		config:        config,
		tokenHasher:   security.NewTokenHasher(),
		mobileConfig:  mobileConfig,
		fingerprinter: security.NewDeviceFingerprinter(),
		keyManager:    keyManager,
	}
}

// GenerateAccessToken generates a new access token (backward compatible - defaults to web platform)
func (j *JWTService) GenerateAccessToken(userID uuid.UUID, email, username string, roles, permissions []string) (string, error) {
	return j.GenerateAccessTokenWithPlatform(userID, email, username, roles, permissions, "web")
}

// GenerateAccessTokenWithPlatform generates a new access token for a specific platform
func (j *JWTService) GenerateAccessTokenWithPlatform(userID uuid.UUID, email, username string, roles, permissions []string, platform string) (string, error) {
	// Input validation
	if err := j.validateTokenInputs(userID, email, username); err != nil {
		return "", fmt.Errorf("invalid token inputs: %w", err)
	}
	
	// Validate platform
	if platform == "" {
		platform = "web" // Default platform
	}
	
	now := time.Now()
	
	// Get platform-specific TTL
	tokenTTL := j.getPlatformTokenTTL(platform)
	
	// Create platform-specific audience
	audience := j.getPlatformAudience(platform)
	
	claims := Claims{
		UserID:      userID,
		Email:       email,
		Username:    username,
		Roles:       roles,
		Permissions: permissions,
		Platform:    platform, // NEW: Include platform in claims
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Issuer:    j.config.Issuer,
			Subject:   userID.String(),
			Audience:  audience,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Get current signing key
	privateKey, keyID, err := j.keyManager.GetCurrentSigningKey()
	if err != nil {
		return "", fmt.Errorf("failed to get signing key: %w", err)
	}
	
	// Add key ID to header
	token.Header["kid"] = keyID
	
	return token.SignedString(privateKey)
}

// GenerateAccessTokenLegacy generates a new access token (legacy method for backward compatibility)
func (j *JWTService) GenerateAccessTokenLegacy(userID uuid.UUID, email, username string) (string, error) {
	return j.GenerateAccessToken(userID, email, username, []string{"user"}, []string{})
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

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Get current signing key
	privateKey, keyID, err := j.keyManager.GetCurrentSigningKey()
	if err != nil {
		return "", fmt.Errorf("failed to get signing key: %w", err)
	}
	
	// Add key ID to header
	token.Header["kid"] = keyID
	
	return token.SignedString(privateKey)
}

// ValidateAccessToken validates and parses an access token
func (j *JWTService) ValidateAccessToken(tokenString string) (*Claims, error) {
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
		
		// Get public key for validation
		publicKey, err := j.keyManager.GetPublicKey(keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to get public key: %w", err)
		}
		
		return publicKey, nil
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
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		
		// Get key ID from header
		keyID, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("missing or invalid key ID in token header")
		}
		
		// Get public key for validation
		publicKey, err := j.keyManager.GetPublicKey(keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to get public key: %w", err)
		}
		
		return publicKey, nil
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

// GenerateTokenPair generates both access and refresh tokens with family tracking
func (j *JWTService) GenerateTokenPair(userID uuid.UUID, email, username string, roles, permissions []string, deviceInfo string) (*TokenPair, error) {
	// Input validation
	if err := j.validateTokenInputs(userID, email, username); err != nil {
		return nil, fmt.Errorf("invalid token inputs: %w", err)
	}
	familyID := uuid.New().String()

	// Generate access token
	accessToken, err := j.GenerateAccessToken(userID, email, username, roles, permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token with family
	refreshToken, err := j.GenerateRefreshTokenWithFamily(userID, familyID, deviceInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		FamilyID:     familyID,
		ExpiresAt:    time.Now().Add(j.config.AccessTokenTTL),
	}, nil
}

// GenerateRefreshTokenWithFamily generates refresh token with family and device info
func (j *JWTService) GenerateRefreshTokenWithFamily(userID uuid.UUID, familyID, deviceInfo string) (string, error) {
	now := time.Now()
	claims := RefreshTokenClaims{
		FamilyID:   familyID,
		DeviceInfo: deviceInfo,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Issuer:    j.config.Issuer,
			Subject:   userID.String(),
			Audience:  jwt.ClaimStrings{"link-app-refresh"},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.config.RefreshTokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Get current signing key
	privateKey, keyID, err := j.keyManager.GetCurrentSigningKey()
	if err != nil {
		return "", fmt.Errorf("failed to get signing key: %w", err)
	}
	
	// Add key ID to header
	token.Header["kid"] = keyID
	
	return token.SignedString(privateKey)
}

// ValidateRefreshTokenWithFamily validates refresh token and returns enhanced claims
func (j *JWTService) ValidateRefreshTokenWithFamily(tokenString string) (*RefreshTokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &RefreshTokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		
		// Get key ID from header
		keyID, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("missing or invalid key ID in token header")
		}
		
		// Get public key for validation
		publicKey, err := j.keyManager.GetPublicKey(keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to get public key: %w", err)
		}
		
		return publicKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse refresh token: %w", err)
	}

	if claims, ok := token.Claims.(*RefreshTokenClaims); ok && token.Valid {
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


// validateTokenInputs validates inputs for token generation
func (j *JWTService) validateTokenInputs(userID uuid.UUID, email, username string) error {
	// Validate user ID
	if userID == uuid.Nil {
		return fmt.Errorf("user ID is nil")
	}

	// Validate email
	if email == "" {
		return fmt.Errorf("email is empty")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if !strings.Contains(email, "@") || len(email) < 5 {
		return fmt.Errorf("email format is invalid")
	}

	// Validate username
	if username == "" {
		return fmt.Errorf("username is empty")
	}
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 30 {
		return fmt.Errorf("username must be between 3 and 30 characters")
	}

	// Basic security check for username (alphanumeric + underscore/dash)
	for _, char := range username {
		if !((char >= 'a' && char <= 'z') || 
			 (char >= 'A' && char <= 'Z') || 
			 (char >= '0' && char <= '9') || 
			 char == '_' || char == '-') {
			return fmt.Errorf("username contains invalid characters")
		}
	}

	return nil
}

// MobileTokenRequest represents a mobile token generation request
type MobileTokenRequest struct {
	UserID      uuid.UUID
	Email       string
	Username    string
	Roles       []string
	Permissions []string
	Platform    string                    // ios, android, web
	DeviceInfo  *security.DeviceInfo     // Device information
	DeviceID    string                   // Unique device identifier
	Biometric   bool                     // Biometric auth enabled
	Environment string                   // dev, staging, production
}

// GenerateMobileTokenPair generates platform-optimized token pair for mobile
func (j *JWTService) GenerateMobileTokenPair(req *MobileTokenRequest) (*TokenPair, error) {
	// Input validation
	if err := j.validateMobileTokenRequest(req); err != nil {
		return nil, fmt.Errorf("invalid mobile token request: %w", err)
	}
	
	// Get platform-specific configuration
	platformConfig := j.mobileConfig.GetPlatformConfig(req.Platform)
	
	// Generate device fingerprint
	deviceFingerprint, err := j.fingerprinter.GenerateFingerprint(req.DeviceInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to generate device fingerprint: %w", err)
	}
	
	// Calculate risk score
	riskScore := j.fingerprinter.CalculateRiskScore(req.DeviceInfo)
	
	// Generate family ID for token rotation
	familyID := uuid.New().String()
	
	// Generate access token with platform-specific TTL
	accessToken, err := j.generateMobileAccessToken(req, platformConfig.AccessTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate mobile access token: %w", err)
	}
	
	// Generate refresh token with mobile-specific claims
	refreshToken, err := j.generateMobileRefreshToken(req, familyID, deviceFingerprint, riskScore, platformConfig.RefreshTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate mobile refresh token: %w", err)
	}
	
	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().Add(platformConfig.AccessTokenTTL),
		FamilyID:     familyID,
		Platform:     req.Platform,
		DeviceID:     req.DeviceID,
		RiskScore:    riskScore,
	}, nil
}

// generateMobileAccessToken generates access token with mobile-specific configuration
func (j *JWTService) generateMobileAccessToken(req *MobileTokenRequest, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:      req.UserID,
		Email:       req.Email,
		Username:    req.Username,
		Roles:       req.Roles,
		Permissions: req.Permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Issuer:    j.config.Issuer,
			Subject:   req.UserID.String(),
			Audience:  jwt.ClaimStrings{fmt.Sprintf("link-app-%s", req.Platform)},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Get current signing key
	privateKey, keyID, err := j.keyManager.GetCurrentSigningKey()
	if err != nil {
		return "", fmt.Errorf("failed to get signing key: %w", err)
	}
	
	// Add key ID to header
	token.Header["kid"] = keyID
	
	return token.SignedString(privateKey)
}

// generateMobileRefreshToken generates refresh token with mobile-specific claims
func (j *JWTService) generateMobileRefreshToken(req *MobileTokenRequest, familyID, deviceFingerprint string, riskScore float64, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := RefreshTokenClaims{
		FamilyID:         familyID,
		DeviceInfo:       deviceFingerprint,
		Platform:         req.Platform,
		DeviceID:         req.DeviceID,
		RiskScore:        riskScore,
		BiometricEnabled: req.Biometric,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Issuer:    j.config.Issuer,
			Subject:   req.UserID.String(),
			Audience:  jwt.ClaimStrings{fmt.Sprintf("link-app-refresh-%s", req.Platform)},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Get current signing key
	privateKey, keyID, err := j.keyManager.GetCurrentSigningKey()
	if err != nil {
		return "", fmt.Errorf("failed to get signing key: %w", err)
	}
	
	// Add key ID to header
	token.Header["kid"] = keyID
	
	return token.SignedString(privateKey)
}

// ValidateMobileRefreshToken validates mobile refresh token with enhanced security
func (j *JWTService) ValidateMobileRefreshToken(tokenString, expectedPlatform string) (*RefreshTokenClaims, error) {
	// Parse token with mobile claims
	claims, err := j.ValidateRefreshTokenWithFamily(tokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid mobile refresh token: %w", err)
	}
	
	// Validate platform consistency
	if claims.Platform != "" && claims.Platform != expectedPlatform {
		return nil, fmt.Errorf("platform mismatch: expected %s, got %s", expectedPlatform, claims.Platform)
	}
	
	// Check risk score threshold
	if j.mobileConfig != nil {
		platformConfig := j.mobileConfig.GetPlatformConfig(expectedPlatform)
		if claims.RiskScore > platformConfig.RiskThreshold {
			return nil, fmt.Errorf("risk score %.2f exceeds threshold %.2f for platform %s", 
				claims.RiskScore, platformConfig.RiskThreshold, expectedPlatform)
		}
	}
	
	return claims, nil
}

// IsBackgroundRefreshAllowed checks if background refresh is allowed for platform and token
func (j *JWTService) IsBackgroundRefreshAllowed(claims *RefreshTokenClaims) bool {
	if j.mobileConfig == nil {
		return false
	}
	
	// Check platform allows background refresh
	if !j.mobileConfig.IsBackgroundRefreshAllowed(claims.Platform) {
		return false
	}
	
	// Check risk score is within acceptable range for background operations
	platformConfig := j.mobileConfig.GetPlatformConfig(claims.Platform)
	return claims.RiskScore <= platformConfig.RiskThreshold * 0.8 // 20% safety margin
}

// validateMobileTokenRequest validates mobile token generation request
func (j *JWTService) validateMobileTokenRequest(req *MobileTokenRequest) error {
	if req == nil {
		return fmt.Errorf("request is nil")
	}
	
	// Validate basic user info
	if err := j.validateTokenInputs(req.UserID, req.Email, req.Username); err != nil {
		return err
	}
	
	// Validate platform
	if req.Platform == "" {
		return fmt.Errorf("platform is required")
	}
	validPlatforms := map[string]bool{"web": true, "ios": true, "android": true}
	if !validPlatforms[req.Platform] {
		return fmt.Errorf("invalid platform: %s", req.Platform)
	}
	
	// Validate device info for mobile platforms
	if req.Platform != "web" {
		if req.DeviceID == "" {
			return fmt.Errorf("device_id is required for mobile platforms")
		}
		if req.DeviceInfo == nil {
			return fmt.Errorf("device_info is required for mobile platforms")
		}
	}
	
	// Validate environment
	validEnvironments := map[string]bool{"development": true, "staging": true, "production": true}
	if req.Environment != "" && !validEnvironments[req.Environment] {
		return fmt.Errorf("invalid environment: %s", req.Environment)
	}
	
	return nil
}

// GenerateMobileTokenResponse creates a comprehensive mobile token response
func (j *JWTService) GenerateMobileTokenResponse(req *MobileTokenRequest, tokenRepo repository.RefreshTokenRepository) (*MobileTokenResponse, error) {
	ctx := context.Background()
	
	// Generate the basic token pair
	tokenPair, err := j.GenerateMobileTokenPair(req)
	if err != nil {
		return nil, fmt.Errorf("failed to generate mobile token pair: %w", err)
	}
	
	// Get or create device session
	deviceSession, err := j.getOrCreateDeviceSession(ctx, req, tokenRepo)
	if err != nil {
		return nil, fmt.Errorf("failed to manage device session: %w", err)
	}
	
	// Get token policy
	tokenPolicy, err := tokenRepo.GetTokenPolicy(ctx, req.Platform, req.Environment)
	if err != nil {
		// Create default policy if not found
		tokenPolicy = j.createDefaultTokenPolicy(req.Platform, req.Environment)
		tokenRepo.UpdateTokenPolicy(ctx, tokenPolicy)
	}
	
	// Generate device fingerprint string
	deviceFingerprint, err := j.fingerprinter.GenerateFingerprint(req.DeviceInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to generate device fingerprint: %w", err)
	}

	// Store the refresh token in the repository
	refreshToken := &repository.RefreshToken{
		UserID:                   req.UserID,
		ExpiresAt:                time.Now().Add(time.Duration(tokenPolicy.RefreshTokenTTLDays) * 24 * time.Hour),
		FamilyID:                 tokenPair.FamilyID,
		Platform:                 req.Platform,
		DeviceFingerprint:        deviceFingerprint,
		AppVersion:               req.DeviceInfo.AppVersion,
		OSVersion:                req.DeviceInfo.OSVersion,
		BiometricEnabled:         req.Biometric,
		SecurityLevel:            tokenPolicy.SecurityLevel,
		RiskScore:                tokenPair.RiskScore,
	}
	
	if err := tokenRepo.StoreRefreshToken(ctx, refreshToken, tokenPair.RefreshToken); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}
	
	return &MobileTokenResponse{
		AccessToken:           tokenPair.AccessToken,
		RefreshToken:          tokenPair.RefreshToken,
		AccessTokenExpiresAt:  tokenPair.ExpiresAt,
		RefreshTokenExpiresAt: refreshToken.ExpiresAt,
		DeviceSession:         deviceSession,
		TokenPolicy:           tokenPolicy,
		FamilyID:              tokenPair.FamilyID,
		Platform:              tokenPair.Platform,
		DeviceID:              tokenPair.DeviceID,
		RiskScore:             tokenPair.RiskScore,
	}, nil
}

// getOrCreateDeviceSession gets existing device session or creates a new one
func (j *JWTService) getOrCreateDeviceSession(ctx context.Context, req *MobileTokenRequest, tokenRepo repository.RefreshTokenRepository) (*repository.MobileDeviceSession, error) {
	// Try to get existing session
	session, err := tokenRepo.GetMobileDeviceSession(ctx, req.UserID, req.DeviceID)
	if err == nil {
		// Update existing session
		tokenRepo.UpdateMobileDeviceLastSeen(ctx, req.UserID, req.DeviceID)
		return session, nil
	}
	
	// Get device model from hardware info
	deviceModel := ""
	if req.DeviceInfo.HardwareInfo != nil {
		deviceModel = req.DeviceInfo.HardwareInfo.Model
	}

	// Create new device session
	newSession := &repository.MobileDeviceSession{
		UserID:           req.UserID,
		DeviceID:         req.DeviceID,
		DeviceName:       req.DeviceInfo.DeviceName,
		Platform:         req.Platform,
		AppVersion:       req.DeviceInfo.AppVersion,
		OSVersion:        req.DeviceInfo.OSVersion,
		DeviceModel:      deviceModel,
		FirstSeen:        time.Now(),
		LastSeen:         time.Now(),
		IsTrusted:        false, // New devices start as untrusted
		IsActive:         true,
		BiometricEnabled: req.Biometric,
	}
	
	if err := tokenRepo.RegisterMobileDevice(ctx, newSession); err != nil {
		return nil, fmt.Errorf("failed to register mobile device: %w", err)
	}
	
	return newSession, nil
}

// createDefaultTokenPolicy creates a default token policy for a platform
func (j *JWTService) createDefaultTokenPolicy(platform, environment string) *repository.TokenPolicy {
	policy := &repository.TokenPolicy{
		Platform:                 platform,
		Environment:              environment,
		AccessTokenTTLMinutes:    60,  // 1 hour
		RefreshTokenTTLDays:      30,  // 30 days
		MaxConcurrentTokens:      5,   // 5 concurrent sessions
		RequireDeviceBinding:     platform != "web",
		AllowBackgroundRefresh:   platform != "web",
		RiskThreshold:            0.7, // 70% risk threshold
		SecurityLevel:            1,   // Basic security level
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}
	
	// Platform-specific adjustments
	switch platform {
	case "ios":
		policy.AccessTokenTTLMinutes = 120 // iOS can handle longer tokens
		policy.AllowBackgroundRefresh = true
		policy.RiskThreshold = 0.6 // iOS is more secure
	case "android":
		policy.AccessTokenTTLMinutes = 90
		policy.AllowBackgroundRefresh = true
		policy.RiskThreshold = 0.7
	case "web":
		policy.AccessTokenTTLMinutes = 60
		policy.RequireDeviceBinding = false
		policy.AllowBackgroundRefresh = false
		policy.RiskThreshold = 0.8 // Web is riskier
	}
	
	return policy
}

// getPlatformTokenTTL returns the appropriate token TTL for a platform
func (j *JWTService) getPlatformTokenTTL(platform string) time.Duration {
	switch platform {
	case "ios":
		return 15 * time.Minute // Short-lived for security
	case "android":
		return 15 * time.Minute
	case "mobile":
		return 15 * time.Minute
	case "web":
		return j.config.AccessTokenTTL // Default web TTL (1 hour)
	default:
		return j.config.AccessTokenTTL
	}
}

// getPlatformAudience returns the appropriate audience for a platform
func (j *JWTService) getPlatformAudience(platform string) jwt.ClaimStrings {
	switch platform {
	case "ios":
		return jwt.ClaimStrings{"link-app", "link-app-ios"}
	case "android":
		return jwt.ClaimStrings{"link-app", "link-app-android"}
	case "mobile":
		return jwt.ClaimStrings{"link-app", "link-app-mobile"}
	case "web":
		return jwt.ClaimStrings{"link-app", "link-app-web"}
	default:
		return jwt.ClaimStrings{"link-app"}
	}
}

// UNIFIED AUTH INTEGRATION METHODS - Added for Phase 1

// GenerateAccessTokenForUnified generates an access token compatible with unified auth system
func (j *JWTService) GenerateAccessTokenForUnified(userID uuid.UUID, email, username string, roles, permissions []string, platform string) (string, error) {
	return j.GenerateAccessTokenWithPlatform(userID, email, username, roles, permissions, platform)
}

// GenerateRefreshTokenForUnified generates a refresh token compatible with unified auth system
func (j *JWTService) GenerateRefreshTokenForUnified(userID uuid.UUID, tokenFamily string, platform string) (string, error) {
	now := time.Now()
	
	// Create platform-specific refresh token claims
	claims := RefreshTokenClaims{
		FamilyID: tokenFamily,
		Platform: platform,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			Issuer:    j.config.Issuer,
			Subject:   userID.String(),
			Audience:  jwt.ClaimStrings{"link-app-refresh"},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.config.RefreshTokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Get current signing key
	privateKey, keyID, err := j.keyManager.GetCurrentSigningKey()
	if err != nil {
		return "", fmt.Errorf("failed to get signing key: %w", err)
	}
	
	// Add key ID to header
	token.Header["kid"] = keyID
	
	return token.SignedString(privateKey)
}

// ValidateAccessTokenForUnified validates an access token for unified auth system
func (j *JWTService) ValidateAccessTokenForUnified(tokenString string) (*Claims, error) {
	return j.ValidateAccessToken(tokenString)
}

// ValidateRefreshTokenForUnified validates a refresh token for unified auth system
func (j *JWTService) ValidateRefreshTokenForUnified(tokenString string) (*RefreshTokenClaims, error) {
	return j.ValidateRefreshTokenWithFamily(tokenString)
}
