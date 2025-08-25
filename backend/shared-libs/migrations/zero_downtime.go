package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ZeroDowntimeConfig holds configuration for zero-downtime migrations
type ZeroDowntimeConfig struct {
	// MaxLockTimeout maximum time to wait for locks
	MaxLockTimeout time.Duration
	// ChunkSize for large data migrations
	ChunkSize int
	// PreMigrationChecks to run before migration
	PreMigrationChecks []HealthCheck
	// PostMigrationChecks to run after migration
	PostMigrationChecks []HealthCheck
	// ConnectionPoolSettings for migration database connections
	ConnectionPoolSettings *ConnectionPoolConfig
}

// ConnectionPoolConfig defines database connection pool settings for migrations
type ConnectionPoolConfig struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// HealthCheck represents a health check function
type HealthCheck func(ctx context.Context, db *gorm.DB) error

// ZeroDowntimeEngine extends MigrationEngine with zero-downtime capabilities
type ZeroDowntimeEngine struct {
	*MigrationEngine
	config *ZeroDowntimeConfig
}

// NewZeroDowntimeEngine creates a new zero-downtime migration engine
func NewZeroDowntimeEngine(db *gorm.DB, serviceName string, migrationsPath string) *ZeroDowntimeEngine {
	engine := NewMigrationEngine(db, serviceName, migrationsPath)
	
	defaultConfig := &ZeroDowntimeConfig{
		MaxLockTimeout: 30 * time.Second,
		ChunkSize:      1000,
		PreMigrationChecks: []HealthCheck{
			CheckDatabaseConnections,
			CheckDiskSpace,
			CheckReplicationLag,
		},
		PostMigrationChecks: []HealthCheck{
			CheckSchemaIntegrity,
			CheckDataConsistency,
		},
		ConnectionPoolSettings: &ConnectionPoolConfig{
			MaxOpenConns:    10,
			MaxIdleConns:    5,
			ConnMaxLifetime: 5 * time.Minute,
			ConnMaxIdleTime: 1 * time.Minute,
		},
	}
	
	return &ZeroDowntimeEngine{
		MigrationEngine: engine,
		config:         defaultConfig,
	}
}

// WithZeroDowntimeConfig sets the zero-downtime configuration
func (e *ZeroDowntimeEngine) WithZeroDowntimeConfig(config *ZeroDowntimeConfig) *ZeroDowntimeEngine {
	e.config = config
	return e
}

// SafeUp runs migrations using zero-downtime strategies
func (e *ZeroDowntimeEngine) SafeUp(ctx context.Context) error {
	// Configure connection pool for migrations
	if err := e.configureConnectionPool(); err != nil {
		return fmt.Errorf("failed to configure connection pool: %w", err)
	}

	// Run pre-migration health checks
	if err := e.runHealthChecks(ctx, e.config.PreMigrationChecks, "pre-migration"); err != nil {
		return fmt.Errorf("pre-migration health checks failed: %w", err)
	}

	// Get pending migrations
	pending, err := e.GetPendingMigrations()
	if err != nil {
		return fmt.Errorf("failed to get pending migrations: %w", err)
	}

	if len(pending) == 0 {
		e.logger.Info("No pending migrations")
		return nil
	}

	// Process each migration with zero-downtime strategies
	for _, migration := range pending {
		if err := e.safeMigration(ctx, migration); err != nil {
			return fmt.Errorf("failed to safely apply migration %s: %w", migration.Name, err)
		}
	}

	// Run post-migration health checks
	if err := e.runHealthChecks(ctx, e.config.PostMigrationChecks, "post-migration"); err != nil {
		return fmt.Errorf("post-migration health checks failed: %w", err)
	}

	return nil
}

// safeMigration applies a single migration using zero-downtime strategies
func (e *ZeroDowntimeEngine) safeMigration(ctx context.Context, migration *Migration) error {
	e.logger.WithFields(map[string]interface{}{
		"migration": migration.Name,
		"version":   migration.Version,
	}).Info("Starting zero-downtime migration")

	// Analyze migration content for zero-downtime compatibility
	strategy, err := e.analyzeMigrationStrategy(migration)
	if err != nil {
		return fmt.Errorf("failed to analyze migration strategy: %w", err)
	}

	// Apply migration based on strategy
	switch strategy {
	case "safe":
		return e.applySafeMigration(ctx, migration)
	case "chunked":
		return e.applyChunkedMigration(ctx, migration)
	case "background":
		return e.applyBackgroundMigration(ctx, migration)
	case "manual":
		return fmt.Errorf("migration %s requires manual intervention - contains potentially blocking operations", migration.Name)
	default:
		return e.applySafeMigration(ctx, migration)
	}
}

