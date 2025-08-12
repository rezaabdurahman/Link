package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/link-app/discovery-svc/internal/migrations"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	var (
		action = flag.String("action", "up", "Migration action: 'up' or 'down'")
		help   = flag.Bool("help", false, "Show help message")
	)
	flag.Parse()

	if *help {
		printHelp()
		os.Exit(0)
	}

	if *action != "up" && *action != "down" {
		log.Fatal("Invalid action. Use 'up' or 'down'")
	}

	// Initialize database connection
	db, err := initDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize migrator
	migrationsPath := filepath.Join(".", "migrations")
	migrator := migrations.NewMigrator(db, migrationsPath)

	// Run migrations
	switch *action {
	case "up":
		log.Println("Running migrations...")
		err = migrator.MigrateUp()
		if err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
		log.Println("Migrations completed successfully")
	case "down":
		log.Println("Rolling back latest migration...")
		err = migrator.MigrateDown()
		if err != nil {
			log.Fatalf("Failed to rollback migration: %v", err)
		}
		log.Println("Migration rollback completed successfully")
	}
}

func initDB() (*gorm.DB, error) {
	// Database connection parameters
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "link_user")
	password := getEnv("DB_PASSWORD", "link_pass")
	dbname := getEnv("DB_NAME", "link_app")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		host, user, password, dbname, port)

	// Use minimal logging for migration tool
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			LogLevel: logger.Silent, // Only show errors
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func printHelp() {
	fmt.Println("Discovery Service Migration Tool")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  go run cmd/migrate/main.go [flags]")
	fmt.Println("")
	fmt.Println("Flags:")
	fmt.Println("  -action string")
	fmt.Println("        Migration action: 'up' or 'down' (default 'up')")
	fmt.Println("  -help")
	fmt.Println("        Show this help message")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  # Run all pending migrations")
	fmt.Println("  go run cmd/migrate/main.go -action=up")
	fmt.Println("")
	fmt.Println("  # Rollback the latest migration")
	fmt.Println("  go run cmd/migrate/main.go -action=down")
	fmt.Println("")
	fmt.Println("Environment Variables:")
	fmt.Println("  DB_HOST     Database host (default: localhost)")
	fmt.Println("  DB_PORT     Database port (default: 5432)")
	fmt.Println("  DB_USER     Database user (default: link_user)")
	fmt.Println("  DB_PASSWORD Database password (default: link_pass)")
	fmt.Println("  DB_NAME     Database name (default: link_app)")
}
