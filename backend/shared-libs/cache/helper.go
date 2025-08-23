package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// CacheHelper provides high-level caching operations with JSON serialization
type CacheHelper struct {
	cache     CacheInterface
	keyPrefix string
}

// NewCacheHelper creates a new cache helper
func NewCacheHelper(cache CacheInterface, keyPrefix string) *CacheHelper {
	return &CacheHelper{
		cache:     cache,
		keyPrefix: keyPrefix,
	}
}

// Get retrieves and unmarshals a value from cache
func (ch *CacheHelper) Get(ctx context.Context, key string, dest interface{}) error {
	prefixedKey := ch.buildKey(key)

	data, err := ch.cache.Get(ctx, prefixedKey)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, dest)
}

// Set marshals and stores a value in cache
func (ch *CacheHelper) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	prefixedKey := ch.buildKey(key)
	return ch.cache.Set(ctx, prefixedKey, data, ttl)
}

// GetOrSet retrieves a value from cache, or computes and caches it if not found
func (ch *CacheHelper) GetOrSet(ctx context.Context, key string, dest interface{}, fetcher func() (interface{}, error), ttl time.Duration) error {
	// Try to get from cache first
	if err := ch.Get(ctx, key, dest); err == nil {
		return nil // Cache hit
	} else if !IsCacheMiss(err) {
		// Log error but continue to fetch from source
		fmt.Printf("Cache error for key %s: %v\n", key, err)
	}

	// Cache miss - fetch from source
	value, err := fetcher()
	if err != nil {
		return fmt.Errorf("failed to fetch value: %w", err)
	}

	// Store in cache (don't fail the request if caching fails)
	if err := ch.Set(ctx, key, value, ttl); err != nil {
		fmt.Printf("Failed to cache value for key %s: %v\n", key, err)
	}

	// Marshal and unmarshal to populate dest
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal fetched value: %w", err)
	}

	return json.Unmarshal(data, dest)
}

// Delete removes a value from cache
func (ch *CacheHelper) Delete(ctx context.Context, key string) error {
	prefixedKey := ch.buildKey(key)
	return ch.cache.Delete(ctx, prefixedKey)
}

// Exists checks if a key exists in cache
func (ch *CacheHelper) Exists(ctx context.Context, key string) (bool, error) {
	prefixedKey := ch.buildKey(key)
	return ch.cache.Exists(ctx, prefixedKey)
}

// Invalidate removes all keys matching a pattern
func (ch *CacheHelper) Invalidate(ctx context.Context, pattern string) error {
	prefixedPattern := ch.buildKey(pattern)
	return ch.cache.DeletePattern(ctx, prefixedPattern)
}

// buildKey creates a prefixed cache key
func (ch *CacheHelper) buildKey(key string) string {
	if ch.keyPrefix != "" {
		return fmt.Sprintf("%s:%s", ch.keyPrefix, key)
	}
	return key
}

// IsCacheMiss checks if an error is a cache miss
func IsCacheMiss(err error) bool {
	if cacheErr, ok := err.(*CacheError); ok {
		return cacheErr.IsMiss()
	}
	return err == ErrCacheMiss
}

// Common cache key patterns for Link services

// UserCacheKeys provides user-related cache key patterns
type UserCacheKeys struct {
	helper *CacheHelper
}

// NewUserCacheKeys creates user cache key helper
func NewUserCacheKeys(cache CacheInterface) *UserCacheKeys {
	return &UserCacheKeys{
		helper: NewCacheHelper(cache, "user"),
	}
}

func (uck *UserCacheKeys) ProfileKey(userID string) string {
	return fmt.Sprintf("profile:%s", userID)
}

func (uck *UserCacheKeys) SessionKey(sessionID string) string {
	return fmt.Sprintf("session:%s", sessionID)
}

func (uck *UserCacheKeys) PreferencesKey(userID string) string {
	return fmt.Sprintf("prefs:%s", userID)
}

func (uck *UserCacheKeys) FriendsKey(userID string) string {
	return fmt.Sprintf("friends:%s", userID)
}

func (uck *UserCacheKeys) GetProfile(ctx context.Context, userID string, dest interface{}) error {
	return uck.helper.Get(ctx, uck.ProfileKey(userID), dest)
}

func (uck *UserCacheKeys) SetProfile(ctx context.Context, userID string, profile interface{}, ttl time.Duration) error {
	return uck.helper.Set(ctx, uck.ProfileKey(userID), profile, ttl)
}

func (uck *UserCacheKeys) InvalidateUser(ctx context.Context, userID string) error {
	patterns := []string{
		uck.ProfileKey(userID),
		uck.PreferencesKey(userID),
		uck.FriendsKey(userID),
	}

	for _, pattern := range patterns {
		if err := uck.helper.Delete(ctx, pattern); err != nil {
			fmt.Printf("Warning: Failed to invalidate cache for pattern %s: %v\n", pattern, err)
		}
	}

	return nil
}

// ChatCacheKeys provides chat-related cache key patterns
type ChatCacheKeys struct {
	helper *CacheHelper
}

func NewChatCacheKeys(cache CacheInterface) *ChatCacheKeys {
	return &ChatCacheKeys{
		helper: NewCacheHelper(cache, "chat"),
	}
}

func (cck *ChatCacheKeys) ConversationKey(conversationID string) string {
	return fmt.Sprintf("conversation:%s", conversationID)
}

func (cck *ChatCacheKeys) MessagesKey(conversationID string, page int) string {
	return fmt.Sprintf("messages:%s:page:%d", conversationID, page)
}

