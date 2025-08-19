package database

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/getsentry/sentry-go"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseMonitor provides comprehensive database monitoring
type DatabaseMonitor struct {
	serviceName string
	
	// Metrics
	queryDuration    *prometheus.HistogramVec
	queryCounter     *prometheus.CounterVec
	activeConnections *prometheus.GaugeVec
	slowQueryCounter *prometheus.CounterVec
	errorCounter     *prometheus.CounterVec
	
	// Configuration
	slowQueryThreshold time.Duration
	errorQueryThreshold time.Duration
	
	// Query analysis
	queryAnalyzer *QueryAnalyzer
	mu           sync.RWMutex
}

// QueryMetrics holds metrics for a specific query
type QueryMetrics struct {
	Query       string
	Count       int64
	TotalTime   time.Duration
	MinTime     time.Duration
	MaxTime     time.Duration
	AvgTime     time.Duration
	LastSeen    time.Time
	ErrorCount  int64
}

// QueryAnalyzer analyzes query patterns and performance
type QueryAnalyzer struct {
	queries map[string]*QueryMetrics
	mu      sync.RWMutex
}

// NewDatabaseMonitor creates a new database monitor
func NewDatabaseMonitor(serviceName string) *DatabaseMonitor {
	return &DatabaseMonitor{
		serviceName: serviceName,
		
		queryDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "database_query_duration_seconds",
				Help: "Database query duration in seconds",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
			},
			[]string{"service", "operation", "table", "query_type"},
		),
		
		queryCounter: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "database_queries_total",
				Help: "Total number of database queries",
			},
			[]string{"service", "operation", "table", "query_type", "status"},
		),
		
		activeConnections: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "database_connections_active",
				Help: "Number of active database connections",
			},
			[]string{"service", "database"},
		),
		
		slowQueryCounter: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "database_slow_queries_total",
				Help: "Total number of slow database queries",
			},
			[]string{"service", "operation", "table"},
		),
		
		errorCounter: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "database_errors_total",
				Help: "Total number of database errors",
			},
			[]string{"service", "error_type"},
		),
		
		slowQueryThreshold: 100 * time.Millisecond,
		errorQueryThreshold: 1 * time.Second,
		queryAnalyzer: &QueryAnalyzer{
			queries: make(map[string]*QueryMetrics),
		},
	}
}

// TrackQuery tracks a database query with comprehensive metrics
func (dm *DatabaseMonitor) TrackQuery(ctx context.Context, operation, table, queryType, query string, duration time.Duration, err error) {
	status := "success"
	if err != nil {
		status = "error"
		dm.trackError(ctx, operation, query, err)
	}
	
	// Record basic metrics
	dm.queryDuration.WithLabelValues(dm.serviceName, operation, table, queryType).Observe(duration.Seconds())
	dm.queryCounter.WithLabelValues(dm.serviceName, operation, table, queryType, status).Inc()
	
	// Track slow queries
	if duration > dm.slowQueryThreshold {
		dm.slowQueryCounter.WithLabelValues(dm.serviceName, operation, table).Inc()
		dm.reportSlowQuery(ctx, operation, table, query, duration)
	}
	
	// Update query analyzer
	dm.queryAnalyzer.recordQuery(query, duration, err)
	
	// Track extremely slow queries in Sentry
	if duration > dm.errorQueryThreshold {
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("service", dm.serviceName)
			scope.SetTag("operation", operation)
			scope.SetTag("table", table)
			scope.SetTag("query_type", queryType)
			scope.SetExtra("query", dm.sanitizeQuery(query))
			scope.SetExtra("duration_ms", duration.Milliseconds())
			scope.SetLevel(sentry.LevelWarning)
			
			sentry.CaptureMessage(fmt.Sprintf("Extremely slow database query detected: %dms", duration.Milliseconds()))
		})
	}
}

