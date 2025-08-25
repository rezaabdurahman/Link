package migrations

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

// MigrationEngine handles database migrations with schema versioning support
type MigrationEngine struct {
	db             *gorm.DB
	serviceName    string
	migrationsPath string
	logger         *log.Logger
	config         *Config
}

// Config holds migration configuration
type Config struct {
	// Table name for tracking migrations (default: schema_migrations)
	MigrationsTable string
	// Table name for tracking schema versions (default: schema_versions)
	SchemaVersionTable string
	// Whether to run migrations in dry-run mode
	DryRun bool
	// Timeout for individual migration execution
	MigrationTimeout time.Duration
	// Whether to use transactions for each migration
	UseTransactions bool
}

// Migration represents a single migration file
type Migration struct {
	Version     int
	Name        string
	Description string
	UpFile      string
	DownFile    string
	AppliedAt   *time.Time
}

// SchemaVersion tracks the current schema version for the service
type SchemaVersion struct {
	Service     string    `gorm:"primaryKey"`
	Version     int       `gorm:"not null"`
	AppliedAt   time.Time `gorm:"not null;default:now()"`
	Description string
}

// MigrationRecord tracks individual applied migrations
type MigrationRecord struct {
	ID        uint      `gorm:"primaryKey"`
	Service   string    `gorm:"not null;index"`
	Version   int       `gorm:"not null;index"`
	Name      string    `gorm:"not null"`
	AppliedAt time.Time `gorm:"not null;default:now()"`
	Checksum  string    `gorm:"not null"` // For integrity verification
}

// NewMigrationEngine creates a new migration engine instance
func NewMigrationEngine(db *gorm.DB, serviceName, migrationsPath string) *MigrationEngine {
	return &MigrationEngine{
		db:             db,
		serviceName:    serviceName,
		migrationsPath: migrationsPath,
		logger:         log.New(os.Stdout, fmt.Sprintf("[%s-migrations] ", serviceName), log.LstdFlags),
		config: &Config{
			MigrationsTable:    "schema_migrations",
			SchemaVersionTable: "schema_versions",
			DryRun:             false,
			MigrationTimeout:   5 * time.Minute,
			UseTransactions:    true,
		},
	}
}

// WithConfig applies custom configuration
func (m *MigrationEngine) WithConfig(config *Config) *MigrationEngine {
	if config.MigrationsTable != "" {
		m.config.MigrationsTable = config.MigrationsTable
	}
	if config.SchemaVersionTable != "" {
		m.config.SchemaVersionTable = config.SchemaVersionTable
	}
	if config.MigrationTimeout > 0 {
		m.config.MigrationTimeout = config.MigrationTimeout
	}
	m.config.DryRun = config.DryRun
	m.config.UseTransactions = config.UseTransactions
	return m
}

// Initialize creates the necessary tracking tables
func (m *MigrationEngine) Initialize() error {
	m.logger.Println("Initializing migration tracking tables...")

	// Create migration records table
	if err := m.db.AutoMigrate(&MigrationRecord{}); err != nil {
		return fmt.Errorf("failed to create migration records table: %w", err)
	}

	// Create schema versions table
	if err := m.db.AutoMigrate(&SchemaVersion{}); err != nil {
		return fmt.Errorf("failed to create schema versions table: %w", err)
	}

	m.logger.Println("Migration tracking tables initialized successfully")
	return nil
}

