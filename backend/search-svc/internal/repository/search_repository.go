package repository

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/pgvector/pgvector-go"
	"gorm.io/gorm"

	"github.com/link-app/search-svc/internal/models"
)

// SearchRepository handles database operations for search functionality
type SearchRepository interface {
	// Embedding operations
	StoreUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error
	StoreUserEmbeddingWithTTL(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string, ttlHours int) error
	GetUserEmbedding(ctx context.Context, userID uuid.UUID) (*models.UserEmbedding, error)
	UpdateUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error
	UpdateUserEmbeddingWithTTL(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string, ttlHours int) error
	DeleteUserEmbedding(ctx context.Context, userID uuid.UUID) error
	
	// Vector search operations
	SearchSimilarUsers(ctx context.Context, queryEmbedding []float32, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error)
	GetTotalUserCount(ctx context.Context, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) (int, error)
	
	// TTL operations
	CleanupExpiredEmbeddings(ctx context.Context) (int, error)
	DeleteExpiredEmbeddings(ctx context.Context) (int, error)
	
	// Query logging
	LogSearchQuery(ctx context.Context, userID uuid.UUID, query string, queryEmbedding []float32, resultsCount, searchTimeMs, totalCandidates int) (*models.SearchQuery, error)
	LogSearchResults(ctx context.Context, queryID uuid.UUID, results []models.SearchResult) error

	// Batch operations for reindexing
	GetAllUserIDs(ctx context.Context) ([]uuid.UUID, error)
	GetUserIDsPage(ctx context.Context, offset, limit int) ([]uuid.UUID, error)
}

type searchRepository struct {
	db *gorm.DB
}

// NewSearchRepository creates a new search repository
func NewSearchRepository(db *gorm.DB) SearchRepository {
	repo := &searchRepository{db: db}
	
	// Ensure tables exist
	if err := repo.autoMigrate(); err != nil {
		log.Printf("Warning: Failed to auto-migrate search tables: %v", err)
	}
	
	return repo
}

// autoMigrate creates the necessary tables
func (r *searchRepository) autoMigrate() error {
	return r.db.AutoMigrate(
		&models.UserEmbedding{},
		&models.SearchQuery{},
		&models.SearchResult{},
	)
}

// StoreUserEmbedding stores a new user embedding
func (r *searchRepository) StoreUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error {
	embeddingHash := generateTextHash(profileText)
	
	userEmbedding := models.UserEmbedding{
		UserID:        userID,
		Embedding:     pgvector.NewVector(embedding),
		ProfileText:   profileText,
		EmbeddingHash: embeddingHash,
		Provider:      provider,
		Model:         model,
	}

	result := r.db.WithContext(ctx).Create(&userEmbedding)
	return result.Error
}

// GetUserEmbedding retrieves a user's embedding
func (r *searchRepository) GetUserEmbedding(ctx context.Context, userID uuid.UUID) (*models.UserEmbedding, error) {
	var embedding models.UserEmbedding
	result := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&embedding)
	
	if result.Error != nil {
		return nil, result.Error
	}
	
	return &embedding, nil
}

// UpdateUserEmbedding updates an existing user embedding
func (r *searchRepository) UpdateUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error {
	embeddingHash := generateTextHash(profileText)
	
	updates := map[string]interface{}{
		"embedding":      pgvector.NewVector(embedding),
		"profile_text":   profileText,
		"embedding_hash": embeddingHash,
		"provider":       provider,
		"model":          model,
	}

	result := r.db.WithContext(ctx).Model(&models.UserEmbedding{}).Where("user_id = ?", userID).Updates(updates)
	return result.Error
}

// DeleteUserEmbedding removes a user's embedding
func (r *searchRepository) DeleteUserEmbedding(ctx context.Context, userID uuid.UUID) error {
	result := r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&models.UserEmbedding{})
	return result.Error
}

// SearchSimilarUsers performs vector similarity search
func (r *searchRepository) SearchSimilarUsers(ctx context.Context, queryEmbedding []float32, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error) {
	query := r.db.WithContext(ctx).Model(&models.UserEmbedding{}).
		Where("expires_at IS NULL OR expires_at > ?", time.Now())
	
	// Apply user ID filter if provided
	if len(userIDFilter) > 0 {
		query = query.Where("user_id IN ?", userIDFilter)
	}
	
	// Exclude specific user if provided
	if excludeUserID != nil {
		query = query.Where("user_id != ?", *excludeUserID)
	}
	
	// Perform vector similarity search using cosine distance
	// Note: pgvector uses <=> for cosine distance, <-> for L2 distance, <#> for inner product
	queryVector := pgvector.NewVector(queryEmbedding)
	
	var results []struct {
		models.UserEmbedding
		Distance float64 `gorm:"column:distance"`
	}
	
	err := query.
		Select("*, embedding <=> ? as distance", queryVector).
		Order("distance ASC").
		Limit(limit).
		Scan(&results).Error
		
	if err != nil {
		return nil, nil, err
	}
	
	embeddings := make([]models.UserEmbedding, len(results))
	distances := make([]float64, len(results))
	
	for i, result := range results {
		embeddings[i] = result.UserEmbedding
		// Convert cosine distance to similarity score (1 - distance)
		distances[i] = 1.0 - result.Distance
	}
	
	return embeddings, distances, nil
}

