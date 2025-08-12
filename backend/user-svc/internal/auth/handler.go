package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/user-svc/internal/middleware"
)

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

	response, err := h.authService.RegisterUser(req)
	if err != nil {
		h.handleServiceError(c, err)
		return
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

	response, session, err := h.authService.LoginUser(req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	// Set secure cookie (if session is created)
	if session != nil {
		c.SetCookie(
			"link_auth_session",
			session.Token,
			int(time.Until(session.ExpiresAt).Seconds()),
			"/",
			"",
			false, // Set to true in production with HTTPS
			true,  // HttpOnly
		)
	}

	c.JSON(http.StatusOK, response)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	refreshToken := c.GetHeader("X-Refresh-Token")
	if refreshToken == "" {
		// Try cookie
		refreshToken, _ = c.Cookie("link_refresh_token")
	}

	if refreshToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Refresh token required",
			"code":    "MISSING_REFRESH_TOKEN",
		})
		return
	}

	response, err := h.authService.RefreshToken(refreshToken)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

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
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "SERVER_ERROR",
			"message": "Internal server error",
			"code":    "INTERNAL_ERROR",
		})
	}
}