// trackError tracks database errors with detailed context
func (dm *DatabaseMonitor) trackError(ctx context.Context, operation, query string, err error) {
	errorType := dm.categorizeError(err)
	dm.errorCounter.WithLabelValues(dm.serviceName, errorType).Inc()
	
	// Send critical errors to Sentry
	if dm.isCriticalError(err) {
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("service", dm.serviceName)
			scope.SetTag("operation", operation)
			scope.SetTag("error_type", errorType)
			scope.SetExtra("query", dm.sanitizeQuery(query))
			scope.SetLevel(sentry.LevelError)
			
			sentry.CaptureException(err)
		})
	}
}

// categorizeError categorizes database errors for better analysis
func (dm *DatabaseMonitor) categorizeError(err error) string {
	if err == nil {
		return "none"
	}
	
	errStr := strings.ToLower(err.Error())
	
	switch {
	case strings.Contains(errStr, "connection"):
		return "connection_error"
	case strings.Contains(errStr, "timeout"):
		return "timeout"
	case strings.Contains(errStr, "duplicate") || strings.Contains(errStr, "unique"):
		return "constraint_violation"
	case strings.Contains(errStr, "foreign key"):
		return "foreign_key_violation"
	case strings.Contains(errStr, "syntax"):
		return "syntax_error"
	case strings.Contains(errStr, "permission") || strings.Contains(errStr, "access"):
		return "permission_error"
	case err == gorm.ErrRecordNotFound:
		return "record_not_found"
	default:
		return "unknown_error"
	}
}

// isCriticalError determines if an error should be escalated
func (dm *DatabaseMonitor) isCriticalError(err error) bool {
	if err == nil {
		return false
	}
	
	errorType := dm.categorizeError(err)
	criticalErrors := []string{
		"connection_error",
		"timeout", 
		"permission_error",
		"syntax_error",
	}
	
	for _, critical := range criticalErrors {
		if errorType == critical {
			return true
		}
	}
	
	return false
}

// sanitizeQuery removes sensitive data from queries for logging
func (dm *DatabaseMonitor) sanitizeQuery(query string) string {
	// Remove potential sensitive data patterns
	sensitivePatterns := []string{
		`'[^']*'`,     // String literals
		`"[^"]*"`,     // Double-quoted strings
		`\$\d+`,       // Parameterized query placeholders
	}
	
	sanitized := query
	for _, pattern := range sensitivePatterns {
		sanitized = strings.ReplaceAll(sanitized, pattern, "?")
	}
	
	// Limit query length for logging
	if len(sanitized) > 500 {
		sanitized = sanitized[:500] + "..."
	}
	
	return sanitized
}

// reportSlowQuery reports slow queries with analysis
func (dm *DatabaseMonitor) reportSlowQuery(ctx context.Context, operation, table, query string, duration time.Duration) {
	analysis := dm.analyzeQuery(query)
	
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetTag("service", dm.serviceName)
		scope.SetTag("operation", operation)
		scope.SetTag("table", table)
		scope.SetTag("query_analysis", analysis.Type)
		scope.SetExtra("query", dm.sanitizeQuery(query))
		scope.SetExtra("duration_ms", duration.Milliseconds())
		scope.SetExtra("analysis", analysis)
		scope.SetLevel(sentry.LevelInfo)
		
		sentry.CaptureMessage(fmt.Sprintf("Slow query detected: %s (%dms)", analysis.Type, duration.Milliseconds()))
	})
}

// QueryAnalysis holds query analysis results
type QueryAnalysis struct {
	Type        string   `json:"type"`
	Tables      []string `json:"tables"`
	HasJoin     bool     `json:"has_join"`
	HasSubquery bool     `json:"has_subquery"`
	HasIndex    bool     `json:"has_index_hint"`
	Complexity  string   `json:"complexity"`
}

