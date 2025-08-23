package cache

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCache implements CacheInterface for Redis
type RedisCache struct {
	client  redis.UniversalClient
	config  *CacheConfig
	stats   *cacheStats
	statsMu sync.RWMutex
}

// cacheStats tracks cache performance metrics
type cacheStats struct {
	hitCount      int64
	missCount     int64
	totalOps      int64
	errorCount    int64
	startTime     time.Time
	lastResetTime time.Time
}

// NewRedisCache creates a new Redis cache implementation
func NewRedisCache(config *CacheConfig) (*RedisCache, error) {
	var client redis.UniversalClient

	// Create appropriate Redis client based on configuration
	if len(config.SentinelAddrs) > 0 {
		// Redis Sentinel configuration
		client = redis.NewFailoverClient(&redis.FailoverOptions{
			MasterName:    config.MasterName,
			SentinelAddrs: config.SentinelAddrs,
			Password:      config.Password,
			DB:            config.Database,
			PoolSize:      config.PoolSize,
			MinIdleConns:  config.MinIdleConns,
			MaxRetries:    config.MaxRetries,
			DialTimeout:   config.DialTimeout,
			ReadTimeout:   config.ReadTimeout,
			WriteTimeout:  config.WriteTimeout,
			PoolTimeout:   config.PoolTimeout,
		})
	} else if len(config.Endpoints) > 1 {
		// Redis Cluster configuration
		client = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:        config.Endpoints,
			Password:     config.Password,
			PoolSize:     config.PoolSize,
			MinIdleConns: config.MinIdleConns,
			MaxRetries:   config.MaxRetries,
			DialTimeout:  config.DialTimeout,
			ReadTimeout:  config.ReadTimeout,
			WriteTimeout: config.WriteTimeout,
			PoolTimeout:  config.PoolTimeout,
		})
	} else {
		// Single Redis instance
		addr := "localhost:6379"
		if len(config.Endpoints) > 0 {
			addr = config.Endpoints[0]
		}
		client = redis.NewClient(&redis.Options{
			Addr:         addr,
			Username:     config.Username,
			Password:     config.Password,
			DB:           config.Database,
			PoolSize:     config.PoolSize,
			MinIdleConns: config.MinIdleConns,
			MaxRetries:   config.MaxRetries,
			DialTimeout:  config.DialTimeout,
			ReadTimeout:  config.ReadTimeout,
			WriteTimeout: config.WriteTimeout,
			PoolTimeout:  config.PoolTimeout,
		})
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, WrapCacheError(err, ErrorTypeConnection, "failed to connect to Redis")
	}

	now := time.Now()
	return &RedisCache{
		client: client,
		config: config,
		stats: &cacheStats{
			startTime:     now,
			lastResetTime: now,
		},
	}, nil
}

// Get retrieves a value from cache
func (rc *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)

	data, err := rc.client.Get(ctx, prefixedKey).Result()
	if err != nil {
		if err == redis.Nil {
			rc.trackMiss()
			return nil, ErrCacheMiss
		}
		rc.trackError()
		return nil, WrapCacheError(err, ErrorTypeInternal, "failed to get from cache")
	}

	rc.trackHit()
	return []byte(data), nil
}

// Set stores a value in cache with TTL
func (rc *RedisCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)

	// Use provided TTL or default
	expiration := ttl
	if expiration == 0 {
		expiration = rc.config.DefaultTTL
	}

	err := rc.client.Set(ctx, prefixedKey, value, expiration).Err()
	if err != nil {
		rc.trackError()
		return WrapCacheError(err, ErrorTypeInternal, "failed to set cache value")
	}

	return nil
}

// Delete removes a value from cache
func (rc *RedisCache) Delete(ctx context.Context, key string) error {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)
	err := rc.client.Del(ctx, prefixedKey).Err()
	if err != nil {
		rc.trackError()
		return WrapCacheError(err, ErrorTypeInternal, "failed to delete cache value")
	}

	return nil
}

// Exists checks if a key exists in cache
func (rc *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)
	count, err := rc.client.Exists(ctx, prefixedKey).Result()
	if err != nil {
		rc.trackError()
		return false, WrapCacheError(err, ErrorTypeInternal, "failed to check key existence")
	}

	return count > 0, nil
}

