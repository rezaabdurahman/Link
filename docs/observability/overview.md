# Observability & Monitoring Overview

This document provides a comprehensive overview of the observability and monitoring implementation for the Link platform.

## 🎯 Observability Architecture

### The Three Pillars of Observability

1. **Metrics**: Quantitative data about system behavior and performance
2. **Logs**: Detailed records of events and transactions  
3. **Traces**: Request flows across distributed services

### Monitoring Stack Components

```mermaid
graph TB
    subgraph "Application Services"
        API[API Gateway]
        USER[User Service]
        CHAT[Chat Service]
        DISC[Discovery Service]
        SEARCH[Search Service]
        AI[AI Service]
    end
    
    subgraph "Metrics Collection"
        PROM[Prometheus]
        NODE[Node Exporter]
        PG[PostgreSQL Exporter]
        REDIS[Redis Exporter]
    end
    
    subgraph "Logging"
        LOKI[Loki]
        PROMTAIL[Promtail]
    end
    
    subgraph "Tracing"
        JAEGER[Jaeger]
    end
    
    subgraph "Visualization & Alerting"
        GRAFANA[Grafana]
        ALERT[AlertManager]
    end
    
    API --> PROM
    USER --> PROM
    CHAT --> PROM
    DISC --> PROM
    SEARCH --> PROM
    AI --> PROM
    
    API --> PROMTAIL
    USER --> PROMTAIL
    CHAT --> PROMTAIL
    DISC --> PROMTAIL
    SEARCH --> PROMTAIL
    AI --> PROMTAIL
    
    API --> JAEGER
    USER --> JAEGER
    CHAT --> JAEGER
    
    NODE --> PROM
    PG --> PROM
    REDIS --> PROM
    
    PROMTAIL --> LOKI
    PROM --> GRAFANA
    LOKI --> GRAFANA
    JAEGER --> GRAFANA
    
    PROM --> ALERT
    ALERT --> GRAFANA
```

## 📊 Metrics Collection

### Application Metrics
Each service exposes metrics on `/metrics` endpoint with comprehensive coverage:

#### API Gateway Metrics
- **HTTP Request Metrics**: Duration, status codes, endpoint-specific counters
- **Authentication Metrics**: JWT validation success/failure rates
- **Proxy Metrics**: Upstream response times, error rates
- **Rate Limiting**: Requests blocked, rate limit consumption

#### Service-Specific Metrics
- **User Service**: Registration rates, login attempts, profile updates
- **Chat Service**: WebSocket connections, message delivery rates, conversation metrics
- **Discovery Service**: Broadcast operations, user availability, matching algorithms
- **Search Service**: Query performance, index operations, search result quality
- **AI Service**: API requests to OpenAI, token consumption, conversation summaries

### Infrastructure Metrics
- **System Resources**: CPU, memory, disk, network (Node Exporter)
- **Container Metrics**: Resource usage per service (cAdvisor)
- **Database Metrics**: Query performance, connection pool usage (PostgreSQL Exporter)
- **Cache Metrics**: Hit rates, memory usage, key operations (Redis Exporter)

### Custom Business Metrics
```go
// Example: User service metrics
var (
    userRegistrations = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "link_user_registrations_total",
            Help: "Total number of user registrations",
        },
        []string{"method", "status"},
    )
    
    activeConnections = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "link_websocket_connections_active",
            Help: "Number of active WebSocket connections",
        },
        []string{"service"},
    )
    
    databaseQueryDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "link_database_query_duration_seconds",
            Help: "Database query duration",
            Buckets: prometheus.DefBuckets,
        },
        []string{"service", "operation", "table"},
    )
)
```

## 📝 Logging Strategy

### Structured Logging
All services implement structured JSON logging with consistent fields:

```json
{
    "timestamp": "2024-01-01T12:00:00Z",
    "level": "info",
    "service": "user-svc",
    "request_id": "req-12345",
    "user_id": "user-67890",
    "operation": "create_user",
    "duration_ms": 125,
    "status": "success",
    "message": "User created successfully",
    "metadata": {
        "email": "user@example.com",
        "ip_address": "192.168.1.1"
    }
}
```

### Log Levels and Usage
- **ERROR**: Service failures, unhandled exceptions, critical issues
- **WARN**: Recoverable errors, deprecated features, unusual conditions
- **INFO**: Business logic events, successful operations, key state changes
- **DEBUG**: Detailed execution flow, variable values (development only)

### PII Sanitization
All logs are automatically sanitized to remove personally identifiable information:

```go
type LogSanitizer struct {
    sensitiveFields []string
}

func (s *LogSanitizer) SanitizeLog(logEntry map[string]interface{}) {
    for _, field := range s.sensitiveFields {
        if _, exists := logEntry[field]; exists {
            logEntry[field] = "[REDACTED]"
        }
    }
}
```

### Log Aggregation with Loki
- **Centralized Collection**: Promtail agents collect logs from all services
- **Label-based Indexing**: Efficient querying by service, environment, log level
- **Retention Policies**: Configurable retention per environment
- **Integration**: Seamless integration with Grafana for log exploration

## 🔍 Distributed Tracing

### Trace Implementation with Jaeger
Distributed tracing tracks requests across service boundaries:

```go
// Example: Tracing a user request
func (h *UserHandler) CreateUser(c *gin.Context) {
    // Start trace
    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "create_user")
    defer span.Finish()
    
    // Add trace metadata
    span.SetTag("user.email", userRequest.Email)
    span.SetTag("service", "user-svc")
    
    // Database operation with tracing
    dbSpan, dbCtx := opentracing.StartSpanFromContext(ctx, "db.create_user")
    user, err := h.userRepo.Create(dbCtx, userRequest)
    dbSpan.Finish()
    
    if err != nil {
        span.SetTag("error", true)
        span.LogFields(log.Error(err))
        return
    }
    
    span.SetTag("user.id", user.ID)
    c.JSON(201, user)
}
```

### Trace Correlation
- **Request IDs**: Unique identifier per request across all services
- **User Context**: User ID propagation for user-centric tracing
- **Performance Analysis**: Identify bottlenecks in request flows
- **Error Tracking**: Trace error propagation across services

## 🚨 Alerting & Incident Management

### Alert Categories

#### Critical Alerts (Immediate Response Required)
```yaml
# Service availability
- name: ServiceDown
  expr: up{job=~".*-svc"} == 0
  for: 2m
  severity: critical
  
# High error rate
- name: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 5m
  severity: critical

# Database connection failures
- name: DatabaseUnavailable
  expr: postgresql_up == 0
  for: 1m
  severity: critical
```

#### Warning Alerts (Investigation Required)
```yaml
# Elevated response time
- name: SlowResponses
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1.0
  for: 10m
  severity: warning

# High memory usage
- name: HighMemoryUsage
  expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
  for: 15m
  severity: warning
```

### Alert Routing
```yaml
# AlertManager configuration
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'pager-duty'
  - match:
      severity: warning
    receiver: 'slack-warnings'
```

## 📊 Dashboards & Visualization

### Grafana Dashboard Structure

#### Platform Overview Dashboard
- **System Health**: Overall platform status and availability
- **Request Volume**: Traffic patterns across all services
- **Error Rates**: Platform-wide error tracking
- **Resource Utilization**: CPU, memory, disk usage

#### Service-Specific Dashboards
- **API Gateway**: Request routing, authentication success rates
- **User Service**: Registration flows, authentication metrics
- **Chat Service**: Message delivery, WebSocket connection health
- **Database**: Query performance, connection pool usage

#### Business Metrics Dashboards
- **User Growth**: Registration trends, active user metrics
- **Engagement**: Message volume, discovery usage, feature adoption
- **Performance**: Response times, conversion rates, user experience

### Dashboard Configuration
```json
{
  "dashboard": {
    "title": "Link Platform Overview",
    "panels": [
      {
        "title": "Request Volume",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))",
            "format": "percentunit"
          }
        ]
      }
    ]
  }
}
```

## 🔧 Environment-Specific Configurations

### Local Development
- **Minimal Overhead**: Essential metrics only for performance
- **Verbose Logging**: Debug-level logging for development
- **Short Retention**: 1-day retention for logs and metrics
- **No Alerting**: Alerts disabled in development

### Staging
- **Production-like**: Full monitoring stack for testing
- **Extended Logging**: Info-level logging with detailed traces
- **Medium Retention**: 7-day retention for validation
- **Test Alerts**: Alerts configured but routed to test channels

### Production
- **Full Observability**: Complete metrics, logs, and traces
- **Optimized Logging**: Info/warn/error levels only
- **Long Retention**: 30-day retention with archiving
- **Production Alerts**: Full alerting with escalation procedures

## 🔍 Troubleshooting & Debugging

### Common Monitoring Issues

#### Missing Metrics
```bash
# Check service health endpoints
curl http://service-name:port/health
curl http://service-name:port/metrics

# Verify Prometheus targets
curl http://prometheus:9090/api/v1/targets
```

#### Log Collection Issues
```bash
# Check Promtail status
docker logs promtail

# Test log shipping
logger -t test-service "Test log message"

# Query Loki directly
curl -G -s "http://loki:3100/loki/api/v1/query" --data-urlencode 'query={service="user-svc"}'
```

#### Dashboard Issues
```bash
# Check Grafana data sources
curl http://admin:admin@grafana:3000/api/datasources

# Test Prometheus queries
curl -G 'http://prometheus:9090/api/v1/query' --data-urlencode 'query=up'
```

### Performance Analysis Workflow
1. **Start with Platform Overview**: Identify affected services
2. **Drill Down to Service**: Use service-specific dashboards
3. **Examine Traces**: Identify bottlenecks in request flow
4. **Analyze Logs**: Look for error patterns and context
5. **Check Infrastructure**: Verify resource availability

## 📚 Best Practices

### Metrics Best Practices
- **Use Labels Wisely**: High-cardinality labels can impact performance
- **Consistent Naming**: Follow Prometheus naming conventions
- **Business Context**: Include business-relevant labels and metrics
- **Rate Over Count**: Use rate() for better insights into trends

### Logging Best Practices
- **Structured Format**: Always use JSON for machine-readable logs
- **Correlation IDs**: Include request/trace IDs for correlation
- **Contextual Information**: Include relevant business context
- **Avoid Sensitive Data**: Implement PII sanitization

### Alerting Best Practices
- **Alert on Symptoms**: Focus on user-impacting issues
- **Avoid Alert Fatigue**: Set appropriate thresholds and timing
- **Runbook References**: Include troubleshooting steps in alerts
- **Test Alert Rules**: Regularly validate alert conditions

For detailed implementation guides, see:
- [Metrics Implementation](metrics.md)
- [Logging Configuration](logging.md)
- [Alerting Setup](alerting.md)
- [Dashboard Creation](dashboards.md)