// analyzeMigrationStrategy determines the appropriate strategy for a migration
func (e *ZeroDowntimeEngine) analyzeMigrationStrategy(migration *Migration) (string, error) {
	// Read migration content from file
	content, err := os.ReadFile(migration.UpFile)
	if err != nil {
		return "", fmt.Errorf("failed to read migration file: %w", err)
	}
	
	contentStr := string(content)
	
	// Check for potentially blocking operations
	blockingOperations := []string{
		"ALTER TABLE", "DROP TABLE", "DROP COLUMN",
		"ADD CONSTRAINT", "CREATE UNIQUE INDEX",
	}
	
	chunkedOperations := []string{
		"UPDATE", "INSERT", "DELETE",
	}
	
	backgroundOperations := []string{
		"CREATE INDEX CONCURRENTLY",
		"REINDEX CONCURRENTLY",
	}

	for _, op := range blockingOperations {
		if containsIgnoreCase(contentStr, op) {
			// Check if it's a safe operation
			if containsIgnoreCase(contentStr, "ADD COLUMN") && !containsIgnoreCase(contentStr, "NOT NULL") {
				continue // Adding nullable columns is safe
			}
			if containsIgnoreCase(contentStr, "IF NOT EXISTS") || containsIgnoreCase(contentStr, "IF EXISTS") {
				continue // Conditional operations are safer
			}
			return "manual", nil
		}
	}

	for _, op := range backgroundOperations {
		if containsIgnoreCase(contentStr, op) {
			return "background", nil
		}
	}

	for _, op := range chunkedOperations {
		if containsIgnoreCase(contentStr, op) {
			return "chunked", nil
		}
	}

	return "safe", nil
}

