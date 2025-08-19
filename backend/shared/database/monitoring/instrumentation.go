package monitoring

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseMetrics holds all Prometheus metrics for database monitoring
type DatabaseMetrics struct {
	// Query metrics
	queryDuration     *prometheus.HistogramVec
	queryTotal        *prometheus.CounterVec
	queryErrors       *prometheus.CounterVec
	slowQueries       *prometheus.CounterVec
	
	// Connection pool metrics
	poolConnections   *prometheus.GaugeVec
	poolIdleConns     *prometheus.GaugeVec
	poolUsedConns     *prometheus.GaugeVec
	poolWaitDuration  *prometheus.HistogramVec
	
	// Database-specific metrics
	transactionTotal  *prometheus.CounterVec
	rowsAffected      *prometheus.HistogramVec
	
	// Service-specific tags
	serviceName string
}

// Config holds configuration for database monitoring
type Config struct {
	ServiceName       string
	SlowQueryThreshold time.Duration
	EnableQueryLogging bool
	SanitizeQueries    bool
}

// DefaultConfig returns a default monitoring configuration
func DefaultConfig(serviceName string) *Config {
	return &Config{
		ServiceName:       serviceName,
		SlowQueryThreshold: 100 * time.Millisecond,
		EnableQueryLogging: true,
		SanitizeQueries:    true,
	}
}

// NewDatabaseMetrics creates a new set of database metrics
func NewDatabaseMetrics(config *Config) *DatabaseMetrics {
	return &DatabaseMetrics{
		serviceName: config.ServiceName,
		
		queryDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:        "database_query_duration_seconds",
			Help:        "Time spent executing database queries",
			Buckets:     []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
		}, []string{"service", "operation", "table", "status"}),

		queryTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "database_queries_total",
			Help: "Total number of database queries executed",
		}, []string{"service", "operation", "table", "status"}),

		queryErrors: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "database_query_errors_total",
			Help: "Total number of database query errors",
		}, []string{"service", "error_type", "table"}),

		slowQueries: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "database_slow_queries_total",
			Help: "Total number of slow database queries",
		}, []string{"service", "operation", "table"}),

		poolConnections: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "database_pool_connections",
			Help: "Current number of database connections",
		}, []string{"service", "state"}),

		poolIdleConns: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "database_pool_idle_connections",
			Help: "Number of idle database connections",
		}, []string{"service"}),

		poolUsedConns: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "database_pool_used_connections",
			Help: "Number of used database connections",
		}, []string{"service"}),

		poolWaitDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "database_pool_wait_duration_seconds",
			Help:    "Time spent waiting for database connections",
			Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0},
		}, []string{"service"}),

		transactionTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "database_transactions_total",
			Help: "Total number of database transactions",
		}, []string{"service", "status"}),

		rowsAffected: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "database_rows_affected",
			Help:    "Number of rows affected by database operations",
			Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000},
		}, []string{"service", "operation", "table"}),
	}
}

// GormMonitoringPlugin implements GORM plugin interface for monitoring
type GormMonitoringPlugin struct {
	config  *Config
	metrics *DatabaseMetrics
}

// NewGormMonitoringPlugin creates a new GORM monitoring plugin
func NewGormMonitoringPlugin(config *Config) *GormMonitoringPlugin {
	return &GormMonitoringPlugin{
		config:  config,
		metrics: NewDatabaseMetrics(config),
	}
}

// Name returns the plugin name
func (p *GormMonitoringPlugin) Name() string {
	return "monitoring"
}

// Initialize sets up the monitoring hooks
func (p *GormMonitoringPlugin) Initialize(db *gorm.DB) error {
	// Before hooks
	db.Callback().Create().Before("gorm:create").Register("monitoring:before_create", p.beforeCreate)
	db.Callback().Query().Before("gorm:query").Register("monitoring:before_query", p.beforeQuery)
	db.Callback().Update().Before("gorm:update").Register("monitoring:before_update", p.beforeUpdate)
	db.Callback().Delete().Before("gorm:delete").Register("monitoring:before_delete", p.beforeDelete)

	// After hooks
	db.Callback().Create().After("gorm:create").Register("monitoring:after_create", p.afterCreate)
	db.Callback().Query().After("gorm:query").Register("monitoring:after_query", p.afterQuery)
	db.Callback().Update().After("gorm:update").Register("monitoring:after_update", p.afterUpdate)
	db.Callback().Delete().After("gorm:delete").Register("monitoring:after_delete", p.afterDelete)

	// Start connection pool monitoring
	go p.monitorConnectionPool(db)

	return nil
}

// beforeCreate handles before create hook
func (p *GormMonitoringPlugin) beforeCreate(db *gorm.DB) {
	db.Set("monitoring:start_time", time.Now())
	db.Set("monitoring:operation", "create")
}

// beforeQuery handles before query hook
func (p *GormMonitoringPlugin) beforeQuery(db *gorm.DB) {
	db.Set("monitoring:start_time", time.Now())
	db.Set("monitoring:operation", "select")
}

