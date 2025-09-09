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

	"github.com/link-app/search-svc/internal/encryption"
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
	
	// Hybrid search operations
	FullTextSearch(ctx context.Context, query string, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error)
	HybridSearch(ctx context.Context, query string, queryEmbedding []float32, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID, bm25Weight, vectorWeight float64) ([]models.UserEmbedding, []float64, error)
	
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
	return r.StoreUserEmbeddingWithTTL(ctx, userID, embedding, profileText, provider, model, 0)
}

// GetUserEmbedding retrieves a user's embedding
func (r *searchRepository) GetUserEmbedding(ctx context.Context, userID uuid.UUID) (*models.UserEmbedding, error) {
	var embedding models.UserEmbedding
	result := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&embedding)
	
	if result.Error != nil {
		return nil, result.Error
	}
	
	// Decrypt profile text if encrypted
	if err := r.decryptProfileText(&embedding); err != nil {
		log.Printf("Warning: Failed to decrypt profile text: %v", err)
		// Continue with encrypted data rather than failing
	}
	
	return &embedding, nil
}

// UpdateUserEmbedding updates an existing user embedding
func (r *searchRepository) UpdateUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error {
	return r.UpdateUserEmbeddingWithTTL(ctx, userID, embedding, profileText, provider, model, 0)
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
	// Encrypt profile text
	encryptedText, isEncrypted, err := r.encryptProfileText(profileText)
	if err != nil {
		return fmt.Errorf("failed to encrypt profile text: %w", err)
	}
	
	embeddingHash := generateTextHash(profileText)
	
	var expiresAt *time.Time
	if ttlHours > 0 {
		t := time.Now().Add(time.Duration(ttlHours) * time.Hour)
		expiresAt = &t
	}
	
	now := time.Now()
	userEmbedding := models.UserEmbedding{
		UserID:           userID,
		Embedding:        pgvector.NewVector(embedding),
		ProfileText:      encryptedText,
		EmbeddingHash:    embeddingHash,
		Provider:         provider,
		Model:            model,
		ExpiresAt:        expiresAt,
		IsEncrypted:      isEncrypted,
		ConsentCheckedAt: &now,                 // Track when consent was verified
	}

	// Use transaction to ensure atomicity between record creation and search vector update
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create the embedding record
		if err := tx.Create(&userEmbedding).Error; err != nil {
			return fmt.Errorf("failed to create user embedding: %w", err)
		}
		
		// Update search_vector using plaintext (PostgreSQL's to_tsvector)
		// We use the original plaintext for search indexing
		if err := tx.Model(&userEmbedding).Update("search_vector", gorm.Expr("to_tsvector('english', ?)", profileText)).Error; err != nil {
			return fmt.Errorf("failed to update search vector: %w", err)
		}
		
		return nil
	})
}

// UpdateUserEmbeddingWithTTL updates an existing user embedding with a TTL
func (r *searchRepository) UpdateUserEmbeddingWithTTL(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string, ttlHours int) error {
	// Encrypt profile text
	encryptedText, isEncrypted, err := r.encryptProfileText(profileText)
	if err != nil {
		return fmt.Errorf("failed to encrypt profile text: %w", err)
	}
	
	embeddingHash := generateTextHash(profileText)
	
	var expiresAt *time.Time
	if ttlHours > 0 {
		t := time.Now().Add(time.Duration(ttlHours) * time.Hour)
		expiresAt = &t
	}
	
	updates := map[string]interface{}{
		"embedding":         pgvector.NewVector(embedding),
		"profile_text":      encryptedText,
		"embedding_hash":    embeddingHash,
		"provider":          provider,
		"model":             model,
		"expires_at":        expiresAt,
		"is_encrypted":      isEncrypted,
		"consent_checked_at": time.Now(),  // Track when consent was verified
	}

	// Use transaction to ensure atomicity between record update and search vector update
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Update the embedding record
		if err := tx.Model(&models.UserEmbedding{}).Where("user_id = ?", userID).Updates(updates).Error; err != nil {
			return fmt.Errorf("failed to update user embedding: %w", err)
		}
		
		// Update search_vector using plaintext
		if err := tx.Model(&models.UserEmbedding{}).Where("user_id = ?", userID).
			Update("search_vector", gorm.Expr("to_tsvector('english', ?)", profileText)).Error; err != nil {
			return fmt.Errorf("failed to update search vector: %w", err)
		}
		
		return nil
	})
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

// FullTextSearch performs BM25-style search using PostgreSQL's full-text search
func (r *searchRepository) FullTextSearch(ctx context.Context, query string, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error) {
	baseQuery := r.db.WithContext(ctx).Model(&models.UserEmbedding{}).
		Where("expires_at IS NULL OR expires_at > ?", time.Now())
	
	// Apply user ID filter if provided
	if len(userIDFilter) > 0 {
		baseQuery = baseQuery.Where("user_id IN ?", userIDFilter)
	}
	
	// Exclude specific user if provided
	if excludeUserID != nil {
		baseQuery = baseQuery.Where("user_id != ?", *excludeUserID)
	}
	
	var results []struct {
		models.UserEmbedding
		Rank float64 `gorm:"column:rank"`
	}
	
	// Use ts_rank_cd for BM25-like ranking
	err := baseQuery.
		Select("*, ts_rank_cd(search_vector, plainto_tsquery('english', ?)) as rank", query).
		Where("search_vector @@ plainto_tsquery('english', ?)", query).
		Order("rank DESC").
		Limit(limit).
		Scan(&results).Error
		
	if err != nil {
		return nil, nil, err
	}
	
	embeddings := make([]models.UserEmbedding, len(results))
	scores := make([]float64, len(results))
	
	for i, result := range results {
		embeddings[i] = result.UserEmbedding
		scores[i] = result.Rank
	}
	
	return embeddings, scores, nil
}

