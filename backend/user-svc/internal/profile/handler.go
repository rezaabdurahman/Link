package profile

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/middleware"
)

type ProfileHandler struct {
	profileService ProfileService
}

// NewProfileHandler creates a new profile handler
func NewProfileHandler(profileService ProfileService) *ProfileHandler {
	return &ProfileHandler{
		profileService: profileService,
	}
}

// GetCurrentUserProfile gets the current user's profile
func (h *ProfileHandler) GetCurrentUserProfile(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	profile, err := h.profileService.GetUserProfile(userID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// GetUserProfile gets a public user profile
func (h *ProfileHandler) GetUserProfile(c *gin.Context) {
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

	profile, err := h.profileService.GetPublicUserProfile(userID, viewerID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateUserProfile updates the current user's profile
func (h *ProfileHandler) UpdateUserProfile(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	profile, err := h.profileService.UpdateUserProfile(userID, req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// GetFriends gets the user's friends list
func (h *ProfileHandler) GetFriends(c *gin.Context) {
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

	friends, err := h.profileService.GetUserFriends(userID, page, limit)
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
func (h *ProfileHandler) GetFriendRequests(c *gin.Context) {
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

	requests, err := h.profileService.GetFriendRequests(userID, page, limit)
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
func (h *ProfileHandler) SendFriendRequest(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	var req SendFriendRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	if err := h.profileService.SendFriendRequest(userID, req); err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Friend request sent successfully",
	})
}

// RespondToFriendRequest accepts or declines a friend request
func (h *ProfileHandler) RespondToFriendRequest(c *gin.Context) {
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

	if err := h.profileService.RespondToFriendRequest(requestID, userID, req.Accept); err != nil {
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

// SearchUsers searches for users
func (h *ProfileHandler) SearchUsers(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Search query required",
			"code":    "MISSING_QUERY",
		})
		return
	}

	// Parse pagination parameters
	page, limit := h.getPaginationParams(c)

	users, err := h.profileService.SearchUsers(query, userID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"query": query,
		"page":  page,
		"limit": limit,
		"count": len(users),
	})
}

// SearchFriends searches within the user's friends list
func (h *ProfileHandler) SearchFriends(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Search query required",
			"code":    "MISSING_QUERY",
		})
		return
	}

	// Parse pagination parameters
	page, limit := h.getPaginationParams(c)

	friends, err := h.profileService.SearchFriends(userID, query, page, limit)
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

// getPaginationParams extracts pagination parameters from request
func (h *ProfileHandler) getPaginationParams(c *gin.Context) (int, int) {
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
func (h *ProfileHandler) handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "User not found",
			"code":    "USER_NOT_FOUND",
		})
	case errors.Is(err, ErrFriendRequestExists):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Friend request already exists",
			"code":    "FRIEND_REQUEST_EXISTS",
		})
	case errors.Is(err, ErrAlreadyFriends):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Users are already friends",
			"code":    "ALREADY_FRIENDS",
		})
	case errors.Is(err, ErrCannotSendToSelf):
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Cannot send friend request to yourself",
			"code":    "CANNOT_SEND_TO_SELF",
		})
	case errors.Is(err, ErrFriendRequestNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "Friend request not found",
			"code":    "FRIEND_REQUEST_NOT_FOUND",
		})
	case errors.Is(err, ErrUnauthorized):
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "AUTHORIZATION_ERROR",
			"message": "Unauthorized action",
			"code":    "UNAUTHORIZED",
		})
	case errors.Is(err, ErrSearchServiceUnavailable):
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "SERVICE_UNAVAILABLE",
			"message": "Search service is currently unavailable",
			"code":    "SEARCH_SERVICE_UNAVAILABLE",
		})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "SERVER_ERROR",
			"message": "Internal server error",
			"code":    "INTERNAL_ERROR",
		})
	}
}