// beforeUpdate handles before update hook
func (p *GormMonitoringPlugin) beforeUpdate(db *gorm.DB) {
	db.Set("monitoring:start_time", time.Now())
	db.Set("monitoring:operation", "update")
}

// beforeDelete handles before delete hook
func (p *GormMonitoringPlugin) beforeDelete(db *gorm.DB) {
	db.Set("monitoring:start_time", time.Now())
	db.Set("monitoring:operation", "delete")
}

// afterCreate handles after create hook
func (p *GormMonitoringPlugin) afterCreate(db *gorm.DB) {
	p.recordQuery(db, "create")
}

// afterQuery handles after query hook
func (p *GormMonitoringPlugin) afterQuery(db *gorm.DB) {
	p.recordQuery(db, "select")
}

// afterUpdate handles after update hook
func (p *GormMonitoringPlugin) afterUpdate(db *gorm.DB) {
	p.recordQuery(db, "update")
}

// afterDelete handles after delete hook
func (p *GormMonitoringPlugin) afterDelete(db *gorm.DB) {
	p.recordQuery(db, "delete")
}

// recordQuery records query metrics
func (p *GormMonitoringPlugin) recordQuery(db *gorm.DB, operation string) {
	startTime, exists := db.Get("monitoring:start_time")
	if !exists {
		return
	}

	start := startTime.(time.Time)
	duration := time.Since(start)
	
	tableName := extractTableName(db)
	status := "success"
	
	if db.Error != nil && db.Error != gorm.ErrRecordNotFound {
		status = "error"
		p.recordError(db.Error, tableName)
	}

	// Record basic metrics
	p.metrics.queryDuration.WithLabelValues(
		p.config.ServiceName, operation, tableName, status,
	).Observe(duration.Seconds())

	p.metrics.queryTotal.WithLabelValues(
		p.config.ServiceName, operation, tableName, status,
	).Inc()

	// Record slow queries
	if duration > p.config.SlowQueryThreshold {
		p.metrics.slowQueries.WithLabelValues(
			p.config.ServiceName, operation, tableName,
		).Inc()
	}

	// Record rows affected for non-select operations
	if operation != "select" && db.RowsAffected > 0 {
		p.metrics.rowsAffected.WithLabelValues(
			p.config.ServiceName, operation, tableName,
		).Observe(float64(db.RowsAffected))
	}
}

// recordError records error metrics
func (p *GormMonitoringPlugin) recordError(err error, tableName string) {
	errorType := getErrorType(err)
	p.metrics.queryErrors.WithLabelValues(
		p.config.ServiceName, errorType, tableName,
	).Inc()
}

// monitorConnectionPool monitors database connection pool
func (p *GormMonitoringPlugin) monitorConnectionPool(db *gorm.DB) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		stats := sqlDB.Stats()
		
		p.metrics.poolConnections.WithLabelValues(
			p.config.ServiceName, "open",
		).Set(float64(stats.OpenConnections))

		p.metrics.poolIdleConns.WithLabelValues(
			p.config.ServiceName,
		).Set(float64(stats.Idle))

		p.metrics.poolUsedConns.WithLabelValues(
			p.config.ServiceName,
		).Set(float64(stats.InUse))
	}
}

// PgxInstrumentation provides pgx-specific monitoring
type PgxInstrumentation struct {
	config  *Config
	metrics *DatabaseMetrics
}

// NewPgxInstrumentation creates a new pgx instrumentation
func NewPgxInstrumentation(config *Config) *PgxInstrumentation {
	return &PgxInstrumentation{
		config:  config,
		metrics: NewDatabaseMetrics(config),
	}
}

// WrapPool wraps a pgx connection pool with monitoring
func (p *PgxInstrumentation) WrapPool(pool *pgxpool.Pool) *MonitoredPool {
	// Start pool monitoring
	go p.monitorPool(pool)
	
	return &MonitoredPool{
		Pool:   pool,
		config: p.config,
		metrics: p.metrics,
	}
}

// MonitoredPool wraps pgxpool.Pool with monitoring
type MonitoredPool struct {
	*pgxpool.Pool
	config  *Config
	metrics *DatabaseMetrics
}

// Query wraps pgxpool.Pool.Query with monitoring
func (p *MonitoredPool) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	start := time.Now()
	rows, err := p.Pool.Query(ctx, sql, args...)
	duration := time.Since(start)

	p.recordQuery("select", sql, duration, err)
	return rows, err
}

// QueryRow wraps pgxpool.Pool.QueryRow with monitoring
func (p *MonitoredPool) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	start := time.Now()
	row := p.Pool.QueryRow(ctx, sql, args...)
	duration := time.Since(start)

	p.recordQuery("select", sql, duration, nil)
	return row
}

