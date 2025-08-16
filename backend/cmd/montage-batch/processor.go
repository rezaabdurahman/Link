package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/link-app/user-svc/internal/montage"
)

// ProcessorConfig holds configuration for the batch processor
type ProcessorConfig struct {
	MontageService    montage.Service
	CheckinClient     montage.CheckinClient
	BatchSize         int
	MaxConcurrency    int
	ProcessingTimeout time.Duration
	EnableAnalytics   bool
	Logger            *log.Logger
}

// BatchProcessor handles batch processing of montages
type BatchProcessor struct {
	config           ProcessorConfig
	semaphore        chan struct{} // Controls concurrency
	logger           *log.Logger
}

// BatchResult contains the results of a batch processing run
type BatchResult struct {
	JobID             string
	ProcessedCount    int
	SuccessCount      int
	ErrorCount        int
	GeneralMontages   int
	InterestMontages  int
	Duration          time.Duration
	Errors            []string
	StartTime         time.Time
	EndTime           time.Time
}

// NewBatchProcessor creates a new batch processor instance
func NewBatchProcessor(config ProcessorConfig) *BatchProcessor {
	// Create semaphore to control concurrency
	semaphore := make(chan struct{}, config.MaxConcurrency)
	
	return &BatchProcessor{
		config:    config,
		semaphore: semaphore,
		logger:    config.Logger,
	}
}

// ProcessBatch processes a complete batch run for all eligible users
func (bp *BatchProcessor) ProcessBatch(ctx context.Context, jobID string) (*BatchResult, error) {
	startTime := time.Now()
	
	bp.logger.Printf("Starting batch job %s", jobID)
	
	// Initialize result tracking
	result := &BatchResult{
		JobID:     jobID,
		StartTime: startTime,
		Errors:    make([]string, 0),
	}
	
	// Publish batch job started event
	if err := montage.PublishBatchJobStarted(
		bp.config.MontageService.GetEventPublisher(),
		jobID,
		"daily_generation",
		"system",
		map[string]interface{}{
			"batch_size":      bp.config.BatchSize,
			"max_concurrency": bp.config.MaxConcurrency,
			"enable_analytics": bp.config.EnableAnalytics,
		},
	); err != nil {
		bp.logger.Printf("Warning: Failed to publish batch started event: %v", err)
	}
	
	// Process users in batches
	offset := 0
	for {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		
		// Fetch batch of users that need montage updates
		users, err := bp.fetchUsersForProcessing(ctx, offset, bp.config.BatchSize)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch users: %w", err)
		}
		
		// No more users to process
		if len(users) == 0 {
			break
		}
		
		bp.logger.Printf("Processing batch of %d users (offset: %d)", len(users), offset)
		
		// Process this batch of users
		batchResult := bp.processBatchOfUsers(ctx, users)
		
		// Aggregate results
		result.ProcessedCount += batchResult.ProcessedCount
		result.SuccessCount += batchResult.SuccessCount
		result.ErrorCount += batchResult.ErrorCount
		result.GeneralMontages += batchResult.GeneralMontages
		result.InterestMontages += batchResult.InterestMontages
		result.Errors = append(result.Errors, batchResult.Errors...)
		
		// Move to next batch
		offset += bp.config.BatchSize
		
		// Add small delay between batches to avoid overwhelming the system
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(1 * time.Second):
		}
	}
	
	// Finalize results
	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)
	
	// Publish batch job completed event
	summary := map[string]interface{}{
		"general_montages":  result.GeneralMontages,
		"interest_montages": result.InterestMontages,
		"avg_processing_time_per_user": float64(result.Duration.Milliseconds()) / float64(result.ProcessedCount),
	}
	
	if err := montage.PublishBatchJobCompleted(
		bp.config.MontageService.GetEventPublisher(),
		jobID,
		"daily_generation",
		result.Duration,
		result.ProcessedCount,
		result.SuccessCount,
		result.ErrorCount,
		summary,
	); err != nil {
		bp.logger.Printf("Warning: Failed to publish batch completed event: %v", err)
	}
	
	bp.logger.Printf("Batch job %s completed: %d processed, %d successful, %d errors",
		jobID, result.ProcessedCount, result.SuccessCount, result.ErrorCount)
	
	return result, nil
}

// fetchUsersForProcessing fetches users that need montage processing
func (bp *BatchProcessor) fetchUsersForProcessing(ctx context.Context, offset, limit int) ([]UserForProcessing, error) {
	// This would typically query users who:
	// 1. Have new check-ins since last montage generation
	// 2. Haven't had montages generated recently
	// 3. Are active users (not deleted/suspended)
	
	// For now, we'll simulate this with a simple query
	// In reality, this would be a more complex query involving check-ins
	
	users := make([]UserForProcessing, 0, limit)
	
	// TODO: Replace with actual database query
	// This is a placeholder implementation
	for i := 0; i < limit && offset+i < 1000; i++ { // Simulate max 1000 users
		users = append(users, UserForProcessing{
			UserID:         fmt.Sprintf("user_%d", offset+i+1),
			LastMontageGen: time.Now().Add(-25 * time.Hour), // Needs update
			CheckinCount:   10 + i%20,                       // Varying check-in counts
		})
	}
	
	return users, nil
}

