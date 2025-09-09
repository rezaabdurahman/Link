package service

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/client"
	"github.com/link-app/search-svc/internal/config"
	"github.com/link-app/search-svc/internal/repository"
	"github.com/link-app/search-svc/internal/utils"
	"github.com/link-app/search-svc/internal/vision"
)

// IndexingService handles the background indexing pipeline
type IndexingService interface {
	StartIndexingPipeline(ctx context.Context) error
	RunIndexingCycle(ctx context.Context) error
	StartTTLCleanupWorker(ctx context.Context)
	GetIndexingStats() *IndexingStats
}

type indexingService struct {
	searchRepo        repository.SearchRepository
	discoveryClient   client.DiscoveryClient
	userClient        client.UserClient
	consentClient     *client.ConsentClient
	embeddingProvider config.EmbeddingProvider
	imageAnalyzer     *vision.ImageAnalyzer
	config            *IndexingConfig
	serviceConfig     *config.Config
	stats             *IndexingStats
	mu                sync.RWMutex
}

// IndexingConfig holds configuration for the indexing service
type IndexingConfig struct {
	// Cron schedule (in minutes)
	CronIntervalMinutes int
	// Worker pool size for concurrent processing
	WorkerPoolSize int
	// Rate limiting
	RateLimitPerSecond int
	// Batch size for processing users
	BatchSize int
	// TTL for embeddings (in hours)
	EmbeddingTTLHours int
	// TTL for unavailable user embeddings (longer retention)
	UnavailableUserTTLHours int
	// Enable image analysis
	EnableImageAnalysis bool
	// Enable full user indexing (beyond just available users)
	EnableFullUserIndexing bool
	// Full indexing interval (in hours)
	FullIndexingIntervalHours int
	// Retry configuration
	RetryConfig *utils.RetryConfig
}

// IndexingStats tracks statistics about the indexing process
type IndexingStats struct {
	LastRunTime             time.Time `json:"last_run_time"`
	LastRunDuration         int64     `json:"last_run_duration_ms"`
	TotalUsersIndexed       int64     `json:"total_users_indexed"`
	AvailableUsersIndexed   int64     `json:"available_users_indexed"`
	UnavailableUsersIndexed int64     `json:"unavailable_users_indexed"`
	UsersWithImages         int64     `json:"users_with_images"`
	ImagesAnalyzed          int64     `json:"images_analyzed"`
	ImageAnalysisErrors     int64     `json:"image_analysis_errors"`
	ImageAnalysisCost       float64   `json:"image_analysis_cost_usd"`
	ErrorsCount             int64     `json:"errors_count"`
	IsRunning               bool      `json:"is_running"`
	NextRunTime             time.Time `json:"next_run_time"`
	LastFullIndexTime       time.Time `json:"last_full_index_time"`
	NextFullIndexTime       time.Time `json:"next_full_index_time"`
}

// IndexingJob represents a single user indexing job
type IndexingJob struct {
	UserID    uuid.UUID
	Attempt   int
	CreatedAt time.Time
}

