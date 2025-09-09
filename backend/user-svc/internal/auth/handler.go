package auth

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthHandler handles authentication HTTP requests
type AuthHandler struct {
	authService AuthService
}

// newAuthHandler creates a new auth handler (internal)
func newAuthHandler(authService AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// isProduction determines if we're running in production environment
func isProduction() bool {
	env := os.Getenv("GO_ENV")
	if env == "" {
		env = os.Getenv("ENVIRONMENT")
	}
	if env == "" {
		env = os.Getenv("ENV")
	}
	return env == "production" || env == "prod"
}

// getCookieDomain returns appropriate cookie domain based on environment
func getCookieDomain() string {
	if isProduction() {
		return os.Getenv("COOKIE_DOMAIN") // e.g., ".link-app.com"
	}
	return "" // localhost for development
}

// setRefreshTokenCookie sets a secure refresh token cookie with proper security settings
func (h *AuthHandler) setRefreshTokenCookie(c *gin.Context, refreshToken string) {
	secure := isProduction() // Only secure cookies in production (HTTPS)
	domain := getCookieDomain()
	
	c.SetCookie(
		"refresh_token",
		refreshToken,
		int(h.authService.(*authService).jwtService.GetRefreshTokenTTL().Seconds()),
		"/",
		domain,
		secure,
		true, // httpOnly - always true for security
	)
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Extract IP and platform from headers
	req.IPAddress = c.ClientIP()
	if req.Platform == "" {
		req.Platform = c.GetHeader("X-Platform")
	}
	if req.DeviceInfo == "" {
		req.DeviceInfo = c.GetHeader("X-Device-Fingerprint")
	}
	if req.DeviceID == "" {
		req.DeviceID = c.GetHeader("X-Device-ID")
	}

	authResponse, tokenPair, err := h.authService.RegisterUser(req)
	if err != nil {
		if authErr, ok := err.(*AuthError); ok {
			c.JSON(authErr.StatusCode, gin.H{
				"error":   authErr.Code,
				"message": authErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "REGISTRATION_ERROR",
			"message": "Registration failed",
		})
		return
	}

	// Set refresh token as HTTP-only cookie with proper security settings
	h.setRefreshTokenCookie(c, tokenPair.RefreshToken)

	c.JSON(http.StatusCreated, authResponse)
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Extract IP and platform from headers
	req.IPAddress = c.ClientIP()
	if req.Platform == "" {
		req.Platform = c.GetHeader("X-Platform")
	}
	if req.DeviceInfo == "" {
		req.DeviceInfo = c.GetHeader("X-Device-Fingerprint")
	}
	if req.DeviceID == "" {
		req.DeviceID = c.GetHeader("X-Device-ID")
	}

	authResponse, tokenPair, err := h.authService.LoginUser(req)
	if err != nil {
		if authErr, ok := err.(*AuthError); ok {
			c.JSON(authErr.StatusCode, gin.H{
				"error":   authErr.Code,
				"message": authErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "LOGIN_ERROR",
			"message": "Login failed",
		})
		return
	}

	// Set refresh token as HTTP-only cookie with proper security settings
	h.setRefreshTokenCookie(c, tokenPair.RefreshToken)

	c.JSON(http.StatusOK, authResponse)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest

	// Get refresh token from cookie or body
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		// Try to get from body
		if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "VALIDATION_ERROR",
				"message": "Refresh token required",
			})
			return
		}
		refreshToken = req.RefreshToken
	} else {
		req.RefreshToken = refreshToken
	}

	// Extract IP and platform from headers
	req.IPAddress = c.ClientIP()
	if req.Platform == "" {
		req.Platform = c.GetHeader("X-Platform")
	}
	if req.DeviceInfo == "" {
		req.DeviceInfo = c.GetHeader("X-Device-Fingerprint")
	}

	response, err := h.authService.RefreshTokens(req)
	if err != nil {
		if authErr, ok := err.(*AuthError); ok {
			c.JSON(authErr.StatusCode, gin.H{
				"error":   authErr.Code,
				"message": authErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "REFRESH_ERROR",
			"message": "Token refresh failed",
		})
		return
	}

	// Set new refresh token as HTTP-only cookie with proper security settings
	h.setRefreshTokenCookie(c, response.RefreshToken)

	c.JSON(http.StatusOK, response)
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "UNAUTHORIZED",
			"message": "User not authenticated",
		})
		return
	}

	// Get refresh token for targeted logout
	refreshToken, _ := c.Cookie("refresh_token")

	err := h.authService.LogoutUser(userID.(uuid.UUID), refreshToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "LOGOUT_ERROR",
			"message": "Logout failed",
		})
		return
	}

	// Clear refresh token cookie with proper security settings
	secure := isProduction()
	domain := getCookieDomain()
	c.SetCookie(
		"refresh_token",
		"",
		-1, // expire immediately
		"/",
		domain,
		secure,
		true, // httpOnly
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
}

// Mobile endpoints - simple extensions for mobile platforms

// MobileLogin handles mobile-specific login
func (h *AuthHandler) MobileLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Set platform to mobile if not specified
	if req.Platform == "" {
		req.Platform = "mobile"
	}

	// Extract mobile-specific headers
	req.IPAddress = c.ClientIP()
	req.DeviceInfo = c.GetHeader("X-Device-Fingerprint")
	req.DeviceID = c.GetHeader("X-Device-ID")

	authResponse, tokenPair, err := h.authService.LoginUser(req)
	if err != nil {
		if authErr, ok := err.(*AuthError); ok {
			c.JSON(authErr.StatusCode, gin.H{
				"error":   authErr.Code,
				"message": authErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "MOBILE_LOGIN_ERROR",
			"message": "Mobile login failed",
		})
		return
	}

	// Return both tokens in response for mobile (no cookies)
	response := gin.H{
		"user":          authResponse.User,
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_at":    tokenPair.ExpiresAt,
		"token_type":    tokenPair.TokenType,
		"message":       authResponse.Message,
	}

	c.JSON(http.StatusOK, response)
}

// MobileRefresh handles mobile token refresh
func (h *AuthHandler) MobileRefresh(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Set platform to mobile if not specified
	if req.Platform == "" {
		req.Platform = "mobile"
	}

	// Extract mobile-specific headers
	req.IPAddress = c.ClientIP()
	req.DeviceInfo = c.GetHeader("X-Device-Fingerprint")

	response, err := h.authService.RefreshTokens(req)
	if err != nil {
		if authErr, ok := err.(*AuthError); ok {
			c.JSON(authErr.StatusCode, gin.H{
				"error":   authErr.Code,
				"message": authErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "MOBILE_REFRESH_ERROR",
			"message": "Mobile token refresh failed",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// RegisterRoutes registers all auth routes
func RegisterRoutes(router *gin.RouterGroup, handler *AuthHandler) {
	// Standard web auth routes
	router.POST("/register", handler.Register)
	router.POST("/login", handler.Login)
	router.POST("/refresh", handler.RefreshToken)
	router.POST("/logout", handler.Logout)

	// Mobile-specific routes
	mobile := router.Group("/mobile")
	{
		mobile.POST("/login", handler.MobileLogin)
		mobile.POST("/refresh", handler.MobileRefresh)
	}
}