// processBatchOfUsers processes a batch of users concurrently
func (bp *BatchProcessor) processBatchOfUsers(ctx context.Context, users []UserForProcessing) *BatchResult {
	result := &BatchResult{
		Errors: make([]string, 0),
	}
	
	// Use WaitGroup to wait for all goroutines
	var wg sync.WaitGroup
	var mu sync.Mutex // Protect result updates
	
	for _, user := range users {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return result
		default:
		}
		
		// Acquire semaphore (blocks if max concurrency reached)
		bp.semaphore <- struct{}{}
		
		wg.Add(1)
		go func(u UserForProcessing) {
			defer wg.Done()
			defer func() { <-bp.semaphore }() // Release semaphore
			
			// Process individual user with timeout
			userCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			
			userResult := bp.processUser(userCtx, u)
			
			// Update aggregate results (thread-safe)
			mu.Lock()
			defer mu.Unlock()
			
			result.ProcessedCount++
			if userResult.Success {
				result.SuccessCount++
				result.GeneralMontages += userResult.GeneralMontages
				result.InterestMontages += userResult.InterestMontages
			} else {
				result.ErrorCount++
				result.Errors = append(result.Errors, 
					fmt.Sprintf("User %s: %s", u.UserID, userResult.Error))
			}
		}(user)
	}
	
	// Wait for all users to be processed
	wg.Wait()
	
	return result
}

// processUser processes montage generation for a single user
func (bp *BatchProcessor) processUser(ctx context.Context, user UserForProcessing) *UserProcessingResult {
	bp.logger.Printf("Processing montages for user %s", user.UserID)
	
	result := &UserProcessingResult{
		UserID: user.UserID,
	}
	
	// Fetch recent check-ins for this user
	checkins, err := bp.config.CheckinClient.GetUserCheckinsFromDate(
		ctx, 
		user.UserID, 
		time.Now().Add(-30*24*time.Hour), // Last 30 days
		100, // Reasonable limit
	)
	if err != nil {
		result.Error = fmt.Sprintf("failed to fetch check-ins: %v", err)
		return result
	}
	
	if len(checkins) == 0 {
		bp.logger.Printf("User %s has no recent check-ins, skipping", user.UserID)
		result.Success = true // Not an error, just nothing to process
		return result
	}
	
	// Generate general montage
	generalMontage, err := bp.config.MontageService.GenerateMontage(
		ctx,
		user.UserID,
		montage.MontageTypeGeneral,
		nil, // No interest filter
	)
	if err != nil {
		result.Error = fmt.Sprintf("failed to generate general montage: %v", err)
		return result
	}
	if generalMontage != nil {
		result.GeneralMontages = 1
	}
	
	// Generate interest-based montages
	interests := bp.extractInterests(checkins)
	for _, interest := range interests {
		// Only generate interest montage if there are enough occurrences
		if bp.shouldGenerateInterestMontage(checkins, interest) {
			interestMontage, err := bp.config.MontageService.GenerateMontage(
				ctx,
				user.UserID,
				montage.MontageTypeInterest,
				&interest,
			)
			if err != nil {
				bp.logger.Printf("Failed to generate interest montage for %s/%s: %v", 
					user.UserID, interest, err)
				// Don't fail the entire user for interest montage errors
				continue
			}
			if interestMontage != nil {
				result.InterestMontages++
			}
		}
	}
	
	result.Success = true
	bp.logger.Printf("Successfully processed user %s: %d general, %d interest montages", 
		user.UserID, result.GeneralMontages, result.InterestMontages)
	
	return result
}

// extractInterests extracts unique interests/tags from check-ins
func (bp *BatchProcessor) extractInterests(checkins []montage.CheckinData) []string {
	interestMap := make(map[string]int)
	
	for _, checkin := range checkins {
		for _, tag := range checkin.Tags {
			interestMap[tag]++
		}
	}
	
	// Return interests that appear frequently enough
	interests := make([]string, 0)
	for interest, count := range interestMap {
		if count >= 3 { // Minimum threshold
			interests = append(interests, interest)
		}
	}
	
	return interests
}

// shouldGenerateInterestMontage determines if an interest montage should be generated
func (bp *BatchProcessor) shouldGenerateInterestMontage(checkins []montage.CheckinData, interest string) bool {
	count := 0
	recentCount := 0
	thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour)
	
	for _, checkin := range checkins {
		for _, tag := range checkin.Tags {
			if tag == interest {
				count++
				if checkin.CreatedAt.After(thirtyDaysAgo) {
					recentCount++
				}
			}
		}
	}
	
	// Generate if there are at least 3 occurrences and at least 1 recent
	return count >= 3 && recentCount >= 1
}

// UserForProcessing represents a user that needs montage processing
type UserForProcessing struct {
	UserID         string
	LastMontageGen time.Time
	CheckinCount   int
}

// UserProcessingResult contains the result of processing a single user
type UserProcessingResult struct {
	UserID           string
	Success          bool
	Error            string
	GeneralMontages  int
	InterestMontages int
}