// NewIndexingService creates a new indexing service
func NewIndexingService(
	searchRepo repository.SearchRepository,
	discoveryClient client.DiscoveryClient,
	userClient client.UserClient,
	consentClient *client.ConsentClient,
	embeddingProvider config.EmbeddingProvider,
	config *IndexingConfig,
	serviceConfig *config.Config,
) IndexingService {
	if config == nil {
		config = &IndexingConfig{
			CronIntervalMinutes:          120, // 2 hours by default
			WorkerPoolSize:               10,
			RateLimitPerSecond:           50,
			BatchSize:                   100,
			EmbeddingTTLHours:           2,   // Short TTL for available users
			UnavailableUserTTLHours:     24,  // Longer TTL for unavailable users
			EnableImageAnalysis:         true, // Enable by default
			EnableFullUserIndexing:      true, // Enable full user indexing
			FullIndexingIntervalHours:   24,   // Run full indexing daily
			RetryConfig:                 utils.DefaultRetryConfig(),
		}
	}

	// Initialize image analyzer if enabled
	var imageAnalyzer *vision.ImageAnalyzer
	if config.EnableImageAnalysis {
		analyzer, err := vision.NewImageAnalyzerFromEnv()
		if err != nil {
			// Log warning but don't fail - continue without image analysis
			log.Printf("Warning: Failed to initialize image analyzer: %v", err)
			config.EnableImageAnalysis = false
		} else {
			imageAnalyzer = analyzer
		}
	}

	return &indexingService{
		searchRepo:        searchRepo,
		discoveryClient:   discoveryClient,
		userClient:        userClient,
		consentClient:     consentClient,
		embeddingProvider: embeddingProvider,
		imageAnalyzer:     imageAnalyzer,
		config:            config,
		serviceConfig:     serviceConfig,
		stats: &IndexingStats{
			NextRunTime:       time.Now().Add(time.Duration(config.CronIntervalMinutes) * time.Minute),
			NextFullIndexTime: time.Now().Add(time.Duration(config.FullIndexingIntervalHours) * time.Hour),
		},
	}
}

// StartIndexingPipeline starts the background indexing cron job
func (s *indexingService) StartIndexingPipeline(ctx context.Context) error {
	ticker := time.NewTicker(time.Duration(s.config.CronIntervalMinutes) * time.Minute)
	defer ticker.Stop()

	// Log service start
	s.logStructured("info", "indexing_pipeline_started", map[string]interface{}{
		"cron_interval_minutes": s.config.CronIntervalMinutes,
		"worker_pool_size":      s.config.WorkerPoolSize,
		"rate_limit_per_second": s.config.RateLimitPerSecond,
	})

	// Run initial indexing cycle
	if err := s.RunIndexingCycle(ctx); err != nil {
		s.logStructured("error", "initial_indexing_failed", map[string]interface{}{
			"error": err.Error(),
		})
	}

	for {
		select {
		case <-ctx.Done():
			s.logStructured("info", "indexing_pipeline_stopped", map[string]interface{}{
				"reason": "context cancelled",
			})
			return ctx.Err()
		case <-ticker.C:
			if err := s.RunIndexingCycle(ctx); err != nil {
				s.logStructured("error", "indexing_cycle_failed", map[string]interface{}{
					"error": err.Error(),
				})
			}
		}
	}
}

