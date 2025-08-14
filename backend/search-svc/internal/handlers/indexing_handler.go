package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/link-app/search-svc/internal/service"
)

// IndexingHandler handles indexing pipeline related HTTP requests
type IndexingHandler struct {
	indexingService service.IndexingService
}

// NewIndexingHandler creates a new indexing handler
func NewIndexingHandler(indexingService service.IndexingService) *IndexingHandler {
	return &IndexingHandler{
		indexingService: indexingService,
	}
}

// GetIndexingStats returns the current indexing pipeline statistics
func (h *IndexingHandler) GetIndexingStats(c *gin.Context) {
	stats := h.indexingService.GetIndexingStats()
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stats,
	})
}

// TriggerIndexing manually triggers a single indexing cycle
func (h *IndexingHandler) TriggerIndexing(c *gin.Context) {
	// Run indexing cycle in background to avoid blocking the request
	go func() {
		if err := h.indexingService.RunIndexingCycle(c.Request.Context()); err != nil {
			// Log error but don't return it since this is async
			// The error will be logged by the indexing service itself
		}
	}()
	
	c.JSON(http.StatusAccepted, gin.H{
		"status":  "success",
		"message": "Indexing cycle triggered",
	})
}
