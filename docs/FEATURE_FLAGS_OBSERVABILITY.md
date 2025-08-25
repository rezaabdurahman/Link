# Feature Flags Observability Guide

This document describes the comprehensive observability setup for the feature flags and A/B testing system.

## Overview

The feature flags system includes multiple layers of observability:

- **Metrics**: Prometheus metrics for quantitative monitoring
- **Logging**: Structured logging with contextual information
- **Tracing**: Distributed tracing with OpenTelemetry
- **Health Checks**: Component health monitoring
- **Alerting**: Proactive alerting on critical issues

## Metrics

### Prometheus Metrics

The feature service exposes the following metrics at `/metrics`:

#### Feature Flag Metrics

- `feature_flag_evaluations_total`: Total number of feature flag evaluations
  - Labels: `flag_key`, `enabled`, `reason`, `environment`
  
- `feature_flag_evaluation_duration_seconds`: Duration of feature flag evaluations
  - Labels: `flag_key`, `environment`
  
- `feature_flag_evaluation_errors_total`: Total number of feature flag evaluation errors
  - Labels: `flag_key`, `error_type`, `environment`

#### Experiment Metrics

- `experiment_evaluations_total`: Total number of experiment evaluations
  - Labels: `experiment_key`, `variant`, `in_experiment`, `reason`, `environment`
  
- `experiment_evaluation_duration_seconds`: Duration of experiment evaluations
  - Labels: `experiment_key`, `environment`
  
- `experiment_conversions_total`: Total number of experiment conversions
  - Labels: `experiment_key`, `variant`, `conversion_type`, `environment`

#### Cache Metrics

- `feature_cache_hits_total`: Total number of cache hits
  - Labels: `cache_type`, `key_type`
  
- `feature_cache_misses_total`: Total number of cache misses
  - Labels: `cache_type`, `key_type`
  
- `feature_cache_operation_duration_seconds`: Duration of cache operations
  - Labels: `operation`, `cache_type`

#### Database Metrics

- `feature_database_operations_total`: Total number of database operations
  - Labels: `operation`, `table`, `status`
  
- `feature_database_operation_duration_seconds`: Duration of database operations
  - Labels: `operation`, `table`

#### Service Health Metrics

- `feature_service_health_status`: Health status of service components
  - Labels: `component`
  
- `feature_active_flags_total`: Total number of active feature flags
- `feature_active_experiments_total`: Total number of active experiments

#### Circuit Breaker Metrics

- `feature_circuit_breaker_status`: Circuit breaker status
  - Labels: `component`
  
- `feature_circuit_breaker_trips_total`: Total number of circuit breaker trips
  - Labels: `component`, `reason`

### Recording Metrics

Metrics are automatically recorded throughout the application:

```go
import "github.com/link/feature-svc/metrics"

// Record feature flag evaluation
metrics.RecordFlagEvaluation("dark_mode", true, "FLAG_ENABLED", "production", duration)

// Record experiment conversion
metrics.RecordExperimentConversion("button_test", "treatment", "click", "production")

// Record cache operation
metrics.RecordCacheHit("redis", "feature_flag")
```

## Logging

### Structured Logging

The service uses structured logging with the following fields:

```json
{
  "timestamp": "2024-01-20T10:30:00.123Z",
  "level": "info",
  "message": "Feature flag evaluated",
  "service": "feature-svc",
  "trace_id": "abc123",
  "span_id": "def456",
  "event_type": "flag_evaluation",
  "flag_key": "dark_mode",
  "user_id": "user-123",
  "enabled": true,
  "reason": "FLAG_ENABLED",
  "duration_ms": 45
}
```

### Log Types

#### Feature Flag Evaluation
- Event Type: `flag_evaluation`
- Fields: `flag_key`, `user_id`, `enabled`, `variant`, `reason`, `duration_ms`

#### Experiment Evaluation
- Event Type: `experiment_evaluation`
- Fields: `experiment_key`, `user_id`, `variant`, `in_experiment`, `reason`, `duration_ms`

#### Conversions
- Event Type: `experiment_conversion`
- Fields: `experiment_key`, `user_id`, `variant`, `conversion_type`

#### Cache Operations
- Event Type: `cache_operation`
- Fields: `operation`, `cache_key`, `hit`, `duration_ms`

#### Database Operations
- Event Type: `database_operation`
- Fields: `operation`, `table`, `success`, `duration_ms`, `rows_affected`

#### Errors
- Event Type: `error`
- Fields: `error`, `flag_key` or `experiment_key`, additional context

### Configuration

Set logging configuration through environment variables:

```bash
LOG_LEVEL=info          # debug, info, warn, error
LOG_FORMAT=json         # json, text
```

## Distributed Tracing

### OpenTelemetry Integration

The service supports distributed tracing with OpenTelemetry:

```go
import "github.com/link/feature-svc/tracing"

// Initialize tracing
shutdown, err := tracing.InitTracing(ctx)
defer shutdown(ctx)

// Create spans for operations
ctx, span := tracing.TraceFeatureFlagEvaluation(ctx, "dark_mode", "user-123")
defer span.End()
```

### Trace Configuration

Configure tracing through environment variables:

```bash
TRACE_EXPORTER=otlp              # otlp, jaeger
OTLP_ENDPOINT=localhost:4317     # OTLP collector endpoint
JAEGER_ENDPOINT=http://localhost:14268/api/traces
TRACE_SAMPLING_RATE=0.1          # 10% sampling, or "always"/"never"
```

