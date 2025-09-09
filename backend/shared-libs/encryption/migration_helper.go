package encryption

import (
	"fmt"
	"sync"
	"time"
)

// MigrationStats tracks the progress of data migration
type MigrationStats struct {
	TotalRecords    int `json:"total_records"`
	ProcessedCount  int `json:"processed_count"`
	SuccessCount    int `json:"success_count"`
	ErrorCount      int `json:"error_count"`
	SkippedCount    int `json:"skipped_count"`
	StartTime       time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time,omitempty"`
	Duration        *time.Duration `json:"duration,omitempty"`
	ErrorMessages   []string `json:"error_messages,omitempty"`
}

// MigrationRecord represents a single record to migrate
type MigrationRecord struct {
	ID            interface{} `json:"id"`
	FieldName     string     `json:"field_name"`
	EncryptedData string     `json:"encrypted_data"`
	TableName     string     `json:"table_name,omitempty"`
}

// MigrationResult represents the result of migrating a single record
type MigrationResult struct {
	Record          MigrationRecord `json:"record"`
	Success         bool           `json:"success"`
	NewEncryptedData string        `json:"new_encrypted_data,omitempty"`
	Error           string         `json:"error,omitempty"`
	SkippedReason   string         `json:"skipped_reason,omitempty"`
	OldVersion      uint16         `json:"old_version"`
	NewVersion      uint16         `json:"new_version"`
}

// DataMigrator handles safe migration of encrypted data to new key versions
type DataMigrator struct {
	encryptor    *VersionedDataEncryptor
	stats        *MigrationStats
	batchSize    int
	maxWorkers   int
	dryRun       bool
	mutex        sync.RWMutex
}

// NewDataMigrator creates a new data migrator
func NewDataMigrator(encryptor *VersionedDataEncryptor) *DataMigrator {
	return &DataMigrator{
		encryptor:  encryptor,
		stats:      &MigrationStats{StartTime: time.Now()},
		batchSize:  100,
		maxWorkers: 5,
		dryRun:     false,
	}
}

// SetBatchSize sets the batch size for processing records
func (m *DataMigrator) SetBatchSize(size int) *DataMigrator {
	m.batchSize = size
	return m
}

// SetMaxWorkers sets the maximum number of concurrent workers
func (m *DataMigrator) SetMaxWorkers(workers int) *DataMigrator {
	m.maxWorkers = workers
	return m
}

// SetDryRun enables or disables dry run mode (no actual updates)
func (m *DataMigrator) SetDryRun(dryRun bool) *DataMigrator {
	m.dryRun = dryRun
	return m
}

// MigrateRecord migrates a single encrypted record to the current key version
func (m *DataMigrator) MigrateRecord(record MigrationRecord) MigrationResult {
	result := MigrationResult{
		Record: record,
	}
	
	// Check if data is encrypted
	if !m.encryptor.IsEncrypted(record.EncryptedData) {
		result.SkippedReason = "Data is not encrypted"
		return result
	}
	
	// Get current version
	oldVersion, err := m.encryptor.GetKeyVersion(record.EncryptedData)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to get key version: %v", err)
		return result
	}
	result.OldVersion = oldVersion
	
	// Check if migration is needed
	currentStats := m.encryptor.GetEncryptionStats()
	currentVersion := currentStats["current_version"].(uint16)
	
	if oldVersion >= currentVersion {
		result.SkippedReason = fmt.Sprintf("Already using current or newer version (v%d)", oldVersion)
		result.NewVersion = oldVersion
		return result
	}
	
	// Perform migration
	newEncryptedData, err := m.encryptor.MigrateDataToCurrentVersion(record.EncryptedData)
	if err != nil {
		result.Error = fmt.Sprintf("Migration failed: %v", err)
		return result
	}
	
	result.NewEncryptedData = newEncryptedData
	result.NewVersion = currentVersion
	result.Success = true
	
	return result
}

// MigrateBatch migrates a batch of records concurrently
func (m *DataMigrator) MigrateBatch(records []MigrationRecord) []MigrationResult {
	results := make([]MigrationResult, len(records))
	
	// Create worker pool
	recordChan := make(chan int, len(records))
	resultChan := make(chan struct{}, len(records))
	
	// Start workers
	for w := 0; w < m.maxWorkers && w < len(records); w++ {
		go func() {
			for i := range recordChan {
				results[i] = m.MigrateRecord(records[i])
				resultChan <- struct{}{}
			}
		}()
	}
	
	// Send work
	for i := range records {
		recordChan <- i
	}
	close(recordChan)
	
	// Wait for completion
	for i := 0; i < len(records); i++ {
		<-resultChan
	}
	
	// Update stats
	m.updateStats(results)
	
	return results
}

// updateStats updates migration statistics
func (m *DataMigrator) updateStats(results []MigrationResult) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	
	m.stats.ProcessedCount += len(results)
	
	for _, result := range results {
		if result.Success {
			m.stats.SuccessCount++
		} else if result.Error != "" {
			m.stats.ErrorCount++
			if len(m.stats.ErrorMessages) < 100 { // Limit error message storage
				m.stats.ErrorMessages = append(m.stats.ErrorMessages, result.Error)
			}
		} else {
			m.stats.SkippedCount++
		}
	}
}

