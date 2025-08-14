# Health Check Endpoints

The AI service provides three health check endpoints designed for different monitoring scenarios, particularly for Kubernetes deployments.

## Endpoints Overview

| Endpoint | Purpose | Timeout | Use Case |
|----------|---------|---------|----------|
| `/health` | Comprehensive health check | 10s | General monitoring, alerting |
| `/health/readiness` | Readiness probe | 5s | Kubernetes readiness probe |
| `/health/liveness` | Liveness probe | 1s | Kubernetes liveness probe |

## 1. Health Check (`/health`)

**Purpose**: Comprehensive health verification of all service dependencies.

**Method**: `GET /health`

**Response Format**:
```json
{
  "status": "healthy|unhealthy",
  "service": "ai-svc",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy|unhealthy",
      "message": "Database connection successful",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    "redis": {
      "status": "healthy|unhealthy", 
      "message": "Redis connection successful",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    "ai_service": {
      "status": "healthy|unhealthy",
      "message": "AI service operational",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    "system": {
      "status": "healthy",
      "message": "Service is running",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

**HTTP Status Codes**:
- `200 OK`: All checks passed
- `503 Service Unavailable`: One or more checks failed

**What's Checked**:
- Database connectivity and query execution
- Redis connectivity and ping
- AI service provider availability
- Basic system health

## 2. Readiness Probe (`/health/readiness`)

**Purpose**: Determine if the service is ready to accept traffic.

**Method**: `GET /health/readiness`

**Response Format**:
```json
{
  "status": "ready|not_ready",
  "service": "ai-svc",
  "checks": {
    "database": {
      "status": "ready|not_ready",
      "message": "Database ready",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    "redis": {
      "status": "ready|not_ready",
      "message": "Redis ready", 
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

**HTTP Status Codes**:
- `200 OK`: Service is ready to accept traffic
- `503 Service Unavailable`: Service is not ready

**What's Checked**:
- Quick database ping
- Quick Redis ping
- Essential services for request processing

## 3. Liveness Probe (`/health/liveness`)

**Purpose**: Determine if the service process is alive and should be restarted if failing.

**Method**: `GET /health/liveness`

**Response Format**:
```json
{
  "status": "alive",
  "service": "ai-svc",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**HTTP Status Codes**:
- `200 OK`: Service process is alive

**What's Checked**:
- Basic process liveness (always returns success if reachable)

## Kubernetes Configuration

### Example Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-svc
spec:
  template:
    spec:
      containers:
      - name: ai-svc
        image: ai-svc:latest
        ports:
        - containerPort: 8081
        
        # Liveness probe - restart container if failing
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 8081
          initialDelaySeconds: 15
          periodSeconds: 20
          timeoutSeconds: 5
          failureThreshold: 3
          
        # Readiness probe - remove from load balancer if failing  
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 8081
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 2
```

### Probe Configuration Guidelines

**Liveness Probe**:
- `initialDelaySeconds: 15` - Wait for service startup
- `periodSeconds: 20` - Check every 20 seconds
- `timeoutSeconds: 5` - 5 second timeout
- `failureThreshold: 3` - Restart after 3 failures

**Readiness Probe**:
- `initialDelaySeconds: 5` - Start checking quickly
- `periodSeconds: 10` - Check every 10 seconds  
- `timeoutSeconds: 3` - Quick timeout for readiness
- `failureThreshold: 3` - Remove from LB after 3 failures
- `successThreshold: 2` - Require 2 successes to be ready

## Monitoring Integration

### Prometheus Metrics (Coming Soon)

Health check results can be exposed as Prometheus metrics:

```
# HELP ai_svc_health_check_status Health check status (1=healthy, 0=unhealthy)
# TYPE ai_svc_health_check_status gauge
ai_svc_health_check_status{component="database"} 1
ai_svc_health_check_status{component="redis"} 1
ai_svc_health_check_status{component="ai_service"} 1

# HELP ai_svc_health_check_duration_seconds Health check duration
# TYPE ai_svc_health_check_duration_seconds histogram
ai_svc_health_check_duration_seconds_bucket{le="0.1"} 45
ai_svc_health_check_duration_seconds_bucket{le="0.5"} 48
ai_svc_health_check_duration_seconds_bucket{le="1.0"} 50
```

### Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
- name: ai-svc.health
  rules:
  - alert: AISvcUnhealthy
    expr: ai_svc_health_check_status{component="database"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "AI Service database health check failing"
      
  - alert: AISvcNotReady
    expr: up{job="ai-svc"} == 0
    for: 30s
    labels:
      severity: warning
    annotations:
      summary: "AI Service not ready to accept traffic"
```

## Troubleshooting

### Common Issues

**Database Connection Failures**:
- Check database connectivity: `pg_isready -h $DB_HOST -p $DB_PORT`
- Verify credentials and database exists
- Check network policies/firewall rules

**Redis Connection Failures**:
- Test Redis connectivity: `redis-cli -h $REDIS_HOST -p $REDIS_PORT ping`
- Verify Redis is running and accessible
- Check authentication if Redis requires it

**AI Service Failures**:
- Verify AI_API_KEY is set and valid
- Check AI provider service status
- Review rate limits and quotas

### Health Check Debugging

Enable debug logging to see detailed health check information:

```bash
# Set log level to debug
export LOG_LEVEL=debug

# Check health endpoint manually
curl -v http://localhost:8081/health
```

### Performance Considerations

- Health checks run concurrently for faster response times
- Timeouts are configured to prevent hanging checks
- Results are not cached - each request performs fresh checks
- Database and Redis connections are reused from connection pools
