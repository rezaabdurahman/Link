# Enhanced API Gateway with Load Balancing

This enhanced API Gateway provides advanced load balancing, circuit breaker patterns, retry logic, and comprehensive observability for multi-instance service deployments.

## 🚀 Features

### Load Balancing
- **Multiple Strategies**: Round-robin, random, and least connections
- **Dynamic Instance Management**: Automatic detection and health tracking
- **Weighted Routing**: Support for weighted instance distribution
- **Connection Tracking**: Real-time monitoring of active connections per instance

### Circuit Breaker
- **Three States**: Closed, Open, and Half-Open
- **Configurable Thresholds**: Failure and success count thresholds
- **Automatic Recovery**: Time-based recovery with progressive testing
- **Per-Instance State**: Individual circuit breaker state per service instance

### Retry Logic
- **Exponential Backoff**: Configurable backoff multiplier and jitter
- **Max Attempts**: Configurable maximum retry attempts
- **Smart Retrying**: Only retry on retriable errors (5xx responses)
- **Context-Aware**: Respects request timeouts and cancellation

### Health Checking
- **Continuous Monitoring**: Background health checks for all service instances
- **Configurable Intervals**: Customizable health check frequency and timeouts
- **Automatic Failover**: Unhealthy instances are automatically removed from load balancing
- **Recovery Detection**: Automatic re-inclusion of recovered instances

### Observability
- **Prometheus Metrics**: Comprehensive metrics for requests, errors, latencies, and circuit breaker states
- **Request Tracing**: Headers for tracking requests across service instances
- **Health Endpoints**: Real-time health status of all services and instances
- **Grafana Dashboards**: Pre-configured dashboards for monitoring

## 📁 Architecture

```
api-gateway/
├── cmd/gateway/              # Main application entry point
│   └── main.go
├── internal/
│   ├── config/              # Configuration management
│   │   ├── enhanced_services.go
│   │   ├── services.go      # Legacy configuration
│   │   └── utils.go
│   ├── handlers/            # HTTP handlers
│   │   ├── enhanced_proxy.go # Enhanced proxy with load balancing
│   │   └── proxy.go         # Legacy proxy handler
│   ├── loadbalancer/        # Load balancing logic
│   │   ├── load_balancer.go
│   │   └── health_checker.go
│   └── retry/               # Retry logic
│       └── retry.go
├── scripts/                 # Testing and utility scripts
│   └── test_load_balancing.sh
├── .env.example            # Environment configuration example
├── Dockerfile
└── README.md
```

## ⚙️ Configuration

### Environment Variables

The gateway supports configuration through environment variables following this pattern:

#### Service Instances
```bash
# Format: SERVICE_NAME_INSTANCES=id1:url1:health_url1:weight:timeout,id2:url2:health_url2:weight:timeout
USER_SVC_INSTANCES=user-1:http://user-svc-1:8080:http://user-svc-1:8080/health:100:30s,user-2:http://user-svc-2:8080:http://user-svc-2:8080/health:100:30s
```

#### Load Balancing Strategy
```bash
# Options: round_robin, random, least_connections
USER_SVC_LOAD_BALANCE_STRATEGY=round_robin
```

#### Circuit Breaker Configuration
```bash
# Format: failure_threshold:success_threshold:timeout
USER_SVC_CIRCUIT_BREAKER=5:3:60s
```

#### Retry Configuration
```bash
# Format: max_attempts:initial_delay:max_delay:backoff_multiplier
USER_SVC_RETRY=3:100ms:5s:2.0
```

#### Health Check Configuration
```bash
# Format: interval:timeout:initial_delay
USER_SVC_HEALTH_CHECK=30s:10s:5s
```

### Configuration Example

See [.env.example](.env.example) for a complete configuration example.

## 🐳 Docker Deployment

### Single Instance (Legacy)
```bash
docker-compose up -d
```

### Multi-Instance with Load Balancing
```bash
docker-compose -f docker-compose.multi-instance.yml up -d
```

This will start:
- 3 User service instances
- 2 Chat service instances  
- 2 AI service instances
- 2 Location service instances
- 1 Discovery service instance
- Enhanced API Gateway with load balancing
- PostgreSQL with PgBouncer connection pooling
- Redis for caching
- Prometheus for metrics collection
- Grafana for dashboards

## 🧪 Testing

### Automated Load Balancing Tests
```bash
./scripts/test_load_balancing.sh
```

This script tests:
- Service health endpoints
- Load balancing distribution across instances
- Circuit breaker behavior
- Metrics collection

### Manual Testing

#### Health Check
```bash
curl http://localhost:8080/health
```

#### Service Requests
```bash
# User service (will be load balanced across 3 instances)
curl http://localhost:8080/user-svc/health

# Check response headers for instance information
curl -I http://localhost:8080/user-svc/health
```

#### Metrics
```bash
curl http://localhost:8080/metrics
```

## 📊 Monitoring

### Prometheus Metrics

The gateway exposes comprehensive metrics:

