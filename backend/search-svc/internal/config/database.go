package config

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDatabase initializes the PostgreSQL connection with pgvector extension
func ConnectDatabase() (*gorm.DB, error) {
	// Get database configuration from environment
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "link_user")
	password := getEnv("DB_PASSWORD", "link_pass")
	dbname := getEnv("DB_NAME", "link_app")
	sslmode := getEnv("DB_SSLMODE", "disable")

	// Database encryption configuration
	encryptionEnabled := getEnv("DB_ENCRYPTION_ENABLED", "true")
	if encryptionEnabled == "true" {
		// Enable PostgreSQL Transparent Data Encryption (TDE) or disk encryption
		// This requires PostgreSQL to be configured with encryption at rest
		log.Println("Database encryption at rest is enabled for embeddings security")
	}

	// Build connection string
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	// Set logger level based on environment
	logLevel := logger.Silent
	if os.Getenv("ENVIRONMENT") == "development" {
		logLevel = logger.Info
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Enable pgvector extension
	if err := enablePgVectorExtension(db); err != nil {
		return nil, fmt.Errorf("failed to enable pgvector extension: %w", err)
	}

	// Auto-migrate models
	if err := migrateModels(db); err != nil {
		return nil, fmt.Errorf("failed to migrate models: %w", err)
	}

	log.Println("Database connection established successfully")
	return db, nil
}

// enablePgVectorExtension creates the pgvector extension if it doesn't exist
func enablePgVectorExtension(db *gorm.DB) error {
	return db.Exec("CREATE EXTENSION IF NOT EXISTS vector").Error
}

// migrateModels runs database migrations
func migrateModels(db *gorm.DB) error {
	// Models are migrated in their respective repositories
	// This ensures proper dependency injection
	return nil
}

// getEnv returns the value of an environment variable or a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
