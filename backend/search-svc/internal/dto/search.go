package dto

import (
	"github.com/google/uuid"
)

// SearchRequest represents the request payload for semantic search
type SearchRequest struct {
	Query          string      `json:"query" binding:"required,min=1,max=500"`
	Limit          *int        `json:"limit,omitempty" binding:"omitempty,min=1,max=100"`
	UserIDs        []uuid.UUID `json:"user_ids,omitempty" binding:"omitempty,max=1000"`
	ExcludeUserID  *uuid.UUID  `json:"exclude_user_id,omitempty"`
}

// SearchResponse represents the response payload for semantic search
type SearchResponse struct {
	Results         []SearchResultItem `json:"results"`
	QueryProcessed  string             `json:"query_processed"`
	TotalCandidates int                `json:"total_candidates"`
	SearchTimeMs    int                `json:"search_time_ms"`
}

// SearchResultItem represents an individual search result
type SearchResultItem struct {
	UserID       uuid.UUID `json:"user_id"`
	Score        float64   `json:"score"`
	MatchReasons []string  `json:"match_reasons,omitempty"`
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
