package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/discovery-svc/internal/client"
	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/repository"
)

// AvailabilityService handles business logic for user availability
type AvailabilityService struct {
	availabilityRepo *repository.AvailabilityRepository
	searchClient     *client.SearchClient
	searchEnabled    bool
	rankingService   *RankingService
}

// NewAvailabilityService creates a new availability service
func NewAvailabilityService(availabilityRepo *repository.AvailabilityRepository) *AvailabilityService {
	return &AvailabilityService{
		availabilityRepo: availabilityRepo,
		searchEnabled:    false,
	}
}

// NewAvailabilityServiceWithSearch creates a new availability service with search integration
func NewAvailabilityServiceWithSearch(availabilityRepo *repository.AvailabilityRepository, searchClient *client.SearchClient, searchEnabled bool) *AvailabilityService {
	return &AvailabilityService{
		availabilityRepo: availabilityRepo,
		searchClient:     searchClient,
		searchEnabled:    searchEnabled,
	}
}

// NewAvailabilityServiceWithRanking creates a new availability service with ranking support
func NewAvailabilityServiceWithRanking(availabilityRepo *repository.AvailabilityRepository, rankingService *RankingService) *AvailabilityService {
	return &AvailabilityService{
		availabilityRepo: availabilityRepo,
		searchEnabled:    false,
		rankingService:   rankingService,
	}
}

// NewAvailabilityServiceWithSearchAndRanking creates a new availability service with both search and ranking
func NewAvailabilityServiceWithSearchAndRanking(availabilityRepo *repository.AvailabilityRepository, searchClient *client.SearchClient, searchEnabled bool, rankingService *RankingService) *AvailabilityService {
	return &AvailabilityService{
		availabilityRepo: availabilityRepo,
		searchClient:     searchClient,
		searchEnabled:    searchEnabled,
		rankingService:   rankingService,
	}
}

// GetUserAvailability gets the availability status for a specific user
func (s *AvailabilityService) GetUserAvailability(userID uuid.UUID) (*models.Availability, error) {
	availability, err := s.availabilityRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user availability: %w", err)
	}
	
	// If no availability record exists, create a default one (unavailable)
	if availability == nil {
		availability = &models.Availability{
			UserID:      userID,
			IsAvailable: false,
		}
		
		err = s.availabilityRepo.CreateOrUpdate(availability)
		if err != nil {
			return nil, fmt.Errorf("failed to create default availability record: %w", err)
		}
	}
	
	return availability, nil
}

// UpdateUserAvailability updates the availability status for a specific user
func (s *AvailabilityService) UpdateUserAvailability(userID uuid.UUID, isAvailable bool) (*models.Availability, error) {
	// Get existing availability or create a new one
	availability, err := s.availabilityRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing availability: %w", err)
	}
	
	if availability == nil {
		availability = &models.Availability{
			UserID: userID,
		}
	}
	
	// Update availability status
	if isAvailable {
		availability.SetAvailable()
	} else {
		availability.SetUnavailable()
	}
	
	// Save to database
	err = s.availabilityRepo.CreateOrUpdate(availability)
	if err != nil {
		return nil, fmt.Errorf("failed to update availability: %w", err)
	}
	
	return availability, nil
}

// GetAvailableUsers gets a paginated list of users who are currently available
func (s *AvailabilityService) GetAvailableUsers(limit, offset int) ([]models.Availability, int64, error) {
	// Validate pagination parameters
	if limit <= 0 {
		limit = 50 // Default limit
	}
	if limit > 100 {
		limit = 100 // Max limit
	}
	if offset < 0 {
		offset = 0
	}
	
	// Get available users
	availabilities, err := s.availabilityRepo.GetAvailableUsers(limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get available users: %w", err)
	}
	
	// Get total count
	totalCount, err := s.availabilityRepo.CountAvailableUsers()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count available users: %w", err)
	}
	
	return availabilities, totalCount, nil
}

// HandleUserHeartbeat updates the user's availability based on a heartbeat
// This could be called periodically to keep users marked as available
func (s *AvailabilityService) HandleUserHeartbeat(userID uuid.UUID) (*models.Availability, error) {
	// Get existing availability
	availability, err := s.availabilityRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing availability: %w", err)
	}
	
	if availability == nil {
		// Create new availability record as available
		availability = &models.Availability{
			UserID: userID,
		}
		availability.SetAvailable()
	} else if availability.IsAvailable {
		// Update the last available timestamp if already available
		now := time.Now()
		availability.LastAvailableAt = &now
	} else {
		// If user was unavailable, mark them as available
		availability.SetAvailable()
	}
	
	// Save to database
	err = s.availabilityRepo.CreateOrUpdate(availability)
	if err != nil {
		return nil, fmt.Errorf("failed to update availability via heartbeat: %w", err)
	}
	
	return availability, nil
}

// CleanupStaleAvailability marks users as unavailable if they haven't sent a heartbeat recently
// This should be called periodically (e.g., every 5 minutes) to clean up stale availability
func (s *AvailabilityService) CleanupStaleAvailability(staleThreshold time.Duration) error {
	// This would require a custom query to find users who are marked as available
	// but haven't updated their last_available_at within the threshold
	// For now, we'll leave this as a TODO for future implementation
	
	// TODO: Implement stale availability cleanup
	// This could be done with a raw SQL query or by getting all available users
	// and checking their last_available_at timestamps
	
	return nil
}

