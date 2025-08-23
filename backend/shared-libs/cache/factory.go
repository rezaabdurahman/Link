package cache

import (
	"fmt"
	"time"
)

// NewCache creates a cache instance based on the provider configuration
func NewCache(config *CacheConfig) (CacheInterface, error) {
	// Set defaults if not provided
	if config.PoolSize == 0 {
		config.PoolSize = 10
	}
	if config.MinIdleConns == 0 {
		config.MinIdleConns = 5
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.DialTimeout == 0 {
		config.DialTimeout = 5 * time.Second
	}
	if config.ReadTimeout == 0 {
		config.ReadTimeout = 3 * time.Second
	}
	if config.WriteTimeout == 0 {
		config.WriteTimeout = 3 * time.Second
	}
	if config.PoolTimeout == 0 {
		config.PoolTimeout = 4 * time.Second
	}
	if config.DefaultTTL == 0 {
		config.DefaultTTL = 1 * time.Hour
	}

	switch config.Provider {
	case ProviderRedis:
		return NewRedisCache(config)
	case ProviderMemcached:
		return NewMemcachedCache(config)
	case ProviderMemory:
		return NewMemoryCache(config)
	case ProviderDynamoDB:
		return NewDynamoDBCache(config)
	case ProviderElastiCache:
		// ElastiCache is essentially Redis/Memcached on AWS
		return NewRedisCache(config)
	case ProviderCloudflare:
		return NewCloudflareCache(config)
	default:
		return nil, fmt.Errorf("unsupported cache provider: %s", config.Provider)
	}
}

// NewCacheFromEnv creates a cache instance from environment variables
func NewCacheFromEnv() (CacheInterface, error) {
	config, err := LoadConfigFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to load cache config from environment: %w", err)
	}

	return NewCache(config)
}

// NewMultiTierCache creates a multi-tier cache with L1 (memory) and L2 (Redis/external)
func NewMultiTierCache(l1Config, l2Config *CacheConfig) (CacheInterface, error) {
	l1Cache, err := NewCache(l1Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create L1 cache: %w", err)
	}

	l2Cache, err := NewCache(l2Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create L2 cache: %w", err)
	}

	return NewMultiTierCacheImpl(l1Cache, l2Cache), nil
}

// CreateDefaultRedisConfig creates a default Redis configuration
func CreateDefaultRedisConfig(endpoints []string) *CacheConfig {
	return &CacheConfig{
		Provider:       ProviderRedis,
		Endpoints:      endpoints,
		PoolSize:       10,
		MinIdleConns:   5,
		MaxRetries:     3,
		DialTimeout:    5 * time.Second,
		ReadTimeout:    3 * time.Second,
		WriteTimeout:   3 * time.Second,
		PoolTimeout:    4 * time.Second,
		DefaultTTL:     1 * time.Hour,
		MetricsEnabled: true,
		LogLevel:       "info",
	}
}

// CreateSentinelConfig creates a Redis Sentinel configuration
func CreateSentinelConfig(sentinelAddrs []string, masterName string) *CacheConfig {
	return &CacheConfig{
		Provider:       ProviderRedis,
		SentinelAddrs:  sentinelAddrs,
		MasterName:     masterName,
		PoolSize:       10,
		MinIdleConns:   5,
		MaxRetries:     3,
		DialTimeout:    5 * time.Second,
		ReadTimeout:    3 * time.Second,
		WriteTimeout:   3 * time.Second,
		PoolTimeout:    4 * time.Second,
		DefaultTTL:     1 * time.Hour,
		MetricsEnabled: true,
		LogLevel:       "info",
	}
}

// CreateMemoryConfig creates an in-memory cache configuration
func CreateMemoryConfig(maxSize int64) *CacheConfig {
	return &CacheConfig{
		Provider:       ProviderMemory,
		DefaultTTL:     1 * time.Hour,
		MetricsEnabled: true,
		LogLevel:       "info",
		// MaxSize would be stored in a custom field or handled by the memory implementation
	}
}

// CreateClusterConfig creates a Redis Cluster configuration
func CreateClusterConfig(endpoints []string) *CacheConfig {
	return &CacheConfig{
		Provider:       ProviderRedis,
		Endpoints:      endpoints,
		PoolSize:       20, // Higher for cluster
		MinIdleConns:   10,
		MaxRetries:     5,
		DialTimeout:    5 * time.Second,
		ReadTimeout:    3 * time.Second,
		WriteTimeout:   3 * time.Second,
		PoolTimeout:    4 * time.Second,
		DefaultTTL:     1 * time.Hour,
		MetricsEnabled: true,
		LogLevel:       "info",
	}
}

// Placeholder implementations for other providers (would need actual implementations)

func NewMemcachedCache(config *CacheConfig) (CacheInterface, error) {
	return nil, fmt.Errorf("memcached implementation not yet available")
}

func NewMemoryCache(config *CacheConfig) (CacheInterface, error) {
	return nil, fmt.Errorf("memory cache implementation not yet available")
}

func NewDynamoDBCache(config *CacheConfig) (CacheInterface, error) {
	return nil, fmt.Errorf("dynamodb cache implementation not yet available")
}

func NewCloudflareCache(config *CacheConfig) (CacheInterface, error) {
	return nil, fmt.Errorf("cloudflare cache implementation not yet available")
}

func NewMultiTierCacheImpl(l1Cache, l2Cache CacheInterface) CacheInterface {
	// This would be a more complex implementation that checks L1 first, then L2
	// For now, return the L2 cache as a placeholder
	return l2Cache
}
