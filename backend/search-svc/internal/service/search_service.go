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

type searchService struct {
	repo              repository.SearchRepository
	embeddingProvider config.EmbeddingProvider
	userClient        client.UserClient
	discoveryClient   client.DiscoveryClient
	disableAnalytics  bool // For testing purposes
}

// NewSearchService creates a new search service
func NewSearchService(repo repository.SearchRepository, embeddingProvider config.EmbeddingProvider) SearchService {
	return &searchService{
		repo:              repo,
		embeddingProvider: embeddingProvider,
	}
}

// NewSearchServiceWithClients creates a new search service with external service clients
func NewSearchServiceWithClients(repo repository.SearchRepository, embeddingProvider config.EmbeddingProvider, userClient client.UserClient, discoveryClient client.DiscoveryClient) SearchService {
	return &searchService{
		repo:              repo,
		embeddingProvider: embeddingProvider,
		userClient:        userClient,
		discoveryClient:   discoveryClient,
	}
}

// Search performs semantic search on user profiles
func (s *searchService) Search(ctx context.Context, userID uuid.UUID, req *dto.SearchRequest) (*dto.SearchResponse, error) {
	start := time.Now()
	
	// Set default limit if not provided
	limit := 10
	if req.Limit != nil {
		limit = *req.Limit
	}
	
	// Process query text
	processedQuery := s.preprocessQuery(req.Query)
	
	// Generate embedding for the search query
	queryEmbedding, err := s.embeddingProvider.GenerateEmbedding(ctx, processedQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}
	
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
	
	// Perform vector similarity search
	embeddings, scores, err := s.repo.SearchSimilarUsers(ctx, queryEmbedding, limit, userIDFilter, req.ExcludeUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to search similar users: %w", err)
	}
	
	// Convert to response format
	results := make([]dto.SearchResultItem, len(embeddings))
	searchResults := make([]models.SearchResult, len(embeddings)) // For analytics logging
	
	for i, embedding := range embeddings {
		matchReasons := s.generateMatchReasons(processedQuery, embedding.ProfileText, scores[i])
		
		results[i] = dto.SearchResultItem{
			UserID:       embedding.UserID,
			Score:        scores[i],
			MatchReasons: matchReasons,
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
	
	// Log search query for analytics (asynchronous)
	if !s.disableAnalytics {
		go s.logSearchAnalytics(context.Background(), userID, processedQuery, queryEmbedding, len(results), searchTimeMs, totalCandidates, searchResults)
	}
	
	return &dto.SearchResponse{
		Results:         results,
		QueryProcessed:  processedQuery,
		TotalCandidates: totalCandidates,
		SearchTimeMs:    searchTimeMs,
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
