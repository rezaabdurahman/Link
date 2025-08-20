package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/link-app/chat-svc/internal/config"
	"github.com/link-app/shared-libs/database/monitoring"
)

// Database wraps the pgx connection pool with monitoring
type Database struct {
	*monitoring.MonitoredPool
	sentryWrapper *monitoring.PgxSentryWrapper
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

	// Set up database monitoring
	monitoringConfig := monitoring.DefaultConfig("chat-svc")
	// Real-time messaging requires fast queries
	monitoringConfig.SlowQueryThreshold = 50 * time.Millisecond

	// Create pgx instrumentation
	pgxInstrumentation := monitoring.NewPgxInstrumentation(monitoringConfig)
	monitoredPool := pgxInstrumentation.WrapPool(pool)

	// Set up Sentry integration for pgx
	var sentryWrapper *monitoring.PgxSentryWrapper
	// Check environment through environment variable since cfg doesn't have Environment field
	env := getEnv("ENVIRONMENT", "development")
	if env != "test" && getEnv("SENTRY_DSN", "") != "" {
		sentryWrapper = monitoring.NewPgxSentryWrapper("chat-svc", monitoringConfig.SlowQueryThreshold)
	}

	return &Database{
		MonitoredPool: monitoredPool,
		sentryWrapper: sentryWrapper,
	}, nil
}

// Close closes the database connection pool
func (d *Database) Close() {
	d.MonitoredPool.Close()
}

// Health checks if the database is healthy
func (d *Database) Health() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := d.MonitoredPool.Ping(ctx); err != nil {
		return fmt.Errorf("database health check failed: %w", err)
	}

	return nil
}

// Query wraps the monitored pool's Query method with additional Sentry reporting
func (d *Database) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if d.sentryWrapper != nil {
		d.sentryWrapper.AddQueryBreadcrumb(sql, args)
	}
	
	start := time.Now()
	rows, err := d.MonitoredPool.Query(ctx, sql, args...)
	duration := time.Since(start)
	
	if d.sentryWrapper != nil {
		if err != nil {
			d.sentryWrapper.ReportQueryError(ctx, sql, err, duration)
		} else {
			d.sentryWrapper.ReportSlowQuery(ctx, sql, duration)
		}
	}
	
	return rows, err
}

// QueryRow wraps the monitored pool's QueryRow method with additional Sentry reporting
func (d *Database) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	if d.sentryWrapper != nil {
		d.sentryWrapper.AddQueryBreadcrumb(sql, args)
	}
	
	start := time.Now()
	row := d.MonitoredPool.QueryRow(ctx, sql, args...)
	duration := time.Since(start)
	
	if d.sentryWrapper != nil {
		d.sentryWrapper.ReportSlowQuery(ctx, sql, duration)
	}
	
	return row
}

// Exec wraps the monitored pool's Exec method with additional Sentry reporting
func (d *Database) Exec(ctx context.Context, sql string, args ...interface{}) (interface{}, error) {
	if d.sentryWrapper != nil {
		d.sentryWrapper.AddQueryBreadcrumb(sql, args)
	}
	
	start := time.Now()
	tag, err := d.MonitoredPool.Exec(ctx, sql, args...)
	duration := time.Since(start)
	
	if d.sentryWrapper != nil {
		if err != nil {
			d.sentryWrapper.ReportQueryError(ctx, sql, err, duration)
		} else {
			d.sentryWrapper.ReportSlowQuery(ctx, sql, duration)
		}
	}
	
	return tag, err
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