func (cck *ChatCacheKeys) UnreadCountKey(userID string) string {
	return fmt.Sprintf("unread:%s", userID)
}

func (cck *ChatCacheKeys) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := cck.helper.Get(ctx, cck.UnreadCountKey(userID), &count)
	return count, err
}

func (cck *ChatCacheKeys) SetUnreadCount(ctx context.Context, userID string, count int, ttl time.Duration) error {
	return cck.helper.Set(ctx, cck.UnreadCountKey(userID), count, ttl)
}

func (cck *ChatCacheKeys) InvalidateConversation(ctx context.Context, conversationID string) error {
	return cck.helper.Invalidate(ctx, fmt.Sprintf("*%s*", conversationID))
}

// DiscoveryCacheKeys provides discovery-related cache key patterns
type DiscoveryCacheKeys struct {
	helper *CacheHelper
}

func NewDiscoveryCacheKeys(cache CacheInterface) *DiscoveryCacheKeys {
	return &DiscoveryCacheKeys{
		helper: NewCacheHelper(cache, "discovery"),
	}
}

func (dck *DiscoveryCacheKeys) NearbyUsersKey(userID string, radius int) string {
	return fmt.Sprintf("nearby:%s:r%d", userID, radius)
}

func (dck *DiscoveryCacheKeys) LocationKey(userID string) string {
	return fmt.Sprintf("location:%s", userID)
}

func (dck *DiscoveryCacheKeys) AvailabilityKey(userID string) string {
	return fmt.Sprintf("available:%s", userID)
}

func (dck *DiscoveryCacheKeys) GetNearbyUsers(ctx context.Context, userID string, radius int, dest interface{}) error {
	return dck.helper.Get(ctx, dck.NearbyUsersKey(userID, radius), dest)
}

func (dck *DiscoveryCacheKeys) SetNearbyUsers(ctx context.Context, userID string, radius int, users interface{}, ttl time.Duration) error {
	return dck.helper.Set(ctx, dck.NearbyUsersKey(userID, radius), users, ttl)
}

func (dck *DiscoveryCacheKeys) InvalidateLocation(ctx context.Context, userID string) error {
	patterns := []string{
		dck.LocationKey(userID),
		dck.AvailabilityKey(userID),
		fmt.Sprintf("nearby:*"), // Invalidate all nearby caches
	}

	for _, pattern := range patterns {
		if err := dck.helper.Invalidate(ctx, pattern); err != nil {
			fmt.Printf("Warning: Failed to invalidate cache for pattern %s: %v\n", pattern, err)
		}
	}

	return nil
}

// SearchCacheKeys provides search-related cache key patterns
type SearchCacheKeys struct {
	helper *CacheHelper
}

func NewSearchCacheKeys(cache CacheInterface) *SearchCacheKeys {
	return &SearchCacheKeys{
		helper: NewCacheHelper(cache, "search"),
	}
}

func (sck *SearchCacheKeys) QueryKey(query string, userID string) string {
	return fmt.Sprintf("query:%s:user:%s", query, userID)
}

func (sck *SearchCacheKeys) IndexKey(entityType string, entityID string) string {
	return fmt.Sprintf("index:%s:%s", entityType, entityID)
}

func (sck *SearchCacheKeys) GetQueryResults(ctx context.Context, query string, userID string, dest interface{}) error {
	return sck.helper.Get(ctx, sck.QueryKey(query, userID), dest)
}

func (sck *SearchCacheKeys) SetQueryResults(ctx context.Context, query string, userID string, results interface{}, ttl time.Duration) error {
	return sck.helper.Set(ctx, sck.QueryKey(query, userID), results, ttl)
}

func (sck *SearchCacheKeys) InvalidateEntity(ctx context.Context, entityType string, entityID string) error {
	patterns := []string{
		sck.IndexKey(entityType, entityID),
		fmt.Sprintf("query:*"), // Invalidate all query caches
	}

	for _, pattern := range patterns {
		if err := sck.helper.Invalidate(ctx, pattern); err != nil {
			fmt.Printf("Warning: Failed to invalidate cache for pattern %s: %v\n", pattern, err)
		}
	}

	return nil
}

// ServiceCacheManager manages cache for a specific service
type ServiceCacheManager struct {
	Cache     CacheInterface
	User      *UserCacheKeys
	Chat      *ChatCacheKeys
	Discovery *DiscoveryCacheKeys
	Search    *SearchCacheKeys
	Helper    *CacheHelper
}

// NewServiceCacheManager creates a cache manager for a service
func NewServiceCacheManager(serviceName string) (*ServiceCacheManager, error) {
	config, err := LoadServiceSpecificConfig(serviceName)
	if err != nil {
		return nil, fmt.Errorf("failed to load cache config for service %s: %w", serviceName, err)
	}

	cache, err := NewCache(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache for service %s: %w", serviceName, err)
	}

	return &ServiceCacheManager{
		Cache:     cache,
		User:      NewUserCacheKeys(cache),
		Chat:      NewChatCacheKeys(cache),
		Discovery: NewDiscoveryCacheKeys(cache),
		Search:    NewSearchCacheKeys(cache),
		Helper:    NewCacheHelper(cache, serviceName),
	}, nil
}

// Close closes the cache connection
func (scm *ServiceCacheManager) Close() error {
	return scm.Cache.Close()
}

// Stats returns cache statistics
func (scm *ServiceCacheManager) Stats(ctx context.Context) (*CacheStats, error) {
	return scm.Cache.Stats(ctx)
}
