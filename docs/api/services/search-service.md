# Search Service API Documentation

## Overview

The Search Service provides intelligent user search and matching capabilities using OpenAI embeddings and vector similarity search. It enables semantic search across user profiles, allowing natural language queries to find relevant users based on interests, skills, and profile content.

**Service Details:**
- **Base URL**: `http://localhost:8083/api/v1` (development)
- **Gateway Route**: `/search/*` → `search-svc/api/v1/*`
- **Authentication**: JWT Bearer tokens or service tokens
- **Database**: PostgreSQL with pgvector extension for vector operations
- **External Integration**: OpenAI Embeddings API

## OpenAPI Specification

Full OpenAPI 3.0 specification available at: `backend/search-svc/openapi.yaml`

## Core Features

- **Semantic Search**: Natural language queries using OpenAI embeddings
- **Vector Similarity**: Fast cosine similarity search with pgvector
- **Profile Indexing**: Automatic indexing of user profiles for search
- **Batch Reindexing**: Efficient bulk reindexing operations
- **Performance Optimized**: Redis caching and HNSW indexing

## Search Operations

### Semantic User Search
```http
POST /api/v1/search
Authorization: Bearer {jwt-token}
```

**Authentication Options:**
- **User JWT**: Standard user authentication for public search
- **Service Token**: Internal service-to-service authentication

**Request Body:**
```json
{
  "query": "software engineer with React experience",
  "limit": 10,
  "user_ids": ["uuid1", "uuid2", "uuid3"],
  "exclude_user_id": "current-user-uuid"
}
```

**Parameters:**
- `query` (required): Natural language search query (1-500 characters)
- `limit` (optional): Maximum results to return (1-100, default: 10)
- `user_ids` (optional): Filter search to specific user IDs (max: 1000)
- `exclude_user_id` (optional): Exclude specific user from results

**Response (200):**
```json
{
  "results": [
    {
      "user_id": "uuid1",
      "score": 0.89,
      "match_reasons": [
        "React experience mentioned in profile",
        "Software engineer role", 
        "JavaScript skills listed"
      ]
    },
    {
      "user_id": "uuid2", 
      "score": 0.76,
      "match_reasons": [
        "Frontend development experience",
        "JavaScript proficiency",
        "Web application focus"
      ]
    }
  ],
  "query_processed": "software engineer react experience",
  "total_candidates": 150,
  "search_time_ms": 45
}
```

**Search Quality:**
- **Relevance Score**: 0.0-1.0 based on semantic similarity
- **Match Reasons**: Explainable AI showing why users matched
- **Query Processing**: Cleaned and normalized query for better matching
- **Performance**: Typical search times <200ms

### Search Examples

#### Basic Skill Search
```bash
curl -X POST http://localhost:8083/api/v1/search \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "data scientist with Python experience",
    "limit": 5
  }'
```

#### Interest-Based Search
```bash
curl -X POST http://localhost:8083/api/v1/search \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "photography enthusiast who loves hiking",
    "limit": 10
  }'
```

#### Filtered Search
```bash
curl -X POST http://localhost:8083/api/v1/search \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "startup founder in fintech",
    "limit": 20,
    "user_ids": ["uuid1", "uuid2", "uuid3"],
    "exclude_user_id": "current-user-uuid"
  }'
```

### Advanced Search Capabilities

The search service supports complex semantic matching:

#### Technical Skills
- Programming languages: "Python developer", "Go expert", "TypeScript specialist"
- Frameworks: "React ninja", "Django expert", "Kubernetes pro"
- Technologies: "machine learning engineer", "blockchain developer"

#### Interests and Hobbies
- Activities: "rock climbing enthusiast", "coffee lover", "book reader"
- Creative pursuits: "photographer", "musician", "writer"
- Sports: "tennis player", "runner", "cyclist"

#### Professional Attributes
- Roles: "product manager", "startup founder", "UX designer"
- Industries: "fintech professional", "healthcare worker", "education specialist"
- Experience levels: "senior developer", "recent graduate", "industry veteran"

#### Personal Characteristics
- Personality: "outgoing person", "analytical thinker", "creative mind"
- Lifestyle: "remote worker", "digital nomad", "city dweller"
- Learning: "continuous learner", "mentor", "knowledge seeker"

## Index Management (Internal Endpoints)

### Trigger Reindexing
```http
POST /api/v1/reindex
Authorization: Bearer {service-token}
```

**Authentication**: Requires internal service token (not user JWT)

