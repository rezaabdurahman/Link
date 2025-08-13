# ADR-001: Re-use Existing Semantic Search Service for Friend-Filtered User Discovery

**Status**: Recommended  
**Date**: 2024-01-17  
**Deciders**: Development Team  
**Technical Story**: Link Search Extension - Step 1: Identify & re-use existing semantic Search Service

## Context

The Link search extension needs to implement user discovery functionality with the ability to filter or boost results based on a user's friend connections. We need to decide between implementing SQL-based filtering (using `ILIKE` queries) or leveraging the existing semantic search infrastructure.

## Decision

We will **re-use the existing semantic search service** (`search-svc`) and extend its contract to support `friendIds` as an explicit filter parameter, rather than implementing SQL `ILIKE` queries.

## Rationale

### Current Search Service Architecture

Our analysis revealed that the existing `search-svc` already provides:

1. **Robust HTTP API** at `POST /api/v1/search` with comprehensive OpenAPI documentation
2. **Semantic Search Capabilities** using OpenAI embeddings with pgvector for vector similarity search
3. **User Filtering Support** via the `user_ids` parameter that accepts up to 1,000 user IDs
4. **Production-Ready Features**:
   - Rate limiting (50 requests/minute per user)
   - Authentication (Bearer JWT + Service tokens)
   - Analytics logging with search query tracking
   - TTL-based privacy safeguards for embedding cleanup
   - Graceful error handling and fallback mechanisms

### Current API Contract Analysis

The search service currently supports:

```typescript
interface SearchRequest {
  query: string;              // Required: Natural language query (1-500 chars)
  limit?: number;             // Optional: Max results (1-100, default 10)
  user_ids?: UUID[];          // Optional: Filter to specific user IDs (max 1000)
  exclude_user_id?: UUID;     // Optional: Exclude specific user
}
```

### Required Extension

To support friend-filtering, we need to extend the API contract to accept a `friendIds` parameter:

```typescript
interface SearchRequest {
  query: string;
  limit?: number;
  user_ids?: UUID[];          // General user filtering
  exclude_user_id?: UUID;
  friend_ids?: UUID[];        // NEW: Friend-specific filtering/boosting
}
```

## Alternatives Considered

### Alternative 1: SQL ILIKE Implementation
- **Pros**: Simple to implement, direct database queries
- **Cons**: 
  - No semantic understanding (misses context and intent)
  - Poor performance on large datasets without full-text indexes
  - Doesn't leverage existing ML infrastructure
  - Violates the architectural requirement for semantic capabilities

### Alternative 2: Hybrid Approach
- **Pros**: Combines SQL performance with semantic ranking
- **Cons**: 
  - Increased complexity
  - Duplicate filtering logic
  - Higher maintenance overhead

## Implementation Plan

### Phase 1: Verify Current Capabilities
✅ **COMPLETED** - The current `search-svc` already supports:
- HTTP endpoint: `POST /api/v1/search`
- User ID filtering via `user_ids` parameter (up to 1,000 IDs)
- Semantic search using OpenAI embeddings
- Vector similarity search with cosine distance
- Comprehensive error handling and rate limiting

### Phase 2: Extend Search Service Contract
Add `friend_ids` parameter to the search request:

1. **Update DTOs** (`internal/dto/search.go`):
```go
type SearchRequest struct {
    Query          string      `json:"query" binding:"required,min=1,max=500"`
    Limit          *int        `json:"limit,omitempty" binding:"omitempty,min=1,max=100"`
    UserIDs        []uuid.UUID `json:"user_ids,omitempty" binding:"omitempty,max=1000"`
    ExcludeUserID  *uuid.UUID  `json:"exclude_user_id,omitempty"`
    FriendIDs      []uuid.UUID `json:"friend_ids,omitempty" binding:"omitempty,max=1000"`
}
```

2. **Update Search Service Logic** to use `FriendIDs` for:
   - **Filtering**: When provided, restrict search to friends only
   - **Boosting**: Prefer friends in ranking when both friends and non-friends match

3. **Update Repository Layer** to handle friend-based filtering in vector search

### Phase 3: Update Discovery Service Integration
Modify the discovery service's search client to pass friend IDs:

```go
// In discovery-svc/internal/client/search_client.go
type SearchRequest struct {
    Query     string      `json:"query"`
    UserIDs   []uuid.UUID `json:"user_ids,omitempty"`
    FriendIDs []uuid.UUID `json:"friend_ids,omitempty"`  // NEW
    Limit     *int        `json:"limit,omitempty"`
}
```

## Benefits

1. **Architectural Consistency**: Aligns with the requirement for semantic search capabilities
2. **Code Reuse**: Leverages existing, production-tested infrastructure
3. **Semantic Understanding**: Enables intelligent matching beyond keyword similarity
4. **Scalability**: Built on vector search optimized for large-scale similarity queries
5. **Feature-Rich**: Inherits analytics, rate limiting, auth, and privacy safeguards
6. **Maintainability**: Single source of truth for search logic

## Risks and Mitigations

### Risk 1: Search Service Dependency
- **Mitigation**: Discovery service already has fallback mechanisms for search service unavailability

### Risk 2: Performance with Large Friend Lists
- **Mitigation**: Current architecture supports up to 1,000 user IDs in filters, sufficient for most friend networks

### Risk 3: API Change Impact
- **Mitigation**: `friend_ids` parameter is optional, maintaining backward compatibility

## Monitoring and Success Metrics

- Search response times with friend filtering
- Friend-filtered query success rates  
- Semantic match quality vs. SQL ILIKE baseline
- API error rates and fallback frequency

## References

- Search Service OpenAPI: `/backend/search-svc/openapi.yaml`
- Current Implementation: `/backend/search-svc/internal/`
- Discovery Integration: `/backend/discovery-svc/internal/client/search_client.go`
- Vector Search Repository: `/backend/search-svc/internal/repository/search_repository.go`

---

## Decision Status

**APPROVED** - The existing search service provides all necessary capabilities and can be extended to support friend filtering with minimal changes while maintaining architectural consistency with semantic search requirements.
