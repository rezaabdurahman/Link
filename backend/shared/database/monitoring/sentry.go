package monitoring

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"gorm.io/gorm"
)

// SentryIntegration provides Sentry error reporting for database operations
type SentryIntegration struct {
	config        *Config
	slowQueryThreshold time.Duration
	enableBreadcrumbs  bool
}

// NewSentryIntegration creates a new Sentry integration
func NewSentryIntegration(config *Config) *SentryIntegration {
	return &SentryIntegration{
		config:        config,
		slowQueryThreshold: config.SlowQueryThreshold,
		enableBreadcrumbs:  true,
	}
}

// GormSentryPlugin implements GORM plugin interface for Sentry reporting
type GormSentryPlugin struct {
	integration *SentryIntegration
}

// NewGormSentryPlugin creates a new GORM Sentry plugin
func NewGormSentryPlugin(config *Config) *GormSentryPlugin {
	return &GormSentryPlugin{
		integration: NewSentryIntegration(config),
	}
}

// Name returns the plugin name
func (p *GormSentryPlugin) Name() string {
	return "sentry"
}

// Initialize sets up the Sentry reporting hooks
func (p *GormSentryPlugin) Initialize(db *gorm.DB) error {
	// After hooks for error reporting
	db.Callback().Create().After("gorm:create").Register("sentry:after_create", p.afterOperation)
	db.Callback().Query().After("gorm:query").Register("sentry:after_query", p.afterOperation)
	db.Callback().Update().After("gorm:update").Register("sentry:after_update", p.afterOperation)
	db.Callback().Delete().After("gorm:delete").Register("sentry:after_delete", p.afterOperation)

	// Before hooks for breadcrumbs
	if p.integration.enableBreadcrumbs {
		db.Callback().Create().Before("gorm:create").Register("sentry:before_create", p.beforeOperation)
		db.Callback().Query().Before("gorm:query").Register("sentry:before_query", p.beforeOperation)
		db.Callback().Update().Before("gorm:update").Register("sentry:before_update", p.beforeOperation)
		db.Callback().Delete().Before("gorm:delete").Register("sentry:before_delete", p.beforeOperation)
	}

	return nil
}

// beforeOperation adds breadcrumbs for database operations
func (p *GormSentryPlugin) beforeOperation(db *gorm.DB) {
	if !p.integration.enableBreadcrumbs {
		return
	}

	operation := extractOperationFromSQL(db.Statement.SQL.String())
	tableName := extractTableName(db)

	sentry.AddBreadcrumb(&sentry.Breadcrumb{
		Type:      "query",
		Category:  "database",
		Message:   fmt.Sprintf("%s operation on %s table", operation, tableName),
		Level:     sentry.LevelInfo,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"service":   p.integration.config.ServiceName,
			"operation": operation,
			"table":     tableName,
		},
	})
}

// afterOperation handles error reporting after database operations
func (p *GormSentryPlugin) afterOperation(db *gorm.DB) {
	// Get timing information if available
	startTime, hasStartTime := db.Get("monitoring:start_time")
	var duration time.Duration
	if hasStartTime {
		duration = time.Since(startTime.(time.Time))
	}

	operation := extractOperationFromSQL(db.Statement.SQL.String())
	tableName := extractTableName(db)

	// Report slow queries as performance issues
	if hasStartTime && duration > p.integration.slowQueryThreshold {
		p.reportSlowQuery(db, operation, tableName, duration)
	}

	// Report errors
	if db.Error != nil && db.Error != gorm.ErrRecordNotFound {
		p.reportDatabaseError(db, operation, tableName, duration)
	}
}

// reportSlowQuery reports slow database queries to Sentry
func (p *GormSentryPlugin) reportSlowQuery(db *gorm.DB, operation, table string, duration time.Duration) {
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelWarning)
		scope.SetTag("type", "performance")
		scope.SetTag("service", p.integration.config.ServiceName)
		scope.SetTag("operation", operation)
		scope.SetTag("table", table)
		
		scope.SetContext("database", map[string]interface{}{
			"service":          p.integration.config.ServiceName,
			"operation":        operation,
			"table":            table,
			"duration_ms":      duration.Milliseconds(),
			"threshold_ms":     p.integration.slowQueryThreshold.Milliseconds(),
			"rows_affected":    db.RowsAffected,
			"sanitized_query": sanitizeQuery(db.Statement.SQL.String()),
		})

		scope.SetContext("performance", map[string]interface{}{
			"duration_seconds": duration.Seconds(),
			"is_slow_query":    true,
		})

		message := fmt.Sprintf("Slow database query: %s on %s took %v", 
			operation, table, duration)
		
		sentry.CaptureMessage(message)
	})
}

