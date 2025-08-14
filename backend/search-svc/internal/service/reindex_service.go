package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/config"
	"github.com/link-app/search-svc/internal/dto"
	"github.com/link-app/search-svc/internal/models"
	"github.com/link-app/search-svc/internal/repository"
)

// ReindexService handles reindexing business logic
type ReindexService interface {
	// Job management
	CreateReindexJob(ctx context.Context, req *dto.ReindexRequest) (*dto.ReindexResponse, error)
	GetReindexStatus(ctx context.Context, jobID uuid.UUID) (*dto.ReindexStatusResponse, error)
	
	// Background worker
	StartWorker()
	StopWorker()
}

type reindexService struct {
	reindexRepo       repository.ReindexRepository
	searchRepo        repository.SearchRepository
	embeddingProvider config.EmbeddingProvider
	workerCtx         context.Context
	workerCancel      context.CancelFunc
	workerWg          sync.WaitGroup
}

// NewReindexService creates a new reindex service
func NewReindexService(reindexRepo repository.ReindexRepository, searchRepo repository.SearchRepository, embeddingProvider config.EmbeddingProvider) ReindexService {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &reindexService{
		reindexRepo:       reindexRepo,
		searchRepo:        searchRepo,
		embeddingProvider: embeddingProvider,
		workerCtx:         ctx,
		workerCancel:      cancel,
	}
}

// CreateReindexJob creates a new reindexing job
func (s *reindexService) CreateReindexJob(ctx context.Context, req *dto.ReindexRequest) (*dto.ReindexResponse, error) {
	force := false
	if req.Force != nil {
		force = *req.Force
	}
	
	var userIDs []uuid.UUID
	
	// If specific user IDs are provided, use them
	if len(req.UserIDs) > 0 {
		userIDs = req.UserIDs
	} else {
		// Full reindex - get all existing user IDs
		var err error
		userIDs, err = s.searchRepo.GetAllUserIDs(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get user IDs for full reindex: %w", err)
		}
		
		// For demonstration, limit full reindex to prevent overwhelming the system
		// In production, you might want to implement proper chunking
		if len(userIDs) > 10000 {
			userIDs = userIDs[:10000]
		}
	}
	
	// Create the reindex job
	job, err := s.reindexRepo.CreateReindexJob(ctx, userIDs, force)
	if err != nil {
		return nil, fmt.Errorf("failed to create reindex job: %w", err)
	}
	
	// Format response
	response := &dto.ReindexResponse{
		JobID:       job.ID,
		Status:      string(job.Status),
		UsersQueued: len(userIDs),
	}
	
	if job.EstimatedCompletion != nil {
		response.EstimatedCompletion = job.EstimatedCompletion.Format(time.RFC3339)
	}
	
	return response, nil
}

// GetReindexStatus returns the status of a reindex job
func (s *reindexService) GetReindexStatus(ctx context.Context, jobID uuid.UUID) (*dto.ReindexStatusResponse, error) {
	job, err := s.reindexRepo.GetReindexJob(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("failed to get reindex job: %w", err)
	}
	
	response := &dto.ReindexStatusResponse{
		JobID:          job.ID,
		Status:         string(job.Status),
		UsersTotal:     job.UsersTotal,
		UsersProcessed: job.UsersProcessed,
		UsersFailed:    job.UsersFailed,
	}
	
	if job.StartedAt != nil {
		startedAt := job.StartedAt.Format(time.RFC3339)
		response.StartedAt = &startedAt
	}
	
	if job.CompletedAt != nil {
		completedAt := job.CompletedAt.Format(time.RFC3339)
		response.CompletedAt = &completedAt
	}
	
	if job.ErrorMessage != nil {
		response.ErrorMessage = job.ErrorMessage
	}
	
	return response, nil
}

// StartWorker starts the background worker for processing reindex jobs
func (s *reindexService) StartWorker() {
	s.workerWg.Add(1)
	
	go func() {
		defer s.workerWg.Done()
		log.Println("Reindex worker started")
		
		ticker := time.NewTicker(10 * time.Second) // Check for jobs every 10 seconds
		defer ticker.Stop()
		
		for {
			select {
			case <-s.workerCtx.Done():
				log.Println("Reindex worker stopped")
				return
			case <-ticker.C:
				s.processJobs()
			}
		}
	}()
}

// StopWorker stops the background worker
func (s *reindexService) StopWorker() {
	if s.workerCancel != nil {
		s.workerCancel()
	}
	s.workerWg.Wait()
}

// processJobs processes pending reindex jobs
func (s *reindexService) processJobs() {
	ctx := context.Background()
	
	// Get running jobs
	jobs, err := s.reindexRepo.GetRunningJobs(ctx)
	if err != nil {
		log.Printf("Error getting running jobs: %v", err)
		return
	}
	
	for _, job := range jobs {
		if job.Status == models.ReindexStatusQueued {
			// Start processing the job
			s.processJob(ctx, job.ID)
		} else if job.Status == models.ReindexStatusInProgress {
			// Continue processing if not already completed
			if !job.IsCompleted() {
				s.continueProcessingJob(ctx, job.ID)
			}
		}
	}
	
	// Cleanup old completed jobs (older than 7 days)
	if err := s.reindexRepo.CleanupOldJobs(ctx, 7*24*time.Hour); err != nil {
		log.Printf("Error cleaning up old jobs: %v", err)
	}
}