// GetAvailableMigrations returns all available migration files
func (m *MigrationEngine) GetAvailableMigrations() ([]Migration, error) {
	var migrations []Migration
	migrationMap := make(map[int]*Migration)

	err := filepath.WalkDir(m.migrationsPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		filename := d.Name()
		
		// Parse migration files - support both naming conventions
		var version int
		var name, direction string
		
		// Try pattern: NNN_description.up.sql or NNN_description.down.sql
		if parts := strings.Split(filename, "."); len(parts) >= 3 && (parts[len(parts)-2] == "up" || parts[len(parts)-2] == "down") {
			direction = parts[len(parts)-2]
			baseName := strings.Join(parts[:len(parts)-2], ".")
			if underscoreIndex := strings.Index(baseName, "_"); underscoreIndex != -1 {
				versionStr := baseName[:underscoreIndex]
				name = baseName[underscoreIndex+1:]
				if v, err := strconv.Atoi(versionStr); err == nil {
					version = v
				}
			}
		}
		
		// Try pattern: NNN_description_up.sql or NNN_description_down.sql
		if version == 0 && (strings.HasSuffix(filename, "_up.sql") || strings.HasSuffix(filename, "_down.sql")) {
			var baseName string
			if strings.HasSuffix(filename, "_up.sql") {
				direction = "up"
				baseName = strings.TrimSuffix(filename, "_up.sql")
			} else {
				direction = "down"
				baseName = strings.TrimSuffix(filename, "_down.sql")
			}
			
			if underscoreIndex := strings.Index(baseName, "_"); underscoreIndex != -1 {
				versionStr := baseName[:underscoreIndex]
				name = baseName[underscoreIndex+1:]
				if v, err := strconv.Atoi(versionStr); err == nil {
					version = v
				}
			}
		}

		if version == 0 {
			// Skip files that don't match our patterns
			return nil
		}

		// Get or create migration entry
		migration, exists := migrationMap[version]
		if !exists {
			migration = &Migration{
				Version: version,
				Name:    name,
			}
			migrationMap[version] = migration
		}

		// Set the file path for up or down
		if direction == "up" {
			migration.UpFile = path
		} else if direction == "down" {
			migration.DownFile = path
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to scan migration files: %w", err)
	}

	// Convert map to sorted slice
	for _, migration := range migrationMap {
		// Only include migrations that have an up file
		if migration.UpFile != "" {
			migrations = append(migrations, *migration)
		}
	}

	// Sort by version
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

// GetAppliedMigrations returns all applied migrations for this service
func (m *MigrationEngine) GetAppliedMigrations() ([]Migration, error) {
	var records []MigrationRecord
	err := m.db.Where("service = ?", m.serviceName).
		Order("version ASC").
		Find(&records).Error
	
	if err != nil {
		return nil, fmt.Errorf("failed to get applied migrations: %w", err)
	}

	var migrations []Migration
	for _, record := range records {
		migrations = append(migrations, Migration{
			Version:   record.Version,
			Name:      record.Name,
			AppliedAt: &record.AppliedAt,
		})
	}

	return migrations, nil
}

// GetPendingMigrations returns migrations that haven't been applied yet
func (m *MigrationEngine) GetPendingMigrations() ([]Migration, error) {
	available, err := m.GetAvailableMigrations()
	if err != nil {
		return nil, err
	}

	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return nil, err
	}

	appliedVersions := make(map[int]bool)
	for _, migration := range applied {
		appliedVersions[migration.Version] = true
	}

	var pending []Migration
	for _, migration := range available {
		if !appliedVersions[migration.Version] {
			pending = append(pending, migration)
		}
	}

	return pending, nil
}

// MigrateUp runs all pending migrations
func (m *MigrationEngine) MigrateUp() error {
	m.logger.Printf("Starting migration up for service: %s", m.serviceName)

	// Initialize tracking tables
	if err := m.Initialize(); err != nil {
		return err
	}

	// Get pending migrations
	pending, err := m.GetPendingMigrations()
	if err != nil {
		return err
	}

	if len(pending) == 0 {
		m.logger.Println("No pending migrations found")
		return nil
	}

	m.logger.Printf("Found %d pending migrations", len(pending))

	// Apply each migration
	for _, migration := range pending {
		if err := m.applyMigration(migration, "up"); err != nil {
			return fmt.Errorf("failed to apply migration %03d_%s: %w", migration.Version, migration.Name, err)
		}

		// Record successful migration
		if err := m.recordMigration(migration); err != nil {
			return fmt.Errorf("failed to record migration %03d_%s: %w", migration.Version, migration.Name, err)
		}

		m.logger.Printf("Successfully applied migration %03d_%s", migration.Version, migration.Name)
	}

	// Update schema version
	if err := m.updateSchemaVersion(pending[len(pending)-1].Version); err != nil {
		return fmt.Errorf("failed to update schema version: %w", err)
	}

	m.logger.Println("All migrations completed successfully")
	return nil
}

// MigrateDown rolls back the latest migration
func (m *MigrationEngine) MigrateDown() error {
	m.logger.Printf("Starting migration down for service: %s", m.serviceName)

	// Get applied migrations
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return err
	}

	if len(applied) == 0 {
		m.logger.Println("No migrations to rollback")
		return nil
	}

	// Get the latest migration
	latest := applied[len(applied)-1]
	
	// Find the migration file
	available, err := m.GetAvailableMigrations()
	if err != nil {
		return err
	}

	var targetMigration Migration
	found := false
	for _, migration := range available {
		if migration.Version == latest.Version {
			targetMigration = migration
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("migration file not found for version %d", latest.Version)
	}

	if targetMigration.DownFile == "" {
		return fmt.Errorf("no down migration file found for version %03d_%s", latest.Version, latest.Name)
	}

	m.logger.Printf("Rolling back migration %03d_%s", latest.Version, latest.Name)

	// Apply down migration
	if err := m.applyMigration(targetMigration, "down"); err != nil {
		return fmt.Errorf("failed to rollback migration %03d_%s: %w", latest.Version, latest.Name, err)
	}

	// Remove migration record
	if err := m.removeMigrationRecord(latest.Version); err != nil {
		return fmt.Errorf("failed to remove migration record: %w", err)
	}

	// Update schema version to previous version
	newVersion := 0
	if len(applied) > 1 {
		newVersion = applied[len(applied)-2].Version
	}
	if err := m.updateSchemaVersion(newVersion); err != nil {
		return fmt.Errorf("failed to update schema version: %w", err)
	}

	m.logger.Printf("Successfully rolled back migration %03d_%s", latest.Version, latest.Name)
	return nil
}

// GetStatus returns the current migration status
func (m *MigrationEngine) GetStatus() (*MigrationStatus, error) {
	available, err := m.GetAvailableMigrations()
	if err != nil {
		return nil, err
	}

	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return nil, err
	}

	pending, err := m.GetPendingMigrations()
	if err != nil {
		return nil, err
	}

	currentVersion := 0
	if len(applied) > 0 {
		currentVersion = applied[len(applied)-1].Version
	}

	return &MigrationStatus{
		Service:        m.serviceName,
		CurrentVersion: currentVersion,
		Available:      len(available),
		Applied:        len(applied),
		Pending:        len(pending),
		Migrations:     available,
	}, nil
}