// GetMulti retrieves multiple values from cache
func (rc *RedisCache) GetMulti(ctx context.Context, keys []string) (map[string][]byte, error) {
	rc.trackOperation()

	if len(keys) == 0 {
		return make(map[string][]byte), nil
	}

	prefixedKeys := make([]string, len(keys))
	for i, key := range keys {
		prefixedKeys[i] = rc.buildKey(key)
	}

	values, err := rc.client.MGet(ctx, prefixedKeys...).Result()
	if err != nil {
		rc.trackError()
		return nil, WrapCacheError(err, ErrorTypeInternal, "failed to get multiple cache values")
	}

	result := make(map[string][]byte)
	for i, value := range values {
		if value != nil {
			if str, ok := value.(string); ok {
				result[keys[i]] = []byte(str)
				rc.trackHit()
			}
		} else {
			rc.trackMiss()
		}
	}

	return result, nil
}

// SetMulti stores multiple values in cache
func (rc *RedisCache) SetMulti(ctx context.Context, items map[string]CacheItem) error {
	rc.trackOperation()

	if len(items) == 0 {
		return nil
	}

	pipe := rc.client.Pipeline()
	for _, item := range items {
		prefixedKey := rc.buildKey(item.Key)
		ttl := item.TTL
		if ttl == 0 {
			ttl = rc.config.DefaultTTL
		}
		pipe.Set(ctx, prefixedKey, item.Value, ttl)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		rc.trackError()
		return WrapCacheError(err, ErrorTypeInternal, "failed to set multiple cache values")
	}

	return nil
}

// DeleteMulti removes multiple values from cache
func (rc *RedisCache) DeleteMulti(ctx context.Context, keys []string) error {
	rc.trackOperation()

	if len(keys) == 0 {
		return nil
	}

	prefixedKeys := make([]string, len(keys))
	for i, key := range keys {
		prefixedKeys[i] = rc.buildKey(key)
	}

	err := rc.client.Del(ctx, prefixedKeys...).Err()
	if err != nil {
		rc.trackError()
		return WrapCacheError(err, ErrorTypeInternal, "failed to delete multiple cache values")
	}

	return nil
}

// Increment increments a numeric value
func (rc *RedisCache) Increment(ctx context.Context, key string, delta int64) (int64, error) {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)
	result, err := rc.client.IncrBy(ctx, prefixedKey, delta).Result()
	if err != nil {
		rc.trackError()
		return 0, WrapCacheError(err, ErrorTypeInternal, "failed to increment cache value")
	}

	return result, nil
}

// Decrement decrements a numeric value
func (rc *RedisCache) Decrement(ctx context.Context, key string, delta int64) (int64, error) {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)
	result, err := rc.client.DecrBy(ctx, prefixedKey, delta).Result()
	if err != nil {
		rc.trackError()
		return 0, WrapCacheError(err, ErrorTypeInternal, "failed to decrement cache value")
	}

	return result, nil
}

// Expire sets TTL for an existing key
func (rc *RedisCache) Expire(ctx context.Context, key string, ttl time.Duration) error {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)
	err := rc.client.Expire(ctx, prefixedKey, ttl).Err()
	if err != nil {
		rc.trackError()
		return WrapCacheError(err, ErrorTypeInternal, "failed to set key expiration")
	}

	return nil
}

// TTL gets the remaining TTL for a key
func (rc *RedisCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	rc.trackOperation()

	prefixedKey := rc.buildKey(key)
	ttl, err := rc.client.TTL(ctx, prefixedKey).Result()
	if err != nil {
		rc.trackError()
		return 0, WrapCacheError(err, ErrorTypeInternal, "failed to get key TTL")
	}

	return ttl, nil
}

