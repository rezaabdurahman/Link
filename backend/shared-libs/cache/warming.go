package cache

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// CacheWarmer provides cache warming strategies
type CacheWarmer struct {
	cache      CacheInterface
	strategies map[string]WarmingStrategy
	scheduler  *WarmingScheduler
	mu         sync.RWMutex
	logger     Logger
}

// WarmingStrategy defines how to warm specific cache entries
type WarmingStrategy interface {
	// Name returns the strategy name
	Name() string

	// ShouldWarm determines if warming should occur
	ShouldWarm(ctx context.Context) (bool, error)

	// GetKeys returns the keys to warm
	GetKeys(ctx context.Context) ([]string, error)

	// FetchData fetches data for a specific key
	FetchData(ctx context.Context, key string) (interface{}, time.Duration, error)

	// Priority returns the warming priority (higher = more important)
	Priority() int
}

// WarmingScheduler manages cache warming schedules
type WarmingScheduler struct {
	warmer    *CacheWarmer
	schedules map[string]*ScheduleConfig
	stopChan  chan struct{}
	mu        sync.RWMutex
}

// ScheduleConfig defines when and how often to warm cache
type ScheduleConfig struct {
	Strategy  string        `json:"strategy"`
	Interval  time.Duration `json:"interval"`
	StartTime time.Time     `json:"start_time"`
	Enabled   bool          `json:"enabled"`
}

// Logger interface for warming operations
type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, err error, fields ...interface{})
	Debug(msg string, fields ...interface{})
}

// DefaultLogger provides basic logging
type DefaultLogger struct{}

func (dl *DefaultLogger) Info(msg string, fields ...interface{}) {
	fmt.Printf("INFO: %s %v\n", msg, fields)
}

func (dl *DefaultLogger) Error(msg string, err error, fields ...interface{}) {
	fmt.Printf("ERROR: %s: %v %v\n", msg, err, fields)
}

func (dl *DefaultLogger) Debug(msg string, fields ...interface{}) {
	fmt.Printf("DEBUG: %s %v\n", msg, fields)
}

// NewCacheWarmer creates a new cache warmer
func NewCacheWarmer(cache CacheInterface, logger Logger) *CacheWarmer {
	if logger == nil {
		logger = &DefaultLogger{}
	}

	return &CacheWarmer{
		cache:      cache,
		strategies: make(map[string]WarmingStrategy),
		scheduler: &WarmingScheduler{
			schedules: make(map[string]*ScheduleConfig),
			stopChan:  make(chan struct{}),
		},
		logger: logger,
	}
}

// RegisterStrategy registers a warming strategy
func (cw *CacheWarmer) RegisterStrategy(strategy WarmingStrategy) {
	cw.mu.Lock()
	defer cw.mu.Unlock()

	cw.strategies[strategy.Name()] = strategy
	cw.logger.Info("Registered warming strategy", "name", strategy.Name())
}

// WarmNow immediately warms cache using a specific strategy
func (cw *CacheWarmer) WarmNow(ctx context.Context, strategyName string) error {
	cw.mu.RLock()
	strategy, exists := cw.strategies[strategyName]
	cw.mu.RUnlock()

	if !exists {
		return fmt.Errorf("strategy not found: %s", strategyName)
	}

	return cw.executeStrategy(ctx, strategy)
}

// WarmAll warms cache using all registered strategies
func (cw *CacheWarmer) WarmAll(ctx context.Context) error {
	cw.mu.RLock()
	strategies := make([]WarmingStrategy, 0, len(cw.strategies))
	for _, strategy := range cw.strategies {
		strategies = append(strategies, strategy)
	}
	cw.mu.RUnlock()

	// Sort by priority
	for i := 0; i < len(strategies); i++ {
		for j := i + 1; j < len(strategies); j++ {
			if strategies[i].Priority() < strategies[j].Priority() {
				strategies[i], strategies[j] = strategies[j], strategies[i]
			}
		}
	}

	// Execute strategies in priority order
	for _, strategy := range strategies {
		if err := cw.executeStrategy(ctx, strategy); err != nil {
			cw.logger.Error("Strategy execution failed", err,
				"strategy", strategy.Name())
		}
	}

	return nil
}

