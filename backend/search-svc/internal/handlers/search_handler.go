package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/dto"
	"github.com/link-app/search-svc/internal/service"
	"github.com/link-app/search-svc/internal/vision"
)

// SearchHandler handles search-related HTTP requests
type SearchHandler struct {
	searchService service.SearchService
	imageAnalyzer *vision.ImageAnalyzer
}

// NewSearchHandler creates a new search handler
func NewSearchHandler(searchService service.SearchService) *SearchHandler {
	// Initialize image analyzer if available
	imageAnalyzer, err := vision.NewImageAnalyzerFromEnv()
	if err != nil {
		// Log warning but continue without image analysis
		fmt.Printf("Warning: Failed to initialize image analyzer in handler: %v\n", err)
	}

	return &SearchHandler{
		searchService: searchService,
		imageAnalyzer: imageAnalyzer,
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
	// Empty query is allowed for discovery browsing
	if len(req.Query) > 500 {
		return fmt.Errorf("query cannot exceed 500 characters")
	}

	if req.Limit != nil && (*req.Limit < 1 || *req.Limit > 100) {
		return fmt.Errorf("limit must be between 1 and 100")
	}

	if len(req.UserIDs) > 1000 {
		return fmt.Errorf("cannot filter by more than 1000 user IDs")
	}

	// Validate scope if provided
	if req.Scope != nil {
		switch *req.Scope {
		case "friends", "discovery":
			// Valid scopes
		default:
			return fmt.Errorf("scope must be 'friends' or 'discovery'")
		}
	}

	// Validate search mode if provided
	if req.SearchMode != nil {
		switch *req.SearchMode {
		case "vector", "hybrid", "fulltext":
			// Valid search modes
		default:
			return fmt.Errorf("search_mode must be 'vector', 'hybrid', or 'fulltext'")
		}
	}

	// Validate hybrid weights if provided
	if req.HybridWeights != nil {
		if req.HybridWeights.BM25Weight < 0 || req.HybridWeights.BM25Weight > 1 {
			return fmt.Errorf("bm25_weight must be between 0 and 1")
		}
		if req.HybridWeights.VectorWeight < 0 || req.HybridWeights.VectorWeight > 1 {
			return fmt.Errorf("vector_weight must be between 0 and 1")
		}
		// Weights should sum to approximately 1.0 (allow small variance for floating point)
		totalWeight := req.HybridWeights.BM25Weight + req.HybridWeights.VectorWeight
		if totalWeight < 0.9 || totalWeight > 1.1 {
			return fmt.Errorf("bm25_weight and vector_weight should sum to approximately 1.0")
		}
	}

	// Validate that full-text search requires a query
	if req.SearchMode != nil && *req.SearchMode == "fulltext" && req.Query == "" {
		return fmt.Errorf("query is required for fulltext search mode")
	}

	return nil
}

// ImageAnalysisRequest represents a request to analyze images
type ImageAnalysisRequest struct {
	ProfilePicture   *string  `json:"profile_picture,omitempty"`
	AdditionalPhotos []string `json:"additional_photos,omitempty"`
}

// ImageAnalysisResponse represents the response from image analysis
type ImageAnalysisResponse struct {
	UserID           uuid.UUID `json:"user_id"`
	CombinedText     string    `json:"combined_text"`
	TotalImages      int       `json:"total_images"`
	ProcessedImages  int       `json:"processed_images"`
	FailedImages     int       `json:"failed_images"`
	ProcessingTime   int64     `json:"processing_time_ms"`
	Cost             float64   `json:"cost_usd"`
	ProcessedAt      time.Time `json:"processed_at"`
}

// AnalyzeImages handles POST /api/v1/search/analyze-images
func (h *SearchHandler) AnalyzeImages(c *gin.Context) {
	// Check if image analyzer is available
	if h.imageAnalyzer == nil {
		c.JSON(http.StatusServiceUnavailable, dto.ErrorResponse{
			Error:   "SERVICE_UNAVAILABLE",
			Message: "Image analysis service is not available",
		})
		return
	}

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
	var req ImageAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Invalid request format: " + err.Error(),
		})
		return
	}

	// Validate request
	if err := h.validateImageAnalysisRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	// Perform image analysis
	start := time.Now()
	result, err := h.imageAnalyzer.AnalyzeUserImages(ctx, userID, req.ProfilePicture, req.AdditionalPhotos)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "ANALYSIS_FAILED",
			Message: "Failed to analyze images: " + err.Error(),
		})
		return
	}

	// Calculate cost
	totalImages := 0
	if req.ProfilePicture != nil {
		totalImages++
	}
	totalImages += len(req.AdditionalPhotos)
	cost := h.imageAnalyzer.GetProvider().GetCostEstimate(totalImages)

	// Build response
	response := ImageAnalysisResponse{
		UserID:          userID,
		CombinedText:    result.CombinedText,
		TotalImages:     result.TotalImages,
		ProcessedImages: result.ProcessedImages,
		FailedImages:    result.FailedImages,
		ProcessingTime:  time.Since(start).Milliseconds(),
		Cost:            cost,
		ProcessedAt:     time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// validateImageAnalysisRequest validates the image analysis request
func (h *SearchHandler) validateImageAnalysisRequest(req *ImageAnalysisRequest) error {
	// Check if at least one image is provided
	hasProfilePic := req.ProfilePicture != nil && *req.ProfilePicture != ""
	hasAdditionalPhotos := len(req.AdditionalPhotos) > 0
	
	if !hasProfilePic && !hasAdditionalPhotos {
		return fmt.Errorf("at least one image URL must be provided")
	}

	// Validate profile picture URL if provided
	if hasProfilePic {
		if err := h.validateImageURL(*req.ProfilePicture); err != nil {
			return fmt.Errorf("invalid profile picture URL: %w", err)
		}
	}

	// Validate additional photos
	if len(req.AdditionalPhotos) > 10 {
		return fmt.Errorf("cannot analyze more than 10 additional photos")
	}

	for i, photoURL := range req.AdditionalPhotos {
		if photoURL != "" {
			if err := h.validateImageURL(photoURL); err != nil {
				return fmt.Errorf("invalid additional photo URL at index %d: %w", i, err)
			}
		}
	}

	return nil
}

// validateImageURL validates an image URL
func (h *SearchHandler) validateImageURL(url string) error {
	if len(url) > 2048 {
		return fmt.Errorf("URL cannot exceed 2048 characters")
	}

	// Basic URL validation - in production, you might want more sophisticated validation
	if url[:4] != "http" {
		return fmt.Errorf("URL must start with http or https")
	}

	return nil
}

// GetImageAnalysisStats handles GET /api/v1/search/image-stats
func (h *SearchHandler) GetImageAnalysisStats(c *gin.Context) {
	if h.imageAnalyzer == nil {
		c.JSON(http.StatusServiceUnavailable, dto.ErrorResponse{
			Error:   "SERVICE_UNAVAILABLE",
			Message: "Image analysis service is not available",
		})
		return
	}

	stats := h.imageAnalyzer.GetStats()
	c.JSON(http.StatusOK, stats)
}