// GetStats returns current migration statistics
func (m *DataMigrator) GetStats() MigrationStats {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	
	stats := *m.stats
	if !stats.StartTime.IsZero() {
		if stats.EndTime != nil {
			duration := stats.EndTime.Sub(stats.StartTime)
			stats.Duration = &duration
		} else {
			duration := time.Since(stats.StartTime)
			stats.Duration = &duration
		}
	}
	
	return stats
}

// FinalizeMigration marks the migration as complete
func (m *DataMigrator) FinalizeMigration() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	
	now := time.Now()
	m.stats.EndTime = &now
}

// ValidateMigration validates that migrated data can be decrypted correctly
func (m *DataMigrator) ValidateMigration(originalData, migratedData string) error {
	// Decrypt original data
	originalPlaintext, err := m.encryptor.DecryptString(originalData)
	if err != nil {
		return fmt.Errorf("failed to decrypt original data: %w", err)
	}
	
	// Decrypt migrated data
	migratedPlaintext, err := m.encryptor.DecryptString(migratedData)
	if err != nil {
		return fmt.Errorf("failed to decrypt migrated data: %w", err)
	}
	
	// Compare plaintexts
	if originalPlaintext != migratedPlaintext {
		return fmt.Errorf("validation failed: plaintexts don't match")
	}
	
	// Verify versions are different
	originalVersion, err := m.encryptor.GetKeyVersion(originalData)
	if err != nil {
		return fmt.Errorf("failed to get original version: %w", err)
	}
	
	migratedVersion, err := m.encryptor.GetKeyVersion(migratedData)
	if err != nil {
		return fmt.Errorf("failed to get migrated version: %w", err)
	}
	
	if originalVersion >= migratedVersion {
		return fmt.Errorf("validation failed: version not upgraded (original: v%d, migrated: v%d)",
			originalVersion, migratedVersion)
	}
	
	return nil
}

// EstimateWork analyzes records to estimate migration work needed
func (m *DataMigrator) EstimateWork(records []MigrationRecord) map[string]interface{} {
	versionCounts := make(map[uint16]int)
	encryptedCount := 0
	errorCount := 0
	
	for _, record := range records {
		if !m.encryptor.IsEncrypted(record.EncryptedData) {
			continue
		}
		
		encryptedCount++
		version, err := m.encryptor.GetKeyVersion(record.EncryptedData)
		if err != nil {
			errorCount++
			continue
		}
		
		versionCounts[version]++
	}
	
	currentStats := m.encryptor.GetEncryptionStats()
	currentVersion := currentStats["current_version"].(uint16)
	
	needsMigration := 0
	for version, count := range versionCounts {
		if version < currentVersion {
			needsMigration += count
		}
	}
	
	return map[string]interface{}{
		"total_records":        len(records),
		"encrypted_records":    encryptedCount,
		"needs_migration":      needsMigration,
		"already_current":      encryptedCount - needsMigration,
		"error_records":        errorCount,
		"version_distribution": versionCounts,
		"current_version":      currentVersion,
		"estimated_time_mins":  needsMigration / 100, // Rough estimate: 100 records per minute
	}
}

// CreateMigrationPlan creates a plan for migrating data
type MigrationPlan struct {
	TotalRecords     int                    `json:"total_records"`
	NeedsMigration   int                    `json:"needs_migration"`
	EstimatedTime    time.Duration          `json:"estimated_time"`
	RecommendedBatch int                    `json:"recommended_batch_size"`
	Phases          []MigrationPhase       `json:"phases"`
	Risks           []string               `json:"risks"`
	Prerequisites   []string               `json:"prerequisites"`
}

type MigrationPhase struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	RecordCount int    `json:"record_count"`
	Order       int    `json:"order"`
}

// CreateMigrationPlan creates a comprehensive migration plan
func (m *DataMigrator) CreateMigrationPlan(records []MigrationRecord) MigrationPlan {
	estimate := m.EstimateWork(records)
	
	needsMigration := estimate["needs_migration"].(int)
	totalRecords := estimate["total_records"].(int)
	
	plan := MigrationPlan{
		TotalRecords:     totalRecords,
		NeedsMigration:   needsMigration,
		EstimatedTime:    time.Duration(needsMigration/50) * time.Minute, // Conservative estimate
		RecommendedBatch: min(needsMigration/10, 500), // Aim for ~10 batches, max 500 per batch
		Phases: []MigrationPhase{
			{
				Name:        "Preparation",
				Description: "Validate keys, create backups, test on sample data",
				RecordCount: 0,
				Order:       1,
			},
			{
				Name:        "Migration",
				Description: "Migrate encrypted data to new key version",
				RecordCount: needsMigration,
				Order:       2,
			},
			{
				Name:        "Validation",
				Description: "Verify all data can be decrypted correctly",
				RecordCount: needsMigration,
				Order:       3,
			},
			{
				Name:        "Cleanup",
				Description: "Remove old keys after successful migration",
				RecordCount: 0,
				Order:       4,
			},
		},
		Risks: []string{
			"Service downtime during migration",
			"Data corruption if migration fails",
			"Performance impact on database",
			"Memory usage during batch processing",
		},
		Prerequisites: []string{
			"All encryption keys validated",
			"Database backup completed",
			"Migration tested on staging environment",
			"Rollback plan prepared",
		},
	}
	
	return plan
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}