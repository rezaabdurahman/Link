package backup

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// RecoveryOptions holds database recovery configuration
type RecoveryOptions struct {
	BackupPath       string    // Path to backup file (local or storage URL)
	TargetDatabase   string    // Target database name (can be different from source)
	TargetTimestamp  *time.Time // Point-in-time recovery target
	SkipOwnership    bool      // Skip ownership restoration
	CreateDatabase   bool      // Create database if it doesn't exist
	DropExisting     bool      // Drop existing database before restore
	DataOnly         bool      // Restore data only, skip schema
	SchemaOnly       bool      // Restore schema only, skip data
	Verbose          bool      // Verbose output
	ParallelJobs     int       // Number of parallel jobs for restoration
}

// RecoveryResult contains recovery operation results
type RecoveryResult struct {
	RecoveryID       string
	SourceBackup     string
	TargetDatabase   string
	TablesRestored   int
	RecordsRestored  int64
	Duration         time.Duration
	Timestamp        time.Time
	Success          bool
	Error            error
	Warnings         []string
}

// RestoreFromBackup restores a database from backup
func (bm *BackupManager) RestoreFromBackup(ctx context.Context, options *RecoveryOptions) (*RecoveryResult, error) {
	startTime := time.Now()
	recoveryID := fmt.Sprintf("recovery_%s", startTime.Format("20060102_150405"))
	
	result := &RecoveryResult{
		RecoveryID:     recoveryID,
		SourceBackup:   options.BackupPath,
		TargetDatabase: options.TargetDatabase,
		Timestamp:      startTime,
	}

	bm.logger.Info(fmt.Sprintf("Starting database recovery: %s", recoveryID))

	// Download backup if it's from remote storage
	localBackupPath, err := bm.downloadBackupIfNeeded(ctx, options.BackupPath)
	if err != nil {
		result.Error = fmt.Errorf("failed to download backup: %w", err)
		return result, result.Error
	}
	defer func() {
		if localBackupPath != options.BackupPath {
			os.Remove(localBackupPath) // Clean up downloaded file
		}
	}()

	// Decrypt if backup is encrypted
	if strings.HasSuffix(localBackupPath, ".enc") {
		decryptedPath, err := bm.decryptFile(localBackupPath)
		if err != nil {
			result.Error = fmt.Errorf("failed to decrypt backup: %w", err)
			return result, result.Error
		}
		localBackupPath = decryptedPath
		defer os.Remove(decryptedPath)
	}

	// Decompress if backup is compressed
	if strings.HasSuffix(localBackupPath, ".gz") {
		decompressedPath, err := bm.decompressFile(localBackupPath)
		if err != nil {
			result.Error = fmt.Errorf("failed to decompress backup: %w", err)
			return result, result.Error
		}
		localBackupPath = decompressedPath
		defer os.Remove(decompressedPath)
	}

	// Create target database if requested
	if options.CreateDatabase {
		if err := bm.createDatabase(ctx, options.TargetDatabase); err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to create database: %v", err))
		}
	}

	// Drop existing database if requested
	if options.DropExisting {
		if err := bm.dropDatabase(ctx, options.TargetDatabase); err != nil {
			result.Error = fmt.Errorf("failed to drop existing database: %w", err)
			return result, result.Error
		}
		// Recreate after dropping
		if err := bm.createDatabase(ctx, options.TargetDatabase); err != nil {
			result.Error = fmt.Errorf("failed to recreate database after drop: %w", err)
			return result, result.Error
		}
	}

	// Execute pg_restore
	if err := bm.executePgRestore(ctx, localBackupPath, options); err != nil {
		result.Error = fmt.Errorf("pg_restore failed: %w", err)
		return result, result.Error
	}

	result.Duration = time.Since(startTime)
	result.Success = true
	bm.logger.Info(fmt.Sprintf("Database recovery completed: %s (duration: %v)", recoveryID, result.Duration))

	// Send recovery notification
	bm.sendRecoveryNotification(result)

	return result, nil
}

