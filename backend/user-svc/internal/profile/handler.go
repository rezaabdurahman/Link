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

// GetMyProfile gets the authenticated user's own profile
func (h *ProfileHandler) GetMyProfile(c *gin.Context) {
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

// CancelFriendRequest cancels a sent friend request
func (h *ProfileHandler) CancelFriendRequest(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	requesteeIDStr := c.Param("requesteeId")
	requesteeID, err := uuid.Parse(requesteeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid requestee ID format",
			"code":    "INVALID_UUID",
		})
		return
	}

	if err := h.profileService.CancelFriendRequest(userID, requesteeID); err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Friend request cancelled successfully",
	})
}

// RemoveFriend removes a friendship between users
// @Summary Remove friend
// @Description Remove a friendship between the authenticated user and another user
// @Tags friends
// @Accept json
// @Produce json
// @Param friendId path string true "Friend ID (UUID)"
// @Success 204 "Friend removed successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request - validation error, users not friends, or cannot remove self"
// @Failure 401 {object} map[string]interface{} "Authentication required"
// @Failure 404 {object} map[string]interface{} "User not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /users/friends/{friendId} [delete]
func (h *ProfileHandler) RemoveFriend(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	friendIDStr := c.Param("friendId")
	friendID, err := uuid.Parse(friendIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid friend ID format",
			"code":    "INVALID_UUID",
		})
		return
	}

	if err := h.profileService.RemoveFriend(userID, friendID); err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
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
	case errors.Is(err, ErrNotFriends):
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Users are not friends",
			"code":    "NOT_FRIENDS",
		})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "SERVER_ERROR",
			"message": "Internal server error",
			"code":    "INTERNAL_ERROR",
		})
	}
}