// analyzeQuery performs basic query analysis
func (dm *DatabaseMonitor) analyzeQuery(query string) QueryAnalysis {
	queryUpper := strings.ToUpper(query)
	
	analysis := QueryAnalysis{
		Tables: dm.extractTables(query),
	}
	
	// Determine query type
	switch {
	case strings.HasPrefix(queryUpper, "SELECT"):
		analysis.Type = "SELECT"
	case strings.HasPrefix(queryUpper, "INSERT"):
		analysis.Type = "INSERT"
	case strings.HasPrefix(queryUpper, "UPDATE"):
		analysis.Type = "UPDATE"
	case strings.HasPrefix(queryUpper, "DELETE"):
		analysis.Type = "DELETE"
	default:
		analysis.Type = "OTHER"
	}
	
	// Check for joins and subqueries
	analysis.HasJoin = strings.Contains(queryUpper, "JOIN")
	analysis.HasSubquery = strings.Contains(queryUpper, "SELECT") && strings.Count(queryUpper, "SELECT") > 1
	analysis.HasIndex = strings.Contains(queryUpper, "USE INDEX") || strings.Contains(queryUpper, "FORCE INDEX")
	
	// Determine complexity
	complexity := 0
	if analysis.HasJoin { complexity += 2 }
	if analysis.HasSubquery { complexity += 3 }
	if len(analysis.Tables) > 1 { complexity += 1 }
	
	switch {
	case complexity >= 5:
		analysis.Complexity = "high"
	case complexity >= 2:
		analysis.Complexity = "medium"
	default:
		analysis.Complexity = "low"
	}
	
	return analysis
}

// extractTables extracts table names from query (basic implementation)
func (dm *DatabaseMonitor) extractTables(query string) []string {
	// This is a simplified implementation - could be enhanced with proper SQL parsing
	tables := []string{}
	queryUpper := strings.ToUpper(query)
	
	// Extract FROM clauses
	if idx := strings.Index(queryUpper, " FROM "); idx != -1 {
		remaining := query[idx+6:]
		if spaceIdx := strings.Index(remaining, " "); spaceIdx != -1 {
			table := strings.TrimSpace(remaining[:spaceIdx])
			tables = append(tables, table)
		}
	}
	
	return tables
}

// UpdateConnectionMetrics updates connection pool metrics
func (dm *DatabaseMonitor) UpdateConnectionMetrics(database string, activeConnections int) {
	dm.activeConnections.WithLabelValues(dm.serviceName, database).Set(float64(activeConnections))
}

// GetQueryStats returns query statistics
func (dm *DatabaseMonitor) GetQueryStats() map[string]*QueryMetrics {
	dm.queryAnalyzer.mu.RLock()
	defer dm.queryAnalyzer.mu.RUnlock()
	
	// Return a copy to avoid concurrent access issues
	stats := make(map[string]*QueryMetrics)
	for key, value := range dm.queryAnalyzer.queries {
		stats[key] = &QueryMetrics{
			Query:      value.Query,
			Count:      value.Count,
			TotalTime:  value.TotalTime,
			MinTime:    value.MinTime,
			MaxTime:    value.MaxTime,
			AvgTime:    value.AvgTime,
			LastSeen:   value.LastSeen,
			ErrorCount: value.ErrorCount,
		}
	}
	
	return stats
}

// recordQuery records query metrics in the analyzer
func (qa *QueryAnalyzer) recordQuery(query string, duration time.Duration, err error) {
	qa.mu.Lock()
	defer qa.mu.Unlock()
	
	// Normalize query for analysis (remove literals, etc.)
	normalizedQuery := qa.normalizeQuery(query)
	
	metrics, exists := qa.queries[normalizedQuery]
	if !exists {
		metrics = &QueryMetrics{
			Query:    normalizedQuery,
			MinTime:  duration,
			MaxTime:  duration,
			LastSeen: time.Now(),
		}
		qa.queries[normalizedQuery] = metrics
	}
	
	// Update metrics
	metrics.Count++
	metrics.TotalTime += duration
	metrics.AvgTime = time.Duration(metrics.TotalTime.Nanoseconds() / metrics.Count)
	metrics.LastSeen = time.Now()
	
	if duration < metrics.MinTime {
		metrics.MinTime = duration
	}
	if duration > metrics.MaxTime {
		metrics.MaxTime = duration
	}
	
	if err != nil {
		metrics.ErrorCount++
	}
}

