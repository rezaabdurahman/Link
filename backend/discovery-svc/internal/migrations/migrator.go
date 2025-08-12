package migrations

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// Migrator handles database migrations
type Migrator struct {
	db          *gorm.DB
	migrationsPath string
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *gorm.DB, migrationsPath string) *Migrator {
	return &Migrator{
		db:             db,
		migrationsPath: migrationsPath,
	}
}

// MigrateUp runs all pending up migrations
func (m *Migrator) MigrateUp() error {
	// Create migrations table if it doesn't exist
	if err := m.createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get applied migrations
	appliedMigrations, err := m.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Get available migrations
	availableMigrations, err := m.getAvailableMigrations("_up.sql")
	if err != nil {
		return fmt.Errorf("failed to get available migrations: %w", err)
	}

	// Run pending migrations
	for _, migration := range availableMigrations {
		if !contains(appliedMigrations, migration) {
			log.Printf("Running migration: %s", migration)
			if err := m.runMigration(migration, "_up.sql"); err != nil {
				return fmt.Errorf("failed to run migration %s: %w", migration, err)
			}
			
			if err := m.recordMigration(migration); err != nil {
				return fmt.Errorf("failed to record migration %s: %w", migration, err)
			}
			log.Printf("Migration %s completed successfully", migration)
		}
	}

	return nil
}

// MigrateDown runs down migration for the latest applied migration
func (m *Migrator) MigrateDown() error {
	// Get applied migrations
	appliedMigrations, err := m.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	if len(appliedMigrations) == 0 {
		log.Println("No migrations to rollback")
		return nil
	}

	// Get the latest migration
	sort.Slice(appliedMigrations, func(i, j int) bool {
		return appliedMigrations[i] > appliedMigrations[j]
	})
	
	latestMigration := appliedMigrations[0]
	
	log.Printf("Rolling back migration: %s", latestMigration)
	if err := m.runMigration(latestMigration, "_down.sql"); err != nil {
		return fmt.Errorf("failed to run down migration %s: %w", latestMigration, err)
	}
	
	if err := m.removeMigrationRecord(latestMigration); err != nil {
		return fmt.Errorf("failed to remove migration record %s: %w", latestMigration, err)
	}
	
	log.Printf("Migration %s rolled back successfully", latestMigration)
	return nil
}

// createMigrationsTable creates the migrations tracking table
func (m *Migrator) createMigrationsTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`
	
	return m.db.Exec(query).Error
}

// getAppliedMigrations gets list of applied migrations
func (m *Migrator) getAppliedMigrations() ([]string, error) {
	var migrations []string
	err := m.db.Table("schema_migrations").Pluck("version", &migrations).Error
	return migrations, err
}

// getAvailableMigrations gets list of available migration files
func (m *Migrator) getAvailableMigrations(suffix string) ([]string, error) {
	var migrations []string
	
	err := filepath.WalkDir(m.migrationsPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		
		if !d.IsDir() && strings.HasSuffix(d.Name(), suffix) {
			// Extract version from filename (e.g., "001_add_availability_columns_up.sql" -> "001_add_availability_columns")
			version := strings.TrimSuffix(d.Name(), suffix)
			migrations = append(migrations, version)
		}
		
		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	// Sort migrations by version
	sort.Strings(migrations)
	return migrations, nil
}

// runMigration executes a migration file
func (m *Migrator) runMigration(version, suffix string) error {
	filename := fmt.Sprintf("%s%s", version, suffix)
	filePath := filepath.Join(m.migrationsPath, filename)
	
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", filePath, err)
	}
	
	// Split SQL content by semicolons and execute each statement
	statements := strings.Split(string(content), ";")
	
	return m.db.Transaction(func(tx *gorm.DB) error {
		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" || strings.HasPrefix(stmt, "--") {
				continue
			}
			
			if err := tx.Exec(stmt).Error; err != nil {
				return fmt.Errorf("failed to execute statement '%s': %w", stmt, err)
			}
		}
		return nil
	})
}

// recordMigration records a migration as applied
func (m *Migrator) recordMigration(version string) error {
	query := "INSERT INTO schema_migrations (version) VALUES (?)"
	return m.db.Exec(query, version).Error
}

// removeMigrationRecord removes a migration record
func (m *Migrator) removeMigrationRecord(version string) error {
	query := "DELETE FROM schema_migrations WHERE version = ?"
	return m.db.Exec(query, version).Error
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
