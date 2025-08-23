package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/client"
	"github.com/link-app/search-svc/internal/config"
	"github.com/link-app/search-svc/internal/dto"
	"github.com/link-app/search-svc/internal/models"
	"github.com/link-app/search-svc/internal/repository"
)

// SearchService handles search business logic
type SearchService interface {
	// Core search functionality
	Search(ctx context.Context, userID uuid.UUID, req *dto.SearchRequest) (*dto.SearchResponse, error)
	
	// User profile embedding management
	UpdateUserEmbedding(ctx context.Context, userID uuid.UUID, profileText string) error
	DeleteUserEmbedding(ctx context.Context, userID uuid.UUID) error
	HasUserEmbedding(ctx context.Context, userID uuid.UUID) (bool, error)
	
	// Privacy & availability safeguards
	PurgeExpiredEmbeddings(ctx context.Context) (int, error)
	PurgeUnavailableUserEmbeddings(ctx context.Context, unavailableUserIDs []uuid.UUID) (int, error)
	StartAvailabilityCleanup(ctx context.Context)
}

// SearchServiceConfig holds configuration for creating a SearchService
type SearchServiceConfig struct {
	Repository        repository.SearchRepository
	EmbeddingProvider config.EmbeddingProvider
	UserClient        client.UserClient      // optional
	DiscoveryClient   client.DiscoveryClient // optional
	DisableAnalytics  bool                   // for testing purposes
}

type searchService struct {
	repo              repository.SearchRepository
	embeddingProvider config.EmbeddingProvider
	userClient        client.UserClient
	discoveryClient   client.DiscoveryClient
	disableAnalytics  bool
}

// NewSearchService creates a new search service with flexible configuration
func NewSearchService(config SearchServiceConfig) SearchService {
	return &searchService{
		repo:              config.Repository,
		embeddingProvider: config.EmbeddingProvider,
		userClient:        config.UserClient,
		discoveryClient:   config.DiscoveryClient,
		disableAnalytics:  config.DisableAnalytics,
	}
}

// Search performs semantic, hybrid, or full-text search on user profiles
func (s *searchService) Search(ctx context.Context, userID uuid.UUID, req *dto.SearchRequest) (*dto.SearchResponse, error) {
	start := time.Now()
	
	// Set default limit if not provided
	limit := 10
	if req.Limit != nil {
		limit = *req.Limit
	}
	
	// Set default search mode
	searchMode := "hybrid"
	if req.SearchMode != nil {
		searchMode = *req.SearchMode
	}
	
	// Set default hybrid weights
	bm25Weight := 0.3
	vectorWeight := 0.7
	if req.HybridWeights != nil {
		bm25Weight = req.HybridWeights.BM25Weight
		vectorWeight = req.HybridWeights.VectorWeight
	}
	
	// Check if visual context should be included
	includeVisualContext := false
	if req.IncludeVisualContext != nil {
		includeVisualContext = *req.IncludeVisualContext
	}
	
	// Process query text
	processedQuery := s.preprocessQuery(req.Query)
	
	// Handle scope-based filtering
	userIDFilter, err := s.buildUserIDFilter(ctx, userID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to build user ID filter: %w", err)
	}
	
	// Get total candidates count for analytics
	totalCandidates, err := s.repo.GetTotalUserCount(ctx, userIDFilter, req.ExcludeUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get total candidates count: %w", err)
	}
	
	var embeddings []models.UserEmbedding
	var scores []float64
	var hybridStats *dto.HybridSearchStats
	var usersWithImages int
	
	// Perform search based on mode
	switch searchMode {
	case "fulltext":
		embeddings, scores, err = s.performFullTextSearch(ctx, processedQuery, limit, userIDFilter, req.ExcludeUserID)
	case "vector":
		embeddings, scores, err = s.performVectorSearch(ctx, processedQuery, limit, userIDFilter, req.ExcludeUserID)
	case "hybrid":
		embeddings, scores, hybridStats, err = s.performHybridSearch(ctx, processedQuery, limit, userIDFilter, req.ExcludeUserID, bm25Weight, vectorWeight)
	default:
		return nil, fmt.Errorf("invalid search mode: %s", searchMode)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to perform %s search: %w", searchMode, err)
	}
	
	// Convert to response format
	results := make([]dto.SearchResultItem, len(embeddings))
	searchResults := make([]models.SearchResult, len(embeddings)) // For analytics logging
	
	for i, embedding := range embeddings {
		matchReasons := s.generateMatchReasons(processedQuery, embedding.ProfileText, scores[i])
		
		// Check if this user has image analysis data
		hasImages := s.checkUserHasImages(embedding.ProfileText)
		if hasImages {
			usersWithImages++
		}
		
		// Extract image context if available
		var imageContext *string
		var visualMatch bool
		if includeVisualContext && hasImages {
			imageContext = s.extractImageContext(embedding.ProfileText)
			visualMatch = s.detectVisualMatch(processedQuery, embedding.ProfileText)
		}
		
		results[i] = dto.SearchResultItem{
			UserID:       embedding.UserID,
			Score:        scores[i],
			MatchReasons: matchReasons,
			HasImages:    hasImages,
			ImageContext: imageContext,
			VisualMatch:  visualMatch,
		}
		
		// Prepare for analytics logging
		searchResults[i] = models.SearchResult{
			MatchedUserID: embedding.UserID,
			Score:         scores[i],
			Rank:          i + 1,
			MatchReasons:  matchReasons,
		}
	}
	
	// Calculate search time
	searchTime := time.Since(start)
	searchTimeMs := int(searchTime.Nanoseconds() / 1e6)
	
	// Log search query for analytics (asynchronous) - only for vector searches to maintain compatibility
	if !s.disableAnalytics && searchMode == "vector" {
		// Generate embedding for analytics (only needed for vector mode)
		var queryEmbedding []float32
		if searchMode == "vector" && processedQuery != "" {
			queryEmbedding, _ = s.embeddingProvider.GenerateEmbedding(ctx, processedQuery)
		}
		go s.logSearchAnalytics(context.Background(), userID, processedQuery, queryEmbedding, len(results), searchTimeMs, totalCandidates, searchResults)
	}
	
	return &dto.SearchResponse{
		Results:           results,
		QueryProcessed:    processedQuery,
		TotalCandidates:   totalCandidates,
		SearchTimeMs:      searchTimeMs,
		SearchMode:        searchMode,
		HybridStats:       hybridStats,
		VisualContextUsed: includeVisualContext,
		UsersWithImages:   usersWithImages,
	}, nil
}

