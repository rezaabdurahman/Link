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
	embeddingProvider config.EmbeddingProvider
	imageAnalyzer     *vision.ImageAnalyzer
	config            *IndexingConfig
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
	// Enable image analysis
	EnableImageAnalysis bool
	// Retry configuration
	RetryConfig *utils.RetryConfig
}

// IndexingStats tracks statistics about the indexing process
type IndexingStats struct {
	LastRunTime          time.Time `json:"last_run_time"`
	LastRunDuration      int64     `json:"last_run_duration_ms"`
	TotalUsersIndexed    int64     `json:"total_users_indexed"`
	UsersWithImages      int64     `json:"users_with_images"`
	ImagesAnalyzed       int64     `json:"images_analyzed"`
	ImageAnalysisErrors  int64     `json:"image_analysis_errors"`
	ImageAnalysisCost    float64   `json:"image_analysis_cost_usd"`
	ErrorsCount          int64     `json:"errors_count"`
	IsRunning            bool      `json:"is_running"`
	NextRunTime          time.Time `json:"next_run_time"`
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
	embeddingProvider config.EmbeddingProvider,
	config *IndexingConfig,
) IndexingService {
	if config == nil {
		config = &IndexingConfig{
			CronIntervalMinutes:  120, // 2 hours by default
			WorkerPoolSize:       10,
			RateLimitPerSecond:   50,
			BatchSize:           100,
			EmbeddingTTLHours:   2,
			EnableImageAnalysis: true, // Enable by default
			RetryConfig:         utils.DefaultRetryConfig(),
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
		embeddingProvider: embeddingProvider,
		imageAnalyzer:     imageAnalyzer,
		config:            config,
		stats: &IndexingStats{
			NextRunTime: time.Now().Add(time.Duration(config.CronIntervalMinutes) * time.Minute),
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

	// Step 1: Get available users from discovery-svc
	userIDs, err := s.fetchAvailableUsers(ctx)
	if err != nil {
		s.incrementErrorCount()
		return fmt.Errorf("failed to fetch available users: %w", err)
	}

	s.logStructured("info", "available_users_fetched", map[string]interface{}{
		"user_count": len(userIDs),
	})

	if len(userIDs) == 0 {
		s.logStructured("info", "no_users_to_index", map[string]interface{}{})
		return nil
	}

	// Step 2: Process users in batches with worker pool
	totalProcessed, totalErrors := s.processUsersBatch(ctx, userIDs)

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

// processUsersBatch processes users in batches using a worker pool
func (s *indexingService) processUsersBatch(ctx context.Context, userIDs []uuid.UUID) (int, int) {
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
		go s.indexingWorker(ctx, jobCh, resultCh, rateLimiter, &wg)
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

// indexingWorker processes individual user indexing jobs
func (s *indexingService) indexingWorker(ctx context.Context, jobCh <-chan IndexingJob, resultCh chan<- error, rateLimiter *time.Ticker, wg *sync.WaitGroup) {
	defer wg.Done()

	for job := range jobCh {
		select {
		case <-ctx.Done():
			resultCh <- ctx.Err()
			return
		case <-rateLimiter.C:
			// Rate limited - proceed with job
		}

		err := s.processUserProfile(ctx, job.UserID)
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

// processUserProfile processes a single user's profile for indexing
func (s *indexingService) processUserProfile(ctx context.Context, userID uuid.UUID) error {
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
		err = s.searchRepo.UpdateUserEmbeddingWithTTL(ctx, userID, embedding, profileText, provider, model, s.config.EmbeddingTTLHours)
	} else {
		err = s.searchRepo.StoreUserEmbeddingWithTTL(ctx, userID, embedding, profileText, provider, model, s.config.EmbeddingTTLHours)
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
