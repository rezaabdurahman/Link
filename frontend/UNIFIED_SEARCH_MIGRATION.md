# Unified Search Migration Guide

This guide documents the migration from separate search endpoints to a unified search API at `/api/v1/search`.

## 🎯 Overview

We've consolidated multiple search endpoints into a single, powerful unified search API that provides:

- **Consistent search experience** across friends and discovery
- **Advanced filtering capabilities** with semantic search
- **Better error handling** and deprecation warnings
- **Enhanced metadata** including search performance metrics
- **Backward compatibility** during the migration period

## 📊 Endpoint Changes

### NEW: Unified Search Endpoint

```typescript
POST /api/v1/search
{
  "query": "find me a tall guy with blue eyes",
  "scope": "friends" | "discovery" | "all",
  "filters": {
    "distance": 10,
    "interests": ["hiking", "photography"],
    "available_only": true,
    "friends_only": true,
    "age_range": { "min": 25, "max": 35 },
    "location": { "lat": 37.7749, "lng": -122.4194, "radius": 25 }
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "page": 1
  }
}
```

**Response:**
```typescript
{
  "users": [{ /* User objects */ }],
  "total": 42,
  "hasMore": true,
  "scope": "friends",
  "query": "find me a tall guy with blue eyes",
  "filters": {
    "maxDistance": 50,
    "availableInterests": ["technology", "sports", "music"],
    "appliedFilters": { /* Applied filters */ }
  },
  "metadata": {
    "searchTime": 85,
    "source": "semantic_search",
    "relevanceScores": { "user-123": 0.95, "user-456": 0.87 }
  }
}
```

### DEPRECATED: Legacy Endpoints

| Legacy Endpoint | New Equivalent | Sunset Date |
|---|---|---|
| `GET /api/v1/users/friends/search` | `POST /api/v1/search` with `scope: "friends"` | 2025-12-31 |
| `GET /discovery/available-users/search` | `POST /api/v1/search` with `scope: "discovery"` | 2025-12-31 |
| `GET /users/search` | `POST /api/v1/search` with `scope: "all"` | **UNUSED** |

## 🔧 Frontend Implementation

### New Unified Client

```typescript
// src/services/unifiedSearchClient.ts
import { unifiedSearch, UnifiedSearchRequest } from './unifiedSearchClient';

const searchRequest: UnifiedSearchRequest = {
  query: "volleyball enthusiasts",
  scope: 'discovery',
  filters: {
    distance: 10,
    interests: ['sports', 'volleyball'],
    available_only: true
  },
  pagination: { limit: 50 }
};

const results = await unifiedSearch(searchRequest);
```

### Migration in Components

#### DiscoveryPage.tsx
- **Before:** Used `searchAvailableUsers()` from `searchClient.ts`
- **After:** Uses `unifiedSearch()` with `scope: 'discovery'`
- **Benefits:** Better semantic search, enhanced metadata, more flexible filters

#### ChatPage.tsx  
- **Before:** Used `searchFriends()` from `userClient.ts`
- **After:** Uses `unifiedSearch()` with `scope: 'friends'`
- **Benefits:** Consistent search experience, fallback to legacy on errors

### Backward Compatibility

The implementation includes automatic fallback mechanisms:

```typescript
try {
  // Try unified search first
  const response = await unifiedSearch(request);
  return response.users;
} catch (error) {
  if (isUnifiedSearchError(error)) {
    console.warn('Unified search failed, falling back to legacy');
    // Fallback to legacy search
    const response = await searchAvailableUsers(legacyRequest);
    return response.users;
  }
  throw error;
}
```

## 🚨 Deprecation Warnings

Legacy endpoints now return deprecation headers:

```http
X-Deprecation-Warning: This endpoint is deprecated. Please use POST /api/v1/search instead.
X-Deprecation-Sunset: 2025-12-31
```

And include warnings in response bodies:

```json
{
  "users": [...],
  "deprecationWarning": "This endpoint is deprecated. Please use POST /api/v1/search with scope: 'discovery' instead."
}
```

## 🎛️ Feature Comparison

| Feature | Legacy Friends Search | Legacy Discovery Search | Unified Search |
|---|---|---|---|
| Semantic Query | ❌ | ✅ | ✅ |
| Distance Filtering | ❌ | ✅ | ✅ |
| Interest Filtering | ❌ | ✅ | ✅ |
| Age Range Filtering | ❌ | ❌ | ✅ |
| Availability Filtering | ❌ | ✅ | ✅ |
| Performance Metrics | ❌ | ❌ | ✅ |
| Relevance Scores | ❌ | ❌ | ✅ |
| Multiple Scopes | ❌ | ❌ | ✅ |

## 🔍 Search Scopes

### `scope: "friends"`
- Searches within user's existing friends only
- Ideal for finding friends to chat with
- Used in ChatPage for conversation initiation

### `scope: "discovery"`  
- Searches available users for new connections
- Filters by availability status automatically
- Used in DiscoveryPage for meeting new people

### `scope: "all"`
- Searches across all users (friends + discoverable)
- Most comprehensive but requires proper filtering
- Useful for global search features

## 🚀 Performance Improvements

- **Semantic Search:** Better understanding of natural language queries
- **Unified Backend:** Single search service handles all queries
- **Caching:** Improved caching across different search types
- **Metrics:** Real-time performance monitoring and optimization

## 📝 Error Handling

```typescript
import { 
  isUnifiedSearchError, 
  getUnifiedSearchErrorMessage 
} from './unifiedSearchClient';

try {
  const results = await unifiedSearch(request);
} catch (error) {
  if (isUnifiedSearchError(error)) {
    const message = getUnifiedSearchErrorMessage(error);
    // Handle specific unified search errors
  } else {
    // Handle other errors
  }
}
```

## 📅 Migration Timeline

- **Phase 1 (Current):** Unified search implemented with legacy fallbacks
- **Phase 2 (Q2 2025):** Begin showing deprecation warnings in UI  
- **Phase 3 (Q3 2025):** Start redirecting legacy calls to unified endpoint
- **Phase 4 (Q4 2025):** Remove legacy endpoints entirely

## 🧪 Testing

Run the following tests to verify the migration:

```bash
# Test unified search functionality
npm run test -- --testNamePattern="unified.*search"

# Test legacy endpoint deprecation warnings
npm run test -- --testNamePattern="deprecation"

# Test fallback mechanisms
npm run test -- --testNamePattern="fallback"
```

## 🔧 Development

### Mock Handlers Updated
- Added `/api/v1/search` endpoint to MSW handlers
- Added deprecation warnings to legacy endpoints
- Maintained backward compatibility in development

### Console Warnings
During development, you'll see deprecation warnings:
```
DEPRECATION WARNING: searchFriendsUnified is deprecated. Use unifiedSearch with scope: "friends" instead.
```

## 📚 Additional Resources

- [Unified Search Client Documentation](./src/services/unifiedSearchClient.ts)
- [Mock Handlers](./src/mocks/handlers.ts)
- [Component Migration Examples](./src/pages/)

## 🤝 Contributing

When adding new search functionality:

1. ✅ **DO:** Use the unified search client
2. ✅ **DO:** Add proper error handling
3. ✅ **DO:** Include relevant filters and scope
4. ❌ **DON'T:** Use deprecated legacy endpoints
5. ❌ **DON'T:** Create new search endpoints without consultation

---

**Questions?** Check the console logs for deprecation warnings and metadata, or review the unified search client implementation.
