# Unified API Contract Documentation

## Overview

This document serves as the single source of truth for API specifications, bridging backend gateway requirements with frontend implementation needs. It resolves conflicts identified in the documentation audit.

## Authentication & Authorization

### JWT Token Structure
```json
{
  "user_id": "uuid",
  "email": "user@example.com", 
  "username": "username",
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "user-svc",
  "sub": "uuid"
}
```

### Authentication Flow
1. **Login/Register**: User authenticates and receives JWT token
2. **Token Validation**: All protected endpoints validate Bearer tokens
3. **Token Refresh**: Automatic refresh using refresh token
4. **User Profile Retrieval**: `/api/me` endpoint called after token operations

## Critical Endpoint Specifications

### 1. User Profile Endpoint (`/api/me`)

**Gateway Route**: `GET /users/profile`  
**Service Route**: `GET /api/v1/profile`  
**Frontend Reference**: `/api/me`

#### Authentication
- **Required**: JWT Bearer token
- **Validation**: Token signature and expiration checked
- **User Extraction**: User ID extracted from JWT claims

#### Request
```http
GET /users/profile
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

#### Response (Success - 200)
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "profilePicture": "string|null",
  "emailVerified": boolean,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

#### Error Responses
- **401 Unauthorized**: Invalid/expired token
- **404 Not Found**: User not found
- **500 Internal Server Error**: Service failure

## Rate Limiting Policy

### Standard Limits
- **Authentication endpoints**: 10 requests/minute per IP
- **User profile endpoints**: 100 requests/minute per user
- **Chat endpoints**: 500 requests/minute per user
- **Location updates**: 60 requests/minute per user

### Abuse Prevention
- **IP-based limiting**: Prevents brute force attacks
- **User-based limiting**: Prevents API abuse
- **Geographic limiting**: Location-based restrictions where applicable
- **Circuit breakers**: Automatic throttling during high load

### Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1640995200
```

## Security Standards

### Token Management
- **Algorithm**: RS256 with key rotation
- **Expiration**: Access tokens expire in 15 minutes
- **Refresh**: Refresh tokens expire in 30 days
- **Revocation**: Tokens can be revoked server-side

### Data Protection
- **Encryption**: All PII encrypted at rest
- **Validation**: Comprehensive input validation
- **CORS**: Properly configured for frontend domain
- **HTTPS**: All endpoints require TLS

### Privacy Controls
- **Profile Visibility**: Public/private settings respected
- **Location Sharing**: Granular permission controls
- **Data Retention**: Configurable retention policies

## Implementation Notes

### Backend (API Gateway)
- Routes `/users/profile` to User Service `/api/v1/profile`
- Extracts user_id from JWT for service calls
- Implements standard error response format
- Applies rate limiting and security headers

### Frontend Integration
- Calls endpoint on app initialization with stored token
- Handles token refresh scenarios automatically
- Implements proper error handling for auth failures
- Updates user state across application context

## Migration Notes

### Changes from Previous Documentation
1. **Endpoint Consistency**: Unified `/api/me` → `/users/profile` mapping
2. **Error Format**: Standardized error response structure
3. **Rate Limiting**: Centralized rate limiting specifications
4. **Authentication**: Clarified token validation flow

### Backward Compatibility
- Frontend can continue using `/api/me` reference (gateway handles routing)
- Error response format maintained for existing integrations
- Token structure unchanged

## Testing & Validation

### Integration Tests
```bash
# Valid token test
curl -H "Authorization: Bearer $VALID_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/users/profile

# Invalid token test  
curl -H "Authorization: Bearer invalid-token" \
     -H "Content-Type: application/json" \
     http://localhost:8080/users/profile
```

### Rate Limit Testing
```bash
# Test rate limiting
for i in {1..15}; do
  curl -H "Authorization: Bearer $TOKEN" \
       http://localhost:8080/users/profile
done
```

## Search Service Architecture

### Service Boundaries

#### user-svc (Unchanged)
- **Role**: Single source of truth for public profile data
- **Responsibilities**: 
  - User authentication and authorization
  - Profile management and storage
  - Friend relationships
  - Public user data access
- **Current Endpoints**: Remain unchanged (see existing endpoints above)

#### search-svc (New Service)
- **Technology Stack**: Go + PostgreSQL + OpenAI Embeddings
- **Role**: Intelligent user search and matching
- **Responsibilities**:
  - Natural language search processing
  - User profile embeddings generation and storage
  - Search result ranking and scoring
  - Index management and updates