// HybridSearch combines vector and full-text search using Reciprocal Rank Fusion (RRF)
func (r *searchRepository) HybridSearch(ctx context.Context, query string, queryEmbedding []float32, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID, bm25Weight, vectorWeight float64) ([]models.UserEmbedding, []float64, error) {
	// Get results from both search methods
	vectorResults, vectorScores, err := r.SearchSimilarUsers(ctx, queryEmbedding, limit*2, userIDFilter, excludeUserID)
	if err != nil {
		return nil, nil, fmt.Errorf("vector search failed: %w", err)
	}
	
	fullTextResults, fullTextScores, err := r.FullTextSearch(ctx, query, limit*2, userIDFilter, excludeUserID)
	if err != nil {
		return nil, nil, fmt.Errorf("full-text search failed: %w", err)
	}
	
	// Create maps for quick lookup
	vectorScoreMap := make(map[uuid.UUID]float64)
	fullTextScoreMap := make(map[uuid.UUID]float64)
	vectorRankMap := make(map[uuid.UUID]int)
	fullTextRankMap := make(map[uuid.UUID]int)
	
	for i, result := range vectorResults {
		vectorScoreMap[result.UserID] = vectorScores[i]
		vectorRankMap[result.UserID] = i + 1
	}
	
	for i, result := range fullTextResults {
		fullTextScoreMap[result.UserID] = fullTextScores[i]
		fullTextRankMap[result.UserID] = i + 1
	}
	
	// Combine all unique user IDs
	userSet := make(map[uuid.UUID]bool)
	allResults := make(map[uuid.UUID]models.UserEmbedding)
	
	for _, result := range vectorResults {
		userSet[result.UserID] = true
		allResults[result.UserID] = result
	}
	
	for _, result := range fullTextResults {
		userSet[result.UserID] = true
		allResults[result.UserID] = result
	}
	
	// Calculate RRF scores for each user
	type RRFResult struct {
		UserID uuid.UUID
		Score  float64
		Embedding models.UserEmbedding
	}
	
	rrfResults := make([]RRFResult, 0, len(userSet))
	
	for userID := range userSet {
		rrfScore := 0.0
		
		// RRF formula: 1 / (k + rank) where k = 60 (standard constant)
		k := 60.0
		
		if rank, exists := vectorRankMap[userID]; exists {
			rrfScore += vectorWeight / (k + float64(rank))
		}
		
		if rank, exists := fullTextRankMap[userID]; exists {
			rrfScore += bm25Weight / (k + float64(rank))
		}
		
		rrfResults = append(rrfResults, RRFResult{
			UserID:    userID,
			Score:     rrfScore,
			Embedding: allResults[userID],
		})
	}
	
	// Sort by RRF score descending
	for i := 0; i < len(rrfResults)-1; i++ {
		for j := i + 1; j < len(rrfResults); j++ {
			if rrfResults[i].Score < rrfResults[j].Score {
				rrfResults[i], rrfResults[j] = rrfResults[j], rrfResults[i]
			}
		}
	}
	
	// Return top results
	if limit > len(rrfResults) {
		limit = len(rrfResults)
	}
	
	finalEmbeddings := make([]models.UserEmbedding, limit)
	finalScores := make([]float64, limit)
	
	for i := 0; i < limit; i++ {
		finalEmbeddings[i] = rrfResults[i].Embedding
		finalScores[i] = rrfResults[i].Score
	}
	
	return finalEmbeddings, finalScores, nil
}

// generateTextHash creates a SHA-256 hash of the profile text
func generateTextHash(text string) string {
	hash := sha256.Sum256([]byte(text))
	return fmt.Sprintf("%x", hash)
}

// encryptProfileText encrypts profile text if encryption is enabled
func (r *searchRepository) encryptProfileText(plaintext string) (string, bool, error) {
	if !encryption.EncryptionEnabled() || plaintext == "" {
		return plaintext, false, nil
	}
	
	encryptor := encryption.GetProfileEncryptor()
	encrypted, err := encryptor.EncryptString(plaintext)
	if err != nil {
		return "", false, err
	}
	
	return encrypted, true, nil
}

// decryptProfileText decrypts profile text if it's encrypted
func (r *searchRepository) decryptProfileText(embedding *models.UserEmbedding) error {
	if !embedding.IsEncrypted || embedding.ProfileText == "" {
		return nil
	}
	
	encryptor := encryption.GetProfileEncryptor()
	decrypted, err := encryptor.DecryptString(embedding.ProfileText)
	if err != nil {
		return err
	}
	
	embedding.ProfileText = decrypted
	return nil
}
