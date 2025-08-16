# Montage Batch Job

The Montage batch job is responsible for generating and updating user montages based on their check-in history. It runs daily to create both general montages (last N check-ins) and interest-based montages (check-ins filtered by specific tags/interests).

## Architecture Overview

The batch job is designed as a **lightweight Go binary** that:
- Reuses the modular montage domain from `user-svc/internal/montage/`
- Processes users in configurable batches with controlled concurrency
- Supports multiple execution modes (one-time, scheduler daemon, health check)
- Publishes domain events for monitoring and analytics
- Is containerized and ready for both Docker Compose and Kubernetes deployment

## Features

### ✅ **Batch Processing**
- **Incremental Processing**: Only processes users with new/updated check-ins
- **Configurable Batch Size**: Process 100-500 users at a time
- **Controlled Concurrency**: Limits parallel montage generation
- **Fault Tolerance**: Continues processing if individual users fail
- **Graceful Shutdown**: Handles termination signals properly

### ✅ **Montage Generation**
- **General Montages**: Last N check-ins across all interests
- **Interest Montages**: Check-ins filtered by specific tags (coffee, hiking, etc.)
- **Smart Filtering**: Only generates interest montages with sufficient data (≥3 occurrences)
- **Configurable Limits**: Max items per montage, lookback periods

### ✅ **Execution Modes**
- **`once`** - Run once and exit (default for cron jobs)
- **`scheduler`** - Run as daemon with built-in scheduling (development)
- **`health`** - Health check mode for monitoring

### ✅ **Monitoring & Observability**
- **Structured Logging**: JSON logs with correlation IDs
- **Domain Events**: Published for batch lifecycle, analytics
- **Health Checks**: Database connectivity, configuration validation
- **Metrics**: Processing statistics, error rates, timing

## Configuration

The batch job is configured via environment variables:

### Database Configuration
```bash
DB_HOST=postgres                    # Database host
DB_PORT=5432                       # Database port
DB_USER=link_user                  # Database username
DB_PASSWORD=link_pass              # Database password
DB_NAME=link_app                   # Database name
DB_SSLMODE=disable                 # SSL mode (disable|require)
```

### Montage Configuration
```bash
MONTAGE_MAX_ITEMS=20               # Max items per montage
MONTAGE_MIN_INTEREST_OCCURRENCE=3  # Min occurrences for interest montage
MONTAGE_INTEREST_LOOKBACK_DAYS=30  # Days to look back for interests
MONTAGE_BATCH_SIZE=100             # Users processed per batch
MAX_CONCURRENT_GENERATIONS=10      # Max concurrent montage generations
```

### External Services
```bash
CHECKIN_SERVICE_URL=http://checkin-svc:8080    # Check-in service endpoint
USER_SERVICE_URL=http://user-svc:8080          # User service endpoint
CHECKIN_SERVICE_API_KEY=secret-key             # API key for check-in service
USER_SERVICE_API_KEY=secret-key                # API key for user service
```

### Feature Flags
```bash
ENABLE_BATCH_PROCESSING=true       # Enable batch processing
ENABLE_REALTIME_GENERATION=false   # Enable real-time generation
ENABLE_ANALYTICS=true              # Enable analytics events
```

### Runtime Configuration
```bash
BATCH_MODE=once                    # Execution mode (once|scheduler|health)
ENVIRONMENT=production             # Environment (development|production)
LOG_LEVEL=info                     # Log level (debug|info|warn|error)
BATCH_PROCESSING_TIMEOUT=30m       # Timeout for entire batch job
CACHE_TTL=1h                       # Cache TTL for generated montages
```

## Usage

### Local Development

1. **Run once (manual execution)**:
```bash
cd backend/cmd/montage-batch
go run . once
```

2. **Run as scheduler daemon**:
```bash
go run . scheduler
```

3. **Health check**:
```bash
go run . health
```

### Docker Development

1. **Build the image**:
```bash
cd backend
docker build -f cmd/montage-batch/Dockerfile -t montage-batch .
```

2. **Run once**:
```bash
docker run --rm -e BATCH_MODE=once montage-batch
```

3. **Run with custom config**:
```bash
docker run --rm \
  -e DB_HOST=postgres \
  -e MONTAGE_BATCH_SIZE=50 \
  -e LOG_LEVEL=debug \
  montage-batch
```

### Docker Compose

The batch job is integrated into the Docker Compose setup with profiles for different deployment scenarios.

1. **Run all services including batch** (uses profile):
```bash
docker-compose --profile full up -d
```

2. **Run only batch services** (for testing):
```bash
docker-compose --profile batch up -d postgres user-svc montage-batch
```

