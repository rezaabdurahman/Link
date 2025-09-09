package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	sharedConfig "github.com/link-app/shared-libs/config"
)

// DatabaseType defines the type of database connection
type DatabaseType string

const (
	DatabaseTypeGORM DatabaseType = "gorm"
	DatabaseTypePGX  DatabaseType = "pgx"
)

// Config holds database configuration
type Config struct {
	Host            string
	Port            string
	User            string
	Password        string
	DBName          string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	Type            DatabaseType
	LogLevel        logger.LogLevel
}

// Database interface provides a unified database abstraction
type Database interface {
	// Health checks if the database is healthy
	Health(ctx context.Context) error
	// Close closes the database connection
	Close() error
	// GetGORM returns the GORM instance (only for GORM-based connections)
	GetGORM() (*gorm.DB, error)
	// GetPGXPool returns the pgx pool (only for PGX-based connections)
	GetPGXPool() (*pgxpool.Pool, error)
	// GetSQL returns the underlying sql.DB
	GetSQL() (*sql.DB, error)
}

// GORMDatabase wraps GORM database
type GORMDatabase struct {
	db *gorm.DB
}

func (g *GORMDatabase) Health(ctx context.Context) error {
	sqlDB, err := g.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}
	return sqlDB.PingContext(ctx)
}

func (g *GORMDatabase) Close() error {
	sqlDB, err := g.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}
	return sqlDB.Close()
}

func (g *GORMDatabase) GetGORM() (*gorm.DB, error) {
	return g.db, nil
}

func (g *GORMDatabase) GetPGXPool() (*pgxpool.Pool, error) {
	return nil, fmt.Errorf("GORM database does not support PGX pool")
}

func (g *GORMDatabase) GetSQL() (*sql.DB, error) {
	return g.db.DB()
}

// PGXDatabase wraps pgx connection pool
type PGXDatabase struct {
	pool *pgxpool.Pool
}

func (p *PGXDatabase) Health(ctx context.Context) error {
	return p.pool.Ping(ctx)
}

func (p *PGXDatabase) Close() error {
	p.pool.Close()
	return nil
}

func (p *PGXDatabase) GetGORM() (*gorm.DB, error) {
	return nil, fmt.Errorf("PGX database does not support GORM")
}

func (p *PGXDatabase) GetPGXPool() (*pgxpool.Pool, error) {
	return p.pool, nil
}

func (p *PGXDatabase) GetSQL() (*sql.DB, error) {
	// Return the underlying SQL DB from the pool
	return stdlib.OpenDBFromPool(p.pool), nil
}

// DefaultConfig returns a default database configuration using shared secrets
func DefaultConfig() *Config {
	maxOpenConns := 100
	maxIdleConns := 10
	connMaxLifetime := time.Hour

	// Parse connection settings from environment if available
	if val := sharedConfig.GetEnv("DB_MAX_OPEN_CONNS", ""); val != "" {
		if parsed, err := fmt.Sscanf(val, "%d", &maxOpenConns); err == nil && parsed > 0 {
			// Use parsed value
		}
	}
	
	if val := sharedConfig.GetEnv("DB_MAX_IDLE_CONNS", ""); val != "" {
		if parsed, err := fmt.Sscanf(val, "%d", &maxIdleConns); err == nil && parsed > 0 {
			// Use parsed value
		}
	}

	return &Config{
		Host:            sharedConfig.GetEnv("DB_HOST", "localhost"),
		Port:            sharedConfig.GetEnv("DB_PORT", "5432"),
		User:            sharedConfig.GetEnv("DB_USER", "linkuser"),
		Password:        sharedConfig.GetDatabasePassword(),
		DBName:          sharedConfig.GetEnv("DB_NAME", "linkdb"),
		SSLMode:         sharedConfig.GetEnv("DB_SSL_MODE", "disable"),
		MaxOpenConns:    maxOpenConns,
		MaxIdleConns:    maxIdleConns,
		ConnMaxLifetime: connMaxLifetime,
		Type:            DatabaseTypeGORM, // Default to GORM
		LogLevel:        getLogLevel(),
	}
}

// NewDatabase creates a new database connection based on the configuration
func NewDatabase(cfg *Config) (Database, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	switch cfg.Type {
	case DatabaseTypeGORM:
		return newGORMDatabase(cfg)
	case DatabaseTypePGX:
		return newPGXDatabase(cfg)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.Type)
	}
}

func newGORMDatabase(cfg *Config) (Database, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(cfg.LogLevel),
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database with GORM: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &GORMDatabase{db: db}, nil
}

func newPGXDatabase(cfg *Config) (Database, error) {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName, cfg.SSLMode,
	)

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	poolConfig.MaxConns = int32(cfg.MaxOpenConns)
	poolConfig.MinConns = int32(cfg.MaxIdleConns)
	poolConfig.MaxConnLifetime = cfg.ConnMaxLifetime
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PGXDatabase{pool: pool}, nil
}

func getLogLevel() logger.LogLevel {
	env := sharedConfig.GetEnv("ENVIRONMENT", "development")
	switch env {
	case "production":
		return logger.Error
	case "staging":
		return logger.Warn
	default:
		return logger.Info
	}
}