# Search Service (search-svc)

Intelligent user search and matching service using vector embeddings for semantic search capabilities.

## Overview

The Search Service provides semantic search functionality for user profiles using OpenAI embeddings and PostgreSQL with pgvector extension. It enables natural language queries to find users with similar skills, experience, or profile content.

## Features

- **Semantic Search**: Natural language search using vector embeddings
- **Vector Database**: PostgreSQL with pgvector for efficient similarity search  
- **Embedding Provider Abstraction**: Switchable embedding providers (OpenAI initially)
- **Batch Reindexing**: Background job system for updating embeddings
- **Analytics**: Search query logging and analytics
- **High Performance**: Optimized vector similarity search with configurable limits

## API Endpoints

### Search Endpoints

#### `POST /api/v1/search`
Perform semantic search on user profiles.

**Request:**
```json
{
  "query": "software engineer with React experience",
  "limit": 10,
  "user_ids": ["uuid1", "uuid2"],
  "exclude_user_id": "current-user-uuid"
}
```

**Response:**
```json
{
  "results": [
    {
      "user_id": "uuid1",
      "score": 0.89,
      "match_reasons": ["React experience", "Software engineer role"]
    }
  ],
  "query_processed": "software engineer react experience",
  "total_candidates": 150,
  "search_time_ms": 45
}
```

### Reindex Endpoints (Internal)

#### `POST /api/v1/reindex`
Trigger reindexing of user profile embeddings.

**Request:**
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "force": true
}
```

**Response:**
```json
{
  "job_id": "reindex-job-uuid",
  "status": "queued",
  "users_queued": 1250,
  "estimated_completion": "2024-01-15T14:30:00Z"
}
```

#### `GET /api/v1/reindex/{jobId}`
Get reindex job status.

**Response:**
```json
{
  "job_id": "reindex-job-uuid",
  "status": "in_progress",
  "users_total": 1250,
  "users_processed": 342,
  "users_failed": 2,
  "started_at": "2024-01-15T14:00:00Z"
}
```

## Architecture

### Components

- **Handlers**: HTTP request/response handling
- **Services**: Business logic implementation
- **Repositories**: Database operations abstraction
- **Config**: Database and embedding provider configuration
- **Models**: Database entity definitions
- **DTOs**: Request/response data structures

### Database Schema

#### user_embeddings
- `id`: UUID primary key
- `user_id`: UUID unique index
- `embedding`: vector(1536) for embeddings
- `profile_text`: text content that was embedded
- `embedding_hash`: SHA-256 hash for change detection
- `provider`: embedding provider name
- `model`: embedding model used
- `created_at`, `updated_at`: timestamps

#### search_queries (Analytics)
- `id`: UUID primary key
- `user_id`: UUID of searcher
- `query`: search query text
- `query_embedding`: vector embedding of query
- `results_count`, `search_time_ms`, `total_candidates`: metrics
- `created_at`: timestamp

#### reindex_jobs
- `id`: UUID primary key
- `status`: job status (queued, in_progress, completed, failed)
- `users_total`, `users_processed`, `users_failed`: progress counters
- `force`: whether to force reindex existing embeddings
- `specific_user_ids`: array of user IDs for partial reindex
- `estimated_completion`, `started_at`, `completed_at`: timestamps
- `error_message`: failure details

## Configuration

### Environment Variables

#### Database
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_USER`: Database user (default: link_user)
- `DB_PASSWORD`: Database password (default: link_pass)
- `DB_NAME`: Database name (default: link_app)
- `DB_SSLMODE`: SSL mode (default: disable)

#### Embedding Provider
- `EMBEDDING_PROVIDER`: Provider type (default: openai)
- `OPENAI_API_KEY`: OpenAI API key (required)
- `OPENAI_EMBEDDING_MODEL`: Model name (default: text-embedding-3-small)

#### Service
- `PORT`: Server port (default: 8080)
- `ENVIRONMENT`: Environment (development/production)
- `SERVICE_AUTH_TOKEN`: Service-to-service authentication token

