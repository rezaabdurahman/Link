package migrations

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDatabase creates a database connection using environment variables
func ConnectDatabase() (*gorm.DB, error) {
	config := GetDatabaseConfigFromEnv()
	return ConnectWithConfig(config)
}

// ConnectWithConfig creates a database connection using provided configuration
func ConnectWithConfig(config *DatabaseConfig) (*gorm.DB, error) {
	dsn := config.GetDSN()
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Test the connection
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// GetDatabaseConfigFromEnv reads database configuration from environment variables
func GetDatabaseConfigFromEnv() *DatabaseConfig {
	return &DatabaseConfig{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", ""),
		Database: getEnv("DB_NAME", "postgres"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}
}

// getEnv gets an environment variable with a fallback default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ValidateMigrationsPath checks if the migrations directory exists and is accessible
func ValidateMigrationsPath(path string) error {
	if path == "" {
		return fmt.Errorf("migrations path cannot be empty")
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("migrations directory does not exist: %s", path)
		}
		return fmt.Errorf("cannot access migrations directory: %w", err)
	}

	if !info.IsDir() {
		return fmt.Errorf("migrations path is not a directory: %s", path)
	}

	return nil
}

// FindMigrationsPath attempts to find the migrations directory relative to the current working directory
func FindMigrationsPath() (string, error) {
	// Common migration directory patterns
	patterns := []string{
		"migrations",
		"./migrations",
		"../migrations",
		"db/migrations",
		"sql/migrations",
	}

	for _, pattern := range patterns {
		absPath, err := filepath.Abs(pattern)
		if err != nil {
			continue
		}

		if err := ValidateMigrationsPath(absPath); err == nil {
			return absPath, nil
		}
	}

	return "", fmt.Errorf("migrations directory not found in common locations")
}

// ParseVersion extracts version number from migration filename
func ParseVersion(filename string) (int, error) {
	// Handle both naming conventions
	var versionStr string
	
	// Pattern: NNN_description.up.sql
	if parts := strings.Split(filename, "."); len(parts) >= 3 {
		baseName := strings.Join(parts[:len(parts)-2], ".")
		if underscoreIndex := strings.Index(baseName, "_"); underscoreIndex != -1 {
			versionStr = baseName[:underscoreIndex]
		}
	}
	
	// Pattern: NNN_description_up.sql
	if versionStr == "" {
		if strings.Contains(filename, "_up.sql") || strings.Contains(filename, "_down.sql") {
			baseName := strings.TrimSuffix(strings.TrimSuffix(filename, "_up.sql"), "_down.sql")
			if underscoreIndex := strings.Index(baseName, "_"); underscoreIndex != -1 {
				versionStr = baseName[:underscoreIndex]
			}
		}
	}

	if versionStr == "" {
		return 0, fmt.Errorf("cannot parse version from filename: %s", filename)
	}

	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return 0, fmt.Errorf("invalid version number in filename %s: %w", filename, err)
	}

	return version, nil
}

// GenerateMigrationFiles creates migration file templates
func GenerateMigrationFiles(migrationsPath, description string) (string, string, error) {
	if err := ValidateMigrationsPath(migrationsPath); err != nil {
		return "", "", fmt.Errorf("invalid migrations path: %w", err)
	}

	// Find next version number
	nextVersion, err := getNextMigrationVersion(migrationsPath)
	if err != nil {
		return "", "", fmt.Errorf("failed to determine next version: %w", err)
	}

	// Clean description for filename
	cleanDescription := strings.ReplaceAll(description, " ", "_")
	cleanDescription = strings.ToLower(cleanDescription)
	
	// Generate filenames
	upFileName := fmt.Sprintf("%03d_%s.up.sql", nextVersion, cleanDescription)
	downFileName := fmt.Sprintf("%03d_%s.down.sql", nextVersion, cleanDescription)
	
	upPath := filepath.Join(migrationsPath, upFileName)
	downPath := filepath.Join(migrationsPath, downFileName)

	// Create up migration template
	upTemplate := fmt.Sprintf(`-- Migration: %s
-- Version: %03d
-- Description: %s
-- Created: %s

-- Add your up migration SQL here
-- Example:
-- CREATE TABLE example (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

`, description, nextVersion, description, time.Now().Format(time.RFC3339))

	// Create down migration template
	downTemplate := fmt.Sprintf(`-- Migration: %s (DOWN)
-- Version: %03d
-- Description: Rollback %s
-- Created: %s

-- Add your down migration SQL here
-- This should reverse the changes made in the up migration
-- Example:
-- DROP TABLE IF EXISTS example;

`, description, nextVersion, description, time.Now().Format(time.RFC3339))

	// Write files
	if err := os.WriteFile(upPath, []byte(upTemplate), 0644); err != nil {
		return "", "", fmt.Errorf("failed to create up migration file: %w", err)
	}

	if err := os.WriteFile(downPath, []byte(downTemplate), 0644); err != nil {
		// Clean up up file if down file creation fails
		os.Remove(upPath)
		return "", "", fmt.Errorf("failed to create down migration file: %w", err)
	}

	return upPath, downPath, nil
}

// getNextMigrationVersion finds the next available migration version number
func getNextMigrationVersion(migrationsPath string) (int, error) {
	maxVersion := 0

	err := filepath.WalkDir(migrationsPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		version, err := ParseVersion(d.Name())
		if err != nil {
			// Skip files that don't match migration pattern
			return nil
		}

		if version > maxVersion {
			maxVersion = version
		}

		return nil
	})

	if err != nil {
		return 0, fmt.Errorf("failed to scan migrations directory: %w", err)
	}

	return maxVersion + 1, nil
}

// WaitForDatabase waits for database to become available
func WaitForDatabase(config *DatabaseConfig, maxRetries int, retryInterval time.Duration) error {
	for i := 0; i < maxRetries; i++ {
		db, err := ConnectWithConfig(config)
		if err == nil {
			// Test connection
			sqlDB, err := db.DB()
			if err == nil {
				if err := sqlDB.Ping(); err == nil {
					sqlDB.Close()
					return nil
				}
				sqlDB.Close()
			}
		}

		if i < maxRetries-1 {
			fmt.Printf("Database not ready, retrying in %v... (%d/%d)\n", retryInterval, i+1, maxRetries)
			time.Sleep(retryInterval)
		}
	}

	return fmt.Errorf("database not available after %d retries", maxRetries)
}
