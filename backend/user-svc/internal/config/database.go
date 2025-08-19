package config

import (
	"fmt"
	"os"
	"time"

	"github.com/link-app/user-svc/internal/models"
	"github.com/link-app/user-svc/internal/onboarding"
	"github.com/link-app/shared/database/monitoring"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// GetDatabaseConfig returns database configuration from environment variables
func GetDatabaseConfig() *DatabaseConfig {
	return &DatabaseConfig{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "linkuser"),
		Password: getEnv("DB_PASSWORD", "linkpass"),
		DBName:   getEnv("DB_NAME", "linkdb"),
		SSLMode:  getEnv("DB_SSL_MODE", "disable"),
	}
}

// ConnectDatabase establishes database connection with user service models
func ConnectDatabase() (*gorm.DB, error) {
	config := GetDatabaseConfig()

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		config.Host, config.Port, config.User, config.Password, config.DBName, config.SSLMode,
	)

	// Set up GORM config
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// Set log level based on environment
	if getEnv("ENVIRONMENT", "development") == "production" {
		gormConfig.Logger = logger.Default.LogMode(logger.Error)
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Set up database monitoring
	monitoringConfig := monitoring.DefaultConfig("user-svc")
	// Adjust slow query threshold based on environment
	if getEnv("ENVIRONMENT", "development") == "production" {
		monitoringConfig.SlowQueryThreshold = 50 * time.Millisecond
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

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Enable required PostgreSQL extensions
	if err := enableExtensions(db); err != nil {
		return nil, fmt.Errorf("failed to enable extensions: %w", err)
	}

	// Auto migrate the schema (for development only)
	if getEnv("ENVIRONMENT", "development") == "development" {
		if err := db.AutoMigrate(
			&models.User{},
			&models.Friendship{},
			&models.FriendRequest{},
			&models.Session{},
			&onboarding.OnboardingProgress{},
			&onboarding.UserPreferences{},
		); err != nil {
			return nil, fmt.Errorf("failed to run auto migration: %w", err)
		}
	}

	return db, nil
}

// enableExtensions enables required PostgreSQL extensions
func enableExtensions(db *gorm.DB) error {
	extensions := []string{
		"CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
	}

	for _, ext := range extensions {
		if err := db.Exec(ext).Error; err != nil {
			return fmt.Errorf("failed to enable extension: %w", err)
		}
	}

	return nil
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
