package cache

import (
	"fmt"

	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/config"
)

// CacheType represents the type of cache implementation
type CacheType string

const (
	CacheTypeRedis CacheType = "redis"
	CacheTypeMem   CacheType = "memory"
)

// NewSummaryCache creates a new SummaryCache instance based on configuration
func NewSummaryCache(cacheType CacheType, cfg *config.Config, logger zerolog.Logger) (SummaryCache, error) {
	switch cacheType {
	case CacheTypeRedis:
		return NewRedisCache(&cfg.Redis, logger)
	case CacheTypeMem:
		return NewMemoryCache(&cfg.Redis, logger)
	default:
		return nil, fmt.Errorf("unsupported cache type: %s", cacheType)
	}
}

// NewRedisSummaryCache creates a Redis-based cache (convenience function)
func NewRedisSummaryCache(cfg *config.Config, logger zerolog.Logger) (SummaryCache, error) {
	return NewRedisCache(&cfg.Redis, logger)
}
