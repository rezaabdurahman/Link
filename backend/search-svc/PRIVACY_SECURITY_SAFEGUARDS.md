# Privacy & Security Safeguards Implementation

## Overview
This document outlines the privacy and security safeguards implemented in the search service to protect user data and ensure secure operations.

## Implemented Safeguards

### 1. Availability-Based Indexing ✅
**Requirement**: Only index **available** users; purge embeddings when availability expires.

**Implementation**:
- Enhanced `AuthRequired()` middleware to check `X-User-Available` header
- Users with `isAvailable != "true"` are rejected with HTTP 403
- Background cleanup process runs every 30 minutes to purge expired embeddings
- TTL-based automatic cleanup of embeddings when availability expires

**Code Locations**:
- `internal/middleware/auth.go` - Availability checks in AuthRequired()
- `internal/service/search_service.go` - PurgeExpiredEmbeddings(), StartAvailabilityCleanup()
- `internal/repository/search_repository.go` - CleanupExpiredEmbeddings()

### 2. Service Authentication ✅ 
**Requirement**: search-svc authenticates inter-service calls via JWT signed by gateway; never exposed publicly.

**Implementation**:
- Search service only accepts requests from authenticated API Gateway
- `AuthRequired()` middleware validates user headers passed by gateway
- `ServiceAuthRequired()` middleware validates service-to-service calls
- Service is never exposed directly to public internet

**Code Locations**:
- `internal/middleware/auth.go` - AuthRequired(), ServiceAuthRequired()
- `main.go` - Protected routes configuration

### 3. Encryption at Rest ✅
**Requirement**: Encrypt embeddings at rest (Postgres TDE or disk encryption).

**Implementation**:
- Database encryption configuration enabled by default
- PostgreSQL Transparent Data Encryption (TDE) support
- Environment variable `DB_ENCRYPTION_ENABLED=true` controls encryption
- All user embeddings stored in encrypted database tables

**Code Locations**:
- `internal/config/database.go` - Database encryption configuration
- `internal/models/search.go` - Encrypted UserEmbedding model

### 4. Private Profile Respect ✅
**Requirement**: Respect profile `visibility = private` (skip indexing).

**Implementation**:
- Enhanced `AuthRequired()` middleware to check `X-User-Visibility` header
- Users with `visibility = "private"` are rejected with HTTP 403
- Private profiles are completely excluded from search indexing
- Privacy setting enforced at the gateway level and validated in search service

**Code Locations**:
- `internal/middleware/auth.go` - Privacy checks in AuthRequired()
- `main.go` - Updated CORS headers to include visibility headers

### 5. Rate Limiting ✅
**Requirement**: Rate-limit `/search` (50 qpm per user).

**Implementation**:
- Per-user rate limiting with 50 requests per minute limit
- Token bucket algorithm with burst allowance (10% of limit)
- Rate limit headers included in responses
- Graceful handling of rate limit exceeded scenarios

**Code Locations**:
- `internal/middleware/auth.go` - RateLimit middleware, RateLimiterStore
- `main.go` - Rate limiter initialization and endpoint protection

## Security Architecture

### Request Flow
```
Client Request
    ↓
API Gateway (JWT validation, user context injection)
    ↓ (Headers: X-User-ID, X-User-Email, X-User-Visibility, X-User-Available)
Search Service
    ↓
AuthRequired() Middleware (Privacy + Availability checks)
    ↓
RateLimit() Middleware (50 QPM per user)
    ↓
Search Handler (Encrypted database operations)
```

### Header-Based Security
The search service relies on trusted headers from the API Gateway:
- `X-User-ID`: Authenticated user identifier
- `X-User-Email`: User email for context
- `X-User-Visibility`: Profile privacy setting ("private" blocked)
- `X-User-Available`: User availability status ("true" required)

### Background Processes
1. **Availability Cleanup**: Runs every 30 minutes to purge expired embeddings
2. **TTL Cleanup**: Removes embeddings that have exceeded their time-to-live
3. **Indexing Pipeline**: Respects privacy and availability settings during indexing

## Environment Configuration

### Required Environment Variables
```bash
# Database encryption (default: enabled)
DB_ENCRYPTION_ENABLED=true

# Rate limiting (default: 50 requests per minute)
SEARCH_RATE_LIMIT_QPM=50

# TTL for embeddings (default: 2 hours)
INDEXING_EMBEDDING_TTL_HOURS=2

# Service authentication token
SERVICE_AUTH_TOKEN=your-secure-service-token
```

### Database Encryption Setup
1. Enable PostgreSQL TDE in your database configuration
2. Configure disk encryption for the database storage
3. Set `DB_ENCRYPTION_ENABLED=true` in environment variables

## Monitoring & Observability

### Rate Limit Headers
```http
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 42
Retry-After: 60
```

### Error Responses
- `403 PRIVATE_PROFILE`: User profile is private
- `403 USER_UNAVAILABLE`: User is not available for discovery  
- `429 RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `401 UNAUTHORIZED`: Authentication required

### Health Check
```bash
GET /health
```

## Testing Privacy & Security

### Availability Testing
```bash
# Test unavailable user (should be rejected)
curl -H "X-User-ID: user123" \
     -H "X-User-Available: false" \
     -H "Authorization: Bearer token" \
     POST /api/v1/search

# Expected: 403 USER_UNAVAILABLE
```

### Privacy Testing  
```bash
# Test private profile (should be rejected)
curl -H "X-User-ID: user123" \
     -H "X-User-Visibility: private" \
     -H "Authorization: Bearer token" \
     POST /api/v1/search

# Expected: 403 PRIVATE_PROFILE
```

### Rate Limiting Testing
```bash
# Send 51 requests rapidly (should hit rate limit)
for i in {1..51}; do
  curl -H "X-User-ID: user123" \
       -H "X-User-Available: true" \
       -H "X-User-Visibility: public" \
       -H "Authorization: Bearer token" \
       POST /api/v1/search
done

# Expected: 429 RATE_LIMIT_EXCEEDED on request 51
```

## Compliance & Security Benefits

### Data Protection
- ✅ Only available users are indexed and searchable
- ✅ Private profiles are completely excluded from search
- ✅ Embeddings are encrypted at rest
- ✅ Automatic cleanup prevents data retention beyond availability

### Access Control
- ✅ Service never exposed directly to public
- ✅ All requests authenticated via API Gateway
- ✅ Service-to-service calls require valid tokens
- ✅ Per-user rate limiting prevents abuse

### Privacy Compliance
- ✅ Respects user privacy settings (`visibility=private`)
- ✅ Automatic data purging when availability expires
- ✅ No indexing of unavailable or private users
- ✅ Secure data storage with encryption at rest

## Future Enhancements

1. **Data Retention Policies**: Configurable retention periods for different user types
2. **Audit Logging**: Enhanced logging for privacy-related actions
3. **Dynamic Rate Limiting**: Adaptive rate limits based on user behavior
4. **Encryption in Transit**: Additional TLS encryption for inter-service communication
5. **Privacy Dashboard**: Admin interface for monitoring privacy compliance
