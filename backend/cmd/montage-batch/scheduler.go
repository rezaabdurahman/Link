package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/link-app/user-svc/internal/montage"
)

// Scheduler handles periodic execution of batch jobs
type Scheduler struct {
	processor *BatchProcessor
	config    *montage.MontageConfig
	logger    *log.Logger
}

// NewScheduler creates a new scheduler instance
func NewScheduler(processor *BatchProcessor, config *montage.MontageConfig) *Scheduler {
	return &Scheduler{
		processor: processor,
		config:    config,
		logger:    log.New(log.Writer(), "[SCHEDULER] ", log.LstdFlags|log.Lshortfile),
	}
}

// Start starts the scheduler daemon
func (s *Scheduler) Start(ctx context.Context) error {
	s.logger.Println("Starting batch job scheduler...")
	
	// Parse schedule from configuration (default to 3 AM daily)
	schedule := s.getSchedule()
	s.logger.Printf("Configured schedule: %s", schedule.String())
	
	// Calculate next run time
	nextRun := s.calculateNextRun(schedule, time.Now())
	s.logger.Printf("Next batch job scheduled for: %s", nextRun.Format(time.RFC3339))
	
	// Main scheduler loop
	for {
		select {
		case <-ctx.Done():
			s.logger.Println("Scheduler shutdown requested")
			return ctx.Err()
			
		case <-time.After(time.Until(nextRun)):
			// Time to run the batch job
			s.logger.Println("Executing scheduled batch job...")
			
			jobID := fmt.Sprintf("scheduled_%d", time.Now().Unix())
			
			// Create context with timeout for the job
			jobCtx, cancel := context.WithTimeout(ctx, 45*time.Minute)
			
			// Execute batch job
			result, err := s.processor.ProcessBatch(jobCtx, jobID)
			cancel()
			
			if err != nil {
				s.logger.Printf("Scheduled batch job failed: %v", err)
			} else {
				s.logger.Printf("Scheduled batch job completed successfully")
				s.logJobResults(result)
			}
			
			// Calculate next run time
			nextRun = s.calculateNextRun(schedule, time.Now())
			s.logger.Printf("Next batch job scheduled for: %s", nextRun.Format(time.RFC3339))
		}
	}
}

// getSchedule returns the configured schedule
func (s *Scheduler) getSchedule() Schedule {
	// For now, use a simple daily schedule
	// In production, this could be configurable via environment variables
	return DailySchedule{
		Hour:   3, // 3 AM
		Minute: 0, // 0 minutes
	}
}

// calculateNextRun calculates the next run time based on the schedule
func (s *Scheduler) calculateNextRun(schedule Schedule, from time.Time) time.Time {
	return schedule.NextRun(from)
}

// logJobResults logs detailed results of a batch job
func (s *Scheduler) logJobResults(result *BatchResult) {
	s.logger.Printf("Job Results Summary:")
	s.logger.Printf("  Job ID: %s", result.JobID)
	s.logger.Printf("  Duration: %v", result.Duration)
	s.logger.Printf("  Users Processed: %d", result.ProcessedCount)
	s.logger.Printf("  Successful: %d", result.SuccessCount)
	s.logger.Printf("  Errors: %d", result.ErrorCount)
	s.logger.Printf("  General Montages: %d", result.GeneralMontages)
	s.logger.Printf("  Interest Montages: %d", result.InterestMontages)
	
	if result.ErrorCount > 0 && len(result.Errors) > 0 {
		s.logger.Printf("  First few errors:")
		for i, err := range result.Errors {
			if i >= 5 { // Limit error logging
				s.logger.Printf("    ... and %d more errors", len(result.Errors)-i)
				break
			}
			s.logger.Printf("    - %s", err)
		}
	}
}

// Schedule interface defines when batch jobs should run
type Schedule interface {
	NextRun(from time.Time) time.Time
	String() string
}

// DailySchedule runs at the same time every day
type DailySchedule struct {
	Hour   int // 0-23
	Minute int // 0-59
}

// NextRun calculates the next run time for a daily schedule
func (ds DailySchedule) NextRun(from time.Time) time.Time {
	// Get today's scheduled time
	today := time.Date(from.Year(), from.Month(), from.Day(), ds.Hour, ds.Minute, 0, 0, from.Location())
	
	// If today's time has already passed, schedule for tomorrow
	if today.Before(from) || today.Equal(from) {
		return today.Add(24 * time.Hour)
	}
	
	return today
}

func (ds DailySchedule) String() string {
	return fmt.Sprintf("Daily at %02d:%02d", ds.Hour, ds.Minute)
}

// CronSchedule uses cron-like expressions (future enhancement)
type CronSchedule struct {
	Expression string
}

func (cs CronSchedule) NextRun(from time.Time) time.Time {
	// TODO: Implement cron parsing
	// For now, fallback to daily at 3 AM
	daily := DailySchedule{Hour: 3, Minute: 0}
	return daily.NextRun(from)
}

func (cs CronSchedule) String() string {
	return fmt.Sprintf("Cron: %s", cs.Expression)
}

// IntervalSchedule runs at regular intervals
type IntervalSchedule struct {
	Interval time.Duration
	lastRun  time.Time
}

func (is IntervalSchedule) NextRun(from time.Time) time.Time {
	if is.lastRun.IsZero() {
		// First run - schedule immediately
		return from.Add(1 * time.Second)
	}
	
	return is.lastRun.Add(is.Interval)
}

func (is IntervalSchedule) String() string {
	return fmt.Sprintf("Every %v", is.Interval)
}

// TestSchedule runs immediately and then every minute (for testing)
type TestSchedule struct {
	runs int
}

func (ts *TestSchedule) NextRun(from time.Time) time.Time {
	ts.runs++
	if ts.runs == 1 {
		// First run immediately
		return from.Add(1 * time.Second)
	}
	
	// Subsequent runs every minute
	return from.Add(1 * time.Minute)
}

func (ts TestSchedule) String() string {
	return "Test schedule (every minute)"
}