**Request Body:**
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "force": false
}
```

**Parameters:**
- `user_ids` (optional): Specific users to reindex (omit for full reindex)
- `force` (optional): Force reindex even if embeddings exist (default: false)

**Response (202):**
```json
{
  "job_id": "reindex-job-uuid",
  "status": "queued",
  "users_queued": 1250,
  "estimated_completion": "2024-01-15T14:30:00Z"
}
```

**Reindexing Process:**
1. **Data Retrieval**: Fetch latest profile data from User Service
2. **Text Processing**: Extract and clean text from profiles
3. **Embedding Generation**: Create OpenAI embeddings
4. **Vector Storage**: Store embeddings in pgvector database
5. **Index Optimization**: Update search indexes for performance

### Get Reindex Job Status
```http
GET /api/v1/reindex/{jobId}
Authorization: Bearer {service-token}
```

**Response (200) - In Progress:**
```json
{
  "job_id": "reindex-job-uuid",
  "status": "in_progress",
  "users_total": 1250,
  "users_processed": 342,
  "users_failed": 2,
  "started_at": "2024-01-15T14:00:00Z",
  "completed_at": null,
  "error_message": null,
  "progress_percentage": 27.4,
  "estimated_completion": "2024-01-15T14:28:00Z",
  "processing_rate_per_minute": 45
}
```

**Response (200) - Completed:**
```json
{
  "job_id": "reindex-job-uuid",
  "status": "completed", 
  "users_total": 1250,
  "users_processed": 1248,
  "users_failed": 2,
  "started_at": "2024-01-15T14:00:00Z",
  "completed_at": "2024-01-15T14:28:30Z",
  "error_message": null,
  "processing_rate_per_minute": 45,
  "failed_users": [
    {
      "user_id": "uuid1",
      "error": "profile_data_incomplete",
      "message": "Insufficient profile text for embedding generation"
    },
    {
      "user_id": "uuid2",
      "error": "openai_api_error", 
      "message": "OpenAI API rate limit exceeded"
    }
  ]
}
```

**Job Statuses:**
- `queued`: Job waiting to start
- `in_progress`: Currently processing users
- `completed`: All users processed successfully
- `failed`: Job failed due to system error
- `cancelled`: Job was manually cancelled

### Reindex Management

#### Full System Reindex
```bash
# Trigger full reindex of all users
curl -X POST http://localhost:8083/api/v1/reindex \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "force": true
  }'
```

#### Selective Reindex  
```bash
# Reindex specific users (e.g., after profile updates)
curl -X POST http://localhost:8083/api/v1/reindex \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["uuid1", "uuid2", "uuid3"],
    "force": false
  }'
```

#### Monitor Progress
```bash
# Check reindex job status
curl -X GET http://localhost:8083/api/v1/reindex/reindex-job-uuid \
  -H "Authorization: Bearer ${SERVICE_TOKEN}"
