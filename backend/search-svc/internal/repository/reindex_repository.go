package repository

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/link-app/search-svc/internal/models"
)

// ReindexRepository handles database operations for reindexing jobs
type ReindexRepository interface {
	// Job management
	CreateReindexJob(ctx context.Context, userIDs []uuid.UUID, force bool) (*models.ReindexJob, error)
	GetReindexJob(ctx context.Context, jobID uuid.UUID) (*models.ReindexJob, error)
	UpdateJobStatus(ctx context.Context, jobID uuid.UUID, status models.ReindexJobStatus, errorMsg *string) error
	UpdateJobProgress(ctx context.Context, jobID uuid.UUID, processed, failed int) error
	SetJobStarted(ctx context.Context, jobID uuid.UUID) error
	SetJobCompleted(ctx context.Context, jobID uuid.UUID) error
	SetJobFailed(ctx context.Context, jobID uuid.UUID, errorMsg string) error
	
	// Job item management
	CreateJobItems(ctx context.Context, jobID uuid.UUID, userIDs []uuid.UUID) error
	GetPendingJobItems(ctx context.Context, jobID uuid.UUID, limit int) ([]models.ReindexJobItem, error)
	UpdateJobItemStatus(ctx context.Context, itemID uuid.UUID, status models.ReindexJobStatus, errorMsg *string) error
	GetJobItemsCount(ctx context.Context, jobID uuid.UUID, status *models.ReindexJobStatus) (int, error)
	
	// Job cleanup
	CleanupOldJobs(ctx context.Context, olderThan time.Duration) error
	GetRunningJobs(ctx context.Context) ([]models.ReindexJob, error)
}

type reindexRepository struct {
	db *gorm.DB
}

// NewReindexRepository creates a new reindex repository
func NewReindexRepository(db *gorm.DB) ReindexRepository {
	repo := &reindexRepository{db: db}
	
	// Ensure tables exist
	if err := repo.autoMigrate(); err != nil {
		log.Printf("Warning: Failed to auto-migrate reindex tables: %v", err)
	}
	
	return repo
}

// autoMigrate creates the necessary tables
func (r *reindexRepository) autoMigrate() error {
	return r.db.AutoMigrate(
		&models.ReindexJob{},
		&models.ReindexJobItem{},
	)
}

// CreateReindexJob creates a new reindex job
func (r *reindexRepository) CreateReindexJob(ctx context.Context, userIDs []uuid.UUID, force bool) (*models.ReindexJob, error) {
	now := time.Now()
	estimatedCompletion := now.Add(time.Duration(len(userIDs)) * 200 * time.Millisecond) // Rough estimate: 200ms per user
	
	job := models.ReindexJob{
		Status:              models.ReindexStatusQueued,
		UsersTotal:          len(userIDs),
		Force:               force,
		EstimatedCompletion: &estimatedCompletion,
	}
	
	// Set specific user IDs if it's a partial reindex
	if len(userIDs) > 0 {
		job.SpecificUserIDs = userIDs
	}

	result := r.db.WithContext(ctx).Create(&job)
	if result.Error != nil {
		return nil, result.Error
	}
	
	// Create job items if user IDs were provided
	if len(userIDs) > 0 {
		if err := r.CreateJobItems(ctx, job.ID, userIDs); err != nil {
			return nil, err
		}
	}
	
	return &job, nil
}

// GetReindexJob retrieves a reindex job by ID
func (r *reindexRepository) GetReindexJob(ctx context.Context, jobID uuid.UUID) (*models.ReindexJob, error) {
	var job models.ReindexJob
	result := r.db.WithContext(ctx).Where("id = ?", jobID).First(&job)
	
	if result.Error != nil {
		return nil, result.Error
	}
	
	return &job, nil
}

// UpdateJobStatus updates the status of a reindex job
func (r *reindexRepository) UpdateJobStatus(ctx context.Context, jobID uuid.UUID, status models.ReindexJobStatus, errorMsg *string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	
	if errorMsg != nil {
		updates["error_message"] = *errorMsg
	}

	result := r.db.WithContext(ctx).Model(&models.ReindexJob{}).Where("id = ?", jobID).Updates(updates)
	return result.Error
}

// UpdateJobProgress updates the progress counters of a reindex job
func (r *reindexRepository) UpdateJobProgress(ctx context.Context, jobID uuid.UUID, processed, failed int) error {
	updates := map[string]interface{}{
		"users_processed": processed,
		"users_failed":    failed,
	}

	result := r.db.WithContext(ctx).Model(&models.ReindexJob{}).Where("id = ?", jobID).Updates(updates)
	return result.Error
}

