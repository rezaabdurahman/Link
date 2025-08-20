package migrations

import (
	"fmt"
	"time"
)

// MigrationStatus represents the current migration status for a service
type MigrationStatus struct {
	Service        string      `json:"service"`
	CurrentVersion int         `json:"current_version"`
	Available      int         `json:"available_migrations"`
	Applied        int         `json:"applied_migrations"`
	Pending        int         `json:"pending_migrations"`
	Migrations     []Migration `json:"migrations"`
	LastApplied    *time.Time  `json:"last_applied,omitempty"`
	Healthy        bool        `json:"healthy"`
	Errors         []string    `json:"errors,omitempty"`
}

// String returns a formatted string representation of migration status
func (s *MigrationStatus) String() string {
	status := fmt.Sprintf("Service: %s\n", s.Service)
	status += fmt.Sprintf("Current Version: %d\n", s.CurrentVersion)
	status += fmt.Sprintf("Available: %d, Applied: %d, Pending: %d\n", s.Available, s.Applied, s.Pending)
	
	if s.LastApplied != nil {
		status += fmt.Sprintf("Last Applied: %s\n", s.LastApplied.Format(time.RFC3339))
	}
	
	if len(s.Errors) > 0 {
		status += fmt.Sprintf("Errors: %v\n", s.Errors)
	}
	
	return status
}

// MigrationDirection represents the direction of migration
type MigrationDirection string

const (
	DirectionUp   MigrationDirection = "up"
	DirectionDown MigrationDirection = "down"
)

// MigrationOptions provides options for migration execution
type MigrationOptions struct {
	// Target version to migrate to (0 means apply all)
	TargetVersion int
	// Direction of migration
	Direction MigrationDirection
	// Whether to run in dry-run mode
	DryRun bool
	// Whether to force migration even if checksums don't match
	Force bool
	// Whether to skip confirmation prompts
	AutoConfirm bool
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	SSLMode  string
}

// GetDSN returns the PostgreSQL connection string
func (c *DatabaseConfig) GetDSN() string {
	sslMode := c.SSLMode
	if sslMode == "" {
		sslMode = "disable"
	}
	
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		c.Host, c.User, c.Password, c.Database, c.Port, sslMode)
}

// MigrationError represents a migration-specific error
type MigrationError struct {
	Migration Migration
	Operation string
	Err       error
}

func (e *MigrationError) Error() string {
	return fmt.Sprintf("migration %03d_%s %s failed: %v", 
		e.Migration.Version, e.Migration.Name, e.Operation, e.Err)
}

// NewMigrationError creates a new migration error
func NewMigrationError(migration Migration, operation string, err error) *MigrationError {
	return &MigrationError{
		Migration: migration,
		Operation: operation,
		Err:       err,
	}
}