// UpdateUserEmbedding updates or creates a user's profile embedding
func (s *searchService) UpdateUserEmbedding(ctx context.Context, userID uuid.UUID, profileText string) error {
	if profileText == "" {
		return fmt.Errorf("profile text cannot be empty")
	}
	
	// Generate embedding for the profile text
	embedding, err := s.embeddingProvider.GenerateEmbedding(ctx, profileText)
	if err != nil {
		return fmt.Errorf("failed to generate profile embedding: %w", err)
	}
	
	// Check if user already has an embedding
	existing, err := s.repo.GetUserEmbedding(ctx, userID)
	if err != nil && err.Error() != "record not found" {
		return fmt.Errorf("failed to check existing embedding: %w", err)
	}
	
	provider := s.embeddingProvider.GetProviderName()
	model := "text-embedding-3-small" // Default model, could be made configurable
	
	if existing != nil {
		// Update existing embedding
		err = s.repo.UpdateUserEmbedding(ctx, userID, embedding, profileText, provider, model)
	} else {
		// Create new embedding
		err = s.repo.StoreUserEmbedding(ctx, userID, embedding, profileText, provider, model)
	}
	
	if err != nil {
		return fmt.Errorf("failed to store user embedding: %w", err)
	}
	
	return nil
}

// DeleteUserEmbedding removes a user's embedding
func (s *searchService) DeleteUserEmbedding(ctx context.Context, userID uuid.UUID) error {
	err := s.repo.DeleteUserEmbedding(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user embedding: %w", err)
	}
	
	return nil
}

// HasUserEmbedding checks if a user has an embedding
func (s *searchService) HasUserEmbedding(ctx context.Context, userID uuid.UUID) (bool, error) {
	_, err := s.repo.GetUserEmbedding(ctx, userID)
	if err != nil {
		if err.Error() == "record not found" {
			return false, nil
		}
		return false, fmt.Errorf("failed to check user embedding: %w", err)
	}
	
	return true, nil
}

// preprocessQuery cleans and normalizes the search query
func (s *searchService) preprocessQuery(query string) string {
	// Basic preprocessing: trim, lowercase, remove extra spaces
	processed := strings.TrimSpace(query)
	processed = strings.ToLower(processed)
	
	// Remove extra whitespaces
	words := strings.Fields(processed)
	processed = strings.Join(words, " ")
	
	return processed
}

