package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/config"
)

// RedisCache implements SummaryCache using Redis
type RedisCache struct {
	client *redis.Client
	ttl    time.Duration
	logger zerolog.Logger
}

// NewRedisCache creates a new Redis-based cache
func NewRedisCache(cfg *config.RedisConfig, logger zerolog.Logger) (*RedisCache, error) {
	// Create Redis client options
	opts := &redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
		
		// Connection settings
		PoolSize:        10,
		PoolTimeout:     30 * time.Second,
		ConnMaxIdleTime: 30 * time.Minute,
		
		// Retry settings
		MaxRetries:      3,
		MinRetryBackoff: 8 * time.Millisecond,
		MaxRetryBackoff: 512 * time.Millisecond,
	}

	// Create Redis client
	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	cache := &RedisCache{
		client: client,
		ttl:    cfg.SummaryTTL,
		logger: logger.With().Str("component", "redis_cache").Logger(),
	}

	cache.logger.Info().
		Str("host", cfg.Host).
		Str("port", cfg.Port).
		Int("db", cfg.DB).
		Dur("ttl", cfg.SummaryTTL).
		Msg("Redis cache initialized")

	return cache, nil
}

// GetSummary retrieves a cached summary by key
func (r *RedisCache) GetSummary(ctx context.Context, key string) (*Summary, error) {
	cacheKey := r.buildSummaryKey(key)
	
	r.logger.Debug().Str("key", cacheKey).Msg("Getting summary from cache")
	
	data, err := r.client.Get(ctx, cacheKey).Result()
	if err == redis.Nil {
		r.logger.Debug().Str("key", cacheKey).Msg("Summary not found in cache")
		return nil, &CacheError{Operation: "get", Err: ErrNotFound}
	}
	if err != nil {
		r.logger.Error().Err(err).Str("key", cacheKey).Msg("Failed to get summary from cache")
		return nil, &CacheError{Operation: "get", Err: err}
	}
	
	var summary Summary
	if err := json.Unmarshal([]byte(data), &summary); err != nil {
		r.logger.Error().Err(err).Str("key", cacheKey).Msg("Failed to unmarshal summary")
		return nil, &CacheError{Operation: "unmarshal", Err: err}
	}
	
	r.logger.Debug().Str("key", cacheKey).Str("summary_id", summary.ID).Msg("Summary retrieved from cache")
	return &summary, nil
}

// SetSummary stores a summary in cache with TTL
func (r *RedisCache) SetSummary(ctx context.Context, key string, summary *Summary) error {
	cacheKey := r.buildSummaryKey(key)
	
	// Set expires_at if not already set
	if summary.ExpiresAt.IsZero() {
		summary.ExpiresAt = time.Now().Add(r.ttl)
	}
	
	data, err := json.Marshal(summary)
	if err != nil {
		r.logger.Error().Err(err).Str("key", cacheKey).Msg("Failed to marshal summary")
		return &CacheError{Operation: "marshal", Err: err}
	}
	
	r.logger.Debug().
		Str("key", cacheKey).
		Str("summary_id", summary.ID).
		Dur("ttl", r.ttl).
		Msg("Setting summary in cache")
	
	if err := r.client.Set(ctx, cacheKey, data, r.ttl).Err(); err != nil {
		r.logger.Error().Err(err).Str("key", cacheKey).Msg("Failed to set summary in cache")
		return &CacheError{Operation: "set", Err: err}
	}
	
	// Also add to conversation index for invalidation
	conversationKey := r.buildConversationIndexKey(summary.ConversationID)
	if err := r.client.SAdd(ctx, conversationKey, cacheKey).Err(); err != nil {
		r.logger.Error().Err(err).
			Str("conversation_key", conversationKey).
			Str("summary_key", cacheKey).
			Msg("Failed to add summary to conversation index")
		// Don't fail the entire operation for index failure
	} else {
		// Set TTL on conversation index (slightly longer than summary TTL)
		indexTTL := r.ttl + time.Hour
		r.client.Expire(ctx, conversationKey, indexTTL)
	}
	
	r.logger.Debug().Str("key", cacheKey).Msg("Summary stored in cache")
	return nil
}

// InvalidateByConversation removes all summaries related to a conversation
func (r *RedisCache) InvalidateByConversation(ctx context.Context, conversationID uuid.UUID) error {
	conversationKey := r.buildConversationIndexKey(conversationID)
	
	r.logger.Debug().
		Str("conversation_id", conversationID.String()).
		Str("conversation_key", conversationKey).
		Msg("Invalidating summaries for conversation")
	
	// Get all summary keys for this conversation
	summaryKeys, err := r.client.SMembers(ctx, conversationKey).Result()
	if err == redis.Nil || len(summaryKeys) == 0 {
		r.logger.Debug().Str("conversation_id", conversationID.String()).Msg("No summaries found for conversation")
		return nil
	}
	if err != nil {
		r.logger.Error().Err(err).Str("conversation_key", conversationKey).Msg("Failed to get conversation summary keys")
		return &CacheError{Operation: "get_conversation_keys", Err: err}
	}
	
	// Delete all summary keys
	if len(summaryKeys) > 0 {
		keysToDelete := append(summaryKeys, conversationKey)
		if err := r.client.Del(ctx, keysToDelete...).Err(); err != nil {
			r.logger.Error().Err(err).
				Strs("keys", keysToDelete).
				Msg("Failed to delete summary keys")
			return &CacheError{Operation: "delete_keys", Err: err}
		}
		
		r.logger.Info().
			Str("conversation_id", conversationID.String()).
			Int("deleted_count", len(summaryKeys)).
			Msg("Invalidated summaries for conversation")
	}
	
	return nil
}

// Health checks the health of the cache
func (r *RedisCache) Health(ctx context.Context) error {
	if err := r.client.Ping(ctx).Err(); err != nil {
		r.logger.Error().Err(err).Msg("Redis health check failed")
		return &CacheError{Operation: "health_check", Err: err}
	}
	return nil
}

// Close closes the cache connection
func (r *RedisCache) Close() error {
	r.logger.Info().Msg("Closing Redis cache connection")
	return r.client.Close()
}

// Helper methods

func (r *RedisCache) buildSummaryKey(key string) string {
	return fmt.Sprintf("summary:%s", key)
}

func (r *RedisCache) buildConversationIndexKey(conversationID uuid.UUID) string {
	return fmt.Sprintf("conversation_summaries:%s", conversationID.String())
}

// KeyBuilder provides utility methods for building cache keys
type KeyBuilder struct{}

// NewKeyBuilder creates a new KeyBuilder
func NewKeyBuilder() *KeyBuilder {
	return &KeyBuilder{}
}

// BuildSummaryKey builds a cache key for a summary
func (kb *KeyBuilder) BuildSummaryKey(conversationID uuid.UUID, requestID string) string {
	return fmt.Sprintf("%s:%s", conversationID.String(), requestID)
}

// BuildConversationSummaryKey builds a cache key for a conversation summary
func (kb *KeyBuilder) BuildConversationSummaryKey(conversationID uuid.UUID) string {
	return fmt.Sprintf("conversation:%s", conversationID.String())
}

// BuildUserSummaryKey builds a cache key for a user's summaries
func (kb *KeyBuilder) BuildUserSummaryKey(userID uuid.UUID, conversationID uuid.UUID) string {
	return fmt.Sprintf("user:%s:conversation:%s", userID.String(), conversationID.String())
}
