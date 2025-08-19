# Database Performance Monitoring

This library provides comprehensive database performance monitoring for the Link application, integrating Prometheus metrics, Grafana dashboards, and Sentry error reporting across all backend services.

## Features

- **Comprehensive Metrics**: Query duration, error rates, connection pool utilization, slow query detection
- **Multi-Database Support**: GORM (PostgreSQL with PostGIS, pgvector) and pgx connection pools
- **Service-Specific Tuning**: Tailored thresholds for different service requirements
- **Real-time Alerting**: Prometheus alerts for performance degradation and SLO breaches
- **Error Reporting**: Integrated Sentry reporting with rich context and sanitized queries
- **Production Ready**: Configurable thresholds, sanitization, and performance optimizations

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│ Monitoring Hooks │───▶│   Prometheus    │
│    Services     │    │  (GORM/pgx)      │    │    Metrics      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Sentry      │    │     Grafana     │
                       │ Error Reporting │    │   Dashboards    │
                       └─────────────────┘    └─────────────────┘
```

## Service Integration

### 1. User Service (GORM + PostgreSQL)
```go
// backend/user-svc/internal/config/database.go
monitoringConfig := monitoring.DefaultConfig("user-svc")
monitoringConfig.SlowQueryThreshold = 50 * time.Millisecond // Production: fast user queries

monitoringPlugin := monitoring.NewGormMonitoringPlugin(monitoringConfig)
db.Use(monitoringPlugin)

if os.Getenv("SENTRY_DSN") != "" {
    sentryPlugin := monitoring.NewGormSentryPlugin(monitoringConfig)
    db.Use(sentryPlugin)
}
```

### 2. Location Service (GORM + PostGIS)
```go
// backend/location-svc/internal/config/database.go
monitoringConfig := monitoring.DefaultConfig("location-svc")
monitoringConfig.SlowQueryThreshold = 200 * time.Millisecond // Higher threshold for spatial queries

monitoringPlugin := monitoring.NewGormMonitoringPlugin(monitoringConfig)
db.Use(monitoringPlugin)
```

### 3. Search Service (GORM + pgvector)
```go
// backend/search-svc/internal/config/database.go
monitoringConfig := monitoring.DefaultConfig("search-svc")
monitoringConfig.SlowQueryThreshold = 500 * time.Millisecond // Vector queries are compute-intensive

monitoringPlugin := monitoring.NewGormMonitoringPlugin(monitoringConfig)
db.Use(monitoringPlugin)
```

### 4. Chat Service (pgx Connection Pool)
```go
// backend/chat-svc/internal/db/db.go
monitoringConfig := monitoring.DefaultConfig("chat-svc")
monitoringConfig.SlowQueryThreshold = 50 * time.Millisecond // Real-time messaging requires fast queries

pgxInstrumentation := monitoring.NewPgxInstrumentation(monitoringConfig)
monitoredPool := pgxInstrumentation.WrapPool(pool)

