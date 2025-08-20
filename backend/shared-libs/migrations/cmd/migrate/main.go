package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/link-app/shared-libs/migrations"
)

func main() {
	var (
		action      = flag.String("action", "up", "Migration action: 'up', 'down', 'status', 'generate', or 'verify'")
		serviceName = flag.String("service", "", "Service name (required)")
		migrationsPath = flag.String("path", "", "Path to migrations directory (optional, will auto-detect if not provided)")
		description = flag.String("description", "", "Description for new migration (required for 'generate' action)")
		dryRun      = flag.Bool("dry-run", false, "Show what would be executed without actually running migrations")
		// force       = flag.Bool("force", false, "Force migration even if checksums don't match")
		autoConfirm = flag.Bool("yes", false, "Skip confirmation prompts")
		help        = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		printHelp()
		os.Exit(0)
	}

	if *serviceName == "" {
		fmt.Fprintf(os.Stderr, "Error: Service name is required\n")
		printUsage()
		os.Exit(1)
	}

	if *action == "generate" && *description == "" {
		fmt.Fprintf(os.Stderr, "Error: Description is required for 'generate' action\n")
		printUsage()
		os.Exit(1)
	}

	// Auto-detect migrations path if not provided
	if *migrationsPath == "" {
		path, err := migrations.FindMigrationsPath()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: Could not find migrations directory: %v\n", err)
			fmt.Fprintf(os.Stderr, "Please specify the path with -path flag\n")
			os.Exit(1)
		}
		*migrationsPath = path
	}

	// Validate migrations path
	if err := migrations.ValidateMigrationsPath(*migrationsPath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// Handle generate action separately (doesn't need database connection)
	if *action == "generate" {
		if err := generateMigration(*migrationsPath, *description); err != nil {
			fmt.Fprintf(os.Stderr, "Error generating migration: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// Connect to database
	db, err := migrations.ConnectDatabase()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error connecting to database: %v\n", err)
		os.Exit(1)
	}

	// Get underlying sql.DB for connection management
	sqlDB, err := db.DB()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting database connection: %v\n", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	// Create migration engine
	engine := migrations.NewMigrationEngine(db, *serviceName, *migrationsPath)
	
	// Configure engine based on flags
	config := &migrations.Config{
		DryRun:          *dryRun,
		UseTransactions: true,
	}
	engine = engine.WithConfig(config)

	// Execute the requested action
	switch *action {
	case "up":
		if err := runMigrateUp(engine, *autoConfirm); err != nil {
			fmt.Fprintf(os.Stderr, "Error running migrations: %v\n", err)
			os.Exit(1)
		}
	case "down":
		if err := runMigrateDown(engine, *autoConfirm); err != nil {
			fmt.Fprintf(os.Stderr, "Error rolling back migration: %v\n", err)
			os.Exit(1)
		}
	case "status":
		if err := showStatus(engine); err != nil {
			fmt.Fprintf(os.Stderr, "Error getting migration status: %v\n", err)
			os.Exit(1)
		}
	case "verify":
		if err := verifyIntegrity(engine); err != nil {
			fmt.Fprintf(os.Stderr, "Error verifying migrations: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "Error: Invalid action '%s'\n", *action)
		printUsage()
		os.Exit(1)
	}
}

func runMigrateUp(engine *migrations.MigrationEngine, autoConfirm bool) error {
	// Check status first
	status, err := engine.GetStatus()
	if err != nil {
		return fmt.Errorf("failed to get migration status: %w", err)
	}

	if status.Pending == 0 {
		fmt.Println("✅ No pending migrations found")
		return nil
	}

	fmt.Printf("Found %d pending migrations for service '%s':\n", status.Pending, status.Service)
	
	// Show pending migrations
	pending, err := engine.GetPendingMigrations()
	if err != nil {
		return fmt.Errorf("failed to get pending migrations: %w", err)
	}

	for _, migration := range pending {
		fmt.Printf("  - %03d_%s\n", migration.Version, migration.Name)
	}

	// Confirm before proceeding
	if !autoConfirm {
		if !confirm(fmt.Sprintf("Apply %d migrations?", len(pending))) {
			fmt.Println("Migration cancelled by user")
			return nil
		}
	}

	// Run migrations
	return engine.MigrateUp()
}

func runMigrateDown(engine *migrations.MigrationEngine, autoConfirm bool) error {
	// Check status first
	applied, err := engine.GetAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	if len(applied) == 0 {
		fmt.Println("✅ No migrations to rollback")
		return nil
	}

	latest := applied[len(applied)-1]
	fmt.Printf("Latest applied migration: %03d_%s\n", latest.Version, latest.Name)
	if latest.AppliedAt != nil {
		fmt.Printf("Applied at: %s\n", latest.AppliedAt.Format(time.RFC3339))
	}

	// Confirm before proceeding
	if !autoConfirm {
		if !confirm(fmt.Sprintf("Rollback migration %03d_%s?", latest.Version, latest.Name)) {
			fmt.Println("Rollback cancelled by user")
			return nil
		}
	}

	// Run rollback
	return engine.MigrateDown()
}

func showStatus(engine *migrations.MigrationEngine) error {
	status, err := engine.GetStatus()
	if err != nil {
		return fmt.Errorf("failed to get migration status: %w", err)
	}

	fmt.Println("=== Migration Status ===")
	fmt.Print(status.String())

	if status.Pending > 0 {
		fmt.Println("\nPending migrations:")
		pending, err := engine.GetPendingMigrations()
		if err != nil {
			return fmt.Errorf("failed to get pending migrations: %w", err)
		}

		for _, migration := range pending {
			fmt.Printf("  📋 %03d_%s\n", migration.Version, migration.Name)
		}
	}

	if status.Applied > 0 {
		fmt.Println("\nApplied migrations:")
		applied, err := engine.GetAppliedMigrations()
		if err != nil {
			return fmt.Errorf("failed to get applied migrations: %w", err)
		}

		for _, migration := range applied {
			fmt.Printf("  ✅ %03d_%s", migration.Version, migration.Name)
			if migration.AppliedAt != nil {
				fmt.Printf(" (applied: %s)", migration.AppliedAt.Format("2006-01-02 15:04:05"))
			}
			fmt.Println()
		}
	}

	return nil
}

func verifyIntegrity(engine *migrations.MigrationEngine) error {
	fmt.Println("🔍 Verifying migration integrity...")
	return engine.VerifyIntegrity()
}

func generateMigration(migrationsPath, description string) error {
	fmt.Printf("Generating new migration: %s\n", description)
	
	upFile, downFile, err := migrations.GenerateMigrationFiles(migrationsPath, description)
	if err != nil {
		return fmt.Errorf("failed to generate migration files: %w", err)
	}

	fmt.Printf("✅ Created migration files:\n")
	fmt.Printf("  📄 Up:   %s\n", filepath.Base(upFile))
	fmt.Printf("  📄 Down: %s\n", filepath.Base(downFile))
	fmt.Printf("\nEdit the files to add your SQL statements, then run:\n")
	fmt.Printf("  migrate -service=%s -action=up\n", "YOUR_SERVICE_NAME")

	return nil
}

func confirm(message string) bool {
	fmt.Printf("%s [y/N]: ", message)
	
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		response := strings.ToLower(strings.TrimSpace(scanner.Text()))
		return response == "y" || response == "yes"
	}
	
	return false
}

func printUsage() {
	fmt.Fprintf(os.Stderr, "Usage: migrate -service=SERVICE_NAME [options]\n")
	fmt.Fprintf(os.Stderr, "Run 'migrate -help' for detailed help\n")
}

func printHelp() {
	fmt.Println("Link Migration Tool")
	fmt.Println("==================")
	fmt.Println()
	fmt.Println("A unified migration tool for all Link microservices.")
	fmt.Println()
	fmt.Println("USAGE:")
	fmt.Println("  migrate -service=SERVICE_NAME [options]")
	fmt.Println()
	fmt.Println("ACTIONS:")
	fmt.Println("  up        Apply all pending migrations (default)")
	fmt.Println("  down      Rollback the latest migration")
	fmt.Println("  status    Show migration status")
	fmt.Println("  generate  Create new migration files")
	fmt.Println("  verify    Verify migration integrity")
	fmt.Println()
	fmt.Println("FLAGS:")
	fmt.Println("  -service string")
	fmt.Println("        Service name (required)")
	fmt.Println("  -action string")
	fmt.Println("        Migration action (default: 'up')")
	fmt.Println("  -path string")
	fmt.Println("        Path to migrations directory (auto-detected if not provided)")
	fmt.Println("  -description string")
	fmt.Println("        Description for new migration (required for 'generate')")
	fmt.Println("  -dry-run")
	fmt.Println("        Show what would be executed without running")
	fmt.Println("  -force")
	fmt.Println("        Force migration even if checksums don't match")
	fmt.Println("  -yes")
	fmt.Println("        Skip confirmation prompts")
	fmt.Println("  -help")
	fmt.Println("        Show this help message")
	fmt.Println()
	fmt.Println("EXAMPLES:")
	fmt.Println("  # Apply all pending migrations for discovery service")
	fmt.Println("  migrate -service=discovery-svc -action=up")
	fmt.Println()
	fmt.Println("  # Check migration status")
	fmt.Println("  migrate -service=ai-svc -action=status")
	fmt.Println()
	fmt.Println("  # Generate new migration")
	fmt.Println("  migrate -action=generate -description=\"add user preferences table\"")
	fmt.Println()
	fmt.Println("  # Rollback latest migration")
	fmt.Println("  migrate -service=chat-svc -action=down")
	fmt.Println()
	fmt.Println("  # Dry run to see what would be executed")
	fmt.Println("  migrate -service=discovery-svc -action=up -dry-run")
	fmt.Println()
	fmt.Println("ENVIRONMENT VARIABLES:")
	fmt.Println("  DB_HOST        Database host (default: localhost)")
	fmt.Println("  DB_PORT        Database port (default: 5432)")
	fmt.Println("  DB_USER        Database user (default: postgres)")
	fmt.Println("  DB_PASSWORD    Database password")
	fmt.Println("  DB_NAME        Database name (default: postgres)")
	fmt.Println("  DB_SSLMODE     SSL mode (default: disable)")
	fmt.Println()
	fmt.Println("MIGRATION FILE NAMING:")
	fmt.Println("  Files should follow the pattern: NNN_description.up.sql and NNN_description.down.sql")
	fmt.Println("  Example: 001_create_users_table.up.sql, 001_create_users_table.down.sql")
	fmt.Println()
}
