package backup

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
)

// Scheduler handles automated backup scheduling
type Scheduler struct {
	backupManager *BackupManager
	cron          *cron.Cron
	logger        Logger
	config        *SchedulerConfig
	mu            sync.RWMutex
	jobs          map[string]cron.EntryID
	running       bool
}

// SchedulerConfig holds scheduler configuration
type SchedulerConfig struct {
	// Backup schedules
	FullBackupSchedule    string        // Cron expression for full backups
	IncrementalSchedule   string        // Cron expression for incremental backups
	CleanupSchedule       string        // Cron expression for cleanup
	
	// Backup settings
	MaxConcurrentBackups  int           // Maximum concurrent backup operations
	BackupTimeout         time.Duration // Timeout for backup operations
	RetryAttempts         int           // Number of retry attempts on failure
	RetryDelay            time.Duration // Delay between retry attempts
	
	// Health checks
	HealthCheckInterval   time.Duration // Interval for health checks
	AlertOnFailure        bool          // Send alerts on backup failures
	
	// Retention policies
	FullBackupRetention   time.Duration // How long to keep full backups
	IncrementalRetention  time.Duration // How long to keep incremental backups
}

// NewScheduler creates a new backup scheduler
func NewScheduler(backupManager *BackupManager, config *SchedulerConfig, logger Logger) *Scheduler {
	return &Scheduler{
		backupManager: backupManager,
		logger:        logger,
		config:        config,
		jobs:          make(map[string]cron.EntryID),
		cron:          cron.New(cron.WithSeconds()),
	}
}

// GetDefaultSchedulerConfig returns production-ready scheduler configuration
func GetDefaultSchedulerConfig() *SchedulerConfig {
	return &SchedulerConfig{
		FullBackupSchedule:    "0 0 2 * * *",      // Daily at 2 AM
		IncrementalSchedule:   "0 0 */6 * * *",    // Every 6 hours
		CleanupSchedule:       "0 0 4 * * 0",      // Weekly at 4 AM on Sunday
		
		MaxConcurrentBackups:  2,
		BackupTimeout:         2 * time.Hour,
		RetryAttempts:         3,
		RetryDelay:            5 * time.Minute,
		
		HealthCheckInterval:   1 * time.Hour,
		AlertOnFailure:        true,
		
		FullBackupRetention:   30 * 24 * time.Hour, // 30 days
		IncrementalRetention:  7 * 24 * time.Hour,  // 7 days
	}
}

// Start starts the backup scheduler
func (s *Scheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.running {
		return fmt.Errorf("scheduler is already running")
	}
	
	s.logger.Info("Starting backup scheduler")
	
	// Schedule full backups
	if s.config.FullBackupSchedule != "" {
		entryID, err := s.cron.AddFunc(s.config.FullBackupSchedule, s.executeFullBackup)
		if err != nil {
			return fmt.Errorf("failed to schedule full backup: %w", err)
		}
		s.jobs["full_backup"] = entryID
		s.logger.Info(fmt.Sprintf("Scheduled full backups: %s", s.config.FullBackupSchedule))
	}
	
	// Schedule incremental backups
	if s.config.IncrementalSchedule != "" {
		entryID, err := s.cron.AddFunc(s.config.IncrementalSchedule, s.executeIncrementalBackup)
		if err != nil {
			return fmt.Errorf("failed to schedule incremental backup: %w", err)
		}
		s.jobs["incremental_backup"] = entryID
		s.logger.Info(fmt.Sprintf("Scheduled incremental backups: %s", s.config.IncrementalSchedule))
	}
	
	// Schedule cleanup
	if s.config.CleanupSchedule != "" {
		entryID, err := s.cron.AddFunc(s.config.CleanupSchedule, s.executeCleanup)
		if err != nil {
			return fmt.Errorf("failed to schedule cleanup: %w", err)
		}
		s.jobs["cleanup"] = entryID
		s.logger.Info(fmt.Sprintf("Scheduled cleanup: %s", s.config.CleanupSchedule))
	}
	
	// Schedule health checks
	if s.config.HealthCheckInterval > 0 {
		entryID, err := s.cron.AddFunc(fmt.Sprintf("@every %s", s.config.HealthCheckInterval), s.executeHealthCheck)
		if err != nil {
			return fmt.Errorf("failed to schedule health check: %w", err)
		}
		s.jobs["health_check"] = entryID
		s.logger.Info(fmt.Sprintf("Scheduled health checks every %v", s.config.HealthCheckInterval))
	}
	
	// Start the cron scheduler
	s.cron.Start()
	s.running = true
	
	s.logger.Info("Backup scheduler started successfully")
	return nil
}