// RunIndexingCycle runs a single indexing cycle
func (s *indexingService) RunIndexingCycle(ctx context.Context) error {
	start := time.Now()
	
	s.mu.Lock()
	s.stats.IsRunning = true
	s.stats.LastRunTime = start
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.stats.IsRunning = false
		s.stats.LastRunDuration = time.Since(start).Milliseconds()
		s.stats.NextRunTime = time.Now().Add(time.Duration(s.config.CronIntervalMinutes) * time.Minute)
		s.mu.Unlock()
	}()

	s.logStructured("info", "indexing_cycle_started", map[string]interface{}{
		"timestamp": start.Format(time.RFC3339),
	})

	// Phase 1: Always index available users (for both discovery and friend search)
	availableUserIDs, err := s.fetchAvailableUsers(ctx)
	if err != nil {
		s.incrementErrorCount()
		return fmt.Errorf("failed to fetch available users: %w", err)
	}

	s.logStructured("info", "available_users_fetched", map[string]interface{}{
		"user_count": len(availableUserIDs),
	})

	totalProcessed, totalErrors := 0, 0
	
	if len(availableUserIDs) > 0 {
		// Process available users with short TTL
		processed, errors := s.processUsersBatchWithTTL(ctx, availableUserIDs, s.config.EmbeddingTTLHours, "available")
		totalProcessed += processed
		totalErrors += errors
		
		s.mu.Lock()
		s.stats.AvailableUsersIndexed += int64(processed)
		s.mu.Unlock()
	}

	// Phase 2: Periodically index all users for comprehensive friend search
	if s.config.EnableFullUserIndexing && s.shouldRunFullIndex() {
		s.logStructured("info", "starting_full_user_indexing", map[string]interface{}{})
		
		// Get all users in batches
		allUserIDs, err := s.fetchAllUsers(ctx)
		if err != nil {
			s.logStructured("error", "failed_to_fetch_all_users", map[string]interface{}{
				"error": err.Error(),
			})
		} else {
			// Filter out users that were just processed as available
			unavailableUserIDs := s.filterUnavailableUsers(allUserIDs, availableUserIDs)
			
			s.logStructured("info", "unavailable_users_to_index", map[string]interface{}{
				"total_users": len(allUserIDs),
				"available_users": len(availableUserIDs),
				"unavailable_users": len(unavailableUserIDs),
			})
			
			if len(unavailableUserIDs) > 0 {
				// Process unavailable users with longer TTL
				processed, errors := s.processUsersBatchWithTTL(ctx, unavailableUserIDs, s.config.UnavailableUserTTLHours, "unavailable")
				totalProcessed += processed
				totalErrors += errors
				
				s.mu.Lock()
				s.stats.UnavailableUsersIndexed += int64(processed)
				s.stats.LastFullIndexTime = time.Now()
				s.stats.NextFullIndexTime = time.Now().Add(time.Duration(s.config.FullIndexingIntervalHours) * time.Hour)
				s.mu.Unlock()
			}
		}
	}

	s.mu.Lock()
	s.stats.TotalUsersIndexed += int64(totalProcessed)
	s.stats.ErrorsCount += int64(totalErrors)
	s.mu.Unlock()

	duration := time.Since(start)
	s.logStructured("info", "indexing_cycle_completed", map[string]interface{}{
		"duration_ms":       duration.Milliseconds(),
		"users_processed":   totalProcessed,
		"errors":           totalErrors,
		"success_rate":     float64(totalProcessed-totalErrors) / float64(totalProcessed),
	})

	return nil
}

// fetchAvailableUsers gets the list of available users from discovery-svc
func (s *indexingService) fetchAvailableUsers(ctx context.Context) ([]uuid.UUID, error) {
	var userIDs []uuid.UUID
	
	err := utils.RetryWithBackoff(ctx, s.config.RetryConfig, func() error {
		var err error
		userIDs, err = s.discoveryClient.GetAvailableUsers(ctx)
		return err
	}, utils.IsHTTPRetryable)

	return userIDs, err
}

// fetchAllUsers gets all user IDs from user-svc (paginated)
func (s *indexingService) fetchAllUsers(ctx context.Context) ([]uuid.UUID, error) {
	var allUserIDs []uuid.UUID
	offset := 0
	limit := 1000 // Process in batches
	
	for {
		userIDs, err := s.userClient.GetAllUsers(ctx, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch users at offset %d: %w", offset, err)
		}
		
		if len(userIDs) == 0 {
			break // No more users
		}
		
		allUserIDs = append(allUserIDs, userIDs...)
		offset += len(userIDs)
		
		// If we got less than the limit, we're done
		if len(userIDs) < limit {
			break
		}
	}
	
	s.logStructured("info", "all_users_fetched", map[string]interface{}{
		"total_users": len(allUserIDs),
	})
	
	return allUserIDs, nil
}

// filterUnavailableUsers returns users that are not in the available list
func (s *indexingService) filterUnavailableUsers(allUserIDs, availableUserIDs []uuid.UUID) []uuid.UUID {
	// Create a map for fast lookup
	availableMap := make(map[uuid.UUID]bool, len(availableUserIDs))
	for _, id := range availableUserIDs {
		availableMap[id] = true
	}
	
	var unavailableUserIDs []uuid.UUID
	for _, id := range allUserIDs {
		if !availableMap[id] {
			unavailableUserIDs = append(unavailableUserIDs, id)
		}
	}
	
	return unavailableUserIDs
}

// shouldRunFullIndex determines if full indexing should run
func (s *indexingService) shouldRunFullIndex() bool {
	s.mu.RLock()
	nextFullIndex := s.stats.NextFullIndexTime
	s.mu.RUnlock()
	
	return time.Now().After(nextFullIndex)
}