#### discovery-svc (Enhanced Orchestrator)
- **Role**: Orchestrates user availability and search integration
- **Enhanced Responsibilities**:
  1. Maintains availability table for user discovery
  2. Queries available user IDs from its own database
  3. Forwards natural language queries + available user IDs to search-svc
  4. Returns combined availability + search results to clients

### Search Service API Specification

#### 1. Search Endpoint

**Service Route**: `POST /api/v1/search`  
**Gateway Route**: `POST /search`  
**Authentication**: Required via service token (internal) or JWT (via gateway)

##### Request
```http
POST /api/v1/search
Content-Type: application/json
Authorization: Bearer {service-token-or-jwt}
```

```json
{
  "query": "string (required) - Natural language search query",
  "limit": "integer (optional) - Maximum results to return (default: 10, max: 100)",
  "user_ids": "array[string] (optional) - Filter search to specific user IDs",
  "exclude_user_id": "string (optional) - Exclude specific user from results"
}
```

##### Response (Success - 200)
```json
{
  "results": [
    {
      "user_id": "uuid - User identifier",
      "score": "float - Relevance score (0.0-1.0)",
      "match_reasons": "array[string] - Why this user matched (optional)"
    }
  ],
  "query_processed": "string - Processed version of the query",
  "total_candidates": "integer - Total users considered",
  "search_time_ms": "integer - Search execution time"
}
```

##### Error Responses
- **400 Bad Request**: Invalid query parameters
- **401 Unauthorized**: Invalid or missing service token
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Search service failure

#### 2. Reindex Endpoint (Internal)

**Service Route**: `POST /api/v1/reindex`  
**Authentication**: Required via internal service token only

##### Request
```http
POST /api/v1/reindex
Content-Type: application/json
Authorization: Bearer {internal-service-token}
```

```json
{
  "user_ids": "array[string] (optional) - Specific users to reindex, omit for full reindex",
  "force": "boolean (optional) - Force reindex even if embeddings exist"
}
```

##### Response (Success - 202)
```json
{
  "job_id": "uuid - Reindex job identifier",
  "status": "queued|in_progress|completed|failed",
  "users_queued": "integer - Number of users queued for reindexing",
  "estimated_completion": "ISO8601 - Estimated completion time"
}
```

#### 3. Reindex Status Endpoint (Internal)

**Service Route**: `GET /api/v1/reindex/{job_id}`  
**Authentication**: Required via internal service token only

##### Response (Success - 200)
```json
{
  "job_id": "uuid",
  "status": "queued|in_progress|completed|failed",
  "users_total": "integer",
  "users_processed": "integer",
  "users_failed": "integer",
  "started_at": "ISO8601",
  "completed_at": "ISO8601 (nullable)",
  "error_message": "string (nullable)"
}
```

### Enhanced Discovery Service Integration

#### Updated Available Users Endpoint

**Service Route**: `GET /api/v1/available-users`  
**Gateway Route**: `GET /discovery/available-users`  
**Enhancement**: Now supports search integration

##### Query Parameters
```
q (optional): Natural language search query
limit (optional): Maximum results (default: 10, max: 50)
include_search_scores (optional): Include search relevance scores (default: false)
```

##### Enhanced Response (Success - 200)
```json
{
  "available_users": [
    {
      "user_id": "uuid",
      "last_seen": "ISO8601",
      "status": "available|busy|away",
      "search_score": "float (nullable) - Only if search query provided",
      "match_reasons": "array[string] (nullable) - Only if search query provided"
    }
  ],
  "total_available": "integer - Total available users (before search filtering)",
  "search_applied": "boolean - Whether search filtering was applied",
  "search_time_ms": "integer (nullable) - Search execution time if applicable"
}
```

### Service Communication Patterns

#### discovery-svc → search-svc Flow
1. **Client Request**: `GET /discovery/available-users?q="software engineers in SF"`
2. **Discovery Service**:
   - Queries local availability table: `SELECT user_id FROM availability WHERE status = 'available'`
   - Calls search-svc: `POST /api/v1/search` with available user_ids and query
   - Merges availability data with search results
   - Returns combined response

#### search-svc → user-svc Integration
- **Reindex Trigger**: search-svc calls user-svc to fetch latest profile data
- **Profile Updates**: user-svc can trigger search-svc reindex via webhook or message queue
- **Data Consistency**: search-svc maintains read-only cached profile data for search