sentryWrapper := monitoring.NewPgxSentryWrapper("chat-svc", monitoringConfig.SlowQueryThreshold)
```

## Metrics Exported

### Query Performance Metrics
- `database_query_duration_seconds`: Query execution time histogram
- `database_queries_total`: Total queries by service, operation, table, and status
- `database_slow_queries_total`: Slow query counter with configurable thresholds
- `database_query_errors_total`: Query errors by type and service

### Connection Pool Metrics
- `database_pool_connections`: Current connection counts by state
- `database_pool_idle_connections`: Available idle connections
- `database_pool_used_connections`: Active connections in use
- `database_pool_wait_duration_seconds`: Connection acquisition time

### Database Operation Metrics
- `database_transactions_total`: Transaction counts by status
- `database_rows_affected`: Histogram of rows affected by operations

## Service-Specific Thresholds

| Service | Slow Query Threshold | Reasoning |
|---------|---------------------|-----------|
| user-svc | 50ms | Fast user operations required |
| chat-svc | 50ms | Real-time messaging performance |
| location-svc | 200ms | PostGIS spatial queries are complex |
| search-svc | 500ms | Vector similarity searches are compute-intensive |

## Sentry Error Reporting

### Automatic Error Capture
- **Database Errors**: Connection failures, query syntax errors, constraint violations
- **Slow Queries**: Performance issues with sanitized query context
- **Connection Pool Issues**: Pool exhaustion and timeout alerts
- **Transaction Failures**: Long-running transaction detection

### Error Context
- Service name and operation type
- Sanitized SQL queries (parameters removed)
- Query duration and performance metrics
- Table names and affected row counts
- Error categorization (connection, timeout, constraint, etc.)

### Breadcrumbs
- Query operation tracking for debugging
- Performance threshold violations
- Connection pool state changes

## Alerting Rules

### Critical Alerts (Immediate Action Required)
- `DatabaseConnectionPoolExhausted`: No available connections
- `DatabaseConnectionPoolCritical`: >95% pool utilization
- `DatabaseQueryErrorRateCritical`: >20% query error rate
- `DatabaseConnectionErrors`: Database connectivity issues
- `DatabaseSLOBreach`: Availability or latency SLO violation

### Warning Alerts (Monitor and Plan)
- `DatabaseConnectionPoolHigh`: >80% pool utilization
- `DatabaseSlowQueriesHigh`: >0.1 slow queries/second
- `DatabaseQueryErrorRateHigh`: >5% query error rate
- `DatabaseQueryDurationHigh`: P95 latency >500ms

### Service-Specific Alerts
- `ChatServiceDatabaseSlowQueries`: Real-time messaging impact
- `SearchServiceVectorQueriesSlow`: Search functionality degradation
- `LocationServicePostGISQueries`: Location feature performance

## Grafana Dashboard

The comprehensive dashboard includes:

### Overview Section
- Query rates by service (QPS)
- Connection pool utilization trends
- Available connection monitoring

### Performance Analysis
- Query duration percentiles (P50, P95, P99)
- Slow query rate trends
- Service-specific performance metrics

### Error Analysis
- Error rates by type and service
- Error distribution visualization
- Historical error trends

### Service-Specific Monitoring
- Chat Service: Real-time query performance
- Search Service: Vector query optimization
- Location Service: PostGIS operation efficiency

### SLO Tracking
- Database availability (99.9% target)
- Query latency (P99 < 100ms target)
- Success rate trends

## Configuration

### Environment Variables
```bash
# Required
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
ENVIRONMENT=production

# Optional Tuning
DB_SLOW_QUERY_THRESHOLD_MS=100
DB_MONITORING_ENABLED=true
DB_SENTRY_SAMPLING_RATE=0.1
```

### Custom Configuration
```go
config := &monitoring.Config{
    ServiceName:       "my-service",
    SlowQueryThreshold: 250 * time.Millisecond,
    EnableQueryLogging: true,
    SanitizeQueries:    true,
}

plugin := monitoring.NewGormMonitoringPlugin(config)
```

## Security Considerations

### Query Sanitization
- SQL parameters are automatically sanitized (`$1`, `$2` → `$?`)
- String literals are masked (`'sensitive'` → `'?'`)
- Query length is limited to 500 characters in error reports

### PII Protection
- No user data is included in metrics labels
- Database connection strings are never logged
- Sentry context excludes sensitive query parameters

### Production Hardening
- Configurable sampling rates for Sentry reporting
- Environment-based feature toggling
- Graceful degradation when monitoring systems are unavailable

## Deployment

### 1. Update Service Dependencies
```bash
go mod tidy
```

### 2. Configure Prometheus
Add the alerting rules to your Prometheus configuration:
```yaml
rule_files:
  - "monitoring/alerting-rules/database-performance.yml"
```

### 3. Import Grafana Dashboard
Import the dashboard from `monitoring/grafana/dashboards/database-performance.json`

### 4. Verify Integration
Check that metrics are being exported:
```bash
curl http://localhost:9090/metrics | grep database_
```

### 5. Test Alerting
Generate test load to verify alerts trigger correctly.

## Troubleshooting

### Common Issues

**Metrics not appearing**: Verify service names match exactly across configuration
**High memory usage**: Reduce cardinality by limiting table name labels
**Sentry spam**: Adjust sampling rates and error thresholds
**Alert fatigue**: Fine-tune alert thresholds based on baseline performance

### Debug Mode
Enable debug logging:
```go
config.EnableQueryLogging = true
```

### Performance Impact
The monitoring overhead is minimal:
- ~1-2μs per query for metrics collection
- Connection pool monitoring runs every 15 seconds
- Sentry reporting is sampled based on environment

## Contributing

When adding new metrics or modifying thresholds:

1. Test with realistic workloads
2. Update alerting rules accordingly
3. Verify dashboard compatibility
4. Update this documentation
5. Consider backward compatibility

## Support

For issues with database monitoring:
1. Check service logs for monitoring plugin errors
2. Verify Prometheus is scraping metrics endpoints
3. Ensure Sentry DSN is correctly configured
4. Review alert rule syntax and thresholds
