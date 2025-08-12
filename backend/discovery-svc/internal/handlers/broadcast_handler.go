package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/service"
)

// BroadcastHandler handles HTTP requests for broadcast operations
type BroadcastHandler struct {
	broadcastService *service.BroadcastService
}

// NewBroadcastHandler creates a new broadcast handler
func NewBroadcastHandler(broadcastService *service.BroadcastService) *BroadcastHandler {
	return &BroadcastHandler{
		broadcastService: broadcastService,
	}
}

// GetCurrentUserBroadcast handles GET /users/broadcasts
func (h *BroadcastHandler) GetCurrentUserBroadcast(c *gin.Context) {
	// Get user ID from JWT token (assuming middleware sets this)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "unauthorized",
			"message":   "User not authenticated",
			"code":      401,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid user ID",
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	broadcast, err := h.broadcastService.GetUserBroadcast(userID)
	if err != nil {
		if errors.Is(err, service.ErrBroadcastNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error":     "not_found",
				"message":   "No active broadcast found",
				"code":      404,
				"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "internal_error",
			"message":   "Failed to retrieve broadcast",
			"code":      500,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	c.JSON(http.StatusOK, broadcast.ToResponse())
}

// CreateBroadcast handles POST /users/broadcasts
func (h *BroadcastHandler) CreateBroadcast(c *gin.Context) {
	// Get user ID from JWT token
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "unauthorized",
			"message":   "User not authenticated",
			"code":      401,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid user ID",
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	var req models.CreateBroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid request data: " + err.Error(),
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	// Validate request
	if err := h.broadcastService.ValidateCreateRequest(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   err.Error(),
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	broadcast, err := h.broadcastService.CreateBroadcast(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "internal_error",
			"message":   "Failed to create broadcast",
			"code":      500,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	c.JSON(http.StatusCreated, broadcast.ToResponse())
}

// UpdateBroadcast handles PUT /users/broadcasts
func (h *BroadcastHandler) UpdateBroadcast(c *gin.Context) {
	// Get user ID from JWT token
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "unauthorized",
			"message":   "User not authenticated",
			"code":      401,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid user ID",
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	var req models.UpdateBroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid request data: " + err.Error(),
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	// Validate request
	if err := h.broadcastService.ValidateUpdateRequest(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   err.Error(),
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	broadcast, err := h.broadcastService.UpdateBroadcast(userID, req)
	if err != nil {
		if errors.Is(err, service.ErrBroadcastNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error":     "not_found",
				"message":   "No active broadcast found to update",
				"code":      404,
				"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "internal_error",
			"message":   "Failed to update broadcast",
			"code":      500,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	c.JSON(http.StatusOK, broadcast.ToResponse())
}

// DeleteBroadcast handles DELETE /users/broadcasts
func (h *BroadcastHandler) DeleteBroadcast(c *gin.Context) {
	// Get user ID from JWT token
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "unauthorized",
			"message":   "User not authenticated",
			"code":      401,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid user ID",
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	err = h.broadcastService.DeleteBroadcast(userID)
	if err != nil {
		if errors.Is(err, service.ErrBroadcastNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error":     "not_found",
				"message":   "No active broadcast found to delete",
				"code":      404,
				"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "internal_error",
			"message":   "Failed to delete broadcast",
			"code":      500,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetUserBroadcast handles GET /users/{userId}/broadcasts (public endpoint)
func (h *BroadcastHandler) GetUserBroadcast(c *gin.Context) {
	userIDParam := c.Param("userId")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "validation_error",
			"message":   "Invalid user ID format",
			"code":      400,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	broadcast, err := h.broadcastService.GetUserBroadcast(userID)
	if err != nil {
		if errors.Is(err, service.ErrBroadcastNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error":     "not_found",
				"message":   "User not found or no active broadcast",
				"code":      404,
				"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "internal_error",
			"message":   "Failed to retrieve broadcast",
			"code":      500,
			"timestamp": gin.H{"timestamp": "2024-08-12T02:22:00Z"},
		})
		return
	}

	c.JSON(http.StatusOK, broadcast.ToPublicResponse())
}