// reportDatabaseError reports database errors to Sentry
func (p *GormSentryPlugin) reportDatabaseError(db *gorm.DB, operation, table string, duration time.Duration) {
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelError)
		scope.SetTag("service", p.integration.config.ServiceName)
		scope.SetTag("operation", operation)
		scope.SetTag("table", table)
		scope.SetTag("error_type", getErrorType(db.Error))
		
		scope.SetContext("database", map[string]interface{}{
			"service":          p.integration.config.ServiceName,
			"operation":        operation,
			"table":            table,
			"error_message":    db.Error.Error(),
			"error_type":       getErrorType(db.Error),
			"rows_affected":    db.RowsAffected,
			"sanitized_query":  sanitizeQuery(db.Statement.SQL.String()),
		})

		if duration > 0 {
			scope.SetContext("timing", map[string]interface{}{
				"duration_seconds": duration.Seconds(),
				"duration_ms":      duration.Milliseconds(),
			})
		}

		// Add affected model information if available
		if db.Statement.Model != nil {
			scope.SetContext("model", map[string]interface{}{
				"model_type": fmt.Sprintf("%T", db.Statement.Model),
			})
		}

		sentry.CaptureException(db.Error)
	})
}

// PgxSentryWrapper wraps pgx operations with Sentry reporting
type PgxSentryWrapper struct {
	serviceName string
	slowQueryThreshold time.Duration
}

// NewPgxSentryWrapper creates a new pgx Sentry wrapper
func NewPgxSentryWrapper(serviceName string, slowQueryThreshold time.Duration) *PgxSentryWrapper {
	return &PgxSentryWrapper{
		serviceName: serviceName,
		slowQueryThreshold: slowQueryThreshold,
	}
}

// ReportQueryError reports pgx query errors to Sentry
func (w *PgxSentryWrapper) ReportQueryError(ctx context.Context, sql string, err error, duration time.Duration) {
	if err == nil {
		return
	}

	operation := extractOperationFromSQL(sql)
	table := extractTableFromSQL(sql)

	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelError)
		scope.SetTag("service", w.serviceName)
		scope.SetTag("operation", operation)
		scope.SetTag("table", table)
		scope.SetTag("error_type", getErrorType(err))
		scope.SetTag("database_driver", "pgx")
		
		scope.SetContext("database", map[string]interface{}{
			"service":          w.serviceName,
			"operation":        operation,
			"table":            table,
			"error_message":    err.Error(),
			"error_type":       getErrorType(err),
			"sanitized_query":  sanitizeQuery(sql),
			"driver":          "pgx",
		})

		if duration > 0 {
			scope.SetContext("timing", map[string]interface{}{
				"duration_seconds": duration.Seconds(),
				"duration_ms":      duration.Milliseconds(),
			})
		}

		// Add context information if available
		if ctx != nil {
			if userID := ctx.Value("user_id"); userID != nil {
				scope.SetUser(sentry.User{
					ID: fmt.Sprintf("%v", userID),
				})
			}
		}

		sentry.CaptureException(err)
	})
}

// ReportSlowQuery reports slow pgx queries to Sentry
func (w *PgxSentryWrapper) ReportSlowQuery(ctx context.Context, sql string, duration time.Duration) {
	if duration <= w.slowQueryThreshold {
		return
	}

	operation := extractOperationFromSQL(sql)
	table := extractTableFromSQL(sql)

	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelWarning)
		scope.SetTag("type", "performance")
		scope.SetTag("service", w.serviceName)
		scope.SetTag("operation", operation)
		scope.SetTag("table", table)
		scope.SetTag("database_driver", "pgx")
		
		scope.SetContext("database", map[string]interface{}{
			"service":          w.serviceName,
			"operation":        operation,
			"table":            table,
			"duration_ms":      duration.Milliseconds(),
			"threshold_ms":     w.slowQueryThreshold.Milliseconds(),
			"sanitized_query":  sanitizeQuery(sql),
			"driver":          "pgx",
		})

		scope.SetContext("performance", map[string]interface{}{
			"duration_seconds": duration.Seconds(),
			"is_slow_query":    true,
		})

		// Add context information if available
		if ctx != nil {
			if userID := ctx.Value("user_id"); userID != nil {
				scope.SetUser(sentry.User{
					ID: fmt.Sprintf("%v", userID),
				})
			}
		}

		message := fmt.Sprintf("Slow pgx query: %s on %s took %v", 
			operation, table, duration)
		
		sentry.CaptureMessage(message)
	})
}

