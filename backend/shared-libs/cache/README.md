# Link Cache System

A comprehensive, production-ready caching solution designed for the Link project with support for multiple cache providers and easy transition between them.

## 🌟 Features

- **Provider Agnostic**: Easy switching between Redis, Memcached, DynamoDB, and other providers
- **High Availability**: Built-in support for Redis Sentinel and clustering
- **Performance Monitoring**: Comprehensive metrics collection and Prometheus integration
- **HTTP Middleware**: Response caching with conditional headers and invalidation
- **Cache Warming**: Proactive cache population strategies
- **Service Integration**: Ready-to-use patterns for each Link microservice
- **Type Safety**: Full Go type safety with interface-based design

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
├─────────────────────────────────────────────────────────────┤
│                   Service Integrations                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  User Svc   │ │  Chat Svc   │ │Discovery Svc│           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│                    Cache Middleware                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │HTTP Caching │ │   Metrics   │ │Cache Warming│           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│                    Cache Interface                          │
│                    (Provider Agnostic)                      │
├─────────────────────────────────────────────────────────────┤
│                   Cache Providers                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │    Redis    │ │  Memcached  │ │  DynamoDB   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Basic Redis Cache

```go
package main

import (
    "context"
    "time"
    "your-project/backend/shared-libs/cache"
)

func main() {
    // Create Redis configuration
    config := cache.CreateDefaultRedisConfig([]string{"localhost:6379"})
    config.KeyPrefix = "myapp"
    config.DefaultTTL = 30 * time.Minute

    // Create cache instance
    cacheInstance, err := cache.NewCache(config)
    if err != nil {
        panic(err)
    }
    defer cacheInstance.Close()

    ctx := context.Background()

    // Basic operations
    err = cacheInstance.Set(ctx, "user:123", []byte(`{"name":"John"}`), time.Hour)
    if err != nil {
        panic(err)
    }

    data, err := cacheInstance.Get(ctx, "user:123")
    if err != nil {
        panic(err)
    }

    fmt.Printf("Retrieved: %s\n", data)
}
```

### Service Integration

```go
// Initialize cache for a service
cacheManager, err := cache.NewServiceCacheManager("user-svc")
if err != nil {
    return err
}

// Cache user profile
profile := UserProfile{ID: "123", Name: "John"}
err = cacheManager.User.SetProfile(ctx, "123", profile, 15*time.Minute)

// Retrieve with fallback
var cachedProfile UserProfile
err = cacheManager.User.GetProfile(ctx, "123", &cachedProfile)
if cache.IsCacheMiss(err) {
    // Fetch from database
    cachedProfile = fetchFromDB("123")
    cacheManager.User.SetProfile(ctx, "123", cachedProfile, 15*time.Minute)
}
```

## 📊 Monitoring & Metrics

### Prometheus Integration

```go
// Create monitored cache
monitoredCache := cache.NewMonitoredCache(cacheInstance, "user-svc")

// Export metrics
exporter := cache.NewPrometheusExporter()
exporter.RegisterCache("user-svc", monitoredCache)

// Serve metrics endpoint
http.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/plain")
    w.Write([]byte(exporter.ExportMetrics()))
})
```

### Available Metrics

- `cache_operations_total` - Total number of cache operations
- `cache_errors_total` - Total number of cache errors  
- `cache_error_rate` - Error rate per operation type
- `cache_latency_average_seconds` - Average latency per operation
- `cache_latency_p95_seconds` - 95th percentile latency
- `cache_latency_p99_seconds` - 99th percentile latency
- `cache_uptime_seconds` - Cache uptime

## 🌐 HTTP Middleware

### Basic Setup

```go
// Configure cache middleware
middlewareConfig := &cache.CacheMiddlewareConfig{
    Cache:      cacheInstance,
    DefaultTTL: 5 * time.Minute,
    KeyPrefix:  "http",
    CacheHeaders: true,
    SkipPaths: []string{"/admin", "/private"},
    VaryHeaders: []string{"Authorization"},
    ConditionalHeaders: true,
}

middleware := cache.NewCacheMiddleware(middlewareConfig)

// Apply to Gin router
router := gin.New()
router.Use(middleware.Handler)
```

### Cache Invalidation

```go
// Invalidate specific patterns
err := middleware.Invalidate(ctx, "user:*", "profile:*")

// Invalidate by path
err := middleware.InvalidateByPath(ctx, "/users/profile/123")

// Global invalidation (if middleware is set globally)
err := cache.InvalidateGlobal(ctx, "user:123:*")
```

## 🔥 Cache Warming

### Define Warming Strategy