// Stop stops the backup scheduler
func (s *Scheduler) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if !s.running {
		return fmt.Errorf("scheduler is not running")
	}
	
	s.logger.Info("Stopping backup scheduler")
	
	// Stop the cron scheduler
	ctx := s.cron.Stop()
	<-ctx.Done() // Wait for running jobs to complete
	
	// Clear job entries
	s.jobs = make(map[string]cron.EntryID)
	s.running = false
	
	s.logger.Info("Backup scheduler stopped")
	return nil
}

// IsRunning returns whether the scheduler is currently running
func (s *Scheduler) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// GetScheduledJobs returns information about scheduled jobs
func (s *Scheduler) GetScheduledJobs() map[string]JobInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	jobs := make(map[string]JobInfo)
	
	for name, entryID := range s.jobs {
		entry := s.cron.Entry(entryID)
		jobs[name] = JobInfo{
			Name:     name,
			Schedule: entry.Schedule.Next(time.Now()).Format(time.RFC3339),
			Next:     entry.Next,
			Prev:     entry.Prev,
		}
	}
	
	return jobs
}

// JobInfo contains information about a scheduled job
type JobInfo struct {
	Name     string
	Schedule string
	Next     time.Time
	Prev     time.Time
}

// executeFullBackup performs a full database backup
func (s *Scheduler) executeFullBackup() {
	s.logger.Info("Starting scheduled full backup")
	
	ctx, cancel := context.WithTimeout(context.Background(), s.config.BackupTimeout)
	defer cancel()
	
	// Execute backup with retries
	var lastErr error
	for attempt := 1; attempt <= s.config.RetryAttempts; attempt++ {
		result, err := s.backupManager.CreateBackup(ctx)
		if err == nil {
			s.logger.Info(fmt.Sprintf("Full backup completed successfully: %s", result.BackupID))
			return
		}
		
		lastErr = err
		s.logger.Error(fmt.Sprintf("Full backup attempt %d failed", attempt), err)
		
		if attempt < s.config.RetryAttempts {
			s.logger.Info(fmt.Sprintf("Retrying in %v", s.config.RetryDelay))
			time.Sleep(s.config.RetryDelay)
		}
	}
	
	// Send failure alert
	if s.config.AlertOnFailure {
		s.sendBackupAlert("Full backup failed after all retry attempts", lastErr)
	}
}

// executeIncrementalBackup performs an incremental database backup
func (s *Scheduler) executeIncrementalBackup() {
	s.logger.Info("Starting scheduled incremental backup")
	
	// For PostgreSQL, incremental backups typically require WAL archiving
	// This is a simplified implementation - production should use proper incremental backup tools
	ctx, cancel := context.WithTimeout(context.Background(), s.config.BackupTimeout)
	defer cancel()
	
	// Execute backup with retries (for now, same as full backup)
	var lastErr error
	for attempt := 1; attempt <= s.config.RetryAttempts; attempt++ {
		result, err := s.backupManager.CreateBackup(ctx)
		if err == nil {
			s.logger.Info(fmt.Sprintf("Incremental backup completed successfully: %s", result.BackupID))
			return
		}
		
		lastErr = err
		s.logger.Error(fmt.Sprintf("Incremental backup attempt %d failed", attempt), err)
		
		if attempt < s.config.RetryAttempts {
			s.logger.Info(fmt.Sprintf("Retrying in %v", s.config.RetryDelay))
			time.Sleep(s.config.RetryDelay)
		}
	}
	
	// Send failure alert
	if s.config.AlertOnFailure {
		s.sendBackupAlert("Incremental backup failed after all retry attempts", lastErr)
	}
}