// processUsersBatch processes users in batches using a worker pool
func (s *indexingService) processUsersBatch(ctx context.Context, userIDs []uuid.UUID) (int, int) {
	return s.processUsersBatchWithTTL(ctx, userIDs, s.config.EmbeddingTTLHours, "default")
}

// processUsersBatchWithTTL processes users in batches with specific TTL
func (s *indexingService) processUsersBatchWithTTL(ctx context.Context, userIDs []uuid.UUID, ttlHours int, userType string) (int, int) {
	// Create job channel and worker pool
	jobCh := make(chan IndexingJob, s.config.BatchSize)
	resultCh := make(chan error, len(userIDs))
	
	// Rate limiter
	rateLimiter := time.NewTicker(time.Second / time.Duration(s.config.RateLimitPerSecond))
	defer rateLimiter.Stop()

	// Start workers
	var wg sync.WaitGroup
	for i := 0; i < s.config.WorkerPoolSize; i++ {
		wg.Add(1)
		go s.indexingWorkerWithTTL(ctx, jobCh, resultCh, rateLimiter, ttlHours, &wg)
	}

	// Send jobs to workers
	go func() {
		defer close(jobCh)
		for _, userID := range userIDs {
			select {
			case <-ctx.Done():
				return
			case jobCh <- IndexingJob{
				UserID:    userID,
				Attempt:   1,
				CreatedAt: time.Now(),
			}:
			}
		}
	}()
	
	s.logStructured("info", "processing_users_batch", map[string]interface{}{
		"user_count": len(userIDs),
		"user_type": userType,
		"ttl_hours": ttlHours,
	})

	// Wait for all workers to finish
	wg.Wait()
	close(resultCh)

	// Collect results
	totalProcessed := len(userIDs)
	totalErrors := 0
	for err := range resultCh {
		if err != nil {
			totalErrors++
		}
	}

	return totalProcessed, totalErrors
}

// indexingWorker processes individual user indexing jobs (legacy method)
func (s *indexingService) indexingWorker(ctx context.Context, jobCh <-chan IndexingJob, resultCh chan<- error, rateLimiter *time.Ticker, wg *sync.WaitGroup) {
	s.indexingWorkerWithTTL(ctx, jobCh, resultCh, rateLimiter, s.config.EmbeddingTTLHours, wg)
}

// indexingWorkerWithTTL processes individual user indexing jobs with specific TTL
func (s *indexingService) indexingWorkerWithTTL(ctx context.Context, jobCh <-chan IndexingJob, resultCh chan<- error, rateLimiter *time.Ticker, ttlHours int, wg *sync.WaitGroup) {
	defer wg.Done()

	for job := range jobCh {
		select {
		case <-ctx.Done():
			resultCh <- ctx.Err()
			return
		case <-rateLimiter.C:
			// Rate limited - proceed with job
		}

		err := s.processUserProfileWithTTL(ctx, job.UserID, ttlHours)
		resultCh <- err

		if err != nil {
			s.logStructured("error", "user_indexing_failed", map[string]interface{}{
				"user_id": job.UserID.String(),
				"attempt": job.Attempt,
				"error":   err.Error(),
			})
		} else {
			s.logStructured("debug", "user_indexed_successfully", map[string]interface{}{
				"user_id": job.UserID.String(),
			})
		}
	}
}

// processUserProfile processes a single user's profile for indexing (legacy method)
func (s *indexingService) processUserProfile(ctx context.Context, userID uuid.UUID) error {
	return s.processUserProfileWithTTL(ctx, userID, s.config.EmbeddingTTLHours)
}

