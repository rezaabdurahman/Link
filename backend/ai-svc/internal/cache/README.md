# Cache Package

The `internal/cache` package provides a Redis-based caching layer for summary data with TTL (Time To Live) configuration.

## Features

- **Redis Integration**: Built on go-redis v9 for high-performance caching
- **TTL Configuration**: Configurable cache expiration via `SUMMARY_TTL` environment variable (default: 1 hour)
- **Summary Management**: Store and retrieve AI-generated summaries with metadata
- **Conversation-based Invalidation**: Remove all summaries for a specific conversation
- **Multiple Implementations**: Redis-based (production) and Memory-based (testing/development)
- **Health Monitoring**: Built-in health checks for cache connectivity
- **Structured Logging**: Comprehensive logging with zerolog

## Configuration

### Environment Variables

- `SUMMARY_TTL`: Cache TTL duration (default: `1h`)
  - Examples: `30m`, `2h`, `3600s`
- `REDIS_HOST`: Redis server host (default: `localhost`)
- `REDIS_PORT`: Redis server port (default: `6379`)
- `REDIS_PASSWORD`: Redis password (optional)
- `REDIS_DB`: Redis database number (default: `1`)

### Example Configuration

```bash
export SUMMARY_TTL=2h
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=1
```

## Usage

### Basic Usage

```go
package main

import (
    "context"
    "time"
    
    "github.com/google/uuid"
    "github.com/rs/zerolog"
    
    "github.com/link-app/ai-svc/internal/cache"
    "github.com/link-app/ai-svc/internal/config"
)

func main() {
    // Load configuration
    cfg, _ := config.Load()
    logger := zerolog.New(os.Stdout)
    
    // Create Redis cache
    summaryCache, err := cache.NewRedisSummaryCache(cfg, logger)
    if err != nil {
        log.Fatal(err)
    }
    defer summaryCache.Close()
    
    ctx := context.Background()
    
    // Create a summary
    summary := &cache.Summary{
        ID:             uuid.New().String(),
        ConversationID: uuid.New(),
        Content:        "This is a cached summary",
        Metadata: map[string]interface{}{
            "model": "gpt-4",
            "tokens": 150,
        },
        CreatedAt: time.Now(),
    }
    
    // Store in cache
    key := "conversation-123:summary-456"
    err = summaryCache.SetSummary(ctx, key, summary)
    if err != nil {
        log.Fatal(err)
    }
    
    // Retrieve from cache
    cached, err := summaryCache.GetSummary(ctx, key)
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("Retrieved: %s\n", cached.Content)
}
```

### Using the Factory

```go
// Create cache based on type
cache, err := cache.NewSummaryCache(cache.CacheTypeRedis, cfg, logger)
if err != nil {
    return err
}

// Or specifically Redis cache
cache, err := cache.NewRedisSummaryCache(cfg, logger)
if err != nil {
    return err
}
```

### Key Building

```go
// Use the key builder for consistent key generation
kb := cache.NewKeyBuilder()

// Build keys for different use cases
summaryKey := kb.BuildSummaryKey(conversationID, requestID)
conversationKey := kb.BuildConversationSummaryKey(conversationID)
userKey := kb.BuildUserSummaryKey(userID, conversationID)
```

### Invalidation

```go
// Invalidate all summaries for a conversation
err := summaryCache.InvalidateByConversation(ctx, conversationID)
if err != nil {
    log.Printf("Failed to invalidate cache: %v", err)
}
```

## Interface

```go
type SummaryCache interface {
    // GetSummary retrieves a cached summary by key
    GetSummary(ctx context.Context, key string) (*Summary, error)
    
    // SetSummary stores a summary in cache with TTL
    SetSummary(ctx context.Context, key string, summary *Summary) error
    
    // InvalidateByConversation removes all summaries related to a conversation
    InvalidateByConversation(ctx context.Context, conversationID uuid.UUID) error
    
    // Health checks the health of the cache
    Health(ctx context.Context) error
    
    // Close closes the cache connection
    Close() error
}
```

## Data Structure

```go
type Summary struct {
    ID             string                 `json:"id"`
    ConversationID uuid.UUID              `json:"conversation_id"`
    Content        string                 `json:"content"`
    Metadata       map[string]interface{} `json:"metadata,omitempty"`
    CreatedAt      time.Time              `json:"created_at"`
    ExpiresAt      time.Time              `json:"expires_at"`
}
```

## Error Handling

The package provides specific error types for better error handling:

```go
// Check for cache miss
cached, err := summaryCache.GetSummary(ctx, key)
if err != nil {
    var cacheErr *cache.CacheError
    if errors.As(err, &cacheErr) {
        if errors.Is(cacheErr.Err, cache.ErrNotFound) {
            // Handle cache miss
            log.Println("Summary not found in cache")
        }
    }
}
```

## Implementations

### Redis Cache (`RedisCache`)
- Production-ready implementation
- Uses go-redis v9 client
- Supports clustering and failover
- Connection pooling and retry logic
- Persistent storage with TTL

### Memory Cache (`MemoryCache`)
- In-memory implementation for testing
- No external dependencies
- Automatic cleanup of expired entries
- Thread-safe with RWMutex

## Testing

Run the cache tests:

```bash
go test -v ./internal/cache
```

The test suite includes:
- Basic CRUD operations
- TTL and expiration behavior
- Conversation-based invalidation
- Key building utilities
- Health checks

## Cache Key Patterns

The cache uses consistent key patterns:

- **Summary Keys**: `summary:{user_key}` where `{user_key}` is provided by the caller
- **Conversation Index**: `conversation_summaries:{conversation_id}` - tracks all summaries for a conversation

## Performance Considerations

- **Connection Pooling**: Redis client uses connection pooling (default: 10 connections)
- **Pipelining**: Bulk operations use Redis pipelining when possible
- **Memory Management**: Memory cache includes automatic cleanup of expired entries
- **Indexing**: Conversation-based indexing for efficient invalidation

## Health Monitoring

The cache supports health checks for monitoring:

```go
// Check cache health
err := summaryCache.Health(ctx)
if err != nil {
    log.Printf("Cache health check failed: %v", err)
}
```

## Integration

The cache integrates with the existing service architecture:

1. **Configuration**: Uses the existing config package
2. **Logging**: Structured logging with zerolog
3. **Context**: Full context support for timeouts and cancellation
4. **Error Handling**: Consistent error patterns with the rest of the application