// executeCleanup performs cleanup of old backups
func (s *Scheduler) executeCleanup() {
	s.logger.Info("Starting scheduled backup cleanup")
	
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	
	if err := s.backupManager.CleanupOldBackups(ctx); err != nil {
		s.logger.Error("Backup cleanup failed", err)
		if s.config.AlertOnFailure {
			s.sendBackupAlert("Backup cleanup failed", err)
		}
	} else {
		s.logger.Info("Backup cleanup completed successfully")
	}
}

// executeHealthCheck performs backup system health checks
func (s *Scheduler) executeHealthCheck() {
	s.logger.Info("Performing backup system health check")
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	
	// Check database connectivity
	if err := s.checkDatabaseHealth(ctx); err != nil {
		s.logger.Error("Database health check failed", err)
		if s.config.AlertOnFailure {
			s.sendBackupAlert("Database health check failed", err)
		}
		return
	}
	
	// Check storage connectivity
	if err := s.checkStorageHealth(ctx); err != nil {
		s.logger.Error("Storage health check failed", err)
		if s.config.AlertOnFailure {
			s.sendBackupAlert("Storage health check failed", err)
		}
		return
	}
	
	// Check recent backup status
	if err := s.checkRecentBackups(ctx); err != nil {
		s.logger.Warn("Recent backup check failed: " + err.Error())
		// Don't alert for this as it's informational
	}
	
	s.logger.Info("Backup system health check completed successfully")
}

// checkDatabaseHealth verifies database connectivity
func (s *Scheduler) checkDatabaseHealth(ctx context.Context) error {
	// TODO: Implement database health check
	// This could involve connecting to the database and running a simple query
	return nil
}

// checkStorageHealth verifies storage connectivity
func (s *Scheduler) checkStorageHealth(ctx context.Context) error {
	// TODO: Implement storage health check
	// This could involve listing objects in the backup storage location
	return nil
}

// checkRecentBackups checks if recent backups exist and are valid
func (s *Scheduler) checkRecentBackups(ctx context.Context) error {
	backups, err := s.backupManager.ListBackups(ctx)
	if err != nil {
		return fmt.Errorf("failed to list backups: %w", err)
	}
	
	if len(backups) == 0 {
		return fmt.Errorf("no backups found")
	}
	
	// Check if we have a recent backup (within last 48 hours)
	cutoff := time.Now().Add(-48 * time.Hour)
	hasRecentBackup := false
	
	for _, backup := range backups {
		if backup.LastModified.After(cutoff) {
			hasRecentBackup = true
			break
		}
	}
	
	if !hasRecentBackup {
		return fmt.Errorf("no recent backups found (within last 48 hours)")
	}
	
	return nil
}

// sendBackupAlert sends an alert notification
func (s *Scheduler) sendBackupAlert(message string, err error) {
	fullMessage := message
	if err != nil {
		fullMessage = fmt.Sprintf("%s: %v", message, err)
	}
	
	s.logger.Error("BACKUP ALERT: "+fullMessage, err)
	
	// TODO: Implement actual alerting (Slack, email, PagerDuty, etc.)
	// For now, just log the alert
}

// TriggerBackup manually triggers a backup operation
func (s *Scheduler) TriggerBackup(ctx context.Context, backupType string) error {
	switch backupType {
	case "full":
		go s.executeFullBackup()
		return nil
	case "incremental":
		go s.executeIncrementalBackup()
		return nil
	case "cleanup":
		go s.executeCleanup()
		return nil
	default:
		return fmt.Errorf("unknown backup type: %s", backupType)
	}
}