```go
type UserProfileWarmingStrategy struct {
    userService UserService
}

func (s *UserProfileWarmingStrategy) Name() string {
    return "user_profiles"
}

func (s *UserProfileWarmingStrategy) ShouldWarm(ctx context.Context) (bool, error) {
    // Warm during business hours
    hour := time.Now().Hour()
    return hour >= 6 && hour <= 23, nil
}

func (s *UserProfileWarmingStrategy) GetKeys(ctx context.Context) ([]string, error) {
    userIDs, err := s.userService.GetActiveUserIDs(ctx)
    if err != nil {
        return nil, err
    }
    
    keys := make([]string, len(userIDs))
    for i, userID := range userIDs {
        keys[i] = fmt.Sprintf("user:profile:%s", userID)
    }
    return keys, nil
}

func (s *UserProfileWarmingStrategy) FetchData(ctx context.Context, key string) (interface{}, time.Duration, error) {
    userID := strings.TrimPrefix(key, "user:profile:")
    profile, err := s.userService.GetUserProfile(ctx, userID)
    return profile, 15 * time.Minute, err
}

func (s *UserProfileWarmingStrategy) Priority() int {
    return 100 // High priority
}
```

### Use Warming Strategy

```go
// Create warmer
warmer := cache.NewCacheWarmer(cacheInstance, nil)

// Register strategy
strategy := &UserProfileWarmingStrategy{userService: userSvc}
warmer.RegisterStrategy(strategy)

// Schedule automatic warming
warmer.Schedule("user_profiles", &cache.ScheduleConfig{
    Interval:  2 * time.Hour,
    StartTime: time.Now(),
    Enabled:   true,
})

// Start scheduler
warmer.StartScheduler(ctx)

// Manual warming
err := warmer.WarmNow(ctx, "user_profiles")
```

## ⚙️ Configuration

### Environment Variables

```bash
# Basic configuration
CACHE_PROVIDER=redis
CACHE_ENDPOINTS=localhost:6379
CACHE_PASSWORD=mypassword
CACHE_DATABASE=0
CACHE_KEY_PREFIX=myapp

# Pool settings
CACHE_POOL_SIZE=10
CACHE_MIN_IDLE_CONNS=5
CACHE_MAX_RETRIES=3

# Timeouts
CACHE_DIAL_TIMEOUT=5s
CACHE_READ_TIMEOUT=3s
CACHE_WRITE_TIMEOUT=3s
CACHE_DEFAULT_TTL=1h

# Redis Sentinel
CACHE_MASTER_NAME=mymaster
CACHE_SENTINEL_ADDRS=sentinel1:26379,sentinel2:26379,sentinel3:26379

# Service-specific (overrides global)
USER_CACHE_ENDPOINTS=redis-user:6379
USER_CACHE_KEY_PREFIX=user
CHAT_CACHE_ENDPOINTS=redis-chat:6379
DISCOVERY_CACHE_ENDPOINTS=redis-discovery:6379
```

### Programmatic Configuration

```go
// Redis Sentinel
config := cache.CreateSentinelConfig(
    []string{"sentinel1:26379", "sentinel2:26379"}, 
    "mymaster",
)

// Redis Cluster
config := cache.CreateClusterConfig(
    []string{"redis1:6379", "redis2:6379", "redis3:6379"},
)

// Memory cache (for testing)
config := cache.CreateMemoryConfig(100 * 1024 * 1024) // 100MB

// Custom configuration
config := &cache.CacheConfig{
    Provider:     cache.ProviderRedis,
    Endpoints:    []string{"redis:6379"},
    Password:     "secret",
    PoolSize:     20,
    DefaultTTL:   30 * time.Minute,
    KeyPrefix:    "myapp",
    TLSEnabled:   true,
    MetricsEnabled: true,
}
```

## 🔧 Service-Specific Integration

### User Service

```go
// Using cache manager
cacheManager, _ := cache.NewServiceCacheManager("user-svc")

// Cache user profile
profile := UserProfile{ID: "123", Name: "John"}
err := cacheManager.User.SetProfile(ctx, "123", profile, 15*time.Minute)

// Get with fallback
var user UserProfile
err = cacheManager.Helper.GetOrSet(ctx, "profile:123", &user, func() (interface{}, error) {
    return fetchUserFromDB("123")
}, 15*time.Minute)

// Invalidate user data
err = cacheManager.User.InvalidateUser(ctx, "123")
```

### Chat Service

```go
cacheManager, _ := cache.NewServiceCacheManager("chat-svc")

// Cache unread count
err := cacheManager.Chat.SetUnreadCount(ctx, "user123", 5, 10*time.Minute)

// Get unread count
count, err := cacheManager.Chat.GetUnreadCount(ctx, "user123")

// Invalidate conversation
err = cacheManager.Chat.InvalidateConversation(ctx, "conv123")
```

### Discovery Service

```go
cacheManager, _ := cache.NewServiceCacheManager("discovery-svc")

// Cache nearby users
nearbyUsers := []User{{ID: "456"}}
err := cacheManager.Discovery.SetNearbyUsers(ctx, "user123", 1000, nearbyUsers, 5*time.Minute)

// Get nearby users
var users []User
err = cacheManager.Discovery.GetNearbyUsers(ctx, "user123", 1000, &users)

// Invalidate location data
err = cacheManager.Discovery.InvalidateLocation(ctx, "user123")
```

## 🔄 Provider Migration

### Redis to AWS ElastiCache