// processJob starts processing a queued job
func (s *reindexService) processJob(ctx context.Context, jobID uuid.UUID) {
	// Mark job as started
	if err := s.reindexRepo.SetJobStarted(ctx, jobID); err != nil {
		log.Printf("Error starting job %s: %v", jobID, err)
		return
	}
	
	log.Printf("Started processing reindex job: %s", jobID)
	s.continueProcessingJob(ctx, jobID)
}

// continueProcessingJob processes job items in batches
func (s *reindexService) continueProcessingJob(ctx context.Context, jobID uuid.UUID) {
	batchSize := 10 // Process 10 users at a time to avoid overwhelming the embedding API
	
	// Get pending job items
	items, err := s.reindexRepo.GetPendingJobItems(ctx, jobID, batchSize)
	if err != nil {
		log.Printf("Error getting pending items for job %s: %v", jobID, err)
		s.reindexRepo.SetJobFailed(ctx, jobID, fmt.Sprintf("Failed to get pending items: %v", err))
		return
	}
	
	if len(items) == 0 {
		// Job is complete, update status
		s.completeJob(ctx, jobID)
		return
	}
	
	// Process each item
	var processed, failed int
	
	for _, item := range items {
		if err := s.processJobItem(ctx, item); err != nil {
			log.Printf("Error processing item %s for user %s: %v", item.ID, item.UserID, err)
			failed++
			
			// Mark item as failed
			errorMsg := err.Error()
			s.reindexRepo.UpdateJobItemStatus(ctx, item.ID, models.ReindexStatusFailed, &errorMsg)
		} else {
			processed++
			
			// Mark item as completed
			s.reindexRepo.UpdateJobItemStatus(ctx, item.ID, models.ReindexStatusCompleted, nil)
		}
	}
	
	// Update job progress
	job, err := s.reindexRepo.GetReindexJob(ctx, jobID)
	if err != nil {
		log.Printf("Error getting job %s for progress update: %v", jobID, err)
		return
	}
	
	newProcessed := job.UsersProcessed + processed
	newFailed := job.UsersFailed + failed
	
	if err := s.reindexRepo.UpdateJobProgress(ctx, jobID, newProcessed, newFailed); err != nil {
		log.Printf("Error updating progress for job %s: %v", jobID, err)
	}
	
	log.Printf("Job %s progress: %d processed, %d failed", jobID, newProcessed, newFailed)
}

// processJobItem processes a single user reindex item
func (s *reindexService) processJobItem(ctx context.Context, item models.ReindexJobItem) error {
	// For this demo, we'll simulate fetching user profile data
	// In a real implementation, this would call the user service or database
	profileText := s.fetchUserProfileText(ctx, item.UserID)
	
	if profileText == "" {
		return fmt.Errorf("no profile text found for user %s", item.UserID)
	}
	
	// Generate embedding
	embedding, err := s.embeddingProvider.GenerateEmbedding(ctx, profileText)
	if err != nil {
		return fmt.Errorf("failed to generate embedding: %w", err)
	}
	
	provider := s.embeddingProvider.GetProviderName()
	model := "text-embedding-3-small" // Default model
	
	// Check if embedding already exists
	existing, err := s.searchRepo.GetUserEmbedding(ctx, item.UserID)
	if err != nil && err.Error() != "record not found" {
		return fmt.Errorf("failed to check existing embedding: %w", err)
	}
	
	// Only update if force is true or if embedding doesn't exist
	job, err := s.reindexRepo.GetReindexJob(ctx, item.JobID)
	if err != nil {
		return fmt.Errorf("failed to get job details: %w", err)
	}
	
	shouldUpdate := job.Force || existing == nil
	
	if shouldUpdate {
		if existing != nil {
			// Update existing
			err = s.searchRepo.UpdateUserEmbedding(ctx, item.UserID, embedding, profileText, provider, model)
		} else {
			// Create new
			err = s.searchRepo.StoreUserEmbedding(ctx, item.UserID, embedding, profileText, provider, model)
		}
		
		if err != nil {
			return fmt.Errorf("failed to store embedding: %w", err)
		}
	}
	
	return nil
}

// completeJob marks a job as completed and performs cleanup
func (s *reindexService) completeJob(ctx context.Context, jobID uuid.UUID) {
	if err := s.reindexRepo.SetJobCompleted(ctx, jobID); err != nil {
		log.Printf("Error marking job %s as completed: %v", jobID, err)
		return
	}
	
	log.Printf("Completed reindex job: %s", jobID)
}

// fetchUserProfileText simulates fetching user profile data
// In a real implementation, this would integrate with the user service
func (s *reindexService) fetchUserProfileText(ctx context.Context, userID uuid.UUID) string {
	// This is a mock implementation
	// In production, you would:
	// 1. Call the user service API to get profile data
	// 2. Extract relevant text fields (bio, skills, experience, etc.)
	// 3. Combine them into a searchable text format
	
	return fmt.Sprintf("Mock profile text for user %s with skills in software development, React, and Go programming", userID)
}