// downloadBackupIfNeeded downloads backup from remote storage if needed
func (bm *BackupManager) downloadBackupIfNeeded(ctx context.Context, backupPath string) (string, error) {
	// If it's already a local path, return as-is
	if !strings.HasPrefix(backupPath, "s3://") && !strings.HasPrefix(backupPath, "gs://") {
		return backupPath, nil
	}

	// Create temporary file for download
	tempDir := os.TempDir()
	filename := filepath.Base(backupPath)
	localPath := filepath.Join(tempDir, fmt.Sprintf("restore_%d_%s", time.Now().Unix(), filename))

	var cmd *exec.Cmd
	if strings.HasPrefix(backupPath, "s3://") {
		// Download from S3
		cmd = exec.CommandContext(ctx, "aws", "s3", "cp", backupPath, localPath, "--region", bm.config.StorageRegion)
	} else if strings.HasPrefix(backupPath, "gs://") {
		// Download from Google Cloud Storage
		cmd = exec.CommandContext(ctx, "gsutil", "cp", backupPath, localPath)
	}

	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("download failed: %w, output: %s", err, string(output))
	}

	return localPath, nil
}

// decryptFile decrypts an encrypted backup file
func (bm *BackupManager) decryptFile(inputPath string) (string, error) {
	outputPath := strings.TrimSuffix(inputPath, ".enc")
	
	// TODO: Implement proper decryption
	// For now, just copy the file as a placeholder
	input, err := os.Open(inputPath)
	if err != nil {
		return "", err
	}
	defer input.Close()
	
	output, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer output.Close()
	
	_, err = io.Copy(output, input)
	return outputPath, err
}

// decompressFile decompresses a gzipped backup file
func (bm *BackupManager) decompressFile(inputPath string) (string, error) {
	outputPath := strings.TrimSuffix(inputPath, ".gz")
	
	cmd := exec.Command("gunzip", "-c", inputPath)
	
	outputFile, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer outputFile.Close()
	
	cmd.Stdout = outputFile
	if err := cmd.Run(); err != nil {
		return "", err
	}
	
	return outputPath, nil
}

// createDatabase creates a new database
func (bm *BackupManager) createDatabase(ctx context.Context, dbName string) error {
	cmd := exec.CommandContext(ctx, "createdb",
		"-h", bm.config.DatabaseHost,
		"-p", bm.config.DatabasePort,
		"-U", bm.config.DatabaseUser,
		"--no-password",
		dbName,
	)
	
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", bm.config.DatabasePassword))
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("createdb error: %w, output: %s", err, string(output))
	}
	
	return nil
}

// dropDatabase drops an existing database
func (bm *BackupManager) dropDatabase(ctx context.Context, dbName string) error {
	cmd := exec.CommandContext(ctx, "dropdb",
		"-h", bm.config.DatabaseHost,
		"-p", bm.config.DatabasePort,
		"-U", bm.config.DatabaseUser,
		"--no-password",
		"--if-exists",
		dbName,
	)
	
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", bm.config.DatabasePassword))
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("dropdb error: %w, output: %s", err, string(output))
	}
	
	return nil
}

// executePgRestore runs pg_restore to restore the database
func (bm *BackupManager) executePgRestore(ctx context.Context, backupPath string, options *RecoveryOptions) error {
	// Build pg_restore command
	args := []string{
		"-h", bm.config.DatabaseHost,
		"-p", bm.config.DatabasePort,
		"-U", bm.config.DatabaseUser,
		"-d", options.TargetDatabase,
		"--no-password",
	}

	// Add optional flags
	if options.Verbose {
		args = append(args, "--verbose")
	}
	
	if options.SkipOwnership {
		args = append(args, "--no-owner")
	}
	
	if options.DataOnly {
		args = append(args, "--data-only")
	} else if options.SchemaOnly {
		args = append(args, "--schema-only")
	}
	
	if options.ParallelJobs > 1 {
		args = append(args, "--jobs", fmt.Sprintf("%d", options.ParallelJobs))
	}
	
	// Clean and create tables
	args = append(args, "--clean", "--if-exists", "--create")
	
	// Add backup file path
	args = append(args, backupPath)

	cmd := exec.CommandContext(ctx, "pg_restore", args...)
	
	// Set password via environment variable
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", bm.config.DatabasePassword))

	// Execute command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_restore error: %w, output: %s", err, string(output))
	}

	return nil
}

