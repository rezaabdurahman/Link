# Indexing Pipeline

This document describes the automated indexing pipeline that keeps user profile embeddings up-to-date in the search service.

## Overview

The indexing pipeline is a cron-based background service that:

1. **Discovers available users** from the `discovery-svc`
2. **Fetches user profiles** from the `user-svc`
3. **Generates embeddings** from profile text (bio, interests, profession, skills, location)
4. **Stores/updates embeddings** in the database with TTL support
5. **Handles failures** with exponential backoff and retry logic

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  discovery-svc  │────│  search-svc      │────│    user-svc     │
│                 │    │  (indexing       │    │                 │
│ /available-users│    │   pipeline)      │    │ /api/v1/users/  │
└─────────────────┘    └──────────────────┘    │ profile/{id}    │
                              │                 └─────────────────┘
                              │
                       ┌──────▼──────┐
                       │ PostgreSQL  │
                       │ + pgvector  │
                       │             │
                       │user_embeddings│
                       └─────────────┘
```

## Key Features

### 🔄 **Automated Cron Job**
- Configurable interval (default: 2 hours)
- Runs continuously in background
- Structured JSON logging for monitoring

### 🏊‍♂️ **Worker Pool Concurrency**
- Configurable worker pool size (default: 10 workers)
- Go channel-based task queue
- Rate limiting to respect API limits

### ⏱️ **TTL (Time-To-Live) Support**
- Automatic cleanup of stale user data
- Configurable TTL (default: 2 hours)
- Natural expiration prevents data staleness

### 🔄 **Smart Update Logic**
- Hash-based change detection
- Only updates when profile content changes
- Skips unnecessary embedding generation

### 🚀 **Exponential Backoff & Retries**
- Automatic retry for transient failures
- Exponential backoff with jitter
- Different retry strategies for different error types

### 📊 **Comprehensive Monitoring**
- Real-time statistics via HTTP API
- Structured JSON logging
- Performance metrics and error tracking

## Configuration

### Environment Variables

```bash
# Service URLs
DISCOVERY_SVC_URL=http://discovery-svc:8081
USER_SVC_URL=http://user-svc:8082

# Cron Configuration
INDEXING_CRON_INTERVAL_MINUTES=120        # Run every 2 hours

# Concurrency & Performance
INDEXING_WORKER_POOL_SIZE=10              # 10 concurrent workers
INDEXING_RATE_LIMIT_PER_SECOND=50         # Max 50 requests/second
INDEXING_BATCH_SIZE=100                   # Process 100 users per batch

# Data Management
INDEXING_EMBEDDING_TTL_HOURS=2            # TTL for embeddings

# Authentication
SERVICE_AUTH_TOKEN=your-service-token     # Inter-service auth
```

### IndexingConfig Structure

```go
type IndexingConfig struct {
    CronIntervalMinutes int                // Cron schedule in minutes
    WorkerPoolSize      int                // Number of concurrent workers
    RateLimitPerSecond  int                // API rate limiting
    BatchSize          int                 // Batch processing size
    EmbeddingTTLHours  int                 // TTL for embeddings
    RetryConfig        *utils.RetryConfig  // Retry configuration
}
```

## API Endpoints

### Get Indexing Statistics
```http
GET /api/v1/indexing/stats
Authorization: Bearer <service-token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "last_run_time": "2024-01-15T10:30:00Z",
    "last_run_duration_ms": 45000,
    "total_users_indexed": 1250,
    "errors_count": 5,
    "is_running": false,
    "next_run_time": "2024-01-15T12:30:00Z"
  }
}
```

### Trigger Manual Indexing
```http
POST /api/v1/indexing/trigger
Authorization: Bearer <service-token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Indexing cycle triggered"
}
```

## Data Flow

### 1. User Discovery
```http
GET /available-users
Host: discovery-svc:8081
Authorization: Bearer <service-token>
```

**Response:**
```json
{
  "user_ids": ["550e8400-e29b-41d4-a716-446655440000", ...],
  "count": 1000
}
```

### 2. Profile Fetching
```http
GET /api/v1/users/profile/{user_id}
Host: user-svc:8082
Authorization: Bearer <service-token>
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "bio": "Software engineer passionate about AI and machine learning...",
  "interests": ["AI", "Machine Learning", "Golang"],
  "profession": "Software Engineer",
  "skills": ["Python", "Go", "Docker"],
  "location": "San Francisco, CA",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### 3. Text Processing & Embedding