// executeStrategy executes a single warming strategy
func (cw *CacheWarmer) executeStrategy(ctx context.Context, strategy WarmingStrategy) error {
	start := time.Now()
	cw.logger.Debug("Executing warming strategy", "strategy", strategy.Name())

	// Check if warming should occur
	shouldWarm, err := strategy.ShouldWarm(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if warming should occur: %w", err)
	}

	if !shouldWarm {
		cw.logger.Debug("Skipping warming", "strategy", strategy.Name(), "reason", "should_warm_false")
		return nil
	}

	// Get keys to warm
	keys, err := strategy.GetKeys(ctx)
	if err != nil {
		return fmt.Errorf("failed to get keys for warming: %w", err)
	}

	if len(keys) == 0 {
		cw.logger.Debug("No keys to warm", "strategy", strategy.Name())
		return nil
	}

	// Warm each key
	warmedCount := 0
	errorCount := 0

	for _, key := range keys {
		if err := cw.warmKey(ctx, strategy, key); err != nil {
			errorCount++
			cw.logger.Error("Failed to warm key", err,
				"strategy", strategy.Name(), "key", key)
		} else {
			warmedCount++
		}
	}

	duration := time.Since(start)
	cw.logger.Info("Warming strategy completed",
		"strategy", strategy.Name(),
		"warmed_count", warmedCount,
		"error_count", errorCount,
		"total_keys", len(keys),
		"duration", duration)

	return nil
}

// warmKey warms a single cache key
func (cw *CacheWarmer) warmKey(ctx context.Context, strategy WarmingStrategy, key string) error {
	// Check if key already exists and is fresh
	exists, err := cw.cache.Exists(ctx, key)
	if err != nil {
		cw.logger.Error("Failed to check key existence", err, "key", key)
		// Continue with warming despite error
	} else if exists {
		// Key exists, check TTL to see if it's fresh
		if ttl, err := cw.cache.TTL(ctx, key); err == nil && ttl > time.Minute {
			// Key is fresh, skip warming
			return nil
		}
	}

	// Fetch data
	data, ttl, err := strategy.FetchData(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to fetch data for key %s: %w", key, err)
	}

	// Marshal data
	serializedData, err := SerializeData(data)
	if err != nil {
		return fmt.Errorf("failed to serialize data for key %s: %w", key, err)
	}

	// Store in cache
	if err := cw.cache.Set(ctx, key, serializedData, ttl); err != nil {
		return fmt.Errorf("failed to set cache for key %s: %w", key, err)
	}

	return nil
}

// Schedule schedules automatic cache warming
func (cw *CacheWarmer) Schedule(strategyName string, config *ScheduleConfig) error {
	cw.scheduler.mu.Lock()
	defer cw.scheduler.mu.Unlock()

	// Validate strategy exists
	cw.mu.RLock()
	_, exists := cw.strategies[strategyName]
	cw.mu.RUnlock()

	if !exists {
		return fmt.Errorf("strategy not found: %s", strategyName)
	}

	config.Strategy = strategyName
	cw.scheduler.schedules[strategyName] = config

	cw.logger.Info("Scheduled warming strategy",
		"strategy", strategyName,
		"interval", config.Interval,
		"enabled", config.Enabled)

	return nil
}

// StartScheduler starts the warming scheduler
func (cw *CacheWarmer) StartScheduler(ctx context.Context) {
	cw.scheduler.warmer = cw
	go cw.scheduler.run(ctx)
	cw.logger.Info("Cache warming scheduler started")
}

// StopScheduler stops the warming scheduler
func (cw *CacheWarmer) StopScheduler() {
	close(cw.scheduler.stopChan)
	cw.logger.Info("Cache warming scheduler stopped")
}

// run executes the warming scheduler
func (ws *WarmingScheduler) run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute) // Check every minute
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ws.stopChan:
			return
		case now := <-ticker.C:
			ws.checkAndExecuteSchedules(ctx, now)
		}
	}
}