// Keys finds keys matching a pattern
func (rc *RedisCache) Keys(ctx context.Context, pattern string) ([]string, error) {
	rc.trackOperation()

	prefixedPattern := rc.buildKey(pattern)
	keys, err := rc.client.Keys(ctx, prefixedPattern).Result()
	if err != nil {
		rc.trackError()
		return nil, WrapCacheError(err, ErrorTypeInternal, "failed to find keys")
	}

	// Remove prefix from returned keys
	result := make([]string, len(keys))
	for i, key := range keys {
		result[i] = rc.removePrefix(key)
	}

	return result, nil
}

// Scan iterates over keys matching a pattern
func (rc *RedisCache) Scan(ctx context.Context, cursor uint64, pattern string, count int64) ([]string, uint64, error) {
	rc.trackOperation()

	prefixedPattern := rc.buildKey(pattern)
	keys, nextCursor, err := rc.client.Scan(ctx, cursor, prefixedPattern, count).Result()
	if err != nil {
		rc.trackError()
		return nil, 0, WrapCacheError(err, ErrorTypeInternal, "failed to scan keys")
	}

	// Remove prefix from returned keys
	result := make([]string, len(keys))
	for i, key := range keys {
		result[i] = rc.removePrefix(key)
	}

	return result, nextCursor, nil
}

// DeletePattern removes all keys matching a pattern
func (rc *RedisCache) DeletePattern(ctx context.Context, pattern string) error {
	rc.trackOperation()

	keys, err := rc.Keys(ctx, pattern)
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return rc.DeleteMulti(ctx, keys)
	}

	return nil
}

// Pipeline creates a new pipeline for batch operations
func (rc *RedisCache) Pipeline() CachePipeline {
	return &redisPipeline{
		pipe:  rc.client.Pipeline(),
		cache: rc,
		cmds:  make([]*PipelineCmd, 0),
	}
}

// Ping checks if the cache is accessible
func (rc *RedisCache) Ping(ctx context.Context) error {
	err := rc.client.Ping(ctx).Err()
	if err != nil {
		return WrapCacheError(err, ErrorTypeConnection, "cache ping failed")
	}
	return nil
}

// Stats returns cache statistics
func (rc *RedisCache) Stats(ctx context.Context) (*CacheStats, error) {
	rc.statsMu.RLock()
	stats := *rc.stats
	rc.statsMu.RUnlock()

	// Get Redis info
	info, err := rc.client.Info(ctx, "memory", "stats", "server").Result()
	if err != nil {
		return nil, WrapCacheError(err, ErrorTypeInternal, "failed to get cache stats")
	}

	// Parse Redis info
	memStats, connStats, opStats := rc.parseRedisInfo(info)

	now := time.Now()
	uptime := now.Sub(stats.startTime)
	totalOps := atomic.LoadInt64(&stats.totalOps)
	hitCount := atomic.LoadInt64(&stats.hitCount)
	missCount := atomic.LoadInt64(&stats.missCount)

	var hitRate float64
	if totalOps > 0 {
		hitRate = float64(hitCount) / float64(totalOps)
	}

	return &CacheStats{
		Provider:      ProviderRedis,
		Connected:     true,
		Uptime:        uptime,
		HitCount:      hitCount,
		MissCount:     missCount,
		HitRate:       hitRate,
		Memory:        memStats,
		Connections:   connStats,
		Operations:    opStats,
		LastResetTime: stats.lastResetTime,
	}, nil
}

// Close closes the cache connection
func (rc *RedisCache) Close() error {
	return rc.client.Close()
}

// Helper methods

func (rc *RedisCache) buildKey(key string) string {
	if rc.config.KeyPrefix != "" {
		return fmt.Sprintf("%s:%s", rc.config.KeyPrefix, key)
	}
	return key
}

func (rc *RedisCache) removePrefix(key string) string {
	if rc.config.KeyPrefix != "" {
		prefix := rc.config.KeyPrefix + ":"
		if strings.HasPrefix(key, prefix) {
			return strings.TrimPrefix(key, prefix)
		}
	}
	return key
}

func (rc *RedisCache) trackOperation() {
	atomic.AddInt64(&rc.stats.totalOps, 1)
}

func (rc *RedisCache) trackHit() {
	atomic.AddInt64(&rc.stats.hitCount, 1)
}

func (rc *RedisCache) trackMiss() {
	atomic.AddInt64(&rc.stats.missCount, 1)
}

