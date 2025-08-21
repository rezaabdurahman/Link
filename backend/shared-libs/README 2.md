# Distributed Service Lifecycle Management

This shared library provides standardized lifecycle management, health checking, and graceful shutdown capabilities for all microservices in the Link distributed architecture.

## Overview

The lifecycle management system ensures that:
- **Each service manages its own health and lifecycle**
- **API Gateway monitors downstream service health**
- **Kubernetes compatibility** with standard health endpoints
- **Graceful shutdown** with proper resource cleanup
- **Dynamic service registration/deregistration** capabilities

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  User Service   │    │ Location Service│
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Lifecycle   │◄┼────┼►│ Lifecycle   │ │    │ │ Lifecycle   │ │
│ │ Manager     │ │    │ │ Manager     │ │    │ │ Manager     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ Monitors:       │    │ Manages:        │    │ Manages:        │
│ - DB Health     │    │ - DB Health     │    │ - DB Health     │
│ - Redis Health  │    │ - Redis Health  │    │ - Redis Health  │
│ - Service Health│    │ - Dependencies  │    │ - Dependencies  │
│ - Load Balancer │    │ - Self Health   │    │ - Self Health   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### 1. ServiceManager
Central lifecycle orchestrator for each service:
- **State Management**: Starting → Healthy → Degraded → Shutting Down → Stopped
- **Health Check Orchestration**: Periodic health checks with configurable intervals
- **Graceful Shutdown**: Resource cleanup with timeout handling
- **Signal Handling**: OS signal capture for graceful termination

### 2. Health Checkers
Modular health check implementations:
- **DatabaseHealthChecker**: PostgreSQL connectivity and query testing
- **RedisHealthChecker**: Redis connectivity and operation testing
- **HTTPServiceHealthChecker**: External service endpoint monitoring
- **LoadBalancerHealthChecker**: Load balancer status and instance health
- **DependencyHealthChecker**: Critical vs optional dependency management
- **CompositeHealthChecker**: Multiple checker aggregation

### 3. Standard Health Endpoints
Kubernetes-compatible endpoints:
- `/health/live` - Liveness probe (service is running)
- `/health/ready` - Readiness probe (service can handle traffic)
- `/health/detailed` - Comprehensive health status with dependencies

## Integration Guide

### 1. Import the Shared Library

Add to your service's `go.mod`:
```go
require github.com/link-app/shared-libs v0.0.0
```

### 2. Basic Service Integration

```go
package main

import (
    "context"
    "net/http"
    "time"

    "github.com/link-app/shared-libs/lifecycle"
)

func main() {
    // Configure HTTP server
    server := &http.Server{
        Addr: ":8081",
        ReadTimeout: 30 * time.Second,
        WriteTimeout: 30 * time.Second,
    }

    // Initialize lifecycle manager
    lifecycleManager := lifecycle.NewServiceManager(server)
    lifecycleManager.SetShutdownTimeout(30 * time.Second)
    lifecycleManager.SetHealthCheckPeriod(10 * time.Second)

    // Setup health checkers
    setupHealthCheckers(lifecycleManager)

    // Setup routes with health endpoints
    router := setupRoutes(lifecycleManager)
    server.Handler = router

    // Start lifecycle management
    ctx := context.Background()
    lifecycleManager.Start(ctx)

    // Start server
    go server.ListenAndServe()

    // Lifecycle manager handles shutdown automatically
    select {}
}
```

### 3. Health Checker Setup

```go
func setupHealthCheckers(lifecycleManager *lifecycle.ServiceManager) {
    // Database health
    db, err := sql.Open("postgres", dbURL)
    if err == nil {
        lifecycleManager.AddHealthChecker("database", 
            lifecycle.NewDatabaseHealthChecker(db))
    }

    // Redis health
    redisClient := redis.NewClient(&redis.Options{...})
    lifecycleManager.AddHealthChecker("redis", 
        lifecycle.NewRedisHealthChecker(redisClient))

    // External service dependencies
    apiChecker := lifecycle.NewHTTPServiceHealthChecker("external-api", apiURL)
    apiChecker.SetTimeout(5 * time.Second).SetRetries(2)
    lifecycleManager.AddHealthChecker("external-api", apiChecker)

    // Critical dependency management
    criticalDeps := lifecycle.NewDependencyHealthChecker()
    criticalDeps.AddCritical("database", lifecycle.NewDatabaseHealthChecker(db))
    criticalDeps.AddOptional("cache", lifecycle.NewRedisHealthChecker(redisClient))
    lifecycleManager.AddHealthChecker("dependencies", criticalDeps)
}
```

### 4. Standard Routes Setup

```go
func setupRoutes(lifecycleManager *lifecycle.ServiceManager) *gin.Engine {
    router := gin.Default()

    // Kubernetes health endpoints
    router.GET("/health/live", lifecycleManager.CreateLivenessHandler())
    router.GET("/health/ready", lifecycleManager.CreateReadinessHandler())
    router.GET("/health/detailed", lifecycleManager.CreateHealthHandler())

    // Service-specific routes
    api := router.Group("/api/v1")
    {
        api.GET("/users", handleGetUsers)
        api.POST("/users", handleCreateUser)
        // ... other endpoints
    }

    return router
}
```

## Service States

| State | Description | HTTP Status | K8s Behavior |
|-------|-------------|-------------|--------------|
| **Starting** | Service is initializing | 503 | Not Ready |
| **Healthy** | All health checks passing | 200 | Ready |
| **Degraded** | Some health checks failing | 503 | Not Ready |
| **Shutting Down** | Graceful shutdown in progress | 503 | Not Ready |
| **Stopped** | Service has stopped | 503 | Dead |

