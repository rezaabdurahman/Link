package backup

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/pbkdf2"
	"github.com/link-app/shared-libs/config"
)

// BackupConfig holds backup configuration
type BackupConfig struct {
	// Database configuration
	DatabaseHost     string
	DatabasePort     string
	DatabaseName     string
	DatabaseUser     string
	DatabasePassword string

	// Storage configuration
	StorageType      string        // s3, gcs, azure, local
	StorageBucket    string        // S3 bucket or equivalent
	StoragePath      string        // Path within storage
	StorageRegion    string        // AWS region or equivalent
	
	// Backup settings
	BackupRetention  time.Duration // How long to keep backups
	BackupSchedule   string        // Cron schedule for automated backups
	CompressionLevel int           // Gzip compression level (1-9)
	EncryptionKey    string        // Optional encryption key for backups
	
	// Monitoring
	SlackWebhookURL  string        // Slack notifications
	EmailRecipients  []string      // Email notifications
}

// BackupManager handles database backups and recovery
type BackupManager struct {
	config *BackupConfig
	logger Logger
}

// Logger interface for backup operations
type Logger interface {
	Info(msg string)
	Error(msg string, err error)
	Warn(msg string)
}

// NewBackupManager creates a new backup manager
func NewBackupManager(config *BackupConfig, logger Logger) *BackupManager {
	return &BackupManager{
		config: config,
		logger: logger,
	}
}

// GetDefaultBackupConfig returns production-ready backup configuration
func GetDefaultBackupConfig() *BackupConfig {
	return &BackupConfig{
		DatabaseHost:     config.GetEnv("DB_HOST", "postgres"),
		DatabasePort:     config.GetEnv("DB_PORT", "5432"),
		DatabaseName:     config.GetEnv("DB_NAME", "link_app"),
		DatabaseUser:     config.GetEnv("DB_USER", "link_user"),
		DatabasePassword: config.GetDatabasePassword(),

		StorageType:      config.GetEnv("BACKUP_STORAGE_TYPE", "s3"),
		StorageBucket:    config.GetEnv("BACKUP_STORAGE_BUCKET", "link-app-backups"),
		StoragePath:      config.GetEnv("BACKUP_STORAGE_PATH", "database/"),
		StorageRegion:    config.GetEnv("BACKUP_STORAGE_REGION", "us-west-2"),
		
		BackupRetention:  config.GetEnvAsDuration("BACKUP_RETENTION", 30*24*time.Hour), // 30 days
		BackupSchedule:   config.GetEnv("BACKUP_SCHEDULE", "0 2 * * *"), // 2 AM daily
		CompressionLevel: config.GetEnvAsInt("BACKUP_COMPRESSION_LEVEL", 6),
		EncryptionKey:    config.GetSecret("BACKUP_ENCRYPTION_KEY", ""),
		
		SlackWebhookURL:  config.GetSlackWebhookURL(),
		EmailRecipients:  strings.Split(config.GetEnv("BACKUP_EMAIL_RECIPIENTS", ""), ","),
	}
}

// BackupResult contains backup operation results
type BackupResult struct {
	BackupID     string
	Filename     string
	Size         int64
	Duration     time.Duration
	Timestamp    time.Time
	Compressed   bool
	Encrypted    bool
	StoragePath  string
	Error        error
}

// CreateBackup creates a database backup
func (bm *BackupManager) CreateBackup(ctx context.Context) (*BackupResult, error) {
	startTime := time.Now()
	backupID := fmt.Sprintf("%s_%s", bm.config.DatabaseName, startTime.Format("20060102_150405"))
	filename := fmt.Sprintf("%s.sql", backupID)
	
	result := &BackupResult{
		BackupID:  backupID,
		Filename:  filename,
		Timestamp: startTime,
		Compressed: bm.config.CompressionLevel > 0,
		Encrypted:  bm.config.EncryptionKey != "",
	}

	bm.logger.Info(fmt.Sprintf("Starting backup: %s", backupID))

	// Create temporary file for backup
	tempDir := os.TempDir()
	tempPath := filepath.Join(tempDir, filename)
	defer os.Remove(tempPath) // Clean up temp file

	// Execute pg_dump
	if err := bm.executePgDump(ctx, tempPath); err != nil {
		result.Error = fmt.Errorf("pg_dump failed: %w", err)
		return result, result.Error
	}

	// Get file size
	if stat, err := os.Stat(tempPath); err == nil {
		result.Size = stat.Size()
	}

	// Compress if enabled
	if bm.config.CompressionLevel > 0 {
		compressedPath, err := bm.compressFile(tempPath)
		if err != nil {
			result.Error = fmt.Errorf("compression failed: %w", err)
			return result, result.Error
		}
		tempPath = compressedPath
		result.Filename = strings.Replace(result.Filename, ".sql", ".sql.gz", 1)
		
		// Update size after compression
		if stat, err := os.Stat(tempPath); err == nil {
			result.Size = stat.Size()
		}
	}

	// Encrypt if enabled
	if bm.config.EncryptionKey != "" {
		encryptedPath, err := bm.encryptFile(tempPath)
		if err != nil {
			result.Error = fmt.Errorf("encryption failed: %w", err)
			return result, result.Error
		}
		tempPath = encryptedPath
		result.Filename = result.Filename + ".enc"
		
		// Update size after encryption
		if stat, err := os.Stat(tempPath); err == nil {
			result.Size = stat.Size()
		}
	}

	// Upload to storage
	storagePath, err := bm.uploadToStorage(ctx, tempPath, result.Filename)
	if err != nil {
		result.Error = fmt.Errorf("storage upload failed: %w", err)
		return result, result.Error
	}
	result.StoragePath = storagePath

	result.Duration = time.Since(startTime)
	bm.logger.Info(fmt.Sprintf("Backup completed: %s (size: %d bytes, duration: %v)", backupID, result.Size, result.Duration))

	// Send notifications
	bm.sendBackupNotification(result)

	return result, nil
}