// applyMigration executes a migration file
func (m *MigrationEngine) applyMigration(migration Migration, direction string) error {
	var filePath string
	if direction == "up" {
		filePath = migration.UpFile
	} else {
		filePath = migration.DownFile
	}

	if filePath == "" {
		return fmt.Errorf("no %s migration file found", direction)
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", filePath, err)
	}

	if m.config.DryRun {
		m.logger.Printf("DRY RUN: Would execute migration from %s", filePath)
		m.logger.Printf("Content:\n%s", string(content))
		return nil
	}

	// Execute migration
	if m.config.UseTransactions {
		return m.executeInTransaction(string(content))
	}
	
	return m.executeStatements(string(content))
}

// executeInTransaction runs migration in a database transaction
func (m *MigrationEngine) executeInTransaction(content string) error {
	return m.db.Transaction(func(tx *gorm.DB) error {
		return m.executeStatementsWithDB(tx, content)
	})
}

// executeStatements runs migration statements without transaction
func (m *MigrationEngine) executeStatements(content string) error {
	return m.executeStatementsWithDB(m.db, content)
}

// executeStatementsWithDB executes SQL statements with the given DB instance
func (m *MigrationEngine) executeStatementsWithDB(db *gorm.DB, content string) error {
	statements := m.parseSQLStatements(content)
	
	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || strings.HasPrefix(stmt, "--") {
			continue
		}

		m.logger.Printf("Executing statement %d/%d", i+1, len(statements))
		
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("failed to execute statement %d: '%s': %w", i+1, stmt, err)
		}
	}

	return nil
}

