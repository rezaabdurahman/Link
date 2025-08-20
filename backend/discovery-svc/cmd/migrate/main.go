package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/link-app/shared-libs/migrations"
)

func main() {
	var (
		action = flag.String("action", "up", "Migration action: 'up', 'down', 'status', or 'verify'")
		help   = flag.Bool("help", false, "Show help message")
		dryRun = flag.Bool("dry-run", false, "Show what would be executed without running")
	)
	flag.Parse()

	if *help {
		printHelp()
		os.Exit(0)
	}

	if *action != "up" && *action != "down" && *action != "status" && *action != "verify" {
		log.Fatal("Invalid action. Use 'up', 'down', 'status', or 'verify'")
	}

	// Use shared migration engine
	migrationsPath := filepath.Join(".", "migrations")
	
	// For up/down actions, wait for database to be ready first
	if *action == "up" || *action == "down" {
		config := migrations.GetDatabaseConfigFromEnv()
		
		log.Println("Waiting for database to be ready...")
		if err := migrations.WaitForDatabase(config, 30, 2*time.Second); err != nil {
			log.Fatalf("Database not available: %v", err)
		}
		log.Println("Database is ready!")
	}

	// Connect to database
	db, err := migrations.ConnectDatabase()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Get underlying sql.DB for connection management
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get database connection: %v", err)
	}
	defer sqlDB.Close()

	// Create migration engine
	engine := migrations.NewMigrationEngine(db, "discovery-svc", migrationsPath)
	
	// Configure for dry run if requested
	if *dryRun {
		config := &migrations.Config{DryRun: true}
		engine = engine.WithConfig(config)
	}

	// Execute action
	switch *action {
	case "up":
		log.Println("Running migrations...")
		if err := engine.MigrateUp(); err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
		log.Println("Migrations completed successfully")
	case "down":
		log.Println("Rolling back latest migration...")
		if err := engine.MigrateDown(); err != nil {
			log.Fatalf("Failed to rollback migration: %v", err)
		}
		log.Println("Migration rollback completed successfully")
	case "status":
		status, err := engine.GetStatus()
		if err != nil {
			log.Fatalf("Failed to get migration status: %v", err)
		}
		fmt.Print(status.String())
	case "verify":
		if err := engine.VerifyIntegrity(); err != nil {
			log.Fatalf("Migration integrity check failed: %v", err)
		}
		log.Println("Migration integrity verified successfully")
	}
}

func printHelp() {
	fmt.Println("Discovery Service Migration Tool (Using Shared Library)")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  go run cmd/migrate/main.go [flags]")
	fmt.Println("")
	fmt.Println("Flags:")
	fmt.Println("  -action string")
	fmt.Println("        Migration action: 'up', 'down', 'status', or 'verify' (default 'up')")
	fmt.Println("  -dry-run")
	fmt.Println("        Show what would be executed without running")
	fmt.Println("  -help")
	fmt.Println("        Show this help message")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  # Run all pending migrations")
	fmt.Println("  go run cmd/migrate/main.go -action=up")
	fmt.Println("")
	fmt.Println("  # Check migration status")
	fmt.Println("  go run cmd/migrate/main.go -action=status")
	fmt.Println("")
	fmt.Println("  # Rollback the latest migration")
	fmt.Println("  go run cmd/migrate/main.go -action=down")
	fmt.Println("")
	fmt.Println("  # Dry run (show what would be executed)")
	fmt.Println("  go run cmd/migrate/main.go -action=up -dry-run")
	fmt.Println("")
	fmt.Println("Environment Variables:")
	fmt.Println("  DB_HOST     Database host (default: localhost)")
	fmt.Println("  DB_PORT     Database port (default: 5432)")
	fmt.Println("  DB_USER     Database user (default: postgres)")
	fmt.Println("  DB_PASSWORD Database password")
	fmt.Println("  DB_NAME     Database name (default: postgres)")
	fmt.Println("  DB_SSLMODE  SSL mode (default: disable)")
}