// Exec wraps pgxpool.Pool.Exec with monitoring
func (p *MonitoredPool) Exec(ctx context.Context, sql string, args ...interface{}) (pgx.CommandTag, error) {
	start := time.Now()
	tag, err := p.Pool.Exec(ctx, sql, args...)
	duration := time.Since(start)

	operation := extractOperationFromSQL(sql)
	p.recordQuery(operation, sql, duration, err)

	// Record rows affected
	if tag.RowsAffected() > 0 {
		tableName := extractTableFromSQL(sql)
		p.metrics.rowsAffected.WithLabelValues(
			p.config.ServiceName, operation, tableName,
		).Observe(float64(tag.RowsAffected()))
	}

	return tag, err
}

// recordQuery records pgx query metrics
func (p *MonitoredPool) recordQuery(operation, sql string, duration time.Duration, err error) {
	tableName := extractTableFromSQL(sql)
	status := "success"

	if err != nil {
		status = "error"
		p.recordError(err, tableName)
	}

	p.metrics.queryDuration.WithLabelValues(
		p.config.ServiceName, operation, tableName, status,
	).Observe(duration.Seconds())

	p.metrics.queryTotal.WithLabelValues(
		p.config.ServiceName, operation, tableName, status,
	).Inc()

	if duration > p.config.SlowQueryThreshold {
		p.metrics.slowQueries.WithLabelValues(
			p.config.ServiceName, operation, tableName,
		).Inc()
	}
}

// recordError records pgx error metrics
func (p *MonitoredPool) recordError(err error, tableName string) {
	errorType := getErrorType(err)
	p.metrics.queryErrors.WithLabelValues(
		p.config.ServiceName, errorType, tableName,
	).Inc()
}

// monitorPool monitors pgx connection pool
func (p *PgxInstrumentation) monitorPool(pool *pgxpool.Pool) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		stat := pool.Stat()
		
		p.metrics.poolConnections.WithLabelValues(
			p.config.ServiceName, "total",
		).Set(float64(stat.TotalConns()))

		p.metrics.poolIdleConns.WithLabelValues(
			p.config.ServiceName,
		).Set(float64(stat.IdleConns()))

		p.metrics.poolUsedConns.WithLabelValues(
			p.config.ServiceName,
		).Set(float64(stat.AcquiredConns()))
	}
}

// Helper functions

// extractTableName extracts table name from GORM statement
func extractTableName(db *gorm.DB) string {
	if db.Statement == nil || db.Statement.Table == "" {
		return "unknown"
	}
	return db.Statement.Table
}

// extractOperationFromSQL extracts operation from SQL query
func extractOperationFromSQL(sql string) string {
	sql = strings.TrimSpace(strings.ToLower(sql))
	parts := strings.Fields(sql)
	if len(parts) == 0 {
		return "unknown"
	}
	
	switch parts[0] {
	case "select":
		return "select"
	case "insert":
		return "insert"
	case "update":
		return "update"
	case "delete":
		return "delete"
	default:
		return "other"
	}
}

// extractTableFromSQL extracts table name from SQL query
func extractTableFromSQL(sql string) string {
	sql = strings.TrimSpace(strings.ToLower(sql))
	
	// Basic table extraction - can be enhanced
	if strings.Contains(sql, "from ") {
		parts := strings.Split(sql, "from ")
		if len(parts) > 1 {
			tablePart := strings.TrimSpace(parts[1])
			tableFields := strings.Fields(tablePart)
			if len(tableFields) > 0 {
				return strings.Trim(tableFields[0], "\"'`")
			}
		}
	}
	
	if strings.HasPrefix(sql, "insert into ") {
		parts := strings.Split(sql, "insert into ")
		if len(parts) > 1 {
			tablePart := strings.TrimSpace(parts[1])
			tableFields := strings.Fields(tablePart)
			if len(tableFields) > 0 {
				return strings.Trim(tableFields[0], "\"'`")
			}
		}
	}
	
	if strings.HasPrefix(sql, "update ") {
		parts := strings.Split(sql, "update ")
		if len(parts) > 1 {
			tablePart := strings.TrimSpace(parts[1])
			tableFields := strings.Fields(tablePart)
			if len(tableFields) > 0 {
				return strings.Trim(tableFields[0], "\"'`")
			}
		}
	}
	
	return "unknown"
}

// getErrorType categorizes database errors
func getErrorType(err error) string {
	if err == nil {
		return "none"
	}
	
	errStr := strings.ToLower(err.Error())
	
	switch {
	case strings.Contains(errStr, "connection"):
		return "connection"
	case strings.Contains(errStr, "timeout"):
		return "timeout"
	case strings.Contains(errStr, "unique"):
		return "constraint_unique"
	case strings.Contains(errStr, "foreign"):
		return "constraint_foreign"
	case strings.Contains(errStr, "not null"):
		return "constraint_null"
	case strings.Contains(errStr, "syntax"):
		return "syntax"
	case strings.Contains(errStr, "permission"):
		return "permission"
	default:
		return "other"
	}
}

// GetMetrics returns the metrics instance for external use
func (p *GormMonitoringPlugin) GetMetrics() *DatabaseMetrics {
	return p.metrics
}

// GetMetrics returns the metrics instance for external use
func (p *PgxInstrumentation) GetMetrics() *DatabaseMetrics {
	return p.metrics
}
