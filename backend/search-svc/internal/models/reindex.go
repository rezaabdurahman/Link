package models

import (
	"time"

	"github.com/google/uuid"
)

// ReindexJobStatus represents the status of a reindex job
type ReindexJobStatus string

const (
	ReindexStatusQueued     ReindexJobStatus = "queued"
	ReindexStatusInProgress ReindexJobStatus = "in_progress"
	ReindexStatusCompleted  ReindexJobStatus = "completed"
	ReindexStatusFailed     ReindexJobStatus = "failed"
)

// ReindexJob represents a reindexing job
type ReindexJob struct {
	ID                  uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Status              ReindexJobStatus `json:"status" gorm:"type:varchar(20);not null;default:'queued'"`
	UsersTotal          int              `json:"users_total" gorm:"type:int;not null;default:0"`
	UsersProcessed      int              `json:"users_processed" gorm:"type:int;not null;default:0"`
	UsersFailed         int              `json:"users_failed" gorm:"type:int;not null;default:0"`
	Force               bool             `json:"force" gorm:"type:boolean;not null;default:false"`
	SpecificUserIDs     []uuid.UUID      `json:"specific_user_ids" gorm:"type:uuid[];null"`      // NULL for full reindex
	EstimatedCompletion *time.Time       `json:"estimated_completion" gorm:"type:timestamptz;null"`
	StartedAt           *time.Time       `json:"started_at" gorm:"type:timestamptz;null"`
	CompletedAt         *time.Time       `json:"completed_at" gorm:"type:timestamptz;null"`
	ErrorMessage        *string          `json:"error_message" gorm:"type:text;null"`
	CreatedAt           time.Time        `json:"created_at" gorm:"type:timestamptz;not null;default:now()"`
	UpdatedAt           time.Time        `json:"updated_at" gorm:"type:timestamptz;not null;default:now()"`
}

// ReindexJobItem represents individual users to be reindexed in a job
type ReindexJobItem struct {
	ID          uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	JobID       uuid.UUID        `json:"job_id" gorm:"type:uuid;not null"`
	Job         ReindexJob       `json:"job" gorm:"foreignKey:JobID"`
	UserID      uuid.UUID        `json:"user_id" gorm:"type:uuid;not null"`
	Status      ReindexJobStatus `json:"status" gorm:"type:varchar(20);not null;default:'queued'"`
	ErrorMessage *string         `json:"error_message" gorm:"type:text;null"`
	ProcessedAt *time.Time       `json:"processed_at" gorm:"type:timestamptz;null"`
	CreatedAt   time.Time        `json:"created_at" gorm:"type:timestamptz;not null;default:now()"`
	UpdatedAt   time.Time        `json:"updated_at" gorm:"type:timestamptz;not null;default:now()"`
}

// TableName returns the table name for ReindexJob
func (ReindexJob) TableName() string {
	return "reindex_jobs"
}

// TableName returns the table name for ReindexJobItem
func (ReindexJobItem) TableName() string {
	return "reindex_job_items"
}

// IsCompleted returns true if the job is in a completed state (success or failure)
func (j *ReindexJob) IsCompleted() bool {
	return j.Status == ReindexStatusCompleted || j.Status == ReindexStatusFailed
}

// IsRunning returns true if the job is currently processing
func (j *ReindexJob) IsRunning() bool {
	return j.Status == ReindexStatusInProgress
}
