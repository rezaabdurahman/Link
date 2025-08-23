package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Legacy CacheService for backward compatibility
// Deprecated: Use CacheInterface implementations instead
type CacheService struct {
	client     *redis.Client
	defaultTTL time.Duration
	keyPrefix  string
	ctx        context.Context
}

// Legacy CacheConfig for backward compatibility
// Deprecated: Use CacheConfig from interface.go instead
type LegacyCacheConfig struct {
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int
	DefaultTTL    time.Duration
	KeyPrefix     string
}

// NewCacheService creates a legacy cache service for backward compatibility
// Deprecated: Use NewRedisCache instead
func NewCacheService(config *LegacyCacheConfig) (*CacheService, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", config.RedisHost, config.RedisPort),
		Password: config.RedisPassword,
		DB:       config.RedisDB,
	})

	// Test connection
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &CacheService{
		client:     rdb,
		defaultTTL: config.DefaultTTL,
		keyPrefix:  config.KeyPrefix,
		ctx:        ctx,
	}, nil
}

// Set stores a value in cache with optional TTL
func (cs *CacheService) Set(key string, value interface{}, ttl ...time.Duration) error {
	prefixedKey := cs.buildKey(key)

	// Use provided TTL or default
	expiration := cs.defaultTTL
	if len(ttl) > 0 {
		expiration = ttl[0]
	}

	// Serialize value to JSON
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	return cs.client.Set(cs.ctx, prefixedKey, data, expiration).Err()
}

// Get retrieves a value from cache
func (cs *CacheService) Get(key string, dest interface{}) error {
	prefixedKey := cs.buildKey(key)

	data, err := cs.client.Get(cs.ctx, prefixedKey).Result()
	if err != nil {
		if err == redis.Nil {
			return LegacyErrCacheMiss
		}
		return fmt.Errorf("failed to get from cache: %w", err)
	}

	// Deserialize JSON data
	if err := json.Unmarshal([]byte(data), dest); err != nil {
		return fmt.Errorf("failed to unmarshal cached value: %w", err)
	}

	return nil
}

// GetOrSet retrieves a value from cache, or sets it using the provided function if not found
func (cs *CacheService) GetOrSet(key string, dest interface{}, fetcher func() (interface{}, error), ttl ...time.Duration) error {
	// Try to get from cache first
	if err := cs.Get(key, dest); err == nil {
		return nil // Cache hit
	} else if err != LegacyErrCacheMiss {
		// Log error but continue to fetch from source
		fmt.Printf("Cache error for key %s: %v\n", key, err)
	}

	// Cache miss - fetch from source
	value, err := fetcher()
	if err != nil {
		return fmt.Errorf("failed to fetch value: %w", err)
	}

	// Store in cache (don't fail the request if caching fails)
	if err := cs.Set(key, value, ttl...); err != nil {
		fmt.Printf("Failed to cache value for key %s: %v\n", key, err)
	}

	// Copy the fetched value to destination
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal fetched value: %w", err)
	}

	return json.Unmarshal(data, dest)
}

// Delete removes a value from cache
func (cs *CacheService) Delete(key string) error {
	prefixedKey := cs.buildKey(key)
	return cs.client.Del(cs.ctx, prefixedKey).Err()
}

// Exists checks if a key exists in cache
func (cs *CacheService) Exists(key string) (bool, error) {
	prefixedKey := cs.buildKey(key)
	count, err := cs.client.Exists(cs.ctx, prefixedKey).Result()
	return count > 0, err
}

// Expire sets TTL for an existing key
func (cs *CacheService) Expire(key string, ttl time.Duration) error {
	prefixedKey := cs.buildKey(key)
	return cs.client.Expire(cs.ctx, prefixedKey, ttl).Err()
}

// Invalidate removes all keys matching a pattern
func (cs *CacheService) Invalidate(pattern string) error {
	prefixedPattern := cs.buildKey(pattern)

	keys, err := cs.client.Keys(cs.ctx, prefixedPattern).Result()
	if err != nil {
		return fmt.Errorf("failed to find keys for pattern %s: %w", prefixedPattern, err)
	}

	if len(keys) > 0 {
		return cs.client.Del(cs.ctx, keys...).Err()
	}

	return nil
}

// GetStats returns cache statistics
func (cs *CacheService) GetStats() (map[string]interface{}, error) {
	info, err := cs.client.Info(cs.ctx, "memory", "stats").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get Redis stats: %w", err)
	}

	// Parse basic info (simplified)
	stats := map[string]interface{}{
		"connected":   true,
		"info":        info,
		"key_prefix":  cs.keyPrefix,
		"default_ttl": cs.defaultTTL.String(),
	}

	return stats, nil
}

// Close closes the Redis connection
func (cs *CacheService) Close() error {
	return cs.client.Close()
}

// buildKey creates a prefixed cache key
func (cs *CacheService) buildKey(key string) string {
	if cs.keyPrefix != "" {
		return fmt.Sprintf("%s:%s", cs.keyPrefix, key)
	}
	return key
}

// Cache key constants
const (
	UserProfileKey = "user:profile:%s"
	UserSessionKey = "user:session:%s"
	UserPrefsKey   = "user:prefs:%s"
	LocationKey    = "location:user:%s"
	DiscoveryKey   = "discovery:available:%s"
)

// LegacyErrCacheMiss for backward compatibility
var (
	LegacyErrCacheMiss = fmt.Errorf("cache miss")
)

// Helper functions for common cache operations

// CacheUserProfile caches a user profile
func (cs *CacheService) CacheUserProfile(userID string, profile interface{}) error {
	key := fmt.Sprintf(UserProfileKey, userID)
	return cs.Set(key, profile, 15*time.Minute) // Cache for 15 minutes
}

// GetUserProfile retrieves a cached user profile
func (cs *CacheService) GetUserProfile(userID string, dest interface{}) error {
	key := fmt.Sprintf(UserProfileKey, userID)
	return cs.Get(key, dest)
}

// CacheUserSession caches a user session
func (cs *CacheService) CacheUserSession(sessionID string, session interface{}) error {
	key := fmt.Sprintf(UserSessionKey, sessionID)
	return cs.Set(key, session, 24*time.Hour) // Cache for 24 hours
}

// GetUserSession retrieves a cached user session
func (cs *CacheService) GetUserSession(sessionID string, dest interface{}) error {
	key := fmt.Sprintf(UserSessionKey, sessionID)
	return cs.Get(key, dest)
}

// InvalidateUserCache removes all cached data for a user
func (cs *CacheService) InvalidateUserCache(userID string) error {
	patterns := []string{
		fmt.Sprintf(UserProfileKey, userID),
		fmt.Sprintf(UserPrefsKey, userID),
		fmt.Sprintf(LocationKey, userID),
		fmt.Sprintf(DiscoveryKey, userID),
	}

	for _, pattern := range patterns {
		if err := cs.Delete(pattern); err != nil {
			fmt.Printf("Warning: Failed to invalidate cache for pattern %s: %v\n", pattern, err)
		}
	}

	return nil
}
