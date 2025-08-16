package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/link-app/user-svc/internal/config"
	"github.com/link-app/user-svc/internal/montage"
)

const (
	AppName    = "montage-batch"
	AppVersion = "1.0.0"
)

func main() {
	log.Printf("Starting %s v%s", AppName, AppVersion)

	// Load configuration
	cfg := montage.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}

	// Initialize database connection
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize dependencies
	montageRepo := montage.NewGormRepository(db)
	eventPublisher := montage.NewInMemoryEventPublisher() // Use NoOp for production
	
	// Initialize Montage service with batch-specific configuration
	serviceConfig := &montage.Config{
		MaxItemsPerMontage:   cfg.Service.MaxItemsPerMontage,
		MinInterestOccurrence: cfg.Service.MinInterestOccurrence,
		InterestLookbackDays:  cfg.Service.InterestLookbackDays,
		DefaultCacheTTL:      cfg.Service.DefaultCacheTTL,
		BatchSize:           cfg.Service.BatchSize,
	}
	
	montageService := montage.NewService(montageRepo, serviceConfig, eventPublisher)
	
	// Initialize HTTP clients for external services
	checkinClient := montage.NewHTTPCheckinClient(cfg.CheckinServiceURL, cfg.CheckinServiceAPIKey)
	
	// Initialize batch processor
	processor := NewBatchProcessor(ProcessorConfig{
		MontageService:       montageService,
		CheckinClient:       checkinClient,
		BatchSize:          cfg.Service.BatchSize,
		MaxConcurrency:     cfg.MaxConcurrentGenerations,
		ProcessingTimeout:  cfg.BatchProcessingTimeout,
		EnableAnalytics:    cfg.EnableAnalytics,
		Logger:             log.New(os.Stdout, "[BATCH] ", log.LstdFlags|log.Lshortfile),
	})

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		log.Printf("Received signal %v, initiating graceful shutdown...", sig)
		cancel()
	}()

	// Determine execution mode
	mode := getExecutionMode()
	
	switch mode {
	case "once":
		// Run once and exit (default for cron jobs)
		log.Println("Running batch job once...")
		if err := runBatchJob(ctx, processor); err != nil {
			log.Fatalf("Batch job failed: %v", err)
		}
		log.Println("Batch job completed successfully")
		
	case "scheduler":
		// Run as a scheduler daemon (for local development)
		log.Println("Starting scheduler daemon...")
		scheduler := NewScheduler(processor, cfg)
		if err := scheduler.Start(ctx); err != nil {
			log.Fatalf("Scheduler failed: %v", err)
		}
		
	case "health":
		// Health check mode
		if err := healthCheck(); err != nil {
			log.Fatalf("Health check failed: %v", err)
		}
		log.Println("Health check passed")
		
	default:
		log.Fatalf("Unknown execution mode: %s. Use 'once', 'scheduler', or 'health'", mode)
	}
}

// getExecutionMode determines how the batch job should run
func getExecutionMode() string {
	if mode := os.Getenv("BATCH_MODE"); mode != "" {
		return mode
	}
	
	// Check command line arguments
	if len(os.Args) > 1 {
		return os.Args[1]
	}
	
	// Default mode for cron execution
	return "once"
}

// runBatchJob executes a single batch processing run
func runBatchJob(ctx context.Context, processor *BatchProcessor) error {
	startTime := time.Now()
	
	log.Printf("Starting batch job at %s", startTime.Format(time.RFC3339))
	
	// Create job context with timeout
	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	
	// Generate unique job ID
	jobID := fmt.Sprintf("batch_%d", startTime.Unix())
	
	// Execute the batch processing
	result, err := processor.ProcessBatch(jobCtx, jobID)
	if err != nil {
		return fmt.Errorf("batch processing failed: %w", err)
	}
	
	// Log results
	duration := time.Since(startTime)
	log.Printf("Batch job completed in %v", duration)
	log.Printf("Processed: %d users, Success: %d, Errors: %d", 
		result.ProcessedCount, result.SuccessCount, result.ErrorCount)
	log.Printf("Montages generated: %d general, %d interest-based", 
		result.GeneralMontages, result.InterestMontages)
	
	if result.ErrorCount > 0 {
		log.Printf("Errors encountered during processing: %v", result.Errors)
	}
	
	return nil
}

// healthCheck performs a basic health check
func healthCheck() error {
	log.Println("Performing health check...")
	
	// Check database connection
	db, err := config.ConnectDatabase()
	if err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}
	
	// Test database query
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}
	
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}
	
	// Check configuration
	cfg := montage.LoadConfig()
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("configuration validation failed: %w", err)
	}
	
	log.Println("All health checks passed")
	return nil
}

// logEnvironmentInfo logs relevant environment information for debugging
func logEnvironmentInfo() {
	log.Printf("Environment: %s", getEnvWithDefault("ENVIRONMENT", "development"))
	log.Printf("Database URL: %s", maskSensitive(getEnvWithDefault("DATABASE_URL", "not-set")))
	log.Printf("Checkin Service URL: %s", getEnvWithDefault("CHECKIN_SERVICE_URL", "not-set"))
	log.Printf("Batch size: %s", getEnvWithDefault("MONTAGE_BATCH_SIZE", "100"))
	log.Printf("Max concurrency: %s", getEnvWithDefault("MAX_CONCURRENT_GENERATIONS", "10"))
}

// getEnvWithDefault gets environment variable with fallback
func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// maskSensitive masks sensitive information in logs
func maskSensitive(value string) string {
	if len(value) <= 8 {
		return "***"
	}
	return value[:4] + "***" + value[len(value)-4:]
}

// init runs initialization tasks
func init() {
	// Set log format
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	
	// Log environment info in debug mode
	if os.Getenv("DEBUG") == "true" {
		logEnvironmentInfo()
	}
}
