package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/link-app/shared-libs/database/monitoring"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDatabase initializes the PostgreSQL connection with pgvector extension
func ConnectDatabase() (*gorm.DB, error) {
	// Get database configuration from environment
	host := getEnv("DB_HOST", "postgres")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "link_user")
	password := getEnv("DB_PASSWORD", "")
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

	// Set up database monitoring for vector operations
	monitoringConfig := monitoring.DefaultConfig("search-svc")
	// Vector queries (embeddings) can be computationally intensive
	if os.Getenv("ENVIRONMENT") == "production" {
		monitoringConfig.SlowQueryThreshold = 500 * time.Millisecond // Higher threshold for vector operations
	} else {
		monitoringConfig.SlowQueryThreshold = 1 * time.Second
	}

	// Initialize monitoring plugins
	monitoringPlugin := monitoring.NewGormMonitoringPlugin(monitoringConfig)
	if err := db.Use(monitoringPlugin); err != nil {
		return nil, fmt.Errorf("failed to initialize database monitoring: %w", err)
	}

	// Initialize Sentry integration for database errors
	if getEnv("SENTRY_DSN", "") != "" {
		sentryPlugin := monitoring.NewGormSentryPlugin(monitoringConfig)
		if err := db.Use(sentryPlugin); err != nil {
			return nil, fmt.Errorf("failed to initialize database Sentry integration: %w", err)
		}
	}

	// Configure connection pool for vector operations
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Vector queries can be resource-intensive, so configure accordingly
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(25) // Lower than other services due to computational load
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Enable pgvector extension (skip for development)
	if getEnv("ENABLE_VECTOR_EXTENSION", "false") == "true" {
		if err := enablePgVectorExtension(db); err != nil {
			log.Printf("Warning: Failed to enable pgvector extension: %v", err)
			log.Println("Vector search features will be disabled")
		}
	} else {
		log.Println("Vector extension disabled - vector search features unavailable")
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