// processUserProfileWithTTL processes a single user's profile for indexing with specific TTL
func (s *indexingService) processUserProfileWithTTL(ctx context.Context, userID uuid.UUID, ttlHours int) error {
	// Step 1: Fetch user profile from user-svc with retry
	var profile *client.UserProfile
	err := utils.RetryWithBackoff(ctx, s.config.RetryConfig, func() error {
		var err error
		profile, err = s.userClient.GetUserProfile(ctx, userID)
		return err
	}, utils.IsHTTPRetryable)

	if err != nil {
		return fmt.Errorf("failed to fetch profile for user %s: %w", userID, err)
	}

	// Step 1.5: Check user consent for search indexing via consent service
	hasConsent, consentErr := s.checkSearchConsent(ctx, userID)
	if consentErr != nil {
		// Log the error but continue with indexing if consent service is unavailable
		// and fallback is enabled (fail-safe approach)
		s.logStructured("warn", "consent_check_failed", map[string]interface{}{
			"user_id": userID.String(),
			"error":   consentErr.Error(),
		})
		
		if s.serviceConfig.Features.ConsentServiceFallback {
			s.logStructured("info", "consent_fallback_allowing_indexing", map[string]interface{}{
				"user_id": userID.String(),
			})
		} else {
			return fmt.Errorf("consent check failed and fallback disabled: %w", consentErr)
		}
	} else if !hasConsent {
		s.logStructured("info", "user_opted_out_of_search", map[string]interface{}{
			"user_id": userID.String(),
		})
		
		// If user has opted out, remove their existing embedding if it exists
		if existingEmbedding, err := s.searchRepo.GetUserEmbedding(ctx, userID); err == nil && existingEmbedding != nil {
			if deleteErr := s.searchRepo.DeleteUserEmbedding(ctx, userID); deleteErr != nil {
				s.logStructured("warn", "failed_to_delete_opted_out_user_embedding", map[string]interface{}{
					"error": deleteErr.Error(),
				})
			} else {
				s.logStructured("info", "removed_embedding_for_opted_out_user", map[string]interface{}{})
			}
		}
		
		return nil // Skip indexing without error
	}
	
	s.logStructured("debug", "user_consented_to_search", map[string]interface{}{
		"user_id": userID.String(),
	})

	// Step 2: Process images if image analysis is enabled
	var imageAnalysisResult *vision.BatchImageAnalysisResult
	if s.config.EnableImageAnalysis && s.imageAnalyzer != nil {
		// Check if user has images
		hasImages := (profile.ProfilePicture != nil && *profile.ProfilePicture != "") || len(profile.AdditionalPhotos) > 0
		if hasImages {
			result, err := s.analyzeUserImages(ctx, userID, profile.ProfilePicture, profile.AdditionalPhotos)
			if err != nil {
				// Log error but continue with text-only indexing
				s.logStructured("warn", "image_analysis_failed", map[string]interface{}{
					"user_id": userID.String(),
					"error":   err.Error(),
				})
				s.incrementImageAnalysisErrors()
			} else {
				imageAnalysisResult = result
				s.incrementImagesAnalyzed(int64(result.ProcessedImages))
				s.incrementImageAnalysisCost(s.imageAnalyzer.GetProvider().GetCostEstimate(result.TotalImages))
			}
		}
	}

	// Step 3: Convert profile to searchable text (including image descriptions)
	profileText := s.buildSearchableText(profile, imageAnalysisResult)
	if profileText == "" {
		s.logStructured("warn", "empty_profile_text", map[string]interface{}{
			"user_id": userID.String(),
		})
		return nil // Skip empty profiles
	}

	// Step 4: Check if we need to update embedding (compare hash)
	existingEmbedding, err := s.searchRepo.GetUserEmbedding(ctx, userID)
	if err == nil {
		// Compare hash to see if profile changed
		currentHash := generateTextHash(profileText)
		if existingEmbedding.EmbeddingHash == currentHash {
			// Profile hasn't changed, no need to update
			s.logStructured("debug", "profile_unchanged", map[string]interface{}{
				"user_id": userID.String(),
			})
			return nil
		}
	}

	// Step 5: Generate embedding
	var embedding []float32
	err = utils.RetryWithBackoff(ctx, s.config.RetryConfig, func() error {
		var err error
		embedding, err = s.embeddingProvider.GenerateEmbedding(ctx, profileText)
		return err
	}, func(err error) bool {
		// Only retry on network/service errors, not on API key issues
		return utils.IsHTTPRetryable(err) && !contains(err.Error(), "api key")
	})

	if err != nil {
		return fmt.Errorf("failed to generate embedding for user %s: %w", userID, err)
	}

	// Step 6: Store/update embedding in database with TTL
	provider := s.embeddingProvider.GetProviderName()
	model := "text-embedding-3-small" // Default model

	if existingEmbedding != nil {
		err = s.searchRepo.UpdateUserEmbeddingWithTTL(ctx, userID, embedding, profileText, provider, model, ttlHours)
	} else {
		err = s.searchRepo.StoreUserEmbeddingWithTTL(ctx, userID, embedding, profileText, provider, model, ttlHours)
	}

	if err != nil {
		return fmt.Errorf("failed to store embedding for user %s: %w", userID, err)
	}

	// Step 7: Store image analysis results if available
	if imageAnalysisResult != nil {
		err = s.storeImageAnalysisResults(ctx, userID, imageAnalysisResult)
		if err != nil {
			// Log error but don't fail the entire indexing process
			s.logStructured("warn", "failed_to_store_image_analysis", map[string]interface{}{
				"user_id": userID.String(),
				"error":   err.Error(),
			})
		}
	}

	return nil
}