// generateMatchReasons creates explanation for why a user matched the query
func (s *searchService) generateMatchReasons(query, profileText string, score float64) []string {
	reasons := make([]string, 0)
	
	// Simple keyword matching for basic explanation
	queryWords := strings.Fields(strings.ToLower(query))
	profileWords := strings.Fields(strings.ToLower(profileText))
	
	// Create a set of profile words for quick lookup
	profileWordSet := make(map[string]bool)
	for _, word := range profileWords {
		profileWordSet[word] = true
	}
	
	// Find matching words
	matchedWords := make([]string, 0)
	for _, queryWord := range queryWords {
		if len(queryWord) >= 3 && profileWordSet[queryWord] { // Only consider words with 3+ characters
			matchedWords = append(matchedWords, queryWord)
		}
	}
	
	// Add reasons based on matched words
	if len(matchedWords) > 0 {
		reasons = append(reasons, fmt.Sprintf("Matched keywords: %s", strings.Join(matchedWords, ", ")))
	}
	
	// Add semantic similarity reason
	if score >= 0.8 {
		reasons = append(reasons, "High semantic similarity")
	} else if score >= 0.6 {
		reasons = append(reasons, "Moderate semantic similarity")
	} else {
		reasons = append(reasons, "Related profile content")
	}
	
	if len(reasons) == 0 {
		reasons = append(reasons, "Profile similarity")
	}
	
	return reasons
}

// logSearchAnalytics logs search queries and results for analytics (asynchronous)
func (s *searchService) logSearchAnalytics(ctx context.Context, userID uuid.UUID, query string, queryEmbedding []float32, resultsCount, searchTimeMs, totalCandidates int, results []models.SearchResult) {
	// Log the search query
	searchQuery, err := s.repo.LogSearchQuery(ctx, userID, query, queryEmbedding, resultsCount, searchTimeMs, totalCandidates)
	if err != nil {
		// Don't fail the request if analytics logging fails
		return
	}
	
	// Set query ID for results
	for i := range results {
		results[i].QueryID = searchQuery.ID
	}
	
	// Log search results
	if len(results) > 0 {
		_ = s.repo.LogSearchResults(ctx, searchQuery.ID, results)
	}
}

// PRIVACY & AVAILABILITY SAFEGUARDS

// PurgeExpiredEmbeddings removes embeddings that have expired based on TTL
func (s *searchService) PurgeExpiredEmbeddings(ctx context.Context) (int, error) {
	count, err := s.repo.DeleteExpiredEmbeddings(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to purge expired embeddings: %w", err)
	}
	return count, nil
}

// PurgeUnavailableUserEmbeddings removes embeddings for users who are no longer available
func (s *searchService) PurgeUnavailableUserEmbeddings(ctx context.Context, unavailableUserIDs []uuid.UUID) (int, error) {
	if len(unavailableUserIDs) == 0 {
		return 0, nil
	}
	
	count := 0
	for _, userID := range unavailableUserIDs {
		err := s.repo.DeleteUserEmbedding(ctx, userID)
		if err != nil {
			// Log error but continue with other users
			continue
		}
		count++
	}
	
	return count, nil
}

// StartAvailabilityCleanup starts a background process to clean up embeddings for unavailable users
func (s *searchService) StartAvailabilityCleanup(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Minute) // Check every 30 minutes
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Purge expired embeddings based on TTL
			expiredCount, err := s.PurgeExpiredEmbeddings(ctx)
			if err != nil {
				// Log error but don't stop the cleanup process
				continue
			}
			if expiredCount > 0 {
				// Log successful cleanup
			}
		}
	}
}

// buildUserIDFilter constructs the user ID filter based on scope and existing filters
func (s *searchService) buildUserIDFilter(ctx context.Context, userID uuid.UUID, req *dto.SearchRequest) ([]uuid.UUID, error) {
	// If explicit UserIDs are provided, use them (takes precedence over scope)
	if len(req.UserIDs) > 0 {
		return req.UserIDs, nil
	}
	
	// Handle scope-based filtering
	if req.Scope != nil {
		switch *req.Scope {
		case "friends":
			// Search only within user's friends
			if s.userClient == nil {
				return nil, fmt.Errorf("user client not configured - cannot retrieve friends for scope filtering")
			}
			
			friendIDs, err := s.userClient.GetUserFriends(ctx, userID)
			if err != nil {
				return nil, fmt.Errorf("failed to get user friends: %w", err)
			}
			
			// If user has no friends, return empty slice (no results)
			if len(friendIDs) == 0 {
				return []uuid.UUID{}, nil
			}
			
			return friendIDs, nil
			
		case "discovery":
			// Search among available users for discovery
			if s.discoveryClient == nil {
				return nil, fmt.Errorf("discovery client not configured - cannot retrieve available users for scope filtering")
			}
			
			availableUserIDs, err := s.discoveryClient.GetAvailableUsers(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to get available users: %w", err)
			}
			
			// If no users are available, return empty slice (no results)
			if len(availableUserIDs) == 0 {
				return []uuid.UUID{}, nil
			}
			
			return availableUserIDs, nil
		}
	}
	
	// No scope specified - search all users (default behavior)
	return nil, nil
}