## Setup Instructions

### Prerequisites
- Go 1.22+
- PostgreSQL 15+ with pgvector extension
- OpenAI API key

### Local Development

1. **Clone and setup:**
   ```bash
   cd backend/search-svc
   go mod download
   ```

2. **Set up environment:**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export SERVICE_AUTH_TOKEN="your-service-token"
   ```

3. **Start PostgreSQL with pgvector:**
   ```bash
   docker run -d --name postgres-pgvector \
     -e POSTGRES_DB=link_app \
     -e POSTGRES_USER=link_user \
     -e POSTGRES_PASSWORD=link_pass \
     -p 5432:5432 \
     pgvector/pgvector:pg15-v0.5.1
   ```

4. **Run the service:**
   ```bash
   go run main.go
   ```

### Docker Deployment

1. **Build image:**
   ```bash
   docker build -t search-svc .
   ```

2. **Run with docker-compose:**
   ```bash
   cd ../
   docker-compose up search-svc
   ```

## Testing

### Unit Tests
```bash
go test ./internal/service/... -v -cover
```

### Integration Tests
```bash
go test ./... -v -cover -tags=integration
```

### Coverage Report
```bash
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

Target: ≥60% coverage for core search logic

## Usage Examples

### Basic Search
```bash
curl -X POST http://localhost:8083/api/v1/search \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-uuid" \
  -H "X-User-Email: user@example.com" \
  -d '{
    "query": "React developer with TypeScript experience",
    "limit": 5
  }'
```

### Filtered Search
```bash
curl -X POST http://localhost:8083/api/v1/search \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-uuid" \
  -H "X-User-Email: user@example.com" \
  -d '{
    "query": "data scientist",
    "limit": 10,
    "user_ids": ["uuid1", "uuid2", "uuid3"],
    "exclude_user_id": "current-user-uuid"
  }'
```

### Trigger Reindex
```bash
curl -X POST http://localhost:8083/api/v1/reindex \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-service-token" \
  -d '{
    "user_ids": ["user1", "user2"],
    "force": true
  }'
```

### Check Reindex Status
```bash
curl -X GET http://localhost:8083/api/v1/reindex/job-uuid \
  -H "Authorization: Bearer your-service-token"
```

## Performance Considerations

### Vector Search Optimization
- Uses cosine distance for similarity matching
- Configurable result limits (1-100)
- Efficient filtering by user ID lists
- Background analytics logging to avoid latency

### Embedding Management
- Hash-based change detection to avoid unnecessary re-embedding
- Batch processing for reindex operations (10 users per batch)
- Provider abstraction allows switching embedding models

### Database Optimization
- Indexes on user_id, embedding fields
- Regular cleanup of old reindex jobs (7 days)
- Connection pooling via GORM

## Monitoring & Observability

### Health Check
```bash
curl http://localhost:8083/health
```

### Metrics
- Search response times logged
- Total candidates per search
- Reindex job progress tracking
- Embedding generation success/failure rates

### Logging
- Structured logging with request IDs
- Search analytics for query optimization  
- Error tracking with stack traces
- Performance metrics per endpoint

## Security

### Authentication
- User endpoints: X-User-ID header validation from API Gateway
- Service endpoints: Bearer token authentication
- No direct database access from external clients

### Data Protection
- No sensitive data in embeddings (only profile summaries)
- Secure token storage for API keys
- SQL injection prevention via GORM
- Input validation on all endpoints

## Contributing

### Code Structure
- Follow clean architecture principles
- Use dependency injection for testability
- Implement interfaces for mockable dependencies
- Include comprehensive error handling

### Adding New Features
1. Define interfaces in service layer
2. Implement in repository layer
3. Add business logic to services
4. Create DTOs for API contracts
5. Add handlers for HTTP endpoints
6. Write unit tests (>60% coverage)
7. Update documentation

## License

MIT License - see LICENSE file for details.
