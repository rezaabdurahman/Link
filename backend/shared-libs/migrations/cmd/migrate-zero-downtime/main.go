package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/link-app/shared-libs/migrations"
)

func main() {
	var (
		action         = flag.String("action", "", "Action to perform: zero-downtime-up, zero-downtime-down, status, verify")
		service        = flag.String("service", "", "Service name (auto-detected if not provided)")
		migrationsPath = flag.String("path", "migrations", "Path to migrations directory")
		dryRun         = flag.Bool("dry-run", false, "Show what would be done without executing")
		timeout        = flag.Duration("timeout", 30*time.Minute, "Migration timeout")
		chunkSize      = flag.Int("chunk-size", 1000, "Chunk size for large data migrations")
		maxRetries     = flag.Int("max-retries", 3, "Maximum retry attempts")
		verbose        = flag.Bool("verbose", false, "Enable verbose logging")
		help           = flag.Bool("help", false, "Show help")
	)

	flag.Parse()

	if *help {
		showHelp()
		return
	}

	if *action == "" {
		log.Fatal("Action is required. Use -help for usage information.")
	}

	// Auto-detect service name if not provided
	if *service == "" {
		cwd, err := os.Getwd()
		if err != nil {
			log.Fatal("Failed to get current directory:", err)
		}
		*service = filepath.Base(cwd)
	}

	// Set up logging level
	logLevel := logger.Silent
	if *verbose {
		logLevel = logger.Info
	}

	// Connect to database
	db, err := connectDatabase(logLevel)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Failed to get SQL DB:", err)
	}
	defer sqlDB.Close()

	// Create zero-downtime migration engine
	engine := migrations.NewZeroDowntimeEngine(db, *service, *migrationsPath)
	
	// Configure zero-downtime settings
	config := &migrations.ZeroDowntimeConfig{
		MaxLockTimeout: 30 * time.Second,
		ChunkSize:      *chunkSize,
		PreMigrationChecks: []migrations.HealthCheck{
			migrations.CheckDatabaseConnections,
			migrations.CheckDiskSpace,
			migrations.CheckReplicationLag,
		},
		PostMigrationChecks: []migrations.HealthCheck{
			migrations.CheckSchemaIntegrity,
			migrations.CheckDataConsistency,
		},
		ConnectionPoolSettings: &migrations.ConnectionPoolConfig{
			MaxOpenConns:    10,
			MaxIdleConns:    5,
			ConnMaxLifetime: 5 * time.Minute,
			ConnMaxIdleTime: 1 * time.Minute,
		},
	}
	
	engine = engine.WithZeroDowntimeConfig(config)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	// Execute action
	switch *action {
	case "zero-downtime-up":
		err = executeZeroDowntimeUp(ctx, engine, *dryRun, *maxRetries)
	case "zero-downtime-down":
		err = executeZeroDowntimeDown(ctx, engine, *dryRun)
	case "status":
		err = executeStatus(ctx, engine.MigrationEngine)
	case "verify":
		err = executeVerify(ctx, engine.MigrationEngine)
	default:
		log.Fatalf("Unknown action: %s", *action)
	}

	if err != nil {
		log.Fatal("Migration failed:", err)
	}

	log.Println("Migration completed successfully")
}

func showHelp() {
	fmt.Println(`Zero-Downtime Migration Tool for Link Services

USAGE:
    migrate-zero-downtime [OPTIONS]

ACTIONS:
    zero-downtime-up    Apply pending migrations using zero-downtime strategies
    zero-downtime-down  Rollback the last migration using zero-downtime strategies  
    status             Show current migration status
    verify             Verify migration integrity

OPTIONS:
    -action string      Action to perform (required)
    -service string     Service name (auto-detected from directory)
    -path string        Path to migrations directory (default: "migrations")
    -dry-run           Show what would be done without executing
    -timeout duration   Migration timeout (default: 30m)
    -chunk-size int     Chunk size for large data migrations (default: 1000)
    -max-retries int    Maximum retry attempts (default: 3)
    -verbose           Enable verbose logging
    -help              Show this help

EXAMPLES:
    # Apply migrations with zero-downtime
    ./migrate-zero-downtime -action=zero-downtime-up
    
    # Dry run to see what would happen
    ./migrate-zero-downtime -action=zero-downtime-up -dry-run
    
    # Apply with custom chunk size for large data migrations
    ./migrate-zero-downtime -action=zero-downtime-up -chunk-size=5000
    
    # Check status
    ./migrate-zero-downtime -action=status
    
    # Rollback last migration
    ./migrate-zero-downtime -action=zero-downtime-down

ENVIRONMENT VARIABLES:
    DB_HOST       Database host (default: localhost)
    DB_PORT       Database port (default: 5432)
    DB_USER       Database user (default: linkuser)
    DB_PASSWORD   Database password (default: linkpass)
    DB_NAME       Database name (default: linkdb)
    DB_SSLMODE    SSL mode (default: disable)

ZERO-DOWNTIME STRATEGIES:
    - Safe migrations: Basic safety measures with timeouts
    - Chunked migrations: Large data operations split into chunks
    - Background migrations: Concurrent index creation
    - Manual migrations: Operations requiring manual intervention

HEALTH CHECKS:
    Pre-migration:  Database connections, disk space, replication lag
    Post-migration: Schema integrity, data consistency

For more information, see the migration documentation.`)
}