## Health Check Types

### Critical vs Optional Dependencies

```go
// Critical dependencies - failure causes service to be unhealthy
criticalDeps.AddCritical("database", dbChecker)
criticalDeps.AddCritical("auth-service", authChecker)

// Optional dependencies - failure logged but service remains healthy
criticalDeps.AddOptional("cache", cacheChecker)
criticalDeps.AddOptional("metrics", metricsChecker)
```

### Health Check Configuration

```go
// HTTP service checker with retries
serviceChecker := lifecycle.NewHTTPServiceHealthChecker("user-service", "http://user-svc:8081/health")
serviceChecker.SetTimeout(5 * time.Second)
serviceChecker.SetRetries(3)

// Database checker
dbChecker := lifecycle.NewDatabaseHealthChecker(db)

// Redis checker with test operations
redisChecker := lifecycle.NewRedisHealthChecker(redisClient)
```

## Deployment Patterns

### 1. Per-Service Deployment

Each microservice:
```yaml
# kubernetes deployment
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        ports:
        - containerPort: 8081
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8081
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. API Gateway Configuration

```yaml
# API Gateway monitors all downstream services
spec:
  template:
    spec:
      containers:
      - name: api-gateway
        env:
        - name: USER_SERVICE_URL
          value: "http://user-service:8081"
        - name: LOCATION_SERVICE_URL
          value: "http://location-service:8082"
```

## Environment Variables

Standard environment variables for all services:

```bash
# Server Configuration
PORT=8081
SHUTDOWN_TIMEOUT=30s
HEALTH_CHECK_PERIOD=10s

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=linkuser
DB_PASSWORD=linkpass
DB_NAME=linkdb
DB_SSL_MODE=disable

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Service Dependencies
USER_SERVICE_URL=http://user-service:8081
LOCATION_SERVICE_URL=http://location-service:8082
```

## Monitoring and Observability

### Health Status Response Format

```json
{
  "state": "healthy",
  "uptime": "2h30m15s",
  "last_health_check": "2024-01-20T10:30:00Z",
  "overall_healthy": true,
  "health_checks": {
    "database": {
      "status": "healthy"
    },
    "redis": {
      "status": "healthy"
    },
    "external-api": {
      "status": "unhealthy",
      "error": "connection timeout"
    }
  }
}
```

### Lifecycle Events

Services emit structured logs for:
- State transitions
- Health check failures
- Shutdown initiation
- Resource cleanup completion

## Best Practices

### 1. Health Check Design
- **Keep checks lightweight** - avoid expensive operations
- **Use timeouts** - prevent hanging health checks
- **Implement retries** - handle transient failures
- **Separate concerns** - check individual components separately

### 2. Graceful Shutdown
- **Set appropriate timeouts** - allow time for cleanup
- **Drain connections** - complete in-flight requests
- **Close resources** - databases, caches, file handles
- **Signal completion** - notify service discovery

### 3. Service Discovery Integration
```go
lifecycleManager.OnStateChange(func(oldState, newState lifecycle.ServiceState) {
    if newState == lifecycle.StateHealthy {
        // Register with service discovery
        serviceRegistry.Register("user-service", serviceURL)
    } else if newState == lifecycle.StateShuttingDown {
        // Deregister from service discovery
        serviceRegistry.Deregister("user-service")
    }
})
```

### 4. Circuit Breaker Integration
```go
// Integrate with circuit breakers for dependency health
circuitBreaker := NewCircuitBreaker("external-api")
healthChecker := lifecycle.HealthCheckFunc(func(ctx context.Context) error {
    if circuitBreaker.State() == CircuitOpen {
        return fmt.Errorf("circuit breaker open for external-api")
    }
    return nil
})
lifecycleManager.AddHealthChecker("circuit-breaker", healthChecker)
```

## Troubleshooting

### Common Issues

1. **Service stuck in Starting state**
   - Check health checker implementations
   - Verify dependency availability
   - Review timeout configurations

2. **Frequent Healthy/Degraded transitions**
   - Adjust health check intervals
   - Implement health check hysteresis
   - Review dependency stability

3. **Shutdown timeouts**
   - Increase shutdown timeout
   - Optimize cleanup procedures
   - Profile resource disposal

### Debug Endpoints

Access detailed health information:
```bash
# Liveness check
curl http://service:8081/health/live

# Readiness check
curl http://service:8081/health/ready

# Detailed status
curl http://service:8081/health/detailed
```

## API Gateway vs Service Responsibilities

| Responsibility | API Gateway | Individual Service |
|----------------|-------------|-------------------|
| **Own Lifecycle** | ✅ Manages its state | ✅ Manages its state |
| **Health Endpoints** | ✅ Standard endpoints | ✅ Standard endpoints |
| **Monitor Downstream** | ✅ All services | ❌ N/A |
| **Load Balance** | ✅ Traffic distribution | ❌ N/A |
| **Service Discovery** | ✅ Register services | ✅ Self-register |
| **Circuit Breaking** | ✅ Cross-service | ✅ For dependencies |
| **Resource Cleanup** | ✅ Own resources | ✅ Own resources |

This distributed approach ensures that:
- Services are self-contained and independently deployable
- The API Gateway can make intelligent routing decisions
- Kubernetes health checks work consistently across all services
- Graceful shutdown works at both the service and system level
