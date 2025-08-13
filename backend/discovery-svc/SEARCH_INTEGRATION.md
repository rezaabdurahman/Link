# Discovery Service - Search Integration Implementation

This document describes the implementation of the search integration feature for the discovery service, as specified in Step 4 of the broader plan.

## Overview

The discovery service now supports semantic search ranking of available users through integration with the search-svc. This feature is controlled by a feature flag and includes graceful fallback behavior.

## New Endpoint

### `GET /api/v1/available-users/search?query=...`

**Purpose**: Search available users with optional semantic ranking

**Query Parameters**:
- `query` (required): Search query string (1-500 characters)
- `limit` (optional): Number of results to return (1-100, default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response Structure**:
```json
{
  "data": [
    {
      "user_id": "uuid",
      "is_available": true,
      "last_available_at": "2023-...",
      "search_score": 0.85,        // Only present when search is enabled
      "match_reasons": ["..."]     // Only present when search is enabled
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true,
    "total_pages": 2
  },
  "search_meta": {
    "query_processed": "processed query",
    "total_candidates": 100,
    "search_time_ms": 45,
    "search_enabled": true
  },
  "warnings": [
    "Search service temporarily unavailable. Returning unranked results."
  ]
}
```

## Implementation Details

### 1. Feature Flag Control

The search integration is controlled by the `SEARCH_ENABLED` environment variable:

- `SEARCH_ENABLED=false` (default): Returns unranked available users
- `SEARCH_ENABLED=true`: Enables semantic search ranking via search-svc

### 2. Search Flow

When search is enabled, the endpoint follows this flow:

1. **Get Available Users**: Retrieves list of currently available user IDs using existing logic
2. **POST to Search Service**: Sends `{query, ids}` to `search-svc /api/v1/search`
3. **Receive Ranked Results**: Gets back ranked user IDs with scores and match reasons
4. **Hydrate User Cards**: Combines search results with availability data (mock/in-memory data for now, later via user-svc)
5. **Return to Frontend**: Sends enhanced response with search metadata

### 3. Graceful Fallback

If the search service is down or unreachable:
- The system automatically falls back to returning unranked available users
- A warning message is included in the response
- The `search_enabled` flag in metadata is set to `false`
- No errors are returned to the client

## Files Modified/Created

### New Files
- `internal/client/search_client.go`: HTTP client for search-svc communication
- `.env.example`: Example environment configuration
- `SEARCH_INTEGRATION.md`: This documentation file

### Modified Files
- `internal/models/availability.go`: Added search-related models and DTOs
- `internal/service/availability_service.go`: Added search integration logic
- `internal/handlers/availability_handler.go`: Added search endpoint handler
- `main.go`: Added search client initialization and feature flag configuration

## Configuration

### Environment Variables

```bash
# Search Service Integration (Feature Flag)
SEARCH_ENABLED=false                    # Enable/disable search integration
SEARCH_SERVICE_URL=http://search-svc:8080  # Search service base URL
```

### Docker Compose Integration

The search integration can be enabled in different environments:

```yaml
# Development with search disabled (default)
discovery-svc:
  environment:
    - SEARCH_ENABLED=false

# Production with search enabled
discovery-svc:
  environment:
    - SEARCH_ENABLED=true
    - SEARCH_SERVICE_URL=http://search-svc:8080
```

## API Behavior Examples

### With Search Disabled
```bash
curl "http://localhost:8080/api/v1/available-users/search?query=developer"
```
Returns unranked available users with `search_enabled: false` in metadata.

### With Search Enabled and Service Available
```bash
curl "http://localhost:8080/api/v1/available-users/search?query=developer"
```
Returns semantically ranked users with search scores and match reasons.

### With Search Enabled but Service Down
```bash
curl "http://localhost:8080/api/v1/available-users/search?query=developer"
```
Returns unranked users with warning message about search service being unavailable.

## Testing

The implementation can be tested by:

1. **Compilation Test**: Run `GOWORK=off go build .` to verify code compiles
2. **Feature Flag Test**: Toggle `SEARCH_ENABLED` and verify different behaviors
3. **Fallback Test**: Disable search-svc and verify graceful degradation
4. **Integration Test**: Enable both services and verify ranked results

## Future Enhancements

1. **User Service Integration**: Replace mock availability data with actual user profile data from user-svc
2. **Caching**: Add Redis caching for frequently searched queries
3. **Analytics**: Track search query patterns and performance metrics
4. **Advanced Filtering**: Add location, skills, and other filters to search
