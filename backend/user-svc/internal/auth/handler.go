package auth

import (
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/user-svc/internal/middleware"
)

// Cookie configuration constants
const (
	AccessTokenCookieName  = "link_access_token"
	RefreshTokenCookieName = "link_refresh_token"
	RefreshTokenCookiePath = "/auth"
	CookieMaxAge           = 30 * 24 * 60 * 60 // 30 days in seconds
)

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

type AuthHandler struct {
	authService AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// RegisterUser handles user registration
func (h *AuthHandler) RegisterUser(c *gin.Context) {
	var req RegisterUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	response, tokenPair, err := h.authService.RegisterUser(req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	// Set secure cookies for both access and refresh tokens
	if tokenPair != nil {
		h.setTokenCookies(c, tokenPair)
	}

	c.JSON(http.StatusCreated, response)
}

// LoginUser handles user login
func (h *AuthHandler) LoginUser(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	// Extract IP address and user agent for security tracking
	req.IPAddress = c.ClientIP()
	req.DeviceInfo = c.GetHeader("User-Agent")

	response, tokenPair, err := h.authService.LoginUser(req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	// Set secure cookies for both access and refresh tokens
	if tokenPair != nil {
		h.setTokenCookies(c, tokenPair)
	}

	c.JSON(http.StatusOK, response)
}

// RefreshToken handles token refresh with rotation
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Try to get refresh token from multiple sources
	refreshToken := c.GetHeader("X-Refresh-Token")
	if refreshToken == "" {
		// Try cookie
		refreshToken, _ = c.Cookie("link_refresh_token")
	}
	if refreshToken == "" {
		// Try from JSON body
		var reqBody struct {
			RefreshToken string `json:"refresh_token"`
		}
		if err := c.ShouldBindJSON(&reqBody); err == nil && reqBody.RefreshToken != "" {
			refreshToken = reqBody.RefreshToken
		}
	}

	if refreshToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Refresh token required",
			"code":    "MISSING_REFRESH_TOKEN",
		})
		return
	}

	// Create refresh request with security context
	req := RefreshTokenRequest{
		RefreshToken: refreshToken,
		IPAddress:    c.ClientIP(),
		DeviceInfo:   c.GetHeader("User-Agent"),
	}

	response, err := h.authService.RefreshTokens(req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	// Set new token cookies (both access and refresh tokens are rotated)
	tokenPair := &TokenPair{
		AccessToken:  response.AccessToken,
		RefreshToken: response.RefreshToken,
		ExpiresAt:    response.ExpiresAt,
	}
	h.setTokenCookies(c, tokenPair)

	c.JSON(http.StatusOK, response)
}

// LogoutUser handles user logout
func (h *AuthHandler) LogoutUser(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	// Get session token from cookie or header
	sessionToken, _ := c.Cookie("link_auth_session")
	if sessionToken == "" {
		sessionToken = c.GetHeader("X-Session-Token")
	}

	if sessionToken != "" {
		if err := h.authService.LogoutUser(userID, sessionToken); err != nil {
			// Log error but don't fail logout
		}
	}

	// Clear cookies
	c.SetCookie("link_auth_session", "", -1, "/", "", false, true)
	c.SetCookie("link_refresh_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logout successful",
	})
}

// setTokenCookies sets secure HTTP-only cookies for access and refresh tokens
func (h *AuthHandler) setTokenCookies(c *gin.Context, tokenPair *TokenPair) {
	// Determine if we're in production for secure cookie settings
	environment := getEnv("ENVIRONMENT", "development")
	isSecure := environment == "production" || c.GetHeader("X-Forwarded-Proto") == "https"
	
	// Set access token cookie (shorter-lived, HttpOnly)
	c.SetCookie(
		AccessTokenCookieName,
		tokenPair.AccessToken,
		int(time.Until(tokenPair.ExpiresAt).Seconds()), // 1 hour
		"/",
		"", // domain - let browser determine
		isSecure, // secure in production
		true, // httpOnly
	)
	
	// Set refresh token cookie (longer-lived, HttpOnly, more restrictive path)
	c.SetCookie(
		RefreshTokenCookieName,
		tokenPair.RefreshToken,
		CookieMaxAge, // 30 days
		RefreshTokenCookiePath, // limited path
		"", // domain - let browser determine
		isSecure, // secure in production
		true, // httpOnly
	)
}

// handleServiceError maps service errors to HTTP responses
func (h *AuthHandler) handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "User not found",
			"code":    "USER_NOT_FOUND",
		})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Invalid email or password",
			"code":    "INVALID_CREDENTIALS",
		})
	case errors.Is(err, ErrEmailAlreadyExists):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Email already exists",
			"code":    "EMAIL_ALREADY_EXISTS",
		})
	case errors.Is(err, ErrUsernameAlreadyExists):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Username already exists",
			"code":    "USERNAME_ALREADY_EXISTS",
		})
	case errors.Is(err, ErrInvalidToken):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Invalid or expired token",
			"code":    "INVALID_TOKEN",
		})
	case errors.Is(err, ErrRefreshTokenExpired):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Refresh token expired",
			"code":    "REFRESH_TOKEN_EXPIRED",
		})
	case errors.Is(err, ErrRefreshTokenRevoked):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Refresh token revoked",
			"code":    "REFRESH_TOKEN_REVOKED",
		})
	case errors.Is(err, ErrRefreshTokenReused):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Security violation detected",
			"code":    "REFRESH_TOKEN_REUSED",
		})
	case errors.Is(err, ErrTooManyTokens):
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":   "RATE_LIMIT_ERROR",
			"message": "Too many active sessions",
			"code":    "TOO_MANY_TOKENS",
		})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "SERVER_ERROR",
			"message": "Internal server error",
			"code":    "INTERNAL_ERROR",
		})
	}
}