// sendRecoveryNotification sends recovery completion notifications
func (bm *BackupManager) sendRecoveryNotification(result *RecoveryResult) {
	var message string
	if result.Error != nil {
		message = fmt.Sprintf("❌ Database recovery FAILED: %s\nSource: %s\nTarget: %s\nError: %v", 
			result.RecoveryID, result.SourceBackup, result.TargetDatabase, result.Error)
	} else {
		message = fmt.Sprintf("✅ Database recovery completed: %s\nSource: %s\nTarget: %s\nDuration: %v", 
			result.RecoveryID, result.SourceBackup, result.TargetDatabase, result.Duration)
		
		if len(result.Warnings) > 0 {
			message += fmt.Sprintf("\nWarnings: %s", strings.Join(result.Warnings, ", "))
		}
	}
	
	// Send notifications (same as backup notifications)
	if bm.config.SlackWebhookURL != "" {
		bm.logger.Info("Slack recovery notification: " + message)
	}
	
	if len(bm.config.EmailRecipients) > 0 {
		bm.logger.Info("Email recovery notification: " + message)
	}
}

// ListBackups returns a list of available backups
func (bm *BackupManager) ListBackups(ctx context.Context) ([]BackupInfo, error) {
	switch bm.config.StorageType {
	case "s3":
		return bm.listS3Backups(ctx)
	case "gcs":
		return bm.listGCSBackups(ctx)
	case "local":
		return bm.listLocalBackups()
	default:
		return nil, fmt.Errorf("unsupported storage type: %s", bm.config.StorageType)
	}
}

// BackupInfo contains metadata about a backup
type BackupInfo struct {
	Name         string
	Path         string
	Size         int64
	LastModified time.Time
	Compressed   bool
	Encrypted    bool
}

// listS3Backups lists backups from S3 storage
func (bm *BackupManager) listS3Backups(ctx context.Context) ([]BackupInfo, error) {
	// TODO: Implement S3 listing using AWS SDK
	return []BackupInfo{}, nil
}

// listGCSBackups lists backups from Google Cloud Storage
func (bm *BackupManager) listGCSBackups(ctx context.Context) ([]BackupInfo, error) {
	// TODO: Implement GCS listing using Google Cloud SDK
	return []BackupInfo{}, nil
}

// listLocalBackups lists backups from local storage
func (bm *BackupManager) listLocalBackups() ([]BackupInfo, error) {
	var backups []BackupInfo
	
	err := filepath.Walk(bm.config.StoragePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".sql") ||
		   strings.HasSuffix(info.Name(), ".sql.gz") ||
		   strings.HasSuffix(info.Name(), ".sql.enc") {
			
			backup := BackupInfo{
				Name:         info.Name(),
				Path:         path,
				Size:         info.Size(),
				LastModified: info.ModTime(),
				Compressed:   strings.Contains(info.Name(), ".gz"),
				Encrypted:    strings.Contains(info.Name(), ".enc"),
			}
			backups = append(backups, backup)
		}
		
		return nil
	})
	
	return backups, err
}

// ValidateBackup validates a backup file integrity
func (bm *BackupManager) ValidateBackup(ctx context.Context, backupPath string) error {
	bm.logger.Info(fmt.Sprintf("Validating backup: %s", backupPath))
	
	// Download backup if remote
	localPath, err := bm.downloadBackupIfNeeded(ctx, backupPath)
	if err != nil {
		return fmt.Errorf("failed to access backup: %w", err)
	}
	
	// Check if file exists and is readable
	if _, err := os.Stat(localPath); err != nil {
		return fmt.Errorf("backup file not accessible: %w", err)
	}
	
	// For PostgreSQL custom format, we can use pg_restore with --list to validate
	cmd := exec.CommandContext(ctx, "pg_restore", "--list", localPath)
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("backup validation failed: %w, output: %s", err, string(output))
	}
	
	bm.logger.Info("Backup validation completed successfully")
	return nil
}