// checkAndExecuteSchedules checks if any scheduled warming should execute
func (ws *WarmingScheduler) checkAndExecuteSchedules(ctx context.Context, now time.Time) {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	for strategyName, config := range ws.schedules {
		if !config.Enabled {
			continue
		}

		// Check if it's time to run
		nextRun := config.StartTime
		for nextRun.Before(now) {
			nextRun = nextRun.Add(config.Interval)
		}

		// If the next run is within the next minute, execute now
		if nextRun.Sub(now) <= time.Minute {
			go func(name string) {
				if err := ws.warmer.WarmNow(ctx, name); err != nil {
					ws.warmer.logger.Error("Scheduled warming failed", err, "strategy", name)
				}
			}(strategyName)
		}
	}
}

// Common warming strategies

// UserProfileWarmingStrategy warms user profiles
type UserProfileWarmingStrategy struct {
	userService   UserService
	activeUserIDs []string
	priority      int
}

// UserService interface for fetching user data
type UserService interface {
	GetActiveUserIDs(ctx context.Context) ([]string, error)
	GetUserProfile(ctx context.Context, userID string) (interface{}, error)
}

func NewUserProfileWarmingStrategy(userService UserService, priority int) *UserProfileWarmingStrategy {
	return &UserProfileWarmingStrategy{
		userService: userService,
		priority:    priority,
	}
}

func (upws *UserProfileWarmingStrategy) Name() string {
	return "user_profiles"
}

func (upws *UserProfileWarmingStrategy) ShouldWarm(ctx context.Context) (bool, error) {
	// Always warm user profiles during business hours
	now := time.Now()
	hour := now.Hour()
	return hour >= 6 && hour <= 23, nil // 6 AM to 11 PM
}

func (upws *UserProfileWarmingStrategy) GetKeys(ctx context.Context) ([]string, error) {
	userIDs, err := upws.userService.GetActiveUserIDs(ctx)
	if err != nil {
		return nil, err
	}

	// Convert to cache keys
	keys := make([]string, len(userIDs))
	for i, userID := range userIDs {
		keys[i] = fmt.Sprintf("user:profile:%s", userID)
	}

	return keys, nil
}

func (upws *UserProfileWarmingStrategy) FetchData(ctx context.Context, key string) (interface{}, time.Duration, error) {
	// Extract user ID from key
	userID := key[len("user:profile:"):]

	profile, err := upws.userService.GetUserProfile(ctx, userID)
	if err != nil {
		return nil, 0, err
	}

	return profile, 15 * time.Minute, nil // Cache for 15 minutes
}

func (upws *UserProfileWarmingStrategy) Priority() int {
	return upws.priority
}

// PopularContentWarmingStrategy warms popular content
type PopularContentWarmingStrategy struct {
	contentService ContentService
	priority       int
}

type ContentService interface {
	GetPopularContentIDs(ctx context.Context, limit int) ([]string, error)
	GetContent(ctx context.Context, contentID string) (interface{}, error)
}

func NewPopularContentWarmingStrategy(contentService ContentService, priority int) *PopularContentWarmingStrategy {
	return &PopularContentWarmingStrategy{
		contentService: contentService,
		priority:       priority,
	}
}

func (pcws *PopularContentWarmingStrategy) Name() string {
	return "popular_content"
}

func (pcws *PopularContentWarmingStrategy) ShouldWarm(ctx context.Context) (bool, error) {
	// Warm popular content every few hours
	return true, nil
}

func (pcws *PopularContentWarmingStrategy) GetKeys(ctx context.Context) ([]string, error) {
	contentIDs, err := pcws.contentService.GetPopularContentIDs(ctx, 100) // Top 100
	if err != nil {
		return nil, err
	}

	keys := make([]string, len(contentIDs))
	for i, contentID := range contentIDs {
		keys[i] = fmt.Sprintf("content:%s", contentID)
	}

	return keys, nil
}

func (pcws *PopularContentWarmingStrategy) FetchData(ctx context.Context, key string) (interface{}, time.Duration, error) {
	contentID := key[len("content:"):]

	content, err := pcws.contentService.GetContent(ctx, contentID)
	if err != nil {
		return nil, 0, err
	}

	return content, 1 * time.Hour, nil // Cache for 1 hour
}

func (pcws *PopularContentWarmingStrategy) Priority() int {
	return pcws.priority
}

// SerializeData serializes data for caching (placeholder)
func SerializeData(data interface{}) ([]byte, error) {
	// This would use the same serialization as your cache helper
	// For now, using a simple JSON marshal
	return []byte(fmt.Sprintf("%v", data)), nil
}
