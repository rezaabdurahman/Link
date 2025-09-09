# API Gateway Migration Guide

## Overview
This guide covers the migration from the legacy Gin-based API Gateway to the enhanced load-balancing API Gateway with circuit breakers and multi-instance support.

## Architecture Changes

### Legacy Architecture (legacy_main.go)
- **Framework**: Gin HTTP framework
- **Features**: JWT authentication, CORS, rate limiting, Sentry error tracking, OpenTelemetry tracing
- **Load Balancing**: None - single service endpoints
- **Resilience**: Basic timeouts only
- **Configuration**: Static service URLs

### Integrated Architecture (cmd/gateway/integrated_main.go) ⭐ RECOMMENDED
- **Framework**: Gin HTTP framework (preserves existing features)
- **Features**: ALL legacy features + Multi-instance load balancing, circuit breakers, retry logic, health monitoring
- **Load Balancing**: Round-robin, random, least connections
- **Resilience**: Circuit breakers, exponential backoff retry, health checking
- **Configuration**: Dynamic multi-instance configuration
- **Migration**: Zero breaking changes - adds load balancing to existing setup

### Pure Enhanced Architecture (cmd/gateway/main.go)
- **Framework**: Standard Go HTTP with Gorilla Mux
- **Features**: Multi-instance load balancing, circuit breakers, retry logic, health monitoring
- **Load Balancing**: Round-robin, random, least connections
- **Resilience**: Circuit breakers, exponential backoff retry, health checking
- **Configuration**: Dynamic multi-instance configuration
- **Note**: Requires re-implementing authentication and middleware features

## Files Changed/Added

### Removed/Replaced
- `main.go` → `legacy_main.go` (preserved for reference)

### Added
- `cmd/gateway/main.go` - New enhanced main entry point
- `internal/loadbalancer/` - Load balancing and health checking logic
- `internal/retry/` - Retry mechanism with exponential backoff
- `internal/config/services.go` - Unified service configuration with load balancing and legacy compatibility
- `internal/handlers/enhanced_proxy.go` - Load-balancing proxy handler

### Preserved (Legacy Components)
The following legacy components are still available but not used in the enhanced version:
- `internal/handlers/proxy.go` - Legacy single-endpoint proxy (now uses services.go)
- `internal/middleware/` - Auth, CORS, rate limiting middleware
- `internal/logger/` - Structured logging
- `internal/metrics/` - Prometheus metrics (Gin-based)
- `internal/sentry/` - Sentry error reporting
- `internal/tracing/` - OpenTelemetry tracing

## Configuration Migration

### Legacy Configuration
```bash
# Static service URLs
USER_SERVICE_URL=http://user-svc:8080
CHAT_SERVICE_URL=http://chat-svc:8080
```

### Enhanced Configuration
```bash
# Multi-instance configuration
USER_SVC_INSTANCES=user-1:http://user-svc-1:8080:http://user-svc-1:8080/health:100:30s,user-2:http://user-svc-2:8080:http://user-svc-2:8080/health:100:30s
USER_SVC_LOAD_BALANCE_STRATEGY=round_robin
USER_SVC_CIRCUIT_BREAKER=5:3:60s
USER_SVC_RETRY=3:100ms:5s:2.0
USER_SVC_HEALTH_CHECK=30s:10s:5s
```

## Feature Comparison

| Feature | Legacy | Enhanced |
|---------|--------|----------|
| Load Balancing | ❌ | ✅ Round-robin, Random, Least Connections |
| Circuit Breakers | ❌ | ✅ Per-instance with auto-recovery |
| Retry Logic | ❌ | ✅ Exponential backoff with jitter |
| Health Monitoring | ❌ | ✅ Background health checks |
| Multi-Instance | ❌ | ✅ Dynamic instance management |
| JWT Authentication | ✅ | ❌ (Can be added back) |
| Rate Limiting | ✅ | ❌ (Can be added back) |
| CORS | ✅ | ❌ (Can be added back) |
| Sentry Error Tracking | ✅ | ❌ (Can be added back) |
| OpenTelemetry Tracing | ✅ | ❌ (Can be added back) |
| Prometheus Metrics | ✅ | ✅ Enhanced load balancer metrics |