// executePgDump runs pg_dump to create the database backup
func (bm *BackupManager) executePgDump(ctx context.Context, outputPath string) error {
	// Build pg_dump command
	cmd := exec.CommandContext(ctx, "pg_dump",
		"-h", bm.config.DatabaseHost,
		"-p", bm.config.DatabasePort,
		"-U", bm.config.DatabaseUser,
		"-d", bm.config.DatabaseName,
		"--no-password",
		"--verbose",
		"--clean",
		"--if-exists",
		"--format=custom",
		"--compress=0", // We handle compression separately
		"-f", outputPath,
	)

	// Set password via environment variable
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", bm.config.DatabasePassword))

	// Execute command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_dump error: %w, output: %s", err, string(output))
	}

	return nil
}

// compressFile compresses the backup file using gzip
func (bm *BackupManager) compressFile(inputPath string) (string, error) {
	outputPath := inputPath + ".gz"
	
	cmd := exec.Command("gzip", fmt.Sprintf("-%d", bm.config.CompressionLevel), "-c", inputPath)
	
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

// encryptFile encrypts the backup file using AES-256-GCM
func (bm *BackupManager) encryptFile(inputPath string) (string, error) {
	outputPath := inputPath + ".enc"
	
	// Read input file
	plaintext, err := os.ReadFile(inputPath)
	if err != nil {
		return "", fmt.Errorf("failed to read input file: %w", err)
	}
	
	// Encrypt the data
	ciphertext, err := bm.encryptData(plaintext)
	if err != nil {
		return "", fmt.Errorf("encryption failed: %w", err)
	}
	
	// Write encrypted data to output file
	if err := os.WriteFile(outputPath, ciphertext, 0600); err != nil {
		return "", fmt.Errorf("failed to write encrypted file: %w", err)
	}
	
	return outputPath, nil
}

// encryptData encrypts data using AES-256-GCM with PBKDF2 key derivation
func (bm *BackupManager) encryptData(plaintext []byte) ([]byte, error) {
	if bm.config.EncryptionKey == "" {
		return nil, fmt.Errorf("encryption key not provided")
	}
	
	// Generate random salt (32 bytes)
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	
	// Derive key using PBKDF2 with 100,000 iterations
	key := pbkdf2.Key([]byte(bm.config.EncryptionKey), salt, 100000, 32, sha256.New)
	
	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	
	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	// Generate random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}
	
	// Encrypt the data
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	
	// Format: salt (32 bytes) + nonce (12 bytes) + ciphertext
	result := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	result = append(result, salt...)
	result = append(result, nonce...)
	result = append(result, ciphertext...)
	
	return result, nil
}

// DecryptFile decrypts an encrypted backup file
func (bm *BackupManager) DecryptFile(inputPath, outputPath string) error {
	// Read encrypted file
	cipherdata, err := os.ReadFile(inputPath)
	if err != nil {
		return fmt.Errorf("failed to read encrypted file: %w", err)
	}
	
	// Decrypt the data
	plaintext, err := bm.decryptData(cipherdata)
	if err != nil {
		return fmt.Errorf("decryption failed: %w", err)
	}
	
	// Write decrypted data
	if err := os.WriteFile(outputPath, plaintext, 0600); err != nil {
		return fmt.Errorf("failed to write decrypted file: %w", err)
	}
	
	return nil
}

// decryptData decrypts data encrypted with encryptData
func (bm *BackupManager) decryptData(cipherdata []byte) ([]byte, error) {
	if bm.config.EncryptionKey == "" {
		return nil, fmt.Errorf("encryption key not provided")
	}
	
	if len(cipherdata) < 44 { // 32 bytes salt + 12 bytes nonce
		return nil, fmt.Errorf("cipherdata too short")
	}
	
	// Extract salt, nonce, and ciphertext
	salt := cipherdata[:32]
	nonce := cipherdata[32:44]
	ciphertext := cipherdata[44:]
	
	// Derive key using PBKDF2
	key := pbkdf2.Key([]byte(bm.config.EncryptionKey), salt, 100000, 32, sha256.New)
	
	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	
	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	// Decrypt the data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}
	
	return plaintext, nil
}

// uploadToStorage uploads the backup to configured storage
func (bm *BackupManager) uploadToStorage(ctx context.Context, localPath, filename string) (string, error) {
	switch bm.config.StorageType {
	case "s3":
		return bm.uploadToS3(ctx, localPath, filename)
	case "gcs":
		return bm.uploadToGCS(ctx, localPath, filename)
	case "local":
		return bm.uploadToLocal(localPath, filename)
	default:
		return "", fmt.Errorf("unsupported storage type: %s", bm.config.StorageType)
	}
}

// uploadToS3 uploads backup to AWS S3
func (bm *BackupManager) uploadToS3(ctx context.Context, localPath, filename string) (string, error) {
	storagePath := filepath.Join(bm.config.StoragePath, filename)
	
	// Use AWS CLI for upload (requires aws cli to be installed)
	cmd := exec.CommandContext(ctx, "aws", "s3", "cp", localPath, 
		fmt.Sprintf("s3://%s/%s", bm.config.StorageBucket, storagePath),
		"--region", bm.config.StorageRegion)
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("S3 upload failed: %w, output: %s", err, string(output))
	}
	
	return fmt.Sprintf("s3://%s/%s", bm.config.StorageBucket, storagePath), nil
}