// performVectorSearch executes pure vector similarity search
func (s *searchService) performVectorSearch(ctx context.Context, query string, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error) {
	if query == "" {
		// For empty queries, use a generic discovery embedding
		query = "discover people nearby available to connect"
	}
	
	// Generate embedding for the search query
	queryEmbedding, err := s.embeddingProvider.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}
	
	return s.repo.SearchSimilarUsers(ctx, queryEmbedding, limit, userIDFilter, excludeUserID)
}

// performFullTextSearch executes BM25-style full-text search
func (s *searchService) performFullTextSearch(ctx context.Context, query string, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error) {
	if query == "" {
		return nil, nil, fmt.Errorf("query is required for full-text search")
	}
	
	return s.repo.FullTextSearch(ctx, query, limit, userIDFilter, excludeUserID)
}

// performHybridSearch executes RRF-based hybrid search combining vector and full-text
func (s *searchService) performHybridSearch(ctx context.Context, query string, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID, bm25Weight, vectorWeight float64) ([]models.UserEmbedding, []float64, *dto.HybridSearchStats, error) {
	start := time.Now()
	
	if query == "" {
		// For empty queries, fall back to vector search only
		embeddings, scores, err := s.performVectorSearch(ctx, query, limit, userIDFilter, excludeUserID)
		stats := &dto.HybridSearchStats{
			BM25Results:   0,
			VectorResults: len(embeddings),
			FusedResults:  len(embeddings),
			BM25TimeMs:    0,
			VectorTimeMs:  int(time.Since(start).Nanoseconds() / 1e6),
			FusionTimeMs:  0,
		}
		return embeddings, scores, stats, err
	}
	
	// Generate embedding for vector search
	queryEmbedding, err := s.embeddingProvider.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}
	
	// Execute hybrid search in repository
	embeddings, scores, err := s.repo.HybridSearch(ctx, query, queryEmbedding, limit, userIDFilter, excludeUserID, bm25Weight, vectorWeight)
	if err != nil {
		return nil, nil, nil, err
	}
	
	// Create hybrid stats (simplified since RRF is done in repository)
	hybridStats := &dto.HybridSearchStats{
		FusedResults:  len(embeddings),
		VectorTimeMs:  int(time.Since(start).Nanoseconds() / 1e6),
		FusionTimeMs:  int(time.Since(start).Nanoseconds() / 1e6),
	}
	
	return embeddings, scores, hybridStats, nil
}

// checkUserHasImages checks if a user profile contains image analysis data
func (s *searchService) checkUserHasImages(profileText string) bool {
	// Simple heuristic: check for image analysis markers in profile text
	// In a full implementation, this would query the database for image analysis records
	return strings.Contains(profileText, "Visual Profile:") ||
		   strings.Contains(profileText, "Visual profile summary:")
}

// extractImageContext extracts a brief image context from profile text
func (s *searchService) extractImageContext(profileText string) *string {
	// Extract the first sentence of visual analysis if present
	if idx := strings.Index(profileText, "Visual Profile:"); idx != -1 {
		start := idx + len("Visual Profile:")
		if end := strings.Index(profileText[start:], "."); end != -1 {
			context := strings.TrimSpace(profileText[start : start+end])
			if len(context) > 100 {
				context = context[:97] + "..."
			}
			return &context
		}
	}
	return nil
}

// detectVisualMatch determines if the query likely matches visual content
func (s *searchService) detectVisualMatch(query, profileText string) bool {
	if query == "" {
		return false
	}

	lowerQuery := strings.ToLower(query)
	lowerProfile := strings.ToLower(profileText)

	// Check for visual-related keywords in the query
	visualKeywords := []string{
		"outdoor", "hiking", "beach", "travel", "cooking", "art", "music",
		"sports", "gym", "fitness", "photography", "dancing", "fashion",
		"restaurant", "office", "home", "city", "mountains", "park",
		"doctor", "engineer", "teacher", "chef", "artist", "musician",
	}

	// If query contains visual keywords and profile has visual content, it's a visual match
	hasVisualKeyword := false
	for _, keyword := range visualKeywords {
		if strings.Contains(lowerQuery, keyword) {
			hasVisualKeyword = true
			break
		}
	}

	// Check if the visual content in profile matches the query
	if hasVisualKeyword && (strings.Contains(lowerProfile, "visual profile") || strings.Contains(lowerProfile, "visual")) {
		return strings.Contains(lowerProfile, lowerQuery) ||
			   s.hasSemanticMatch(lowerQuery, lowerProfile)
	}

	return false
}

// hasSemanticMatch performs simple semantic matching
func (s *searchService) hasSemanticMatch(query, profileText string) bool {
	// Simple word overlap check - in production, this could use embeddings
	queryWords := strings.Fields(query)
	for _, word := range queryWords {
		if len(word) > 3 && strings.Contains(profileText, word) {
			return true
		}
	}
	return false
}