func (rc *RedisCache) trackError() {
	atomic.AddInt64(&rc.stats.errorCount, 1)
}

func (rc *RedisCache) parseRedisInfo(info string) (*MemoryStats, *ConnectionStats, *OperationStats) {
	lines := strings.Split(info, "\r\n")

	memStats := &MemoryStats{}
	connStats := &ConnectionStats{}
	opStats := &OperationStats{}

	for _, line := range lines {
		if strings.Contains(line, ":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key, value := parts[0], parts[1]

				switch key {
				case "used_memory":
					if val, err := strconv.ParseInt(value, 10, 64); err == nil {
						memStats.UsedBytes = val
					}
				case "maxmemory":
					if val, err := strconv.ParseInt(value, 10, 64); err == nil {
						memStats.MaxBytes = val
					}
				case "evicted_keys":
					if val, err := strconv.ParseInt(value, 10, 64); err == nil {
						memStats.EvictedKeys = val
					}
				case "connected_clients":
					if val, err := strconv.Atoi(value); err == nil {
						connStats.ActiveConns = val
					}
				case "total_commands_processed":
					if val, err := strconv.ParseInt(value, 10, 64); err == nil {
						opStats.TotalOps = val
					}
				}
			}
		}
	}

	// Calculate percentages
	if memStats.MaxBytes > 0 {
		memStats.UsagePercent = float64(memStats.UsedBytes) / float64(memStats.MaxBytes) * 100
	}

	return memStats, connStats, opStats
}

// redisPipeline implements CachePipeline for Redis
type redisPipeline struct {
	pipe  redis.Pipeliner
	cache *RedisCache
	cmds  []*PipelineCmd
}

func (rp *redisPipeline) Get(key string) *PipelineCmd {
	cmd := &PipelineCmd{Key: key}
	rp.cmds = append(rp.cmds, cmd)

	prefixedKey := rp.cache.buildKey(key)
	rp.pipe.Get(context.Background(), prefixedKey)

	return cmd
}

func (rp *redisPipeline) Set(key string, value []byte, ttl time.Duration) *PipelineCmd {
	cmd := &PipelineCmd{Key: key}
	rp.cmds = append(rp.cmds, cmd)

	prefixedKey := rp.cache.buildKey(key)
	if ttl == 0 {
		ttl = rp.cache.config.DefaultTTL
	}
	rp.pipe.Set(context.Background(), prefixedKey, value, ttl)

	return cmd
}

func (rp *redisPipeline) Delete(key string) *PipelineCmd {
	cmd := &PipelineCmd{Key: key}
	rp.cmds = append(rp.cmds, cmd)

	prefixedKey := rp.cache.buildKey(key)
	rp.pipe.Del(context.Background(), prefixedKey)

	return cmd
}

func (rp *redisPipeline) Increment(key string, delta int64) *PipelineCmd {
	cmd := &PipelineCmd{Key: key}
	rp.cmds = append(rp.cmds, cmd)

	prefixedKey := rp.cache.buildKey(key)
	rp.pipe.IncrBy(context.Background(), prefixedKey, delta)

	return cmd
}

func (rp *redisPipeline) Exec(ctx context.Context) error {
	redisCmds, err := rp.pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return WrapCacheError(err, ErrorTypeInternal, "pipeline execution failed")
	}

	// Process results
	for i, redisCmd := range redisCmds {
		if i < len(rp.cmds) {
			cmd := rp.cmds[i]
			if redisCmd.Err() != nil && redisCmd.Err() != redis.Nil {
				cmd.Error = redisCmd.Err()
			} else {
				// Extract result based on command type
				switch c := redisCmd.(type) {
				case *redis.StringCmd:
					if c.Err() == nil {
						cmd.Result = []byte(c.Val())
					}
				case *redis.IntCmd:
					if c.Err() == nil {
						cmd.Result = []byte(fmt.Sprintf("%d", c.Val()))
					}
				}
			}
		}
	}

	return nil
}

func (rp *redisPipeline) Discard() {
	rp.pipe.Discard()
	rp.cmds = nil
}