// AddQueryBreadcrumb adds a breadcrumb for database queries
func (w *PgxSentryWrapper) AddQueryBreadcrumb(sql string, args []interface{}) {
	operation := extractOperationFromSQL(sql)
	table := extractTableFromSQL(sql)

	sentry.AddBreadcrumb(&sentry.Breadcrumb{
		Type:      "query",
		Category:  "database.pgx",
		Message:   fmt.Sprintf("%s operation on %s table", operation, table),
		Level:     sentry.LevelInfo,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"service":         w.serviceName,
			"operation":       operation,
			"table":           table,
			"args_count":      len(args),
			"sanitized_query": sanitizeQuery(sql),
		},
	})
}

// sanitizeQuery removes sensitive data from SQL queries
func sanitizeQuery(sql string) string {
	if sql == "" {
		return ""
	}

	// Basic sanitization - replace parameter placeholders and potential sensitive data
	sanitized := sql
	
	// Replace common parameter patterns
	replacements := map[string]string{
		// PostgreSQL numbered parameters
		`\$\d+`: "$?",
		// MySQL/SQLite named parameters  
		`:\w+`: ":?",
		// Quoted strings that might contain sensitive data
		`'[^']*'`: "'?'",
		`"[^"]*"`: '"?"',
	}

	for pattern, replacement := range replacements {
		sanitized = strings.ReplaceAll(sanitized, pattern, replacement)
	}

	// Limit query length for readability
	maxLength := 500
	if len(sanitized) > maxLength {
		sanitized = sanitized[:maxLength] + "..."
	}

	return sanitized
}

// DatabaseTransactionReporter handles transaction-level Sentry reporting
type DatabaseTransactionReporter struct {
	serviceName string
	txStartTime time.Time
	txContext   map[string]interface{}
}

// NewDatabaseTransactionReporter creates a new transaction reporter
func NewDatabaseTransactionReporter(serviceName string) *DatabaseTransactionReporter {
	return &DatabaseTransactionReporter{
		serviceName: serviceName,
		txStartTime: time.Now(),
		txContext:   make(map[string]interface{}),
	}
}

// SetContext adds context information to the transaction
func (r *DatabaseTransactionReporter) SetContext(key string, value interface{}) {
	r.txContext[key] = value
}

// ReportTransactionError reports transaction errors to Sentry
func (r *DatabaseTransactionReporter) ReportTransactionError(err error, operationCount int) {
	if err == nil {
		return
	}

	duration := time.Since(r.txStartTime)

	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelError)
		scope.SetTag("service", r.serviceName)
		scope.SetTag("type", "transaction")
		scope.SetTag("error_type", getErrorType(err))
		
		scope.SetContext("database", map[string]interface{}{
			"service":         r.serviceName,
			"transaction":     true,
			"error_message":   err.Error(),
			"error_type":      getErrorType(err),
			"operation_count": operationCount,
		})

		scope.SetContext("timing", map[string]interface{}{
			"duration_seconds": duration.Seconds(),
			"duration_ms":      duration.Milliseconds(),
		})

		// Add custom context
		if len(r.txContext) > 0 {
			scope.SetContext("transaction_context", r.txContext)
		}

		sentry.CaptureException(err)
	})
}

// ReportLongTransaction reports long-running transactions
func (r *DatabaseTransactionReporter) ReportLongTransaction(threshold time.Duration, operationCount int) {
	duration := time.Since(r.txStartTime)
	if duration <= threshold {
		return
	}

	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelWarning)
		scope.SetTag("service", r.serviceName)
		scope.SetTag("type", "performance")
		scope.SetTag("subtype", "long_transaction")
		
		scope.SetContext("database", map[string]interface{}{
			"service":         r.serviceName,
			"transaction":     true,
			"operation_count": operationCount,
			"duration_ms":     duration.Milliseconds(),
			"threshold_ms":    threshold.Milliseconds(),
		})

		scope.SetContext("performance", map[string]interface{}{
			"duration_seconds": duration.Seconds(),
			"is_long_transaction": true,
		})

		// Add custom context
		if len(r.txContext) > 0 {
			scope.SetContext("transaction_context", r.txContext)
		}

		message := fmt.Sprintf("Long database transaction took %v (threshold: %v) with %d operations",
			duration, threshold, operationCount)
		
		sentry.CaptureMessage(message)
	})
}