```

## Data Models and Storage

### User Embeddings Table
```sql
CREATE TABLE user_embeddings (
    user_id UUID PRIMARY KEY,
    profile_embedding VECTOR(1536),  -- OpenAI ada-002 embedding dimension
    profile_text TEXT,               -- Source text used for embedding
    embedding_version INTEGER,       -- Model version for compatibility
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity index for efficient search
CREATE INDEX user_embeddings_vector_idx ON user_embeddings 
USING ivfflat (profile_embedding vector_cosine_ops) WITH (lists = 100);
```

### Search Analytics Table  
```sql
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT,
    user_id UUID,                   -- Who searched (nullable for service calls)
    results_count INTEGER,
    execution_time_ms INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Reindex Jobs Table
```sql
CREATE TABLE reindex_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) DEFAULT 'queued',
    users_total INTEGER,
    users_processed INTEGER DEFAULT 0,
    users_failed INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    job_metadata JSONB
);
```

## Performance and Optimization

### Caching Strategy
- **Redis Cache**: Search results cached for 5 minutes
- **Cache Keys**: Based on query hash and filters
- **Invalidation**: Automatic invalidation when profiles update
- **Hit Rates**: Typically 60-70% cache hit rate

### Vector Search Optimization
- **HNSW Indexing**: Hierarchical Navigable Small World graphs
- **Index Parameters**: Tuned for balance of speed and accuracy
- **Memory Usage**: Embeddings kept in memory for fastest access
- **Batch Operations**: Efficient batch similarity computation

### Database Performance
```sql
-- Performance monitoring queries
SELECT 
    query_text,
    AVG(execution_time_ms) as avg_time_ms,
    COUNT(*) as query_count,
    AVG(results_count) as avg_results
FROM search_queries 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY query_text
ORDER BY avg_time_ms DESC;

-- Index usage statistics
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats 
WHERE tablename = 'user_embeddings';
```

## Health and Monitoring

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "service": "search-svc",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "dependencies": {
    "database": "healthy",
    "pgvector": "healthy", 
    "redis": "healthy",
    "openai_api": "healthy"
  },
  "metrics": {
    "total_embeddings": 9876,
    "avg_search_time_ms": 45,
    "cache_hit_rate": 0.68,
    "openai_api_calls_today": 234,
    "reindex_jobs_active": 0
  }
}
```

### Search Analytics
```http
GET /api/v1/analytics/search
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "period": "24h",
  "total_searches": 1234,
  "unique_users": 456,
  "avg_response_time_ms": 47,
  "cache_hit_rate": 0.71,
  "top_queries": [
    {
      "query": "software engineer",
      "count": 45,
      "avg_results": 12,
      "avg_score": 0.78
    },
    {
      "query": "data scientist python",
      "count": 38,
      "avg_results": 8,
      "avg_score": 0.82
    }
  ],
  "search_patterns": {
    "technical_skills": 0.34,
    "interests_hobbies": 0.28,
    "location_based": 0.18,
    "industry_specific": 0.20
  },
  "performance_metrics": {
    "p50_response_time_ms": 35,
    "p95_response_time_ms": 120,
    "p99_response_time_ms": 280,
    "error_rate": 0.002
  }
}
```

### Index Health
```http
GET /api/v1/analytics/index
Authorization: Bearer {service-token}
```

**Response (200):**
```json
{
  "index_stats": {
    "total_users": 9876,
    "indexed_users": 9834,
    "pending_reindex": 42,
    "last_full_reindex": "2024-01-14T02:00:00Z",
    "index_freshness_hours": 14.5,
    "embedding_coverage": 0.996
  },
  "vector_index": {
    "index_type": "ivfflat",
    "index_size_mb": 456,
    "lists_count": 100,
    "avg_vectors_per_list": 98,
    "index_build_time_ms": 15000
  },
  "reindex_history": [
    {
      "job_id": "job-uuid-1",
      "completed_at": "2024-01-14T02:00:00Z",
      "users_processed": 9876,
      "duration_minutes": 45,
      "success_rate": 0.998
    },
    {
      "job_id": "job-uuid-2", 
      "completed_at": "2024-01-13T02:00:00Z",
      "users_processed": 9654,
      "duration_minutes": 42,
      "success_rate": 0.997
    }
  ]
}
```

## Error Handling

### Common Error Responses

```json
{
  "error": "INVALID_REQUEST",
  "message": "Query parameter is required",
  "details": "The 'query' field must contain a non-empty string between 1 and 500 characters",
  "request_id": "req_123456",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Codes:
- `INVALID_REQUEST`: Invalid request parameters or missing required fields
- `QUERY_TOO_LONG`: Query exceeds maximum length of 500 characters
- `QUERY_TOO_SHORT`: Query is too short or empty
- `UNAUTHORIZED`: Invalid or missing authentication token
- `RATE_LIMIT_EXCEEDED`: Search rate limit exceeded
- `SEARCH_ENGINE_ERROR`: Internal search engine error
- `EMBEDDING_GENERATION_FAILED`: Failed to generate embedding for query
- `DATABASE_ERROR`: Database connection or query error
- `REINDEX_JOB_NOT_FOUND`: Specified reindex job doesn't exist
- `OPENAI_API_ERROR`: OpenAI API unavailable or rate limited

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87  
X-RateLimit-Reset: 1640995200
X-RateLimit-Type: user
X-RateLimit-Scope: search
```

## Security and Authentication

### User Authentication (Public Search)
- **JWT Tokens**: Standard user JWT tokens for authenticated search
- **Rate Limiting**: 100 searches/hour per user
- **Input Validation**: Query sanitization and length limits
- **Result Filtering**: Only publicly searchable profiles returned

### Service Authentication (Internal)
- **Service Tokens**: Internal service-to-service authentication
- **Higher Limits**: 1000 searches/minute for service calls
- **Admin Operations**: Reindexing and analytics access
- **mTLS**: Secure communication between services

### Privacy Protection
- **Profile Visibility**: Respects user privacy settings
- **Data Anonymization**: Search logs anonymized after 30 days
- **Consent Compliance**: Only processes consented user data
- **GDPR Right to be Forgotten**: User data removal from search index

## Integration Patterns

### User Profile Updates (Event-Driven)
```json
{
  "event_type": "user.profile.updated",
  "user_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "changes": ["bio", "interests", "skills"]
}
```

**Search Service Response:**
1. Receive profile update event
2. Queue user for reindexing
3. Generate new embedding from updated profile
4. Update search index
5. Invalidate related search caches

### Discovery Service Integration
```http
POST /api/v1/search
Authorization: Bearer {service-token}
X-Calling-Service: discovery-svc
```

**Integration Flow:**
1. Discovery Service queries available users
2. Applies search query with user ID filtering
3. Returns combined availability + search relevance data
4. Cache results for subsequent proximity searches

## Best Practices

### Query Optimization
```javascript
// Good: Specific and descriptive queries
"React developer with 5+ years experience"
"UX designer interested in accessibility"  
"Data scientist specializing in NLP"

// Avoid: Too generic or short queries
"developer"
"person"
"good"
```

### Batch Operations
```javascript
// Efficient: Single search with multiple filters
{
  "query": "software engineer",
  "user_ids": ["uuid1", "uuid2", "uuid3", ...],
  "limit": 50
}

// Inefficient: Multiple separate searches
// Multiple API calls for same query with different filters
```

### Caching Strategy
```javascript
// Cache-friendly: Consistent query formatting
const normalizeQuery = (query) => {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
};

// Use normalized queries for better cache hit rates
const searchQuery = normalizeQuery(userInput);
```

## Example Usage

### Frontend Search Implementation
```javascript
class SearchService {
  constructor(apiBase, authToken) {
    this.apiBase = apiBase;
    this.authToken = authToken;
    this.cache = new Map();
  }

  async searchUsers(query, options = {}) {
    const cacheKey = this.getCacheKey(query, options);
    
    // Check local cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.apiBase}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          limit: options.limit || 10,
          user_ids: options.userIds,
          exclude_user_id: options.excludeUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache successful results for 5 minutes
      this.cache.set(cacheKey, data);
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
      
      return data;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  getCacheKey(query, options) {
    return `${query}:${JSON.stringify(options)}`;
  }
}

// Usage
const searchService = new SearchService('http://localhost:8083/api/v1', token);

const results = await searchService.searchUsers(
  'React developer with TypeScript experience',
  {
    limit: 20,
    excludeUserId: currentUserId
  }
);
```

### Backend Service Integration
```go
package search

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type SearchClient struct {
    BaseURL      string
    ServiceToken string
    HTTPClient   *http.Client
}

type SearchRequest struct {
    Query         string   `json:"query"`
    Limit         int      `json:"limit,omitempty"`
    UserIDs       []string `json:"user_ids,omitempty"`
    ExcludeUserID string   `json:"exclude_user_id,omitempty"`
}

type SearchResponse struct {
    Results          []SearchResult `json:"results"`
    QueryProcessed   string         `json:"query_processed"`
    TotalCandidates  int           `json:"total_candidates"`
    SearchTimeMs     int           `json:"search_time_ms"`
}

type SearchResult struct {
    UserID       string   `json:"user_id"`
    Score        float64  `json:"score"`
    MatchReasons []string `json:"match_reasons"`
}

func NewSearchClient(baseURL, serviceToken string) *SearchClient {
    return &SearchClient{
        BaseURL:      baseURL,
        ServiceToken: serviceToken,
        HTTPClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *SearchClient) SearchUsers(req SearchRequest) (*SearchResponse, error) {
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal request: %w", err)
    }

    httpReq, err := http.NewRequest("POST", c.BaseURL+"/search", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    httpReq.Header.Set("Content-Type", "application/json")
    httpReq.Header.Set("Authorization", "Bearer "+c.ServiceToken)

    resp, err := c.HTTPClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("search request failed with status %d", resp.StatusCode)
    }

    var searchResp SearchResponse
    if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &searchResp, nil
}

// Usage example
func main() {
    client := NewSearchClient("http://search-svc:8083/api/v1", serviceToken)
    
    results, err := client.SearchUsers(SearchRequest{
        Query: "software engineer with Go experience",
        Limit: 10,
        UserIDs: availableUserIDs,
    })
    
    if err != nil {
        log.Printf("Search failed: %v", err)
        return
    }
    
    log.Printf("Found %d users in %dms", len(results.Results), results.SearchTimeMs)
}
```

## Service Integration

The Search Service integrates with:
- **Discovery Service**: Semantic search for user discovery and matching
- **User Service**: Profile data synchronization and updates
- **Feature Service**: A/B testing for search algorithms and ranking
- **AI Service**: Enhanced search insights and user matching
- **API Gateway**: Authentication, rate limiting, and request routing

All service communication uses mTLS via Linkerd service mesh with comprehensive observability through Prometheus metrics, distributed tracing, and structured logging.