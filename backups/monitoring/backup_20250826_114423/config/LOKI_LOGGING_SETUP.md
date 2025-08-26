# Loki Structured Logging Setup

This document explains how to enable and use the Grafana/Loki setup for collecting structured logs from your Link application services.

## Overview

The logging stack consists of:
- **Loki**: Log aggregation system that stores and indexes structured logs
- **Promtail**: Log collector that scrapes Docker container logs and forwards them to Loki
- **Grafana**: Visualization platform with Loki datasource for log exploration and dashboards

## Current Configuration Status

✅ **Application Logging**: Your services already output structured JSON logs
✅ **Loki Service**: Configured and ready to run
✅ **Promtail Service**: Configured to collect Docker container logs  
✅ **Grafana Integration**: Loki datasource configured with log exploration capabilities
✅ **Basic Dashboard**: Log overview dashboard created

## Enabling the Logging Stack

### Development Environment

```bash
# Start the full stack including logging
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  --profile logging \
  up -d

# Or if you want development + monitoring + logging
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  --profile development \
  --profile logging \
  up -d
```

### Production Environment

```bash
# Start production stack with logging enabled
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  --profile production \
  --profile logging \
  up -d
```

## Accessing the Services

Once started, you can access:

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin123` (development) or from environment variable (production)
- **Loki**: http://localhost:3100 (API endpoint)
- **Promtail**: http://localhost:9080 (metrics/health endpoint)

## Log Structure

Your applications output structured JSON logs with the following fields:

```json
{
  "level": "info",
  "time": "2024-01-19T16:00:33Z",
  "msg": "HTTP request completed",
  "service": "ai-svc",
  "method": "POST",
  "url": "/api/v1/ai/chat",
  "status": 200,
  "duration": "45ms",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_email": "user@example.com",
  "request_id": "req_abc123",
  "remote_addr": "192.168.1.100"
}
```

## Using Grafana for Log Exploration

### 1. Basic Log Exploration

1. Open Grafana at http://localhost:3001
2. Go to **Explore** (compass icon in sidebar)
3. Select **Loki** as the datasource
4. Use LogQL queries to search logs:

```logql
# All logs from ai-svc
{service="ai-svc"}

# Error logs from all services
{level="error"}

# Logs for a specific user
{user_id="550e8400-e29b-41d4-a716-446655440000"}

# HTTP requests with status 500
{service=~"ai-svc|chat-svc"} | json | status="500"
```

### 2. Pre-built Dashboard

A "Link App - Logs Overview" dashboard is available with:
- Log volume by service and level
- HTTP status code rates
- Recent error logs table
- Live log streaming with filtering

### 3. Advanced Queries

```logql
# Request duration analysis
{service="ai-svc"} | json | duration != "" | 
unwrap duration | rate(5m)

# Top users by request volume
topk(10, 
  sum by (user_id) (
    rate({service=~"ai-svc|chat-svc"}[5m])
  )
)

# Error rate by service
sum by (service) (
  rate({level="error"}[5m])
) / sum by (service) (
  rate({}[5m])
)
```

## Log Retention and Storage

### Current Configuration

- **Loki**: Stores logs in `/loki` volume
- **Retention**: Default (no explicit retention policy set)
- **Docker Logs**: 10MB max size, 3 files per container

### Configuring Retention (Optional)

To set log retention, create or modify `loki-config.yaml`:

```yaml
# Add to loki service configuration
command: 
  - -config.file=/etc/loki/local-config.yaml
  - -table-manager.retention-period=168h  # 7 days
  - -table-manager.retention-deletes-enabled=true
```

## Troubleshooting

### No Logs Appearing in Loki

1. **Check Promtail Status**:
   ```bash
   docker logs promtail-production  # or promtail-development
   ```

2. **Verify Log Files**:
   ```bash
   # Check if container logs exist
   docker inspect <container_name> | grep LogPath
   ```

3. **Check Loki Health**:
   ```bash
   curl http://localhost:3100/ready
   ```

### Promtail Configuration Issues

1. **Verify Promtail can access Docker socket**:
   ```bash
   docker logs promtail-production 2>&1 | grep -i error
   ```

2. **Check log file permissions**:
   ```bash
   # Promtail container should have read access to:
   # /var/lib/docker/containers/*/*log
   ```

### Performance Considerations

1. **Resource Limits**: Loki and Promtail have resource limits set in production
2. **Log Volume**: Monitor disk usage for log storage
3. **Query Performance**: Use appropriate time ranges and label filters

## Security Considerations

### Production Setup

1. **Grafana Security**:
   - Use secure passwords (stored in environment variables)
   - Configure HTTPS in production
   - Set up proper user authentication

2. **Loki Access**:
   - Loki is only accessible within Docker network
   - No external exposure by default

3. **Log Content**:
   - Avoid logging sensitive information (passwords, API keys, etc.)
   - PII data should be handled according to your privacy policy

## Environment Variables

Key environment variables for logging configuration:

```bash
# Application logging
LOG_LEVEL=info           # debug, info, warn, error
LOG_FORMAT=json          # json or text

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=secure_password

# Loki (if customizing)
LOKI_RETENTION_PERIOD=168h
```

## Integration with Alerting

You can create alerts based on log patterns:

1. **Error Rate Alerts**: Alert when error rate exceeds threshold
2. **Service Down**: Alert when no logs received from a service
3. **Performance**: Alert on high response times in logs

Example alert rule:
```yaml
# Add to Prometheus alerting rules
- alert: HighErrorRate
  expr: |
    sum by (service) (
      rate({level="error"}[5m])
    ) > 0.1
  labels:
    severity: warning
  annotations:
    summary: "High error rate detected in {{ $labels.service }}"
```

## Next Steps

1. **Custom Dashboards**: Create service-specific dashboards
2. **Log Parsing**: Enhance Promtail configuration for specific log formats
3. **Alerting**: Set up log-based alerts
4. **Retention**: Configure appropriate log retention policies
5. **Performance**: Monitor and optimize based on log volume

For more advanced LogQL queries and Grafana configuration, refer to:
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [LogQL Reference](https://grafana.com/docs/loki/latest/logql/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