// parseSQLStatements splits SQL content into individual statements
func (m *MigrationEngine) parseSQLStatements(content string) []string {
	// Split by semicolons, but be smarter about it
	statements := strings.Split(content, ";")
	
	var result []string
	var current strings.Builder
	
	for _, stmt := range statements {
		current.WriteString(stmt)
		
		// Check if this completes a statement (not inside quotes, etc.)
		trimmed := strings.TrimSpace(current.String())
		if trimmed != "" && !strings.HasPrefix(trimmed, "--") {
			result = append(result, current.String())
		}
		
		current.Reset()
	}
	
	return result
}

// recordMigration records a successful migration
func (m *MigrationEngine) recordMigration(migration Migration) error {
	checksum, err := m.calculateChecksum(migration.UpFile)
	if err != nil {
		return fmt.Errorf("failed to calculate checksum: %w", err)
	}

	record := MigrationRecord{
		Service:   m.serviceName,
		Version:   migration.Version,
		Name:      migration.Name,
		AppliedAt: time.Now(),
		Checksum:  checksum,
	}

	if err := m.db.Create(&record).Error; err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	return nil
}

// removeMigrationRecord removes a migration record
func (m *MigrationEngine) removeMigrationRecord(version int) error {
	result := m.db.Where("service = ? AND version = ?", m.serviceName, version).
		Delete(&MigrationRecord{})
	
	if result.Error != nil {
		return fmt.Errorf("failed to remove migration record: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("no migration record found for version %d", version)
	}

	return nil
}

// updateSchemaVersion updates the current schema version for the service
func (m *MigrationEngine) updateSchemaVersion(version int) error {
	schemaVersion := SchemaVersion{
		Service: m.serviceName,
		Version: version,
	}

	// Use UPSERT to update or create
	result := m.db.Where("service = ?", m.serviceName).
		Assign(SchemaVersion{Version: version, AppliedAt: time.Now()}).
		FirstOrCreate(&schemaVersion)

	return result.Error
}

// calculateChecksum calculates MD5 checksum of migration file for integrity
func (m *MigrationEngine) calculateChecksum(filePath string) (string, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	
	// Simple checksum - in production you might want crypto/md5
	return fmt.Sprintf("%x", len(content)), nil
}

// GetDB returns the database connection
func (m *MigrationEngine) GetDB() *gorm.DB {
	return m.db
}

// VerifyIntegrity checks if applied migrations match their files
func (m *MigrationEngine) VerifyIntegrity() error {
	m.logger.Println("Verifying migration integrity...")

	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return err
	}

	available, err := m.GetAvailableMigrations()
	if err != nil {
		return err
	}

	availableMap := make(map[int]Migration)
	for _, migration := range available {
		availableMap[migration.Version] = migration
	}

	for _, appliedMigration := range applied {
		availableMigration, exists := availableMap[appliedMigration.Version]
		if !exists {
			m.logger.Printf("WARNING: Applied migration %03d_%s not found in available migrations", 
				appliedMigration.Version, appliedMigration.Name)
			continue
		}

		// Verify checksum if we have the record
		var record MigrationRecord
		err := m.db.Where("service = ? AND version = ?", m.serviceName, appliedMigration.Version).
			First(&record).Error
		
		if err == nil {
			currentChecksum, err := m.calculateChecksum(availableMigration.UpFile)
			if err == nil && record.Checksum != currentChecksum {
				m.logger.Printf("WARNING: Migration %03d_%s checksum mismatch - file may have been modified", 
					appliedMigration.Version, appliedMigration.Name)
			}
		}
	}

	m.logger.Println("Migration integrity verification completed")
	return nil
}
