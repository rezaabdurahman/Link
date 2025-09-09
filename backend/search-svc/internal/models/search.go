package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/pgvector/pgvector-go"
)

// UserEmbedding represents a user's profile embedding for semantic search
type UserEmbedding struct {
	ID                  uuid.UUID       `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID              uuid.UUID       `json:"user_id" gorm:"type:uuid;uniqueIndex;not null"`
	Embedding           pgvector.Vector `json:"embedding" gorm:"type:vector(1536);not null"` // Default to OpenAI text-embedding-3-small dimensions
	ProfileText         string          `json:"profile_text" gorm:"type:text;not null"`       // Encrypted profile text (base64-encoded)
	EmbeddingHash       string          `json:"embedding_hash" gorm:"type:varchar(64);not null"` // Hash of profile text to detect changes
	Provider            string          `json:"provider" gorm:"type:varchar(50);not null;default:'openai'"`
	Model               string          `json:"model" gorm:"type:varchar(100);not null;default:'text-embedding-3-small'"`
	ExpiresAt           *time.Time      `json:"expires_at" gorm:"type:timestamptz;index"`     // TTL for automatic cleanup
	CreatedAt           time.Time       `json:"created_at" gorm:"type:timestamptz;not null;default:now()"`
	UpdatedAt           time.Time       `json:"updated_at" gorm:"type:timestamptz;not null;default:now()"`
	IsEncrypted         bool            `json:"is_encrypted" gorm:"type:boolean;not null;default:false"` // Flag to track encryption status
	ConsentCheckedAt    *time.Time      `json:"consent_checked_at" gorm:"type:timestamptz;index"`                 // When consent was last verified
	
	// Full-text search vector for hybrid search
	SearchVector        string          `json:"-" gorm:"type:tsvector;index:gin"`  // GIN index for full-text search (uses decrypted text)
}

// SearchQuery represents a search query log for analytics
type SearchQuery struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID          uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	Query           string    `json:"query" gorm:"type:text;not null"`
	QueryEmbedding  pgvector.Vector `json:"query_embedding" gorm:"type:vector(1536);not null"`
	ResultsCount    int       `json:"results_count" gorm:"type:int;not null"`
	SearchTimeMs    int       `json:"search_time_ms" gorm:"type:int;not null"`
	TotalCandidates int       `json:"total_candidates" gorm:"type:int;not null"`
	CreatedAt       time.Time `json:"created_at" gorm:"type:timestamptz;not null;default:now()"`
}

// SearchResult represents individual search results (for analytics)
type SearchResult struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	QueryID      uuid.UUID `json:"query_id" gorm:"type:uuid;not null"`
	SearchQuery  SearchQuery `json:"search_query" gorm:"foreignKey:QueryID"`
	MatchedUserID uuid.UUID `json:"matched_user_id" gorm:"type:uuid;not null"`
	Score        float64   `json:"score" gorm:"type:decimal(5,4);not null"`
	Rank         int       `json:"rank" gorm:"type:int;not null"`
	MatchReasons []string  `json:"match_reasons" gorm:"type:text[];not null"`
}

// TableName returns the table name for UserEmbedding
func (UserEmbedding) TableName() string {
	return "user_embeddings"
}

// TableName returns the table name for SearchQuery
func (SearchQuery) TableName() string {
	return "search_queries"
}

// TableName returns the table name for SearchResult
func (SearchResult) TableName() string {
	return "search_results"
}
