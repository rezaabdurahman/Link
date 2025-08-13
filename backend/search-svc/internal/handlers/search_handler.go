package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/dto"
	"github.com/link-app/search-svc/internal/service"
)

// SearchHandler handles search-related HTTP requests
type SearchHandler struct {
	searchService service.SearchService
}

// NewSearchHandler creates a new search handler
func NewSearchHandler(searchService service.SearchService) *SearchHandler {
	return &SearchHandler{
		searchService: searchService,
	}
}

// Search handles POST /api/v1/search
func (h *SearchHandler) Search(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "UNAUTHORIZED",
			Message: "User ID not found in context",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_USER_ID",
			Message: "Invalid user ID format",
		})
		return
	}

	// Parse request body
	var req dto.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Validate request
	if err := h.validateSearchRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Perform search
	response, err := h.searchService.Search(c.Request.Context(), userID, &req)
	if err != nil {
		// Log error for debugging
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "SEARCH_FAILED",
			Message: "Failed to perform search",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// validateSearchRequest validates the search request
func (h *SearchHandler) validateSearchRequest(req *dto.SearchRequest) error {
	// Additional validation beyond JSON binding
	if len(req.Query) == 0 {
		return fmt.Errorf("query cannot be empty")
	}

	if req.Limit != nil && (*req.Limit < 1 || *req.Limit > 100) {
		return fmt.Errorf("limit must be between 1 and 100")
	}

	if len(req.UserIDs) > 1000 {
		return fmt.Errorf("cannot filter by more than 1000 user IDs")
	}

	return nil
}
