package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/link-app/chat-svc/internal/config"
)

// Database wraps the pgx connection pool
type Database struct {
	Pool *pgxpool.Pool
}

// Connect establishes a connection pool to the database
func Connect(cfg config.DatabaseConfig) (*Database, error) {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name, cfg.SSLMode,
	)

	// Configure connection pool
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

	// Test the connection
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &Database{
		Pool: pool,
	}, nil
}

// Close closes the database connection pool
func (d *Database) Close() {
	d.Pool.Close()
}

// Health checks if the database is healthy
func (d *Database) Health() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := d.Pool.Ping(ctx); err != nil {
		return fmt.Errorf("database health check failed: %w", err)
	}

	return nil
}

// Query wraps the pool's Query method
func (d *Database) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return d.Pool.Query(ctx, sql, args...)
}

// QueryRow wraps the pool's QueryRow method
func (d *Database) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return d.Pool.QueryRow(ctx, sql, args...)
}

// Exec wraps the pool's Exec method
func (d *Database) Exec(ctx context.Context, sql string, args ...interface{}) (interface{}, error) {
	return d.Pool.Exec(ctx, sql, args...)
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