3. **Manual batch execution**:
```bash
docker-compose run --rm montage-batch /app/montage-batch once
```

4. **Check batch logs**:
```bash
docker-compose logs montage-batch
```

### Kubernetes Production

1. **Deploy CronJob**:
```bash
kubectl apply -f cmd/montage-batch/k8s-cronjob.yaml
```

2. **Check CronJob status**:
```bash
kubectl get cronjobs -n link-app
kubectl get jobs -n link-app
```

3. **View job logs**:
```bash
kubectl logs -n link-app -l app=montage-batch --tail=100
```

4. **Manual job execution**:
```bash
kubectl create job -n link-app --from=cronjob/montage-batch-daily montage-manual-$(date +%s)
```

## Monitoring

### Health Checks

The batch job provides health check endpoints for monitoring:

```bash
# Container health check
/app/montage-batch health

# Expected output on success:
Health check passed
```

### Logging

The batch job produces structured logs for monitoring:

```json
{
  "timestamp": "2024-01-15T03:00:00Z",
  "level": "info",
  "message": "Batch job completed",
  "job_id": "batch_1705287600",
  "duration": "5m30s",
  "processed": 1250,
  "successful": 1245,
  "errors": 5,
  "general_montages": 1245,
  "interest_montages": 3420
}
```

### Domain Events

The batch job publishes events for external monitoring:

- **`montage.batch_job.started`** - Job started
- **`montage.batch_job.completed`** - Job completed successfully  
- **`montage.batch_job.failed`** - Job failed
- **`montage.generated`** - Individual montage generated
- **`montage.cache.invalidated`** - Cache invalidated

## Performance

### Recommended Settings

| Environment | Batch Size | Concurrency | Timeout |
|-------------|------------|-------------|---------|
| Development | 100 | 10 | 30m |
| Staging | 250 | 25 | 45m |
| Production | 500 | 50 | 60m |

### Scaling Considerations

- **Memory**: ~50MB base + ~2MB per concurrent montage generation
- **CPU**: CPU-bound during montage generation, I/O-bound during DB operations
- **Database**: Uses read-heavy queries, benefits from read replicas
- **Network**: Makes HTTP calls to check-in service, ensure sufficient bandwidth

### Performance Tuning

1. **Increase batch size** for fewer DB round trips
2. **Increase concurrency** for faster processing (watch memory usage)
3. **Use database connection pooling** for better resource utilization
4. **Enable read replicas** for check-in data queries
5. **Add caching** for frequently accessed user data

## Troubleshooting

### Common Issues

1. **Database Connection Timeouts**:
```bash
# Increase connection timeout
DB_CONNECT_TIMEOUT=30s
DB_MAX_IDLE_CONNS=10
DB_MAX_OPEN_CONNS=20
```

2. **Memory Issues**:
```bash
# Reduce concurrency and batch size
MAX_CONCURRENT_GENERATIONS=5
MONTAGE_BATCH_SIZE=50
```

3. **External Service Timeouts**:
```bash
# Increase service timeouts
CHECKIN_SERVICE_TIMEOUT=60s
USER_SERVICE_TIMEOUT=60s
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
LOG_LEVEL=debug DEBUG=true ./montage-batch once
```

### Manual Testing

Test individual components:

```bash
# Test configuration
./montage-batch health

# Test with small batch size
MONTAGE_BATCH_SIZE=5 ./montage-batch once

# Test with specific user
USER_ID_FILTER=user123 ./montage-batch once
```

## Development

### Adding New Features

The batch job is designed to be modular and extensible:

1. **New Montage Types**: Add to `montage/models.go`
2. **New Processors**: Extend `processor.go`  
3. **New Schedulers**: Add to `scheduler.go`
4. **New Events**: Add to `montage/events.go`

### Testing

```bash
# Unit tests
go test ./cmd/montage-batch/...

# Integration tests with database
DATABASE_URL=postgres://... go test -tags=integration ./cmd/montage-batch/...

# Load testing
MONTAGE_BATCH_SIZE=1000 go test -bench=. ./cmd/montage-batch/...
```

### Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive logging for observability
3. Include proper error handling and graceful degradation  
4. Write unit tests for new functionality
5. Update documentation for configuration changes

## Migration Guide

When extracting to a separate microservice:

1. **Copy the entire `cmd/montage-batch` directory**
2. **Update import paths** to point to the new service
3. **Add service discovery** for external dependencies
4. **Update deployment configs** (Docker Compose, Kubernetes)
5. **Migrate environment configuration**
6. **Update monitoring and alerting rules**

The modular architecture ensures minimal changes are required for extraction.