### Authentication & Authorization

#### Service-to-Service Authentication
```json
{
  "service_token": {
    "algorithm": "HS256",
    "issuer": "api-gateway",
    "audience": "search-svc",
    "expiry": "1h",
    "claims": {
      "service_name": "discovery-svc|api-gateway",
      "permissions": ["search:read", "reindex:write"]
    }
  }
}
```

#### Public Search via Gateway
- **Route**: `POST /search` → `search-svc:/api/v1/search`
- **Authentication**: Standard JWT token validation
- **Rate Limiting**: 100 requests/hour per user
- **Input Sanitization**: Query length limits, content filtering

### Data Models & Storage

#### Search Service Database Schema
```sql
-- User embeddings table
CREATE TABLE user_embeddings (
    user_id UUID PRIMARY KEY,
    profile_embedding VECTOR(1536),  -- OpenAI embedding dimension
    profile_text TEXT,               -- Source text for embedding
    embedding_version INTEGER,       -- For model version tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Search analytics table
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT,
    user_id UUID,                   -- Who searched (nullable for internal searches)
    results_count INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reindex jobs table
CREATE TABLE reindex_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) DEFAULT 'queued',
    users_total INTEGER,
    users_processed INTEGER DEFAULT 0,
    users_failed INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);
```

#### Vector Search Configuration
```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector index for efficient similarity search
CREATE INDEX user_embeddings_vector_idx ON user_embeddings 
USING ivfflat (profile_embedding vector_cosine_ops) WITH (lists = 100);
```

### Protobuf Definitions

#### SearchService.proto
```protobuf
syntax = "proto3";

package search;

option go_package = "github.com/link-app/search-svc/pkg/pb";

// Search service definition
service SearchService {
  // Perform semantic search on user profiles
  rpc Search(SearchRequest) returns (SearchResponse);
  
  // Trigger reindexing of user profiles
  rpc Reindex(ReindexRequest) returns (ReindexResponse);
  
  // Get reindex job status
  rpc GetReindexStatus(ReindexStatusRequest) returns (ReindexStatusResponse);
}

// Search request message
message SearchRequest {
  string query = 1;                    // Natural language query
  optional int32 limit = 2;            // Max results (default: 10)
  repeated string user_ids = 3;        // Filter to specific users
  optional string exclude_user_id = 4; // Exclude specific user
}

// Search response message
message SearchResponse {
  repeated SearchResult results = 1;
  string query_processed = 2;
  int32 total_candidates = 3;
  int32 search_time_ms = 4;
}

// Individual search result
message SearchResult {
  string user_id = 1;
  float score = 2;
  repeated string match_reasons = 3;
}

// Reindex request message
message ReindexRequest {
  repeated string user_ids = 1;  // Specific users, empty for all
  optional bool force = 2;       // Force reindex
}

// Reindex response message
message ReindexResponse {
  string job_id = 1;
  string status = 2;
  int32 users_queued = 3;
  string estimated_completion = 4; // ISO8601
}

// Reindex status request
message ReindexStatusRequest {
  string job_id = 1;
}

// Reindex status response
message ReindexStatusResponse {
  string job_id = 1;
  string status = 2;
  int32 users_total = 3;
  int32 users_processed = 4;
  int32 users_failed = 5;
  string started_at = 6;     // ISO8601
  optional string completed_at = 7; // ISO8601
  optional string error_message = 8;
}
```

### Performance & Scaling Considerations

#### Search Service
- **Embedding Cache**: Redis cache for frequently accessed embeddings
- **Query Optimization**: HNSW indexing for vector similarity search
- **Batch Processing**: Bulk reindexing capabilities
- **Horizontal Scaling**: Read replicas for search queries

#### Rate Limiting
- **Public Search**: 100 queries/hour per user
- **Service-to-Service**: 1000 queries/minute between services
- **Reindexing**: Maximum 1 full reindex every 6 hours

#### Monitoring & Metrics
- **Search Latency**: p95 < 200ms, p99 < 500ms
- **Embedding Generation**: Time per user profile
- **Index Freshness**: Time since last successful reindex
- **Query Success Rate**: Percentage of successful searches

---

*This document resolves conflicts identified in the documentation audit and serves as the canonical reference for API implementation across backend and frontend teams.*
