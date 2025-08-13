package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/service"
)

// RankingHandler handles HTTP requests for ranking configuration
type RankingHandler struct {
	rankingService *service.RankingService
}

// NewRankingHandler creates a new ranking handler
func NewRankingHandler(rankingService *service.RankingService) *RankingHandler {
	return &RankingHandler{
		rankingService: rankingService,
	}
}

// GetRankingWeights retrieves the current ranking weights
// GET /api/v1/ranking/weights
func (h *RankingHandler) GetRankingWeights(c *gin.Context) {
	weights, err := h.rankingService.GetCurrentWeights()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get ranking weights",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": weights,
		"status": "success",
	})
}

// UpdateRankingWeights updates the ranking algorithm weights
// PUT /api/v1/ranking/weights
func (h *RankingHandler) UpdateRankingWeights(c *gin.Context) {
	var req models.UpdateRankingConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	updatedWeights, err := h.rankingService.UpdateWeights(&req)
	if err != nil {
		// Check if it's a validation error
		if validationErr, ok := err.(*models.ValidationError); ok {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Validation failed",
				"details": validationErr.Error(),
				"field":   validationErr.Field,
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update ranking weights",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": updatedWeights,
		"status": "success",
		"message": "Ranking weights updated successfully",
	})
}

// ResetRankingWeights resets the ranking weights to default values
// POST /api/v1/ranking/weights/reset
func (h *RankingHandler) ResetRankingWeights(c *gin.Context) {
	defaultWeights, err := h.rankingService.ResetWeightsToDefaults()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to reset ranking weights",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": defaultWeights,
		"status": "success",
		"message": "Ranking weights reset to defaults",
	})
}

// GetRankingConfig retrieves all ranking configuration entries (for admin/debugging)
// GET /api/v1/ranking/config
func (h *RankingHandler) GetRankingConfig(c *gin.Context) {
	configs, err := h.rankingService.GetAllConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get ranking configuration",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": configs,
		"status": "success",
		"count": len(configs),
	})
}

// ValidateRankingWeights validates that the current weights sum to 1.0
// GET /api/v1/ranking/weights/validate
func (h *RankingHandler) ValidateRankingWeights(c *gin.Context) {
	err := h.rankingService.ValidateWeightsSum()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"valid":   false,
			"error":   err.Error(),
			"status":  "validation_failed",
		})
		return
	}

	weights, err := h.rankingService.GetCurrentWeights()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get current weights",
			"details": err.Error(),
		})
		return
	}

	total := weights.SemanticSimilarity + weights.InterestOverlap + weights.GeoProximity + weights.RecentActivity

	c.JSON(http.StatusOK, gin.H{
		"valid":   true,
		"status":  "validation_passed",
		"weights": weights,
		"sum":     total,
		"message": "Ranking weights are valid",
	})
}

// GetRankingWeightsInfo provides information about the ranking algorithm
// GET /api/v1/ranking/info
func (h *RankingHandler) GetRankingWeightsInfo(c *gin.Context) {
	weights, err := h.rankingService.GetCurrentWeights()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get ranking weights",
			"details": err.Error(),
		})
		return
	}

	total := weights.SemanticSimilarity + weights.InterestOverlap + weights.GeoProximity + weights.RecentActivity

	c.JSON(http.StatusOK, gin.H{
		"algorithm": gin.H{
			"version": "v1",
			"formula": "Score = semantic_similarity_weight × semantic_similarity + interest_overlap_weight × interest_overlap + geo_proximity_weight × geo_proximity + recent_activity_weight × recent_activity",
			"components": gin.H{
				"semantic_similarity": gin.H{
					"description": "Cosine similarity from pgvector",
					"weight":      weights.SemanticSimilarity,
				},
				"interest_overlap": gin.H{
					"description": "Jaccard coefficient over interests (pre-computed bitset)",
					"weight":      weights.InterestOverlap,
				},
				"geo_proximity": gin.H{
					"description": "Normalized distance within 10 mi radius",
					"weight":      weights.GeoProximity,
				},
				"recent_activity": gin.H{
					"description": "Inverse of minutes since last heartbeat",
					"weight":      weights.RecentActivity,
				},
			},
		},
		"current_weights": weights,
		"weights_sum":     total,
		"is_adjustable":   true,
		"is_ab_ready":     true,
		"status":         "active",
	})
}