```go
// Old configuration
oldConfig := &cache.CacheConfig{
    Provider:  cache.ProviderRedis,
    Endpoints: []string{"localhost:6379"},
}

// New configuration  
newConfig := &cache.CacheConfig{
    Provider:  cache.ProviderElastiCache,
    Endpoints: []string{"my-cluster.cache.amazonaws.com:6379"},
    TLSEnabled: true,
}

// No code changes needed - same interface!
cacheInstance, err := cache.NewCache(newConfig)
```

### Multi-tier Caching

```go
// L1: In-memory cache
l1Config := cache.CreateMemoryConfig(100 * 1024 * 1024)

// L2: Redis cache  
l2Config := cache.CreateDefaultRedisConfig([]string{"redis:6379"})

// Combined cache
multiTierCache, err := cache.NewMultiTierCache(l1Config, l2Config)
```

## 🧪 Testing

### Unit Tests

```go
func TestCacheOperations(t *testing.T) {
    // Use in-memory cache for testing
    config := cache.CreateMemoryConfig(1024 * 1024)
    cache, err := cache.NewCache(config)
    require.NoError(t, err)

    ctx := context.Background()
    
    // Test set/get
    err = cache.Set(ctx, "test", []byte("value"), time.Minute)
    require.NoError(t, err)
    
    data, err := cache.Get(ctx, "test")
    require.NoError(t, err)
    assert.Equal(t, []byte("value"), data)
}
```

### Integration Tests

```go
func TestServiceIntegration(t *testing.T) {
    // Start test Redis instance
    redis := startTestRedis(t)
    defer redis.Stop()

    // Test with real Redis
    config := cache.CreateDefaultRedisConfig([]string{redis.Addr()})
    cacheManager, err := cache.NewServiceCacheManager("test-svc")
    require.NoError(t, err)

    // Test operations
    // ...
}
```

## 🚨 Health Checking

```go
// Create health checker
healthChecker := cache.NewHealthChecker(cacheInstance)

// Perform health check
healthy, err := healthChecker.Check(ctx)
if !healthy {
    log.Printf("Cache health check failed: %v", err)
}

// Get last status
lastHealthy, lastChecked := healthChecker.GetLastStatus()
```

## 🔐 Security

### TLS Configuration

```go
config := &cache.CacheConfig{
    Provider:      cache.ProviderRedis,
    Endpoints:     []string{"redis:6379"},
    TLSEnabled:    true,
    TLSSkipVerify: false,
    CertFile:      "/path/to/cert.pem",
    KeyFile:       "/path/to/key.pem",
    CAFile:        "/path/to/ca.pem",
}
```

### Authentication

```go
config := &cache.CacheConfig{
    Provider:  cache.ProviderRedis,
    Endpoints: []string{"redis:6379"},
    Username:  "myuser",
    Password:  "mypassword",
}
```

## 📈 Performance Tuning

### Connection Pooling

```go
config := &cache.CacheConfig{
    PoolSize:     20,           // Total connections
    MinIdleConns: 10,           // Minimum idle connections
    MaxRetries:   3,            // Retry failed operations
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,
}
```

### Batch Operations

```go
// Use batch operations for better performance
items := map[string]cache.CacheItem{
    "key1": {Key: "key1", Value: []byte("value1"), TTL: time.Hour},
    "key2": {Key: "key2", Value: []byte("value2"), TTL: time.Hour},
}

err := cacheInstance.SetMulti(ctx, items)

results, err := cacheInstance.GetMulti(ctx, []string{"key1", "key2"})
```

### Pipeline Operations

```go
// Use pipelines for multiple operations
pipeline := cacheInstance.Pipeline()

cmd1 := pipeline.Get("key1")
cmd2 := pipeline.Set("key2", []byte("value2"), time.Hour)
cmd3 := pipeline.Delete("key3")

err := pipeline.Exec(ctx)

// Check individual results
if cmd1.Error == nil {
    fmt.Printf("key1 value: %s\n", cmd1.Result)
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Connection Timeouts**
   ```go
   config.DialTimeout = 10 * time.Second
   config.PoolTimeout = 5 * time.Second
   ```

2. **Memory Issues**
   ```bash
   # Check Redis memory usage
   redis-cli info memory
   
   # Set max memory policy
   redis-cli config set maxmemory-policy allkeys-lru
   ```

3. **Sentinel Failover**
   ```go
   config := cache.CreateSentinelConfig(
       []string{"sentinel1:26379", "sentinel2:26379", "sentinel3:26379"},
       "mymaster",
   )
   ```

### Debugging

```go
// Enable debug logging
config.LogLevel = "debug"

// Check cache stats
stats, err := cacheInstance.Stats(ctx)
fmt.Printf("Cache stats: %+v\n", stats)

// Monitor metrics
monitoredCache := cache.NewMonitoredCache(cacheInstance, "debug")
metrics := monitoredCache.GetMetrics()
fmt.Printf("Metrics: %+v\n", metrics)
```

## 🔗 Links

- [Redis Documentation](https://redis.io/documentation)
- [Go Redis Client](https://github.com/redis/go-redis)
- [Prometheus Metrics](https://prometheus.io/docs/guides/go-application/)
- [Link Project Architecture](../../../docs/architecture.md)

## 📄 License

This cache system is part of the Link project and follows the same licensing terms.