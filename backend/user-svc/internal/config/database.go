package config

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	
	sharedConfig "github.com/link-app/shared-libs/config"
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

// GetDatabaseConfig returns database configuration using shared secrets management
func GetDatabaseConfig() *DatabaseConfig {
	return &DatabaseConfig{
		Host:     sharedConfig.GetEnv("DB_HOST", "localhost"),
		Port:     sharedConfig.GetEnv("DB_PORT", "5432"),
		User:     sharedConfig.GetEnv("DB_USER", "linkuser"),
		Password: sharedConfig.GetDatabasePassword(), // Use shared secrets management
		DBName:   sharedConfig.GetEnv("DB_NAME", "linkdb"),
		SSLMode:  sharedConfig.GetEnv("DB_SSL_MODE", "disable"),
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
	if sharedConfig.GetEnv("ENVIRONMENT", "development") == "production" {
		gormConfig.Logger = logger.Default.LogMode(logger.Error)
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Simplified database setup for testing

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
	// Note: Commented out due to "insufficient arguments" error - using existing tables
	// if sharedConfig.GetEnv("ENVIRONMENT", "development") == "development" {
	//	if err := db.AutoMigrate(
	//		&models.User{},
	//		&models.Friendship{},
	//		&models.FriendRequest{},
	//		&models.Session{},
	//		&onboarding.OnboardingProgress{},
	//		&onboarding.UserPreferences{},
	//	); err != nil {
	//		return nil, fmt.Errorf("failed to run auto migration: %w", err)
	//	}
	// }

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

