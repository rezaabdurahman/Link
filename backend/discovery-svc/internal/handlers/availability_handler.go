package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/service"
)

// AvailabilityHandler handles HTTP requests for availability operations
type AvailabilityHandler struct {
	availabilityService *service.AvailabilityService
}

// NewAvailabilityHandler creates a new availability handler
func NewAvailabilityHandler(availabilityService *service.AvailabilityService) *AvailabilityHandler {
	return &AvailabilityHandler{
		availabilityService: availabilityService,
	}
}

// GetCurrentUserAvailability gets the current user's availability status
func (h *AvailabilityHandler) GetCurrentUserAvailability(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	availability, err := h.availabilityService.GetUserAvailability(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get availability"})
		return
	}

	c.JSON(http.StatusOK, availability.ToResponse())
}

// UpdateCurrentUserAvailability updates the current user's availability status
func (h *AvailabilityHandler) UpdateCurrentUserAvailability(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Parse request body
	var req models.UpdateAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Update availability
	availability, err := h.availabilityService.UpdateUserAvailability(userID, req.IsAvailable)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update availability"})
		return
	}

	c.JSON(http.StatusOK, availability.ToResponse())
}

// GetUserAvailability gets the availability status for a specific user (authenticated users only)
func (h *AvailabilityHandler) GetUserAvailability(c *gin.Context) {
	// Verify the requesting user is authenticated
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Authentication required",
			"message": "You must be logged in to view user availability",
			"code":    "AUTH_REQUIRED",
		})
		return
	}

	userIDParam := c.Param("userId")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid user ID format",
			"message": "The provided user ID is not valid",
			"code":    "INVALID_USER_ID",
		})
		return
	}

	availability, err := h.availabilityService.GetUserAvailability(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get availability",
			"message": "Unable to retrieve user availability at this time",
			"code":    "SERVICE_ERROR",
		})
		return
	}

	// Return public response (minimal info for cross-user access)
	c.JSON(http.StatusOK, availability.ToPublicResponse())
}

// GetAvailableUsers gets a list of users who are currently available (authenticated users only)
func (h *AvailabilityHandler) GetAvailableUsers(c *gin.Context) {
	// Verify the requesting user is authenticated
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Authentication required",
			"message": "You must be logged in to discover available users",
			"code":    "AUTH_REQUIRED",
		})
		return
	}

	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid limit parameter",
			"message": "Limit must be a positive number",
			"code":    "INVALID_LIMIT",
		})
		return
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid offset parameter",
			"message": "Offset must be a positive number",
			"code":    "INVALID_OFFSET",
		})
		return
	}

	// Get available users
	availabilities, totalCount, err := h.availabilityService.GetAvailableUsers(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get available users",
			"message": "Unable to retrieve available users at this time",
			"code":    "SERVICE_ERROR",
		})
		return
	}

	// Convert to public responses
	publicResponses := make([]models.PublicAvailabilityResponse, len(availabilities))
	for i, availability := range availabilities {
		publicResponses[i] = availability.ToPublicResponse()
	}

	// Return paginated response
	c.JSON(http.StatusOK, gin.H{
		"data": publicResponses,
		"pagination": gin.H{
			"total":       totalCount,
			"limit":       limit,
			"offset":      offset,
			"has_more":    int64(offset+limit) < totalCount,
			"total_pages": (totalCount + int64(limit) - 1) / int64(limit), // Ceiling division
		},
	})
}

// SearchAvailableUsers searches available users with optional semantic ranking
func (h *AvailabilityHandler) SearchAvailableUsers(c *gin.Context) {
	// Verify the requesting user is authenticated
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Authentication required",
			"message": "You must be logged in to search available users",
			"code":    "AUTH_REQUIRED",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid user ID format",
			"message": "The provided user ID is not valid",
			"code":    "INVALID_USER_ID",
		})
		return
	}

	// Parse and validate request
	var req models.SearchAvailableUsersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request parameters",
			"message": "The provided search parameters are not valid",
			"code":    "INVALID_PARAMS",
			"details": err.Error(),
		})
		return
	}

	// Perform search
	response, err := h.availabilityService.SearchAvailableUsers(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Search failed",
			"message": "Unable to search available users at this time",
			"code":    "SERVICE_ERROR",
		})
		return
	}

	// Return search response
	c.JSON(http.StatusOK, response)
}

// HandleHeartbeat handles heartbeat requests to keep users available
func (h *AvailabilityHandler) HandleHeartbeat(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Handle heartbeat
	availability, err := h.availabilityService.HandleUserHeartbeat(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to handle heartbeat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"availability": availability.ToResponse(),
	})
}