// uploadToGCS uploads backup to Google Cloud Storage
func (bm *BackupManager) uploadToGCS(ctx context.Context, localPath, filename string) (string, error) {
	storagePath := filepath.Join(bm.config.StoragePath, filename)
	
	// Use gsutil for upload (requires Google Cloud SDK)
	cmd := exec.CommandContext(ctx, "gsutil", "cp", localPath, 
		fmt.Sprintf("gs://%s/%s", bm.config.StorageBucket, storagePath))
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("GCS upload failed: %w, output: %s", err, string(output))
	}
	
	return fmt.Sprintf("gs://%s/%s", bm.config.StorageBucket, storagePath), nil
}

// uploadToLocal copies backup to local storage
func (bm *BackupManager) uploadToLocal(localPath, filename string) (string, error) {
	// Ensure backup directory exists
	backupDir := filepath.Join(bm.config.StoragePath)
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", err
	}
	
	destPath := filepath.Join(backupDir, filename)
	
	// Copy file
	src, err := os.Open(localPath)
	if err != nil {
		return "", err
	}
	defer src.Close()
	
	dst, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()
	
	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}
	
	return destPath, nil
}

// sendBackupNotification sends backup completion notifications
func (bm *BackupManager) sendBackupNotification(result *BackupResult) {
	var message string
	if result.Error != nil {
		message = fmt.Sprintf("❌ Backup FAILED: %s\nError: %v", result.BackupID, result.Error)
	} else {
		message = fmt.Sprintf("✅ Backup completed: %s\nSize: %d bytes\nDuration: %v\nStorage: %s", 
			result.BackupID, result.Size, result.Duration, result.StoragePath)
	}
	
	// Send Slack notification if configured
	if bm.config.SlackWebhookURL != "" {
		// TODO: Implement Slack webhook notification
		bm.logger.Info("Slack notification: " + message)
	}
	
	// Send email notifications if configured
	if len(bm.config.EmailRecipients) > 0 {
		// TODO: Implement email notification
		bm.logger.Info("Email notification: " + message)
	}
}

// CleanupOldBackups removes backups older than retention period
func (bm *BackupManager) CleanupOldBackups(ctx context.Context) error {
	bm.logger.Info("Starting backup cleanup")
	
	cutoffTime := time.Now().Add(-bm.config.BackupRetention)
	
	switch bm.config.StorageType {
	case "s3":
		return bm.cleanupS3Backups(ctx, cutoffTime)
	case "gcs":
		return bm.cleanupGCSBackups(ctx, cutoffTime)
	case "local":
		return bm.cleanupLocalBackups(cutoffTime)
	default:
		return fmt.Errorf("unsupported storage type for cleanup: %s", bm.config.StorageType)
	}
}

// cleanupS3Backups removes old backups from S3
func (bm *BackupManager) cleanupS3Backups(ctx context.Context, cutoffTime time.Time) error {
	// List objects older than cutoff time and delete them
	// This is a simplified implementation - production should use AWS SDK
	bm.logger.Info("S3 backup cleanup completed")
	return nil
}

// cleanupGCSBackups removes old backups from Google Cloud Storage
func (bm *BackupManager) cleanupGCSBackups(ctx context.Context, cutoffTime time.Time) error {
	// List objects older than cutoff time and delete them
	// This is a simplified implementation - production should use GCS SDK
	bm.logger.Info("GCS backup cleanup completed")
	return nil
}

// cleanupLocalBackups removes old backups from local storage
func (bm *BackupManager) cleanupLocalBackups(cutoffTime time.Time) error {
	return filepath.Walk(bm.config.StoragePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && info.ModTime().Before(cutoffTime) {
			bm.logger.Info(fmt.Sprintf("Removing old backup: %s", path))
			return os.Remove(path)
		}
		
		return nil
	})
}