// normalizeQuery normalizes query for pattern analysis
func (qa *QueryAnalyzer) normalizeQuery(query string) string {
	// Remove literals and normalize for pattern matching
	normalized := query
	
	// Replace string literals
	normalized = strings.ReplaceAll(normalized, "'[^']*'", "?")
	normalized = strings.ReplaceAll(normalized, "\"[^\"]*\"", "?")
	
	// Replace numbers
	normalized = strings.ReplaceAll(normalized, "\\b\\d+\\b", "?")
	
	// Normalize whitespace
	normalized = strings.ReplaceAll(normalized, "\\s+", " ")
	normalized = strings.TrimSpace(normalized)
	
	return normalized
}

// GORM Logger Integration
type GormLogger struct {
	monitor *DatabaseMonitor
	logger.Interface
}

// NewGormLogger creates a new GORM logger with monitoring
func NewGormLogger(monitor *DatabaseMonitor, baseLogger logger.Interface) *GormLogger {
	return &GormLogger{
		monitor: monitor,
		Interface: baseLogger,
	}
}

// Trace implements the GORM logger interface with monitoring
func (gl *GormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	elapsed := time.Since(begin)
	sql, rows := fc()
	
	// Extract operation and table info from SQL
	operation := gl.extractOperation(sql)
	table := gl.extractTable(sql)
	queryType := gl.extractQueryType(sql)
	
	// Track the query
	gl.monitor.TrackQuery(ctx, operation, table, queryType, sql, elapsed, err)
	
	// Call the original logger
	gl.Interface.Trace(ctx, begin, fc, err)
}

// extractOperation extracts the SQL operation
func (gl *GormLogger) extractOperation(sql string) string {
	sqlUpper := strings.ToUpper(strings.TrimSpace(sql))
	
	switch {
	case strings.HasPrefix(sqlUpper, "SELECT"):
		return "SELECT"
	case strings.HasPrefix(sqlUpper, "INSERT"):
		return "INSERT"
	case strings.HasPrefix(sqlUpper, "UPDATE"):
		return "UPDATE"
	case strings.HasPrefix(sqlUpper, "DELETE"):
		return "DELETE"
	case strings.HasPrefix(sqlUpper, "CREATE"):
		return "CREATE"
	case strings.HasPrefix(sqlUpper, "DROP"):
		return "DROP"
	case strings.HasPrefix(sqlUpper, "ALTER"):
		return "ALTER"
	default:
		return "OTHER"
	}
}

// extractTable extracts the primary table name
func (gl *GormLogger) extractTable(sql string) string {
	// This is a simplified implementation
	sqlUpper := strings.ToUpper(sql)
	
	patterns := []string{
		" FROM ",
		" INTO ",
		" UPDATE ",
		" TABLE ",
	}
	
	for _, pattern := range patterns {
		if idx := strings.Index(sqlUpper, pattern); idx != -1 {
			remaining := sql[idx+len(pattern):]
			if spaceIdx := strings.Index(remaining, " "); spaceIdx != -1 {
				return strings.TrimSpace(remaining[:spaceIdx])
			}
			return strings.TrimSpace(remaining)
		}
	}
	
	return "unknown"
}

// extractQueryType determines the query type for categorization
func (gl *GormLogger) extractQueryType(sql string) string {
	sqlUpper := strings.ToUpper(strings.TrimSpace(sql))
	
	switch {
	case strings.Contains(sqlUpper, "JOIN"):
		return "join"
	case strings.Contains(sqlUpper, "GROUP BY"):
		return "aggregate"
	case strings.Contains(sqlUpper, "ORDER BY"):
		return "sorted"
	case strings.Contains(sqlUpper, "WHERE"):
		return "filtered"
	default:
		return "simple"
	}
}
