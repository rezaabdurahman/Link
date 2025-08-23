package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/auth"
	"github.com/link-app/user-svc/internal/middleware"
	"github.com/link-app/user-svc/internal/profile"
	"github.com/link-app/user-svc/internal/service"
)

type UserHandler struct {
	userService service.UserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(userService service.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// RegisterUser handles user registration
func (h *UserHandler) RegisterUser(c *gin.Context) {
	var req auth.RegisterUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	response, err := h.userService.RegisterUser(req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, response)
}

// LoginUser handles user login
func (h *UserHandler) LoginUser(c *gin.Context) {
	var req auth.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	response, session, err := h.userService.LoginUser(req)
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
func (h *UserHandler) RefreshToken(c *gin.Context) {
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

	response, err := h.userService.RefreshToken(refreshToken)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// LogoutUser handles user logout
func (h *UserHandler) LogoutUser(c *gin.Context) {
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
		if err := h.userService.LogoutUser(userID, sessionToken); err != nil {
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

// GetMyProfile gets the authenticated user's own profile
func (h *UserHandler) GetMyProfile(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	profile, err := h.userService.GetUserProfile(userID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// GetUserProfile gets a public user profile
func (h *UserHandler) GetUserProfile(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid user ID format",
			"code":    "INVALID_UUID",
		})
		return
	}

	// Get viewer ID (optional - for friend status)
	viewerID, _ := middleware.GetUserIDFromHeader(c)

	profile, err := h.userService.GetPublicUserProfile(userID, viewerID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateUserProfile updates the current user's profile
func (h *UserHandler) UpdateUserProfile(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	var req profile.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	profile, err := h.userService.UpdateUserProfile(userID, req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// GetFriends gets the user's friends list
func (h *UserHandler) GetFriends(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	// Parse pagination parameters
	page, limit := h.getPaginationParams(c)

	friends, err := h.userService.GetUserFriends(userID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"friends": friends,
		"page":    page,
		"limit":   limit,
		"count":   len(friends),
	})
}

// GetFriendRequests gets pending friend requests
func (h *UserHandler) GetFriendRequests(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	// Parse pagination parameters
	page, limit := h.getPaginationParams(c)

	requests, err := h.userService.GetFriendRequests(userID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"friend_requests": requests,
		"page":            page,
		"limit":           limit,
		"count":           len(requests),
	})
}

// SendFriendRequest sends a friend request
func (h *UserHandler) SendFriendRequest(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	var req profile.SendFriendRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	if err := h.userService.SendFriendRequest(userID, req); err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Friend request sent successfully",
	})
}

// RespondToFriendRequest accepts or declines a friend request
func (h *UserHandler) RespondToFriendRequest(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	requestIDStr := c.Param("requestId")
	requestID, err := uuid.Parse(requestIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request ID format",
			"code":    "INVALID_UUID",
		})
		return
	}

	var req struct {
		Accept bool `json:"accept"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	if err := h.userService.RespondToFriendRequest(requestID, userID, req.Accept); err != nil {
		h.handleServiceError(c, err)
		return
	}

	action := "declined"
	if req.Accept {
		action = "accepted"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Friend request " + action + " successfully",
	})
}

// GetHiddenUsers returns the current user's hidden users list
func (h *UserHandler) GetHiddenUsers(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User ID not found in context",
			"code":    "USER_ID_NOT_FOUND",
		})
		return
	}

	userUUID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid user ID format",
			"code":    "INVALID_USER_ID",
		})
		return
	}

	hiddenUsers, err := h.userService.GetHiddenUsers(userUUID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hidden_users": hiddenUsers,
	})
}

// HideUser adds a user to the current user's hidden list
func (h *UserHandler) HideUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User ID not found in context",
			"code":    "USER_ID_NOT_FOUND",
		})
		return
	}

	userUUID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid user ID format",
			"code":    "INVALID_USER_ID",
		})
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	userToHideUUID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid user ID to hide",
			"code":    "INVALID_USER_ID_TO_HIDE",
		})
		return
	}

	// Prevent users from hiding themselves
	if userUUID == userToHideUUID {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Cannot hide yourself",
			"code":    "CANNOT_HIDE_SELF",
		})
		return
	}

	err = h.userService.HideUser(userUUID, userToHideUUID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User hidden successfully",
	})
}

// UnhideUser removes a user from the current user's hidden list
func (h *UserHandler) UnhideUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User ID not found in context",
			"code":    "USER_ID_NOT_FOUND",
		})
		return
	}

	userUUID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid user ID format",
			"code":    "INVALID_USER_ID",
		})
		return
	}

	userToUnhideParam := c.Param("userId")
	userToUnhideUUID, err := uuid.Parse(userToUnhideParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid user ID to unhide",
			"code":    "INVALID_USER_ID_TO_UNHIDE",
		})
		return
	}

	err = h.userService.UnhideUser(userUUID, userToUnhideUUID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User unhidden successfully",
	})
}

// getPaginationParams extracts pagination parameters from request
func (h *UserHandler) getPaginationParams(c *gin.Context) (int, int) {
	page := 1
	limit := 20

	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	return page, limit
}

// handleServiceError maps service errors to HTTP responses
func (h *UserHandler) handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, profile.ErrUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "User not found",
			"code":    "USER_NOT_FOUND",
		})
	case errors.Is(err, auth.ErrInvalidCredentials):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Invalid email or password",
			"code":    "INVALID_CREDENTIALS",
		})
	case errors.Is(err, auth.ErrEmailAlreadyExists):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Email already exists",
			"code":    "EMAIL_ALREADY_EXISTS",
		})
	case errors.Is(err, auth.ErrUsernameAlreadyExists):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Username already exists",
			"code":    "USERNAME_ALREADY_EXISTS",
		})
	case errors.Is(err, auth.ErrInvalidToken):
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "Invalid or expired token",
			"code":    "INVALID_TOKEN",
		})
	case errors.Is(err, profile.ErrFriendRequestExists):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Friend request already exists",
			"code":    "FRIEND_REQUEST_EXISTS",
		})
	case errors.Is(err, profile.ErrAlreadyFriends):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Users are already friends",
			"code":    "ALREADY_FRIENDS",
		})
	case errors.Is(err, profile.ErrCannotSendToSelf):
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Cannot send friend request to yourself",
			"code":    "CANNOT_SEND_TO_SELF",
		})
	case errors.Is(err, profile.ErrFriendRequestNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "Friend request not found",
			"code":    "FRIEND_REQUEST_NOT_FOUND",
		})
	case errors.Is(err, profile.ErrUnauthorized):
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "AUTHORIZATION_ERROR",
			"message": "Unauthorized action",
			"code":    "UNAUTHORIZED",
		})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "SERVER_ERROR",
			"message": "Internal server error",
			"code":    "INTERNAL_ERROR",
		})
	}
}