// StartTTLCleanupWorker starts a background worker that periodically cleans up expired embeddings
func (s *indexingService) StartTTLCleanupWorker(ctx context.Context) {
	// Run cleanup every 30 minutes
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	s.logStructured("info", "ttl_cleanup_worker_started", map[string]interface{}{
		"cleanup_interval_minutes": 30,
	})

	// Run initial cleanup
	s.cleanupExpiredEmbeddings(ctx)

	for {
		select {
		case <-ctx.Done():
			s.logStructured("info", "ttl_cleanup_worker_stopped", map[string]interface{}{
				"reason": "context cancelled",
			})
			return
		case <-ticker.C:
			s.cleanupExpiredEmbeddings(ctx)
		}
	}
}

// cleanupExpiredEmbeddings removes expired embeddings from the database
func (s *indexingService) cleanupExpiredEmbeddings(ctx context.Context) {
	start := time.Now()
	
	deleted, err := s.searchRepo.CleanupExpiredEmbeddings(ctx)
	if err != nil {
		s.logStructured("error", "ttl_cleanup_failed", map[string]interface{}{
			"error": err.Error(),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		return
	}

	s.logStructured("info", "ttl_cleanup_completed", map[string]interface{}{
		"deleted_count": deleted,
		"duration_ms": time.Since(start).Milliseconds(),
	})
}

// GetIndexingStats returns current indexing statistics
func (s *indexingService) GetIndexingStats() *IndexingStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	// Return a copy to avoid race conditions
	statsCopy := *s.stats
	return &statsCopy
}

// incrementErrorCount safely increments the error count
func (s *indexingService) incrementErrorCount() {
	s.mu.Lock()
	s.stats.ErrorsCount++
	s.mu.Unlock()
}

// incrementImagesAnalyzed safely increments the images analyzed count
func (s *indexingService) incrementImagesAnalyzed(count int64) {
	s.mu.Lock()
	s.stats.ImagesAnalyzed += count
	s.mu.Unlock()
}

// incrementImageAnalysisErrors safely increments the image analysis errors count
func (s *indexingService) incrementImageAnalysisErrors() {
	s.mu.Lock()
	s.stats.ImageAnalysisErrors++
	s.mu.Unlock()
}

// incrementImageAnalysisCost safely increments the image analysis cost
func (s *indexingService) incrementImageAnalysisCost(cost float64) {
	s.mu.Lock()
	s.stats.ImageAnalysisCost += cost
	s.mu.Unlock()
}

// analyzeUserImages analyzes all images for a user
func (s *indexingService) analyzeUserImages(ctx context.Context, userID uuid.UUID, profilePicture *string, additionalPhotos []string) (*vision.BatchImageAnalysisResult, error) {
	if s.imageAnalyzer == nil {
		return nil, fmt.Errorf("image analyzer not initialized")
	}

	result, err := s.imageAnalyzer.AnalyzeUserImages(ctx, userID, profilePicture, additionalPhotos)
	if err != nil {
		return nil, err
	}

	// Update statistics
	s.mu.Lock()
	s.stats.UsersWithImages++
	s.mu.Unlock()

	return result, nil
}

// buildSearchableText combines profile text with image analysis results
func (s *indexingService) buildSearchableText(profile *client.UserProfile, imageResult *vision.BatchImageAnalysisResult) string {
	// Start with base profile text
	profileText := profile.ProfileToText()

	// Add image analysis results if available
	if imageResult != nil && imageResult.CombinedText != "" {
		if profileText != "" {
			profileText += " " + imageResult.CombinedText
		} else {
			profileText = imageResult.CombinedText
		}
	}

	return profileText
}

// storeImageAnalysisResults stores the image analysis results in the database
func (s *indexingService) storeImageAnalysisResults(ctx context.Context, userID uuid.UUID, result *vision.BatchImageAnalysisResult) error {
	// For now, we'll store this as part of the embedding metadata
	// In a full implementation, you might want to store these in separate tables
	// or extend the repository interface to handle image analysis storage
	
	// This is a placeholder - in a real implementation you would:
	// 1. Store individual ImageAnalysis records
	// 2. Store/update UserImageSummary
	// 3. Update ImageAnalysisStats
	
	s.logStructured("debug", "image_analysis_stored", map[string]interface{}{
		"user_id":          userID.String(),
		"total_images":     result.TotalImages,
		"processed_images": result.ProcessedImages,
		"failed_images":    result.FailedImages,
		"processing_time":  result.ProcessingTime.Milliseconds(),
	})

	return nil
}

// logStructured logs in structured JSON format
func (s *indexingService) logStructured(level, message string, fields map[string]interface{}) {
	logEntry := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"level":     level,
		"service":   "search-svc",
		"component": "indexing_pipeline",
		"message":   message,
	}

	// Merge additional fields
	for k, v := range fields {
		logEntry[k] = v
	}

	// Marshal to JSON and log
	if jsonBytes, err := json.Marshal(logEntry); err == nil {
		log.Println(string(jsonBytes))
	} else {
		log.Printf("[%s] %s: %+v", level, message, fields)
	}
}