- **proxy_requests_total**: Total number of proxy requests by service, method, status, and instance
- **proxy_request_duration_seconds**: Request duration histogram by service, method, and status
- **proxy_instances_available**: Number of available instances per service
- **proxy_circuit_breaker_state**: Circuit breaker state per service instance
- **proxy_retry_attempts_total**: Total number of retry attempts by service
- **proxy_load_balancer_errors_total**: Load balancer errors by service and error type

### Grafana Dashboards

Access Grafana at http://localhost:3001 (admin/admin) for:
- Request rate and latency dashboards
- Circuit breaker state visualization
- Instance health monitoring
- Load balancing distribution charts

### Prometheus Queries

```promql
# Request rate per service
sum(rate(proxy_requests_total[5m])) by (service)

# Average response time by service
avg(proxy_request_duration_seconds) by (service)

# Circuit breaker open instances
sum(proxy_circuit_breaker_state == 1) by (service)

# Instance availability
proxy_instances_available
```

## 🔧 Development

### Building

```bash
# Build the gateway
go build -o gateway cmd/gateway/main.go

# Build Docker image
docker build -t api-gateway-enhanced .
```

### Running Locally

```bash
# Set environment variables
export USER_SVC_INSTANCES="user-1:http://localhost:8081:http://localhost:8081/health:100:30s"
export USER_SVC_LOAD_BALANCE_STRATEGY="round_robin"
export USER_SVC_CIRCUIT_BREAKER="5:3:60s"
export USER_SVC_RETRY="3:100ms:5s:2.0"
export USER_SVC_HEALTH_CHECK="30s:10s:5s"

# Run the gateway
go run cmd/gateway/main.go
```

### Adding New Services

1. Add service configuration to environment variables:
   ```bash
   NEWSERVICE_SVC_INSTANCES=instance1:url1:health1:weight:timeout
   NEWSERVICE_SVC_LOAD_BALANCE_STRATEGY=round_robin
   NEWSERVICE_SVC_CIRCUIT_BREAKER=5:3:60s
   NEWSERVICE_SVC_RETRY=3:100ms:5s:2.0
   NEWSERVICE_SVC_HEALTH_CHECK=30s:10s:5s
   ```

2. Update Docker Compose file with new service instances

3. Update Prometheus configuration to scrape new service metrics

## 📈 Load Balancing Algorithms

### Round Robin
Distributes requests evenly across all healthy instances in sequence.

**Best for**: Services with similar processing capabilities and uniform request load.

### Random
Randomly selects a healthy instance for each request.

**Best for**: Large numbers of instances where statistical distribution is sufficient.

### Least Connections
Routes requests to the instance with the fewest active connections.

**Best for**: Services with varying request processing times or connection-heavy workloads.

## 🔄 Circuit Breaker States

### Closed (Normal Operation)
- All requests are forwarded to the service instance
- Failure count is tracked
- When failure threshold is reached, transitions to Open

### Open (Service Unavailable)
- All requests immediately return error without calling the service
- After timeout period, transitions to Half-Open

### Half-Open (Testing Recovery)
- Limited number of requests are forwarded to test service recovery
- On success threshold, transitions to Closed
- On any failure, transitions back to Open

## 🚨 Error Handling

### Retry Policy
- Only retries on 5xx HTTP status codes
- Uses exponential backoff with jitter
- Respects request context cancellation
- Configurable maximum attempts and delays

### Failover Behavior
- Unhealthy instances are removed from load balancing
- Circuit breakers prevent cascading failures
- Health checks enable automatic recovery
- Graceful degradation when no instances available

## 🔒 Security Considerations

### Headers
- Preserves client headers while filtering hop-by-hop headers
- Adds proxy identification headers for tracing
- Supports X-Forwarded-* headers for client IP preservation

### Timeouts
- Configurable per-service request timeouts
- Global gateway timeout limits
- Context cancellation support for early termination

## 🔧 Troubleshooting

### Common Issues

#### No Available Instances
```
Error: No healthy instances available
```
**Solution**: Check service health endpoints and network connectivity.

#### Circuit Breaker Open
```
Error: Service temporarily unavailable
```
**Solution**: Wait for circuit breaker timeout or fix underlying service issues.

#### Load Balancing Not Working
**Symptoms**: All requests go to same instance
**Solution**: Verify instance configuration and health check endpoints.

### Debugging

#### Enable Debug Logging
```bash
export LOG_LEVEL=debug
```

#### Check Service Health
```bash
curl http://localhost:8080/health | jq '.'
```

#### Monitor Metrics
```bash
curl http://localhost:8080/metrics | grep proxy_
```

#### View Service Logs
```bash
docker-compose -f docker-compose.multi-instance.yml logs -f api-gateway
```

## 🚀 Production Deployment

### Kubernetes
For production deployment in Kubernetes, consider:
- Using Kubernetes service discovery instead of static configuration
- Implementing proper resource limits and requests
- Setting up horizontal pod autoscaling
- Configuring ingress controllers

### Monitoring
- Set up alerting for circuit breaker state changes
- Monitor request latency percentiles
- Alert on service instance availability drops
- Track load balancing distribution metrics

### Performance Tuning
- Adjust connection pool settings
- Tune circuit breaker thresholds based on SLA requirements
- Configure appropriate retry policies for different service types
- Optimize health check intervals and timeouts

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