```go
profileText := bio + " " + profession + " " + 
               "Interests: " + strings.Join(interests, ", ") + " " +
               "Skills: " + strings.Join(skills, ", ") + " " +
               "Location: " + location
```

### 4. Database Storage
```sql
INSERT INTO user_embeddings (
    user_id, 
    embedding, 
    profile_text, 
    embedding_hash,
    expires_at,
    provider,
    model
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id) DO UPDATE SET
    embedding = EXCLUDED.embedding,
    profile_text = EXCLUDED.profile_text,
    embedding_hash = EXCLUDED.embedding_hash,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();
```

## Error Handling

### Retry Strategy
```go
retryConfig := &utils.RetryConfig{
    MaxRetries:    3,
    BaseDelay:     100 * time.Millisecond,
    MaxDelay:      5 * time.Second,
    BackoffFactor: 2.0,
    EnableJitter:  true,
}
```

### Retryable Errors
- Network timeouts
- HTTP 5xx errors
- HTTP 429 (rate limiting)
- Connection refused/reset
- Temporary service failures

### Non-Retryable Errors
- Invalid API keys
- HTTP 4xx errors (except 429)
- Profile not found (404)
- Authentication failures

## Monitoring & Logging

### Structured JSON Logging
```json
{
  "timestamp": "2024-01-15T10:30:15Z",
  "level": "info",
  "service": "search-svc",
  "component": "indexing_pipeline",
  "message": "indexing_cycle_completed",
  "duration_ms": 45000,
  "users_processed": 1000,
  "errors": 5,
  "success_rate": 0.995
}
```

### Key Metrics
- **Cycle Duration**: Time taken for each indexing cycle
- **Success Rate**: Percentage of successfully processed users
- **Error Count**: Number of failed user profile updates
- **Throughput**: Users processed per minute
- **Next Run Time**: When the next cycle will execute

## Performance Considerations

### Concurrency
- **Worker Pool**: Prevents overwhelming downstream services
- **Rate Limiting**: Respects API rate limits
- **Batch Processing**: Processes users in manageable chunks

### Memory Management
- **Streaming**: Processes users one at a time
- **Channel Buffering**: Limits memory usage with buffered channels
- **Garbage Collection**: Efficient resource cleanup

### Database Optimization
- **Hash Comparison**: Avoids unnecessary embedding updates
- **TTL Cleanup**: Automatic cleanup of expired embeddings
- **Vector Indexing**: Optimized for similarity search

## Deployment

### Docker Support
The indexing pipeline runs as part of the search-svc container:

```dockerfile
# Dockerfile already includes all dependencies
FROM golang:1.22-alpine AS builder
# ... build steps

FROM alpine:latest
# ... runtime setup
CMD ["./search-svc"]  # Includes indexing pipeline
```

### Health Checks
```bash
# Check if indexing is running
curl -H "Authorization: Bearer $SERVICE_TOKEN" \
     http://search-svc:8080/api/v1/indexing/stats

# Trigger manual indexing (for testing)
curl -X POST \
     -H "Authorization: Bearer $SERVICE_TOKEN" \
     http://search-svc:8080/api/v1/indexing/trigger
```

## Troubleshooting

### Common Issues

1. **Service Discovery Failures**
   - Check `DISCOVERY_SVC_URL` configuration
   - Verify service authentication token
   - Check network connectivity

2. **User Service Errors**
   - Verify `USER_SVC_URL` is correct
   - Check service authentication
   - Monitor rate limiting

3. **Embedding Generation Failures**
   - Verify OpenAI API key is valid
   - Check API quotas and limits
   - Monitor embedding provider status

4. **Database Issues**
   - Check PostgreSQL connection
   - Verify pgvector extension is installed
   - Monitor disk space for TTL cleanup

### Debug Commands
```bash
# Check logs
docker logs search-svc | grep indexing_pipeline

# Manual trigger for testing
curl -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/indexing/trigger

# Check statistics
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/indexing/stats | jq .
```

## Security

### Authentication
- Service-to-service authentication required
- JWT token validation
- Secure token storage in environment variables

### Data Privacy
- Profile text is processed but not permanently stored in logs
- Embedding vectors are anonymized
- TTL ensures data doesn't persist indefinitely

### Network Security
- Internal service communication
- No external API exposure
- Rate limiting prevents abuse