func connectDatabase(logLevel logger.LogLevel) (*gorm.DB, error) {
	host := getEnvOrDefault("DB_HOST", "localhost")
	port := getEnvOrDefault("DB_PORT", "5432")
	user := getEnvOrDefault("DB_USER", "linkuser")
	password := getEnvOrDefault("DB_PASSWORD", "linkpass")
	dbname := getEnvOrDefault("DB_NAME", "linkdb")
	sslmode := getEnvOrDefault("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	return gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
}

func executeZeroDowntimeUp(ctx context.Context, engine *migrations.ZeroDowntimeEngine, dryRun bool, maxRetries int) error {
	if dryRun {
		log.Println("DRY RUN: Zero-downtime migration up")
		pending, err := engine.GetPendingMigrations()
		if err != nil {
			return err
		}

		if len(pending) == 0 {
			log.Println("No pending migrations")
			return nil
		}

		log.Printf("Would apply %d migrations:", len(pending))
		for _, migration := range pending {
			log.Printf("  - %s", migration.Name)
		}
		return nil
	}

	// Retry logic
	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("Zero-downtime migration attempt %d/%d", attempt, maxRetries)
		
		err := engine.SafeUp(ctx)
		if err == nil {
			log.Println("Zero-downtime migration completed successfully")
			return nil
		}

		log.Printf("Attempt %d failed: %v", attempt, err)
		
		if attempt < maxRetries {
			log.Printf("Retrying in 30 seconds...")
			time.Sleep(30 * time.Second)
		}
	}

	return fmt.Errorf("zero-downtime migration failed after %d attempts", maxRetries)
}

func executeZeroDowntimeDown(ctx context.Context, engine *migrations.ZeroDowntimeEngine, dryRun bool) error {
	if dryRun {
		log.Println("DRY RUN: Zero-downtime migration down")
		// Show what would be rolled back
		status, err := engine.GetStatus()
		if err != nil {
			return err
		}
		
		if status.CurrentVersion == 0 {
			log.Println("No migrations to rollback")
			return nil
		}
		
		log.Printf("Would rollback migration version %d", status.CurrentVersion)
		return nil
	}

	log.Println("Rolling back last migration with zero-downtime strategy...")
	
	// For now, delegate to the regular migration engine
	// In a full implementation, this would use zero-downtime rollback strategies
	return engine.MigrationEngine.MigrateDown()
}

func executeStatus(ctx context.Context, engine *migrations.MigrationEngine) error {
	status, err := engine.GetStatus()
	if err != nil {
		return err
	}

	fmt.Printf("Service: %s\n", status.Service)
	fmt.Printf("Current Version: %d\n", status.CurrentVersion)
	fmt.Printf("Applied Migrations: %d\n", status.Applied)
	fmt.Printf("Pending Migrations: %d\n", status.Pending)
	fmt.Printf("Last Applied: %s\n", status.LastApplied.Format("2006-01-02 15:04:05"))

	if status.Pending > 0 {
		pending, err := engine.GetPendingMigrations()
		if err != nil {
			return err
		}

		fmt.Println("\nPending migrations:")
		for _, migration := range pending {
			fmt.Printf("  - %s\n", migration.Name)
		}
	}

	return nil
}

func executeVerify(ctx context.Context, engine *migrations.MigrationEngine) error {
	log.Println("Verifying migration integrity...")
	
	if err := engine.VerifyIntegrity(); err != nil {
		return fmt.Errorf("verification failed: %w", err)
	}

	log.Println("Migration verification passed")
	return nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}