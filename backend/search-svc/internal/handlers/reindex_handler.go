package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/dto"
	"github.com/link-app/search-svc/internal/service"
)

// ReindexHandler handles reindex-related HTTP requests
type ReindexHandler struct {
	reindexService service.ReindexService
}

// NewReindexHandler creates a new reindex handler
func NewReindexHandler(reindexService service.ReindexService) *ReindexHandler {
	return &ReindexHandler{
		reindexService: reindexService,
	}
}

// Reindex handles POST /api/v1/reindex
func (h *ReindexHandler) Reindex(c *gin.Context) {
	// Parse request body (optional for reindex)
	var req dto.ReindexRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// If there's an error parsing JSON, assume empty request (full reindex)
		req = dto.ReindexRequest{}
	}

	// Create reindex job
	response, err := h.reindexService.CreateReindexJob(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "REINDEX_FAILED",
			Message: "Failed to create reindex job",
			Details: err.Error(),
		})
		return
	}

	// Return 202 Accepted as the job is queued
	c.JSON(http.StatusAccepted, response)
}

// GetReindexStatus handles GET /api/v1/reindex/:jobId
func (h *ReindexHandler) GetReindexStatus(c *gin.Context) {
	// Parse job ID from URL
	jobIDStr := c.Param("jobId")
	if jobIDStr == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "MISSING_JOB_ID",
			Message: "Job ID is required",
		})
		return
	}

	jobID, err := uuid.Parse(jobIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_JOB_ID",
			Message: "Invalid job ID format",
		})
		return
	}

	// Get job status
	response, err := h.reindexService.GetReindexStatus(c.Request.Context(), jobID)
	if err != nil {
		if err.Error() == "record not found" {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{
				Error:   "JOB_NOT_FOUND",
				Message: "Reindex job not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "STATUS_FAILED",
			Message: "Failed to get job status",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}