// SearchAvailableUsers searches available users with optional semantic search ranking
func (s *AvailabilityService) SearchAvailableUsers(ctx context.Context, userID uuid.UUID, req *models.SearchAvailableUsersRequest) (*models.SearchAvailableUsersResponse, error) {
	// Set defaults
	limit := 50
	offset := 0
	if req.Limit != nil {
		limit = *req.Limit
	}
	if req.Offset != nil {
		offset = *req.Offset
	}

	// Validate pagination parameters
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	// First, get list of available user IDs (existing logic)
	availabilities, totalCount, err := s.GetAvailableUsers(limit*2, 0) // Get more to allow for search filtering
	if err != nil {
		return nil, fmt.Errorf("failed to get available users: %w", err)
	}

	// Extract user IDs for search
	userIDs := make([]uuid.UUID, len(availabilities))
	for i, availability := range availabilities {
		userIDs[i] = availability.UserID
	}

	var warnings []string
	var searchMeta models.SearchMetaResponse
	var enhancedResults []models.EnhancedPublicAvailabilityResponse

	// Try semantic search if enabled and search service is available
	if s.searchEnabled && s.searchClient != nil && len(userIDs) > 0 {
		searchResp, searchErr := s.performSearch(ctx, userID, req.Query, userIDs, limit)
		if searchErr != nil {
			// Search service is down - fall back to unranked list with warning
			log.Printf("Search service unavailable, falling back to unranked list: %v", searchErr)
			warnings = append(warnings, "Search service temporarily unavailable. Returning unranked results.")
			enhancedResults = s.createUnrankedResults(availabilities, limit, offset)
			searchMeta = models.SearchMetaResponse{
				QueryProcessed:  req.Query,
				TotalCandidates: len(availabilities),
				SearchTimeMs:    0,
				SearchEnabled:   false,
			}
		} else {
			// Search succeeded - use ranked results
			enhancedResults = s.createRankedResults(availabilities, searchResp, limit, offset)
			searchMeta = models.SearchMetaResponse{
				QueryProcessed:  searchResp.QueryProcessed,
				TotalCandidates: searchResp.TotalCandidates,
				SearchTimeMs:    searchResp.SearchTimeMs,
				SearchEnabled:   true,
			}
		}
	} else {
		// Search not enabled or no available users - return unranked list
		enhancedResults = s.createUnrankedResults(availabilities, limit, offset)
		searchMeta = models.SearchMetaResponse{
			QueryProcessed:  req.Query,
			TotalCandidates: len(availabilities),
			SearchTimeMs:    0,
			SearchEnabled:   s.searchEnabled,
		}
	}

	// Calculate pagination
	actualTotal := int64(len(enhancedResults))
	if actualTotal > int64(limit) {
		actualTotal = totalCount // Use original total count for pagination
	}

	pagination := models.PaginationResponse{
		Total:      actualTotal,
		Limit:      limit,
		Offset:     offset,
		HasMore:    int64(offset+limit) < actualTotal,
		TotalPages: (actualTotal + int64(limit) - 1) / int64(limit),
	}

	return &models.SearchAvailableUsersResponse{
		Data:       enhancedResults,
		Pagination: pagination,
		SearchMeta: searchMeta,
		Warnings:   warnings,
	}, nil
}

// performSearch calls the search service
func (s *AvailabilityService) performSearch(ctx context.Context, userID uuid.UUID, query string, userIDs []uuid.UUID, limit int) (*client.SearchResponse, error) {
	searchReq := &client.SearchRequest{
		Query:   query,
		UserIDs: userIDs,
		Limit:   &limit,
	}

	return s.searchClient.Search(ctx, userID, searchReq)
}

// createRankedResults creates results ordered by search ranking
func (s *AvailabilityService) createRankedResults(availabilities []models.Availability, searchResp *client.SearchResponse, limit, offset int) []models.EnhancedPublicAvailabilityResponse {
	// Create a map for quick availability lookup
	availabilityMap := make(map[uuid.UUID]*models.Availability)
	for i := range availabilities {
		availabilityMap[availabilities[i].UserID] = &availabilities[i]
	}

	// Create ranked results based on search response
	var results []models.EnhancedPublicAvailabilityResponse
	for _, searchResult := range searchResp.Results {
		if availability, exists := availabilityMap[searchResult.UserID]; exists {
			score := searchResult.Score
			result := models.EnhancedPublicAvailabilityResponse{
				UserID:          availability.UserID,
				IsAvailable:     availability.IsAvailable,
				LastAvailableAt: availability.LastAvailableAt,
				SearchScore:     &score,
				MatchReasons:    searchResult.MatchReasons,
			}
			results = append(results, result)
		}
	}

	// Apply pagination
	if offset >= len(results) {
		return []models.EnhancedPublicAvailabilityResponse{}
	}
	end := offset + limit
	if end > len(results) {
		end = len(results)
	}

	return results[offset:end]
}

// createUnrankedResults creates results without search ranking
func (s *AvailabilityService) createUnrankedResults(availabilities []models.Availability, limit, offset int) []models.EnhancedPublicAvailabilityResponse {
	// Apply pagination first
	if offset >= len(availabilities) {
		return []models.EnhancedPublicAvailabilityResponse{}
	}
	end := offset + limit
	if end > len(availabilities) {
		end = len(availabilities)
	}

	// Convert to enhanced responses without search scores
	results := make([]models.EnhancedPublicAvailabilityResponse, end-offset)
	for i, availability := range availabilities[offset:end] {
		results[i] = models.EnhancedPublicAvailabilityResponse{
			UserID:          availability.UserID,
			IsAvailable:     availability.IsAvailable,
			LastAvailableAt: availability.LastAvailableAt,
			SearchScore:     nil,
			MatchReasons:    nil,
		}
	}

	return results
}

// RemoveUserAvailability removes the availability record for a user (e.g., when user is deleted)
func (s *AvailabilityService) RemoveUserAvailability(userID uuid.UUID) error {
	err := s.availabilityRepo.DeleteByUserID(userID)
	if err != nil {
		return fmt.Errorf("failed to remove user availability: %w", err)
	}
	return nil
}