// StoreUserEmbeddingWithTTL stores a new user embedding with a TTL
func (r *searchRepository) StoreUserEmbeddingWithTTL(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string, ttlHours int) error {
	embeddingHash := generateTextHash(profileText)
	
	var expiresAt *time.Time
	if ttlHours > 0 {
		t := time.Now().Add(time.Duration(ttlHours) * time.Hour)
		expiresAt = &t
	}
	
	userEmbedding := models.UserEmbedding{
		UserID:        userID,
		Embedding:     pgvector.NewVector(embedding),
		ProfileText:   profileText,
		EmbeddingHash: embeddingHash,
		Provider:      provider,
		Model:         model,
		ExpiresAt:     expiresAt,
	}

	result := r.db.WithContext(ctx).Create(&userEmbedding)
	return result.Error
}

// UpdateUserEmbeddingWithTTL updates an existing user embedding with a TTL
func (r *searchRepository) UpdateUserEmbeddingWithTTL(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string, ttlHours int) error {
	embeddingHash := generateTextHash(profileText)
	
	var expiresAt *time.Time
	if ttlHours > 0 {
		t := time.Now().Add(time.Duration(ttlHours) * time.Hour)
		expiresAt = &t
	}
	
	updates := map[string]interface{}{
		"embedding":      pgvector.NewVector(embedding),
		"profile_text":   profileText,
		"embedding_hash": embeddingHash,
		"provider":       provider,
		"model":          model,
		"expires_at":     expiresAt,
	}

	result := r.db.WithContext(ctx).Model(&models.UserEmbedding{}).Where("user_id = ?", userID).Updates(updates)
	return result.Error
}

// CleanupExpiredEmbeddings removes embeddings that have passed their TTL
func (r *searchRepository) CleanupExpiredEmbeddings(ctx context.Context) (int, error) {
	result := r.db.WithContext(ctx).
		Where("expires_at IS NOT NULL AND expires_at < ?", time.Now()).
		Delete(&models.UserEmbedding{})
		
	if result.Error != nil {
		return 0, result.Error
	}
	
	return int(result.RowsAffected), nil
}

// DeleteExpiredEmbeddings removes embeddings that have passed their TTL (alias for CleanupExpiredEmbeddings)
func (r *searchRepository) DeleteExpiredEmbeddings(ctx context.Context) (int, error) {
	return r.CleanupExpiredEmbeddings(ctx)
}

// GetTotalUserCount returns the total number of users available for search
func (r *searchRepository) GetTotalUserCount(ctx context.Context, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) (int, error) {
	query := r.db.WithContext(ctx).Model(&models.UserEmbedding{}).
		Where("expires_at IS NULL OR expires_at > ?", time.Now())

	// Apply user ID filter if provided
	if len(userIDFilter) > 0 {
		query = query.Where("user_id IN ?", userIDFilter)
	}
	
	// Exclude specific user if provided
	if excludeUserID != nil {
		query = query.Where("user_id != ?", *excludeUserID)
	}
	
	var count int64
	err := query.Count(&count).Error
	return int(count), err
}

// LogSearchQuery logs a search query for analytics
func (r *searchRepository) LogSearchQuery(ctx context.Context, userID uuid.UUID, query string, queryEmbedding []float32, resultsCount, searchTimeMs, totalCandidates int) (*models.SearchQuery, error) {
	searchQuery := models.SearchQuery{
		UserID:          userID,
		Query:           query,
		QueryEmbedding:  pgvector.NewVector(queryEmbedding),
		ResultsCount:    resultsCount,
		SearchTimeMs:    searchTimeMs,
		TotalCandidates: totalCandidates,
	}

	result := r.db.WithContext(ctx).Create(&searchQuery)
	if result.Error != nil {
		return nil, result.Error
	}
	
	return &searchQuery, nil
}

// LogSearchResults logs individual search results for analytics
func (r *searchRepository) LogSearchResults(ctx context.Context, queryID uuid.UUID, results []models.SearchResult) error {
	if len(results) == 0 {
		return nil
	}

	result := r.db.WithContext(ctx).Create(&results)
	return result.Error
}

// GetAllUserIDs returns all user IDs that have embeddings (for reindexing)
func (r *searchRepository) GetAllUserIDs(ctx context.Context) ([]uuid.UUID, error) {
	var userIDs []uuid.UUID
	err := r.db.WithContext(ctx).Model(&models.UserEmbedding{}).Pluck("user_id", &userIDs).Error
	return userIDs, err
}

// GetUserIDsPage returns a paginated list of user IDs (for batch processing)
func (r *searchRepository) GetUserIDsPage(ctx context.Context, offset, limit int) ([]uuid.UUID, error) {
	var userIDs []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&models.UserEmbedding{}).
		Offset(offset).
		Limit(limit).
		Pluck("user_id", &userIDs).Error
	return userIDs, err
}

// generateTextHash creates a SHA-256 hash of the profile text
func generateTextHash(text string) string {
	hash := sha256.Sum256([]byte(text))
	return fmt.Sprintf("%x", hash)
}
