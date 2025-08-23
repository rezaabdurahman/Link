# gRPC Monitoring and Observability

This document describes the monitoring and observability setup for gRPC services in the Link backend.

## Overview

All gRPC services include comprehensive monitoring through:
- Prometheus metrics collection
- Structured logging
- Request tracing
- Health checks

## Metrics

### Server Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `grpc_server_requests_total` | Counter | Total number of gRPC requests received | service, method, status_code |
| `grpc_server_request_duration_seconds` | Histogram | Duration of gRPC requests in seconds | service, method, status_code |
| `grpc_server_stream_messages_received_total` | Counter | Total messages received on server streams | service, method |
| `grpc_server_stream_messages_sent_total` | Counter | Total messages sent on server streams | service, method |
| `grpc_connections_active` | Gauge | Number of active gRPC connections | service, direction |

### Client Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `grpc_client_requests_total` | Counter | Total number of gRPC client requests sent | service, method, status_code |
| `grpc_client_request_duration_seconds` | Histogram | Duration of gRPC client requests in seconds | service, method, status_code |

## Interceptors

### Server Interceptors

The following interceptors are automatically applied to all gRPC servers:

1. **Logging Interceptor**: Logs all incoming requests with timing and status
2. **Metrics Interceptor**: Records Prometheus metrics for monitoring
3. **Auth Interceptor**: Handles authentication and authorization
4. **Error Interceptor**: Standardizes error handling and responses
5. **Recovery Interceptor**: Recovers from panics and converts to gRPC errors

### Client Interceptors

The following interceptors are automatically applied to all gRPC clients:

1. **Logging Interceptor**: Logs all outgoing requests with timing and status
2. **Metrics Interceptor**: Records Prometheus metrics for monitoring
3. **Auth Interceptor**: Handles authentication token injection
4. **Retry Interceptor**: Provides automatic retry with backoff (optional)

## Configuration

### Server Configuration

```go
import "github.com/link-app/backend/shared-libs/grpc/interceptors"

grpcServer := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        interceptors.UnaryLoggingInterceptor(),
        interceptors.UnaryMetricsInterceptor(),
        interceptors.UnaryAuthInterceptor(),
        interceptors.UnaryErrorInterceptor(),
        interceptors.UnaryRecoveryInterceptor(),
    ),
    grpc.ChainStreamInterceptor(
        interceptors.StreamLoggingInterceptor(),
        interceptors.StreamMetricsInterceptor(),
        interceptors.StreamAuthInterceptor(),
        interceptors.StreamErrorInterceptor(),
        interceptors.StreamRecoveryInterceptor(),
    ),
)
```

### Client Configuration

```go
import "github.com/link-app/backend/shared-libs/grpc"

config := grpc.DefaultClientConfig("user-service")
config.DirectEndpoint = "user-svc:50051"
client, err := grpc.NewClient(config)
```

Interceptors are automatically applied to clients created through the shared gRPC library.

## Metrics Endpoints

Each gRPC service exposes metrics on a separate HTTP port:

| Service | gRPC Port | Metrics Port |
|---------|-----------|--------------|
| user-svc | 50051 | 9090 |
| discovery-svc | 50052 | 9091 |
| chat-svc | 50053 | 9092 |
| ai-svc | 50054 | 9093 |
| search-svc | 50055 | 9094 |

Access metrics at: `http://localhost:9090/metrics` (or respective port)

## Grafana Dashboard

Key metrics to monitor:

### Request Rate
- `rate(grpc_server_requests_total[5m])` - Requests per second
- `rate(grpc_client_requests_total[5m])` - Client requests per second

### Request Duration
- `histogram_quantile(0.95, rate(grpc_server_request_duration_seconds_bucket[5m]))` - 95th percentile response time
- `histogram_quantile(0.99, rate(grpc_server_request_duration_seconds_bucket[5m]))` - 99th percentile response time

### Error Rate
- `rate(grpc_server_requests_total{status_code!="OK"}[5m])` - Error requests per second
- `rate(grpc_server_requests_total{status_code!="OK"}[5m]) / rate(grpc_server_requests_total[5m])` - Error percentage

### Active Connections
- `grpc_connections_active` - Current active connections

## Health Checks

All gRPC services implement the standard gRPC Health Checking Protocol:

```bash
# Check service health using grpcurl
grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check
```

## Alerting Rules

Recommended Prometheus alerting rules:

```yaml
groups:
- name: grpc
  rules:
  - alert: GRPCHighErrorRate
    expr: rate(grpc_server_requests_total{status_code!="OK"}[5m]) / rate(grpc_server_requests_total[5m]) > 0.05
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High gRPC error rate for {{ $labels.service }}"
  
  - alert: GRPCHighLatency
    expr: histogram_quantile(0.95, rate(grpc_server_request_duration_seconds_bucket[5m])) > 1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High gRPC latency for {{ $labels.service }}"
  
  - alert: GRPCServiceDown
    expr: up{job=~".*grpc.*"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "gRPC service {{ $labels.instance }} is down"
```

## Service Discovery Integration

When using service discovery (Consul), health checks are automatically registered:

- **gRPC Health Check**: Uses the standard gRPC health protocol
- **HTTP Health Check**: Metrics endpoint serves as basic health indicator
- **TTL Check**: Service reports health status periodically

## Troubleshooting

### Common Issues

1. **Metrics not appearing**: Ensure metrics port is accessible and not blocked by firewall
2. **High error rates**: Check gRPC status codes in metrics to identify specific error types
3. **Connection issues**: Monitor `grpc_connections_active` metric
4. **Performance issues**: Use request duration histograms to identify slow methods

### Debug Mode

Enable debug logging by setting environment variables:
```bash
export LOG_LEVEL=debug
export GRPC_GO_LOG_VERBOSITY_LEVEL=2
export GRPC_GO_LOG_SEVERITY_LEVEL=info
```

## Integration with Existing Systems

### Prometheus Configuration

Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'grpc-services'
    static_configs:
      - targets: 
          - 'user-svc:9090'
          - 'discovery-svc:9091'
          - 'chat-svc:9092'
          - 'ai-svc:9093'
          - 'search-svc:9094'
```

### Linkerd Integration

gRPC services work seamlessly with Linkerd service mesh for additional observability:
- Automatic mTLS between services
- Traffic splitting and load balancing
- Additional metrics via Linkerd proxy

The built-in interceptors complement Linkerd's observability features without conflicts.