package cache

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/config"
)

// MemoryCache implements SummaryCache using in-memory storage
// This implementation is primarily for testing and development purposes
type MemoryCache struct {
	data   map[string]*Summary
	index  map[string][]string // conversation_id -> []summary_keys
	mutex  sync.RWMutex
	ttl    time.Duration
	logger zerolog.Logger
}

// NewMemoryCache creates a new in-memory cache
func NewMemoryCache(cfg *config.RedisConfig, logger zerolog.Logger) (*MemoryCache, error) {
	cache := &MemoryCache{
		data:   make(map[string]*Summary),
		index:  make(map[string][]string),
		ttl:    cfg.SummaryTTL,
		logger: logger.With().Str("component", "memory_cache").Logger(),
	}

	cache.logger.Info().
		Dur("ttl", cfg.SummaryTTL).
		Msg("Memory cache initialized")

	// Start cleanup goroutine
	go cache.startCleanup()

	return cache, nil
}

// GetSummary retrieves a cached summary by key
func (m *MemoryCache) GetSummary(ctx context.Context, key string) (*Summary, error) {
	cacheKey := m.buildSummaryKey(key)

	m.mutex.RLock()
	defer m.mutex.RUnlock()

	m.logger.Debug().Str("key", cacheKey).Msg("Getting summary from memory cache")

	summary, exists := m.data[cacheKey]
	if !exists {
		m.logger.Debug().Str("key", cacheKey).Msg("Summary not found in memory cache")
		return nil, &CacheError{Operation: "get", Err: ErrNotFound}
	}

	// Check if expired
	if time.Now().After(summary.ExpiresAt) {
		m.logger.Debug().Str("key", cacheKey).Msg("Summary expired in memory cache")
		// Clean up expired entry (without blocking the read lock)
		go m.deleteExpired(cacheKey, summary.ConversationID)
		return nil, &CacheError{Operation: "get", Err: ErrNotFound}
	}

	m.logger.Debug().Str("key", cacheKey).Str("summary_id", summary.ID).Msg("Summary retrieved from memory cache")
	return summary, nil
}

// SetSummary stores a summary in cache with TTL
func (m *MemoryCache) SetSummary(ctx context.Context, key string, summary *Summary) error {
	cacheKey := m.buildSummaryKey(key)

	// Set expires_at if not already set
	if summary.ExpiresAt.IsZero() {
		summary.ExpiresAt = time.Now().Add(m.ttl)
	}

	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.logger.Debug().
		Str("key", cacheKey).
		Str("summary_id", summary.ID).
		Dur("ttl", m.ttl).
		Msg("Setting summary in memory cache")

	// Store the summary
	m.data[cacheKey] = summary

	// Update conversation index
	conversationKey := summary.ConversationID.String()
	if keys, exists := m.index[conversationKey]; exists {
		// Check if key already exists in index
		found := false
		for _, existingKey := range keys {
			if existingKey == cacheKey {
				found = true
				break
			}
		}
		if !found {
			m.index[conversationKey] = append(keys, cacheKey)
		}
	} else {
		m.index[conversationKey] = []string{cacheKey}
	}

	m.logger.Debug().Str("key", cacheKey).Msg("Summary stored in memory cache")
	return nil
}

// InvalidateByConversation removes all summaries related to a conversation
func (m *MemoryCache) InvalidateByConversation(ctx context.Context, conversationID uuid.UUID) error {
	conversationKey := conversationID.String()

	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.logger.Debug().
		Str("conversation_id", conversationID.String()).
		Msg("Invalidating summaries for conversation in memory cache")

	keys, exists := m.index[conversationKey]
	if !exists || len(keys) == 0 {
		m.logger.Debug().Str("conversation_id", conversationID.String()).Msg("No summaries found for conversation in memory cache")
		return nil
	}

	// Delete all summary keys
	deletedCount := 0
	for _, key := range keys {
		if _, exists := m.data[key]; exists {
			delete(m.data, key)
			deletedCount++
		}
	}

	// Clear the conversation index
	delete(m.index, conversationKey)

	m.logger.Info().
		Str("conversation_id", conversationID.String()).
		Int("deleted_count", deletedCount).
		Msg("Invalidated summaries for conversation in memory cache")

	return nil
}

// Health checks the health of the cache
func (m *MemoryCache) Health(ctx context.Context) error {
	// Memory cache is always healthy if the struct exists
	m.mutex.RLock()
	dataSize := len(m.data)
	indexSize := len(m.index)
	m.mutex.RUnlock()

	m.logger.Debug().
		Int("data_entries", dataSize).
		Int("index_entries", indexSize).
		Msg("Memory cache health check")

	return nil
}

// Close closes the cache connection (no-op for memory cache)
func (m *MemoryCache) Close() error {
	m.logger.Info().Msg("Closing memory cache")
	
	m.mutex.Lock()
	defer m.mutex.Unlock()
	
	// Clear all data
	m.data = make(map[string]*Summary)
	m.index = make(map[string][]string)
	
	return nil
}

// Helper methods

func (m *MemoryCache) buildSummaryKey(key string) string {
	return fmt.Sprintf("summary:%s", key)
}

func (m *MemoryCache) deleteExpired(cacheKey string, conversationID uuid.UUID) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	delete(m.data, cacheKey)

	// Remove from conversation index
	conversationKey := conversationID.String()
	if keys, exists := m.index[conversationKey]; exists {
		newKeys := make([]string, 0, len(keys))
		for _, key := range keys {
			if key != cacheKey {
				newKeys = append(newKeys, key)
			}
		}
		if len(newKeys) == 0 {
			delete(m.index, conversationKey)
		} else {
			m.index[conversationKey] = newKeys
		}
	}
}

func (m *MemoryCache) startCleanup() {
	ticker := time.NewTicker(5 * time.Minute) // Cleanup every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		m.cleanupExpired()
	}
}

func (m *MemoryCache) cleanupExpired() {
	now := time.Now()
	
	m.mutex.Lock()
	defer m.mutex.Unlock()

	keysToDelete := make([]string, 0)
	conversationsToUpdate := make(map[string][]string)

	// Find expired entries
	for key, summary := range m.data {
		if now.After(summary.ExpiresAt) {
			keysToDelete = append(keysToDelete, key)
			conversationKey := summary.ConversationID.String()
			if _, exists := conversationsToUpdate[conversationKey]; !exists {
				conversationsToUpdate[conversationKey] = []string{}
			}
			conversationsToUpdate[conversationKey] = append(conversationsToUpdate[conversationKey], key)
		}
	}

	// Delete expired entries
	for _, key := range keysToDelete {
		delete(m.data, key)
	}

	// Update conversation indexes
	for conversationKey, expiredKeys := range conversationsToUpdate {
		if keys, exists := m.index[conversationKey]; exists {
			newKeys := make([]string, 0, len(keys))
			for _, key := range keys {
				expired := false
				for _, expiredKey := range expiredKeys {
					if key == expiredKey {
						expired = true
						break
					}
				}
				if !expired {
					newKeys = append(newKeys, key)
				}
			}
			if len(newKeys) == 0 {
				delete(m.index, conversationKey)
			} else {
				m.index[conversationKey] = newKeys
			}
		}
	}

	if len(keysToDelete) > 0 {
		m.logger.Debug().
			Int("expired_count", len(keysToDelete)).
			Msg("Cleaned up expired entries from memory cache")
	}
}
