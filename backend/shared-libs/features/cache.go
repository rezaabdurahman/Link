package features

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisFeatureCache implements FeatureCache using Redis
type RedisFeatureCache struct {
	client redis.UniversalClient
	prefix string
}

// NewRedisFeatureCache creates a new Redis-based feature cache
func NewRedisFeatureCache(client redis.UniversalClient, prefix string) *RedisFeatureCache {
	if prefix == "" {
		prefix = "features"
	}
	return &RedisFeatureCache{
		client: client,
		prefix: prefix,
	}
}

// Get retrieves a value from cache
func (c *RedisFeatureCache) Get(ctx context.Context, key string) ([]byte, error) {
	fullKey := c.buildKey(key)
	result, err := c.client.Get(ctx, fullKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("key not found")
		}
		return nil, fmt.Errorf("failed to get from cache: %w", err)
	}
	return []byte(result), nil
}

// Set stores a value in cache with TTL
func (c *RedisFeatureCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	fullKey := c.buildKey(key)
	err := c.client.Set(ctx, fullKey, value, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to set cache: %w", err)
	}
	return nil
}

// Delete removes a key from cache
func (c *RedisFeatureCache) Delete(ctx context.Context, key string) error {
	fullKey := c.buildKey(key)
	err := c.client.Del(ctx, fullKey).Err()
	if err != nil {
		return fmt.Errorf("failed to delete from cache: %w", err)
	}
	return nil
}

// DeletePattern removes all keys matching a pattern
func (c *RedisFeatureCache) DeletePattern(ctx context.Context, pattern string) error {
	fullPattern := c.buildKey(pattern)
	keys, err := c.client.Keys(ctx, fullPattern).Result()
	if err != nil {
		return fmt.Errorf("failed to get keys for pattern: %w", err)
	}

	if len(keys) > 0 {
		err = c.client.Del(ctx, keys...).Err()
		if err != nil {
			return fmt.Errorf("failed to delete keys: %w", err)
		}
	}

	return nil
}

// Exists checks if a key exists in cache
func (c *RedisFeatureCache) Exists(ctx context.Context, key string) (bool, error) {
	fullKey := c.buildKey(key)
	count, err := c.client.Exists(ctx, fullKey).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check existence: %w", err)
	}
	return count > 0, nil
}

func (c *RedisFeatureCache) buildKey(key string) string {
	return fmt.Sprintf("%s:%s", c.prefix, key)
}

// MemoryFeatureCache provides an in-memory cache for testing/development
type MemoryFeatureCache struct {
	data map[string]cacheItem
}

type cacheItem struct {
	value     []byte
	expiresAt time.Time
}

// NewMemoryFeatureCache creates a new in-memory feature cache
func NewMemoryFeatureCache() *MemoryFeatureCache {
	return &MemoryFeatureCache{
		data: make(map[string]cacheItem),
	}
}

// Get retrieves a value from memory cache
func (c *MemoryFeatureCache) Get(ctx context.Context, key string) ([]byte, error) {
	item, exists := c.data[key]
	if !exists {
		return nil, fmt.Errorf("key not found")
	}

	if time.Now().After(item.expiresAt) {
		delete(c.data, key)
		return nil, fmt.Errorf("key expired")
	}

	return item.value, nil
}

// Set stores a value in memory cache with TTL
func (c *MemoryFeatureCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	c.data[key] = cacheItem{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
	return nil
}

// Delete removes a key from memory cache
func (c *MemoryFeatureCache) Delete(ctx context.Context, key string) error {
	delete(c.data, key)
	return nil
}

// DeletePattern removes all keys matching a pattern (simplified implementation)
func (c *MemoryFeatureCache) DeletePattern(ctx context.Context, pattern string) error {
	// Simple implementation - remove exact matches
	// In a real implementation, you'd use proper pattern matching
	delete(c.data, pattern)
	return nil
}

// Exists checks if a key exists in memory cache
func (c *MemoryFeatureCache) Exists(ctx context.Context, key string) (bool, error) {
	_, exists := c.data[key]
	return exists, nil
}