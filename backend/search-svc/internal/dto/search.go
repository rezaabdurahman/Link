package dto

import (
	"github.com/google/uuid"
)

// SearchRequest represents the request payload for semantic search
type SearchRequest struct {
	Query               string         `json:"query" binding:"omitempty,max=500"`
	Limit               *int           `json:"limit,omitempty" binding:"omitempty,min=1,max=100"`
	UserIDs             []uuid.UUID    `json:"user_ids,omitempty" binding:"omitempty,max=1000"`
	ExcludeUserID       *uuid.UUID     `json:"exclude_user_id,omitempty"`
	Scope               *string        `json:"scope,omitempty" binding:"omitempty,oneof=friends discovery"`
	HybridWeights       *HybridWeights `json:"hybrid_weights,omitempty"`
	SearchMode          *string        `json:"search_mode,omitempty" binding:"omitempty,oneof=vector hybrid fulltext"`
	IncludeVisualContext *bool         `json:"include_visual_context,omitempty"` // Include image analysis in search
}

// HybridWeights controls the balance between different search methods
type HybridWeights struct {
	BM25Weight   float64 `json:"bm25_weight" binding:"min=0,max=1"`
	VectorWeight float64 `json:"vector_weight" binding:"min=0,max=1"`
}

// SearchResponse represents the response payload for semantic search
type SearchResponse struct {
	Results            []SearchResultItem `json:"results"`
	QueryProcessed     string             `json:"query_processed"`
	TotalCandidates    int                `json:"total_candidates"`
	SearchTimeMs       int                `json:"search_time_ms"`
	SearchMode         string             `json:"search_mode"`
	HybridStats        *HybridSearchStats `json:"hybrid_stats,omitempty"`
	VisualContextUsed  bool               `json:"visual_context_used"`       // Whether image analysis was used
	UsersWithImages    int                `json:"users_with_images,omitempty"` // Number of users with analyzed images
}

// HybridSearchStats provides insights into hybrid search performance
type HybridSearchStats struct {
	BM25Results    int `json:"bm25_results"`
	VectorResults  int `json:"vector_results"`
	FusedResults   int `json:"fused_results"`
	BM25TimeMs     int `json:"bm25_time_ms"`
	VectorTimeMs   int `json:"vector_time_ms"`
	FusionTimeMs   int `json:"fusion_time_ms"`
}

// SearchResultItem represents an individual search result
type SearchResultItem struct {
	UserID         uuid.UUID `json:"user_id"`
	Score          float64   `json:"score"`
	MatchReasons   []string  `json:"match_reasons,omitempty"`
	BM25Score      *float64  `json:"bm25_score,omitempty"`
	VectorScore    *float64  `json:"vector_score,omitempty"`
	HasImages      bool      `json:"has_images,omitempty"`      // Whether this user has analyzed images
	ImageContext   *string   `json:"image_context,omitempty"`   // Brief image-derived context
	VisualMatch    bool      `json:"visual_match,omitempty"`    // Whether match was enhanced by visual analysis
	RRFRank      *int      `json:"rrf_rank,omitempty"`
}

// ReindexRequest represents the request payload for reindexing
type ReindexRequest struct {
	UserIDs []uuid.UUID `json:"user_ids,omitempty" binding:"omitempty,max=10000"`
	Force   *bool       `json:"force,omitempty"`
}

// ReindexResponse represents the response payload for reindexing
type ReindexResponse struct {
	JobID               uuid.UUID `json:"job_id"`
	Status              string    `json:"status"`
	UsersQueued         int       `json:"users_queued"`
	EstimatedCompletion string    `json:"estimated_completion"` // ISO8601 format
}

// ReindexStatusResponse represents the response payload for reindex status
type ReindexStatusResponse struct {
	JobID         uuid.UUID `json:"job_id"`
	Status        string    `json:"status"`
	UsersTotal    int       `json:"users_total"`
	UsersProcessed int      `json:"users_processed"`
	UsersFailed   int       `json:"users_failed"`
	StartedAt     *string   `json:"started_at"`     // ISO8601 format, nullable
	CompletedAt   *string   `json:"completed_at"`   // ISO8601 format, nullable
	ErrorMessage  *string   `json:"error_message,omitempty"`
}

// ErrorResponse represents a standard error response
type ErrorResponse struct {
	Error   string      `json:"error"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}