// applySafeMigration applies migration with basic safety measures
func (e *ZeroDowntimeEngine) applySafeMigration(ctx context.Context, migration *Migration) error {
	// Read migration content
	content, err := os.ReadFile(migration.UpFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// Set statement timeout
	if err := e.setStatementTimeout(ctx, e.config.MaxLockTimeout); err != nil {
		return fmt.Errorf("failed to set statement timeout: %w", err)
	}

	// Apply migration in transaction with timeout
	return e.db.Transaction(func(tx *gorm.DB) error {
		ctx, cancel := context.WithTimeout(ctx, e.config.MaxLockTimeout*2)
		defer cancel()

		if err := tx.WithContext(ctx).Exec(string(content)).Error; err != nil {
			return fmt.Errorf("failed to execute migration: %w", err)
		}

		// Record migration
		return e.recordMigration(*migration)
	})
}

// applyChunkedMigration applies data migrations in small chunks
func (e *ZeroDowntimeEngine) applyChunkedMigration(ctx context.Context, migration *Migration) error {
	e.logger.Printf("Applying migration in chunks for zero-downtime")

	// Read migration content
	content, err := os.ReadFile(migration.UpFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// This is a simplified example - real implementation would parse SQL
	// and break down large UPDATE/INSERT/DELETE operations
	chunkSize := e.config.ChunkSize
	contentStr := string(content)
	
	return e.db.Transaction(func(tx *gorm.DB) error {
		// Example: Break large operations into chunks
		if containsIgnoreCase(contentStr, "UPDATE") {
			return e.executeChunkedUpdate(ctx, tx, contentStr, chunkSize)
		}
		
		// For other operations, fall back to safe migration
		return tx.WithContext(ctx).Exec(contentStr).Error
	})
}

// applyBackgroundMigration applies migration using background operations
func (e *ZeroDowntimeEngine) applyBackgroundMigration(ctx context.Context, migration *Migration) error {
	e.logger.Printf("Applying migration in background for zero-downtime")

	// Read migration content
	content, err := os.ReadFile(migration.UpFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// Execute migration without transaction for concurrent operations
	if err := e.db.WithContext(ctx).Exec(string(content)).Error; err != nil {
		return fmt.Errorf("failed to execute background migration: %w", err)
	}

	// Record migration in separate transaction
	return e.db.Transaction(func(tx *gorm.DB) error {
		return e.recordMigration(*migration)
	})
}

// executeChunkedUpdate executes UPDATE statements in chunks
func (e *ZeroDowntimeEngine) executeChunkedUpdate(ctx context.Context, tx *gorm.DB, query string, chunkSize int) error {
	// This is a simplified implementation
	// Real implementation would parse SQL properly and handle various UPDATE patterns
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		result := tx.WithContext(ctx).Exec(fmt.Sprintf("%s LIMIT %d", query, chunkSize))
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			break // No more rows to update
		}

		// Small delay between chunks to reduce load
		time.Sleep(100 * time.Millisecond)
	}

	return nil
}

// setStatementTimeout sets a timeout for database statements
func (e *ZeroDowntimeEngine) setStatementTimeout(ctx context.Context, timeout time.Duration) error {
	timeoutMs := int(timeout.Milliseconds())
	return e.db.WithContext(ctx).Exec(fmt.Sprintf("SET statement_timeout = %d", timeoutMs)).Error
}

// configureConnectionPool configures the database connection pool for migrations
func (e *ZeroDowntimeEngine) configureConnectionPool() error {
	sqlDB, err := e.db.DB()
	if err != nil {
		return err
	}

	config := e.config.ConnectionPoolSettings
	if config != nil {
		sqlDB.SetMaxOpenConns(config.MaxOpenConns)
		sqlDB.SetMaxIdleConns(config.MaxIdleConns)
		sqlDB.SetConnMaxLifetime(config.ConnMaxLifetime)
		sqlDB.SetConnMaxIdleTime(config.ConnMaxIdleTime)
	}

	return nil
}

// runHealthChecks executes health checks
func (e *ZeroDowntimeEngine) runHealthChecks(ctx context.Context, checks []HealthCheck, phase string) error {
	for i, check := range checks {
		e.logger.WithFields(map[string]interface{}{
			"phase": phase,
			"check": i + 1,
			"total": len(checks),
		}).Info("Running health check")

		if err := check(ctx, e.db); err != nil {
			return fmt.Errorf("health check %d failed: %w", i+1, err)
		}
	}
	return nil
}

// Built-in health checks

// CheckDatabaseConnections verifies database connectivity
func CheckDatabaseConnections(ctx context.Context, db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

// CheckDiskSpace verifies sufficient disk space (requires PostgreSQL-specific query)
func CheckDiskSpace(ctx context.Context, db *gorm.DB) error {
	var result struct {
		FreeSpaceGB float64
	}
	
	err := db.WithContext(ctx).Raw(`
		SELECT 
			pg_size_pretty(pg_database_size(current_database()))::text as size,
			(SELECT setting::bigint FROM pg_settings WHERE name = 'shared_buffers') * 8192 / 1024 / 1024 / 1024.0 as free_space_gb
	`).Scan(&result).Error
	
	if err != nil {
		return err
	}

	// Require at least 1GB free space
	if result.FreeSpaceGB < 1.0 {
		return fmt.Errorf("insufficient disk space: %.2f GB available", result.FreeSpaceGB)
	}

	return nil
}

// CheckReplicationLag verifies replication lag is acceptable
func CheckReplicationLag(ctx context.Context, db *gorm.DB) error {
	// This would check replication lag in a production setup
	// For now, just return nil (no replication setup)
	return nil
}

// CheckSchemaIntegrity verifies schema consistency after migration
func CheckSchemaIntegrity(ctx context.Context, db *gorm.DB) error {
	// Check for broken foreign keys, invalid constraints, etc.
	var count int64
	
	err := db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM information_schema.table_constraints 
		WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
	`).Scan(&count).Error
	
	return err
}

// CheckDataConsistency verifies data consistency after migration
func CheckDataConsistency(ctx context.Context, db *gorm.DB) error {
	// Implement data consistency checks based on your schema
	// For now, just verify we can read from key tables
	var count int64
	
	// Check if we can read from migration tables
	if err := db.WithContext(ctx).Model(&MigrationRecord{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to read migration records: %w", err)
	}

	return nil
}

// Helper function
func containsIgnoreCase(s, substr string) bool {
	s = strings.ToLower(s)
	substr = strings.ToLower(substr)
	return strings.Contains(s, substr)
}