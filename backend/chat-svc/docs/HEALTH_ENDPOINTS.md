# Health Endpoints

This document describes the health check endpoints available in the chat-svc application. These endpoints are essential for monitoring, orchestration, and ensuring service reliability in containerized and distributed environments.

## Overview

The chat-svc provides three health-related endpoints designed for different use cases:

- **`/health`** - Comprehensive health check including database and Redis connectivity
- **`/health/readiness`** - Readiness probe for container orchestration
- **`/health/liveness`** - Liveness probe for container orchestration

All endpoints are exposed on port **8080** and return JSON responses.

## Endpoints

### 1. Primary Health Check - `/health`

**Purpose**: Comprehensive health assessment of the service and its dependencies.

**Method**: `GET`
**URL**: `http://localhost:8080/health`
**Timeout**: 10 seconds
**Dependencies Checked**:
- PostgreSQL database connectivity
- Redis connectivity
- Basic system health

#### Success Response (HTTP 200)
```json
{
  "status": "healthy",
  "service": "chat-svc",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "redis": {
      "status": "healthy",
      "message": "Redis connection successful",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "system": {
      "status": "healthy",
      "message": "Service is running",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### Failure Response (HTTP 503)
```json
{
  "status": "unhealthy",
  "service": "chat-svc",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "unhealthy",
      "message": "Database connection failed: connection refused",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "redis": {
      "status": "healthy",
      "message": "Redis connection successful",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "system": {
      "status": "healthy",
      "message": "Service is running",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 2. Readiness Probe - `/health/readiness`

**Purpose**: Determines if the service is ready to receive traffic. Used by load balancers and orchestration platforms.

**Method**: `GET`
**URL**: `http://localhost:8080/health/readiness`
**Timeout**: 5 seconds
**Dependencies Checked**:
- PostgreSQL database connectivity
- Redis connectivity

#### Success Response (HTTP 200)
```json
{
  "status": "ready",
  "service": "chat-svc",
  "checks": {
    "database": {
      "status": "ready",
      "message": "Database ready",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "redis": {
      "status": "ready",
      "message": "Redis ready",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### Failure Response (HTTP 503)
```json
{
  "status": "not_ready",
  "service": "chat-svc",
  "checks": {
    "database": {
      "status": "not_ready",
      "message": "Database not ready",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "redis": {
      "status": "ready",
      "message": "Redis ready",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 3. Liveness Probe - `/health/liveness`

**Purpose**: Basic check to determine if the service process is alive and should not be restarted.

**Method**: `GET`
**URL**: `http://localhost:8080/health/liveness`
**Timeout**: Immediate
**Dependencies Checked**: None (basic process health only)

#### Success Response (HTTP 200)
```json
{
  "status": "alive",
  "service": "chat-svc",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Usage in Container Orchestration

### Docker Compose

```yaml
services:
  chat-svc:
    image: chat-svc:latest
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-svc
spec:
  template:
    spec:
      containers:
      - name: chat-svc
        image: chat-svc:latest
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
```

### Load Balancer Configuration (NGINX)

```nginx
upstream chat_backend {
    server chat-svc:8080;
    # Add more instances as needed
}

server {
    listen 80;
    
    location / {
        proxy_pass http://chat_backend;
        
        # Health check configuration
        proxy_next_upstream error timeout http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
    
    # Optional: Expose health endpoint through load balancer
    location /health {
        proxy_pass http://chat_backend/health;
        access_log off;
    }
}
```

## Monitoring and Alerting

### Prometheus Metrics Integration

The health endpoints can be integrated with monitoring systems:

```yaml
# Example monitoring job
- job_name: 'chat-svc-health'
  static_configs:
    - targets: ['chat-svc:8080']
  metrics_path: '/health'
  scrape_interval: 30s
  scrape_timeout: 10s
```

### Alerting Rules

Example alerting rules based on health endpoints:

```yaml
groups:
- name: chat-svc.rules
  rules:
  - alert: ChatServiceUnhealthy
    expr: probe_success{job="chat-svc-health"} == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Chat service health check failing"
      
  - alert: ChatServiceDatabaseDown
    expr: probe_http_status_code{job="chat-svc-health"} == 503
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Chat service database connectivity issues"
```

## Configuration

Health check behavior can be configured via environment variables:

```bash
# Database connection timeout affects health checks
DB_CONN_MAX_LIFETIME=300s

# Redis connection timeout affects health checks  
REDIS_TIMEOUT=5s

# Health check interval (not directly used by endpoints but useful for monitoring)
HEALTH_CHECK_INTERVAL=30s
```

## Best Practices

1. **Use appropriate endpoints for different purposes**:
   - `/health` for comprehensive monitoring and debugging
   - `/health/readiness` for load balancer and traffic routing decisions
   - `/health/liveness` for process restart decisions

2. **Set appropriate timeouts**:
   - Liveness checks: Fast (< 5s)
   - Readiness checks: Moderate (5-10s) 
   - Health checks: Longer (10-30s)

3. **Configure retry logic**:
   - Allow multiple failures before marking as unhealthy
   - Use exponential backoff for retries

4. **Monitor health check performance**:
   - Track response times
   - Monitor failure rates
   - Set up alerts for prolonged failures

5. **Handle partial failures gracefully**:
   - Service should remain partially functional if non-critical dependencies fail
   - Use circuit breaker patterns for external dependencies

## Security Considerations

- Health endpoints are intentionally public and do not require authentication
- Avoid exposing sensitive information in health check responses
- Consider rate limiting if health endpoints are exposed externally
- Use HTTPS in production environments for health check traffic

## Troubleshooting

### Common Issues

1. **Database connection failures**:
   ```bash
   # Check database connectivity
   curl http://localhost:8080/health
   # Look for database status in response
   ```

2. **Redis connection failures**:
   ```bash
   # Check Redis connectivity
   curl http://localhost:8080/health/readiness
   # Verify Redis configuration
   ```

3. **Service not responding**:
   ```bash
   # Check if process is running
   curl http://localhost:8080/health/liveness
   ```

### Debugging Health Checks

Enable debug logging to see detailed health check information:

```bash
export LOG_LEVEL=debug
./chat-svc
```

Check logs for health check execution details and any errors encountered during dependency checks.