## Deployment Options

### Option 1: Enhanced API Gateway (Recommended)
```bash
# Use multi-instance Docker Compose
docker-compose -f docker-compose.multi-instance.yml up -d

# Or build and run enhanced version
docker build -t api-gateway-enhanced .
```

### Option 2: Legacy API Gateway (Fallback)
```bash
# Rename files back
mv legacy_main.go main.go

# Update Dockerfile
# Change: RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/gateway/main.go
# To:     RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Build and run
docker build -t api-gateway-legacy .
docker-compose up -d
```

## Testing the Migration

### 1. Test Enhanced Version
```bash
# Start enhanced stack
docker-compose -f docker-compose.multi-instance.yml up -d

# Run load balancing tests
./scripts/test_load_balancing.sh

# Check health endpoint
curl http://localhost:8080/health

# Check metrics
curl http://localhost:8080/metrics | grep proxy_
```

### 2. Test Legacy Version (if needed)
```bash
# Switch back to legacy
mv main.go enhanced_main.go
mv legacy_main.go main.go

# Update Dockerfile build command
# Restart with legacy compose
docker-compose up -d --build

# Test legacy endpoints
curl http://localhost:8080/health
curl http://localhost:8080/users/health
```

## Rollback Process

If you need to rollback to the legacy version:

1. **Stop enhanced services**:
   ```bash
   docker-compose -f docker-compose.multi-instance.yml down
   ```

2. **Switch to legacy main**:
   ```bash
   mv cmd/gateway/main.go cmd/gateway/enhanced_main.go
   mv legacy_main.go main.go
   ```

3. **Update Dockerfile**:
   ```dockerfile
   RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .
   ```

4. **Restart with legacy compose**:
   ```bash
   docker-compose up -d --build
   ```

## Future Integration

To integrate legacy features into the enhanced version:

### 1. JWT Authentication
Add JWT middleware to enhanced proxy handler:
```go
// In enhanced_proxy.go
func (h *EnhancedProxyHandler) authenticateRequest(r *http.Request) error {
    // Implement JWT validation logic
}
```

### 2. Rate Limiting
Add Redis-based rate limiting:
```go
// Add rate limiting before load balancer selection
func (h *EnhancedProxyHandler) checkRateLimit(clientID string) error {
    // Implement Redis rate limiting
}
```

### 3. Tracing Integration
Add OpenTelemetry spans:
```go
// In ServeHTTP method
ctx, span := tracer.Start(r.Context(), "proxy_request")
defer span.End()
```

## Monitoring and Observability

### Enhanced Metrics
The enhanced version provides additional metrics:
- `proxy_instances_available` - Available instances per service
- `proxy_circuit_breaker_state` - Circuit breaker state per instance
- `proxy_retry_attempts_total` - Retry attempts by service
- `proxy_load_balancer_errors_total` - Load balancer errors

### Legacy Metrics
Legacy version provides:
- JWT authentication metrics
- Rate limiting metrics  
- Gin framework metrics
- Custom business metrics

## Recommendations

1. **Start with Enhanced**: Use the enhanced version for new deployments
2. **Gradual Migration**: Test enhanced version alongside legacy in staging
3. **Feature Integration**: Gradually add legacy features to enhanced version as needed
4. **Monitoring**: Set up comprehensive monitoring for both versions during transition
5. **Documentation**: Keep both configurations documented until migration is complete

## Support

- Enhanced version: See [README.md](README.md) for detailed documentation
- Legacy version: Refer to git history and legacy_main.go comments
- Issues: Check load balancer logs and circuit breaker states
- Rollback: Follow the rollback process above if needed