// SetJobStarted marks a job as started
func (r *reindexRepository) SetJobStarted(ctx context.Context, jobID uuid.UUID) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":     models.ReindexStatusInProgress,
		"started_at": now,
	}

	result := r.db.WithContext(ctx).Model(&models.ReindexJob{}).Where("id = ?", jobID).Updates(updates)
	return result.Error
}

// SetJobCompleted marks a job as completed
func (r *reindexRepository) SetJobCompleted(ctx context.Context, jobID uuid.UUID) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":       models.ReindexStatusCompleted,
		"completed_at": now,
	}

	result := r.db.WithContext(ctx).Model(&models.ReindexJob{}).Where("id = ?", jobID).Updates(updates)
	return result.Error
}

// SetJobFailed marks a job as failed
func (r *reindexRepository) SetJobFailed(ctx context.Context, jobID uuid.UUID, errorMsg string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":        models.ReindexStatusFailed,
		"completed_at":  now,
		"error_message": errorMsg,
	}

	result := r.db.WithContext(ctx).Model(&models.ReindexJob{}).Where("id = ?", jobID).Updates(updates)
	return result.Error
}

// CreateJobItems creates job items for a reindex job
func (r *reindexRepository) CreateJobItems(ctx context.Context, jobID uuid.UUID, userIDs []uuid.UUID) error {
	items := make([]models.ReindexJobItem, len(userIDs))
	
	for i, userID := range userIDs {
		items[i] = models.ReindexJobItem{
			JobID:  jobID,
			UserID: userID,
			Status: models.ReindexStatusQueued,
		}
	}

	result := r.db.WithContext(ctx).Create(&items)
	return result.Error
}

// GetPendingJobItems retrieves pending job items for processing
func (r *reindexRepository) GetPendingJobItems(ctx context.Context, jobID uuid.UUID, limit int) ([]models.ReindexJobItem, error) {
	var items []models.ReindexJobItem
	
	result := r.db.WithContext(ctx).
		Where("job_id = ? AND status = ?", jobID, models.ReindexStatusQueued).
		Limit(limit).
		Find(&items)
	
	if result.Error != nil {
		return nil, result.Error
	}
	
	return items, nil
}

// UpdateJobItemStatus updates the status of a job item
func (r *reindexRepository) UpdateJobItemStatus(ctx context.Context, itemID uuid.UUID, status models.ReindexJobStatus, errorMsg *string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":       status,
		"processed_at": now,
	}
	
	if errorMsg != nil {
		updates["error_message"] = *errorMsg
	}

	result := r.db.WithContext(ctx).Model(&models.ReindexJobItem{}).Where("id = ?", itemID).Updates(updates)
	return result.Error
}

// GetJobItemsCount returns the count of job items with a specific status
func (r *reindexRepository) GetJobItemsCount(ctx context.Context, jobID uuid.UUID, status *models.ReindexJobStatus) (int, error) {
	query := r.db.WithContext(ctx).Model(&models.ReindexJobItem{}).Where("job_id = ?", jobID)
	
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	
	var count int64
	err := query.Count(&count).Error
	return int(count), err
}

// CleanupOldJobs removes completed jobs older than the specified duration
func (r *reindexRepository) CleanupOldJobs(ctx context.Context, olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	
	// First delete job items
	result := r.db.WithContext(ctx).
		Where("job_id IN (SELECT id FROM reindex_jobs WHERE completed_at < ? AND (status = ? OR status = ?))", 
			cutoff, models.ReindexStatusCompleted, models.ReindexStatusFailed).
		Delete(&models.ReindexJobItem{})
	
	if result.Error != nil {
		return result.Error
	}
	
	// Then delete the jobs
	result = r.db.WithContext(ctx).
		Where("completed_at < ? AND (status = ? OR status = ?)", 
			cutoff, models.ReindexStatusCompleted, models.ReindexStatusFailed).
		Delete(&models.ReindexJob{})
	
	return result.Error
}

// GetRunningJobs returns all jobs that are currently running
func (r *reindexRepository) GetRunningJobs(ctx context.Context) ([]models.ReindexJob, error) {
	var jobs []models.ReindexJob
	
	result := r.db.WithContext(ctx).
		Where("status = ? OR status = ?", models.ReindexStatusQueued, models.ReindexStatusInProgress).
		Order("created_at ASC").
		Find(&jobs)
	
	if result.Error != nil {
		return nil, result.Error
	}
	
	return jobs, nil
}