// generateTextHash creates a SHA-256 hash of the profile text
func generateTextHash(text string) string {
	hash := sha256.Sum256([]byte(text))
	return fmt.Sprintf("%x", hash)
}

// Helper function for substring checking
func contains(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// checkSearchConsent checks if a user has consented to search indexing
func (s *indexingService) checkSearchConsent(ctx context.Context, userID uuid.UUID) (bool, error) {
	// Skip consent check if consent service is disabled
	if !s.serviceConfig.ConsentService.Enabled {
		s.logStructured("debug", "consent_service_disabled", map[string]interface{}{
			"user_id": userID.String(),
		})
		return true, nil
	}
	
	// Skip consent check if enforcement is disabled
	if !s.serviceConfig.Features.EnforceConsent {
		s.logStructured("debug", "consent_enforcement_disabled", map[string]interface{}{
			"user_id": userID.String(),
		})
		return true, nil
	}
	
	// Create a timeout context for consent check
	consentCtx, cancel := context.WithTimeout(ctx, s.serviceConfig.Search.ConsentCheckTimeout)
	defer cancel()
	
	// Check consent via consent service
	hasConsent, err := s.consentClient.ValidateSearchConsent(consentCtx, userID)
	if err != nil {
		s.logStructured("warn", "consent_check_error", map[string]interface{}{
			"user_id": userID.String(),
			"error":   err.Error(),
		})
		return false, err
	}
	
	s.logStructured("debug", "consent_check_result", map[string]interface{}{
		"user_id":     userID.String(),
		"has_consent": hasConsent,
	})
	
	return hasConsent, nil
}