### Span Attributes

Traces include relevant attributes:

- **Feature Flags**: `feature.flag_key`, `user.id`, `feature.enabled`, `feature.reason`
- **Experiments**: `experiment.key`, `user.id`, `experiment.variant`, `experiment.in_experiment`
- **Cache**: `cache.operation`, `cache.key`, `cache.hit`
- **Database**: `db.operation`, `db.table`, `db.system`

## Health Checks

### Endpoints

The service provides multiple health check endpoints:

#### `/health` - Comprehensive Health Check
Returns detailed health status of all components:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "database": {
      "status": "healthy",
      "message": "Database is responsive",
      "last_checked": "2024-01-20T10:30:00Z",
      "duration": "15ms"
    },
    "redis": {
      "status": "healthy",
      "message": "Redis is responsive",
      "last_checked": "2024-01-20T10:30:00Z",
      "duration": "5ms"
    },
    "application": {
      "status": "healthy",
      "message": "Application is running",
      "last_checked": "2024-01-20T10:30:00Z",
      "duration": "1ms"
    }
  },
  "metrics": {
    "check_duration_ms": 21,
    "goroutines": 15
  }
}
```

#### `/health/ready` - Readiness Check
Quick check for Kubernetes readiness probe.

#### `/health/live` - Liveness Check
Basic liveness check for Kubernetes liveness probe.

### Health Status Values

- `healthy`: Component is fully functional
- `degraded`: Component has issues but is still operational
- `unhealthy`: Component is not functional

## Alerting

### Prometheus Alerting Rules

Critical alerts are configured in `/monitoring/prometheus/rules/feature-flags.yml`:

#### Critical Alerts
- **FeatureServiceDown**: Service is completely down
- **FeatureFlagVeryHighLatency**: P95 latency > 2s
- **FeatureFlagVeryHighErrorRate**: Error rate > 20/sec
- **FeatureCacheVeryLowHitRate**: Cache hit rate < 50%

#### Warning Alerts
- **FeatureServiceUnhealthy**: Component health issues
- **FeatureFlagHighLatency**: P95 latency > 500ms
- **FeatureFlagHighErrorRate**: Error rate > 5/sec
- **FeatureCacheLowHitRate**: Cache hit rate < 80%
- **FeatureCircuitBreakerOpen**: Circuit breaker activated

#### Business Alerts
- **ExperimentLowParticipation**: Experiment participation is low
- **ExperimentNoConversions**: Experiment has no conversions

### Alert Routing

Alerts are routed based on severity:

- **Critical**: Immediate notification to on-call engineer
- **Warning**: Notification to team Slack channel
- **Info**: Logged for analysis, no immediate notification

## Dashboards

### Grafana Dashboard

A comprehensive Grafana dashboard is available at `/monitoring/grafana/dashboards/feature-flags.json`:

#### Panels Include:
1. **Evaluation Rate**: Requests per second for flags and experiments
2. **Service Health**: Current health status of all components
3. **Top Flags**: Most frequently evaluated feature flags
4. **Experiment Distribution**: Variant distribution across experiments
5. **Latency**: P50, P95, P99 response times
6. **Cache Performance**: Hit rate and operation times
7. **Error Rates**: Error counts by type
8. **Conversion Rates**: Experiment conversion metrics

### Dashboard Access

- **Production**: https://grafana.link-app.com/d/feature-flags-dashboard
- **Staging**: https://grafana-staging.link-app.com/d/feature-flags-dashboard

## Troubleshooting

### Common Issues

#### High Latency
1. Check database connection and query performance
2. Verify cache hit rates
3. Review circuit breaker status
4. Check for resource constraints (CPU, memory)

#### Cache Misses
1. Verify Redis connectivity
2. Check cache TTL configurations
3. Review cache key patterns
4. Monitor Redis memory usage

#### Experiment Issues
1. Check experiment configuration (traffic allocation, variants)
2. Verify user assignment logic
3. Review conversion tracking implementation
4. Validate experiment start/end dates

### Debugging Commands

```bash
# Check service logs
kubectl logs -f deployment/feature-svc

# Check metrics endpoint
curl http://feature-svc:8086/metrics

# Health check
curl http://feature-svc:8086/health

# Feature flag test
curl -X POST http://feature-svc:8086/api/features/flags/dark_mode/evaluate \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'
```

## Best Practices

### Monitoring
1. Set up alerts for critical metrics (latency, errors, health)
2. Monitor business metrics (conversion rates, flag usage)
3. Use distributed tracing to understand request flows
4. Implement proper logging levels for different environments

### Performance
1. Monitor cache hit rates and optimize TTL settings
2. Use circuit breakers to prevent cascading failures
3. Implement proper database indexing
4. Set reasonable timeouts for all operations

### Security
1. Monitor for unusual flag evaluation patterns
2. Log all flag configuration changes
3. Implement rate limiting to prevent abuse
4. Use secure transport for all communications

## Maintenance

### Regular Tasks
1. Review and tune alerting thresholds
2. Clean up old experiment data
3. Optimize database queries and indexes
4. Update dashboard panels based on usage patterns
5. Rotate and manage trace sampling rates

### Capacity Planning
1. Monitor resource usage trends
2. Plan for traffic growth in flag evaluations
3. Scale cache and database resources appropriately
4. Review and adjust rate limits