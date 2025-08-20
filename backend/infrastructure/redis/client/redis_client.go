package redis

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

// Config holds the Redis configuration
type Config struct {
	// Sentinel configuration
	SentinelAddrs    []string      `json:"sentinel_addrs"`
	MasterName       string        `json:"master_name"`
	SentinelPassword string        `json:"sentinel_password"`
	
	// Direct Redis configuration (fallback)
	Addr     string `json:"addr"`
	Password string `json:"password"`
	DB       int    `json:"db"`
	
	// Connection pool settings
	PoolSize        int           `json:"pool_size"`
	MinIdleConns    int           `json:"min_idle_conns"`
	MaxConnAge      time.Duration `json:"max_conn_age"`
	PoolTimeout     time.Duration `json:"pool_timeout"`
	IdleTimeout     time.Duration `json:"idle_timeout"`
	IdleCheckFreq   time.Duration `json:"idle_check_freq"`
	
	// Read/Write timeouts
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	
	// Dial timeout
	DialTimeout time.Duration `json:"dial_timeout"`
	
	// Retry configuration
	MaxRetries      int           `json:"max_retries"`
	MinRetryBackoff time.Duration `json:"min_retry_backoff"`
	MaxRetryBackoff time.Duration `json:"max_retry_backoff"`
}

// Client wraps the Redis client with high-level operations
type Client struct {
	client   redis.UniversalClient
	config   *Config
	isMaster func() bool
}

// NewClient creates a new Redis client with Sentinel support
func NewClient(config *Config) (*Client, error) {
	var client redis.UniversalClient
	var isMaster func() bool

	if len(config.SentinelAddrs) > 0 && config.MasterName != "" {
		// Use Sentinel for high availability
		client = redis.NewFailoverClient(&redis.FailoverOptions{
			MasterName:       config.MasterName,
			SentinelAddrs:    config.SentinelAddrs,
			SentinelPassword: config.SentinelPassword,
			Password:         config.Password,
			DB:               config.DB,
			
			// Connection pool settings
			PoolSize:        config.PoolSize,
			MinIdleConns:    config.MinIdleConns,
			MaxConnAge:      config.MaxConnAge,
			PoolTimeout:     config.PoolTimeout,
			IdleTimeout:     config.IdleTimeout,
			IdleCheckFreq:   config.IdleCheckFreq,
			
			// Timeouts
			ReadTimeout:  config.ReadTimeout,
			WriteTimeout: config.WriteTimeout,
			DialTimeout:  config.DialTimeout,
			
			// Retry configuration
			MaxRetries:      config.MaxRetries,
			MinRetryBackoff: config.MinRetryBackoff,
			MaxRetryBackoff: config.MaxRetryBackoff,
			
			// Route read-only commands to slaves when possible
			RouteByLatency: true,
			RouteRandomly:  false,
		})
		
		isMaster = func() bool {
			// Check if connected to master
			role, err := client.Do(context.Background(), "INFO", "replication").Result()
			if err != nil {
				return false
			}
			return strings.Contains(fmt.Sprintf("%v", role), "role:master")
		}
	} else {
		// Use direct connection (development/fallback)
		client = redis.NewClient(&redis.Options{
			Addr:     config.Addr,
			Password: config.Password,
			DB:       config.DB,
			
			// Connection pool settings
			PoolSize:        config.PoolSize,
			MinIdleConns:    config.MinIdleConns,
			MaxConnAge:      config.MaxConnAge,
			PoolTimeout:     config.PoolTimeout,
			IdleTimeout:     config.IdleTimeout,
			IdleCheckFreq:   config.IdleCheckFreq,
			
			// Timeouts
			ReadTimeout:  config.ReadTimeout,
			WriteTimeout: config.WriteTimeout,
			DialTimeout:  config.DialTimeout,
			
			// Retry configuration
			MaxRetries:      config.MaxRetries,
			MinRetryBackoff: config.MinRetryBackoff,
			MaxRetryBackoff: config.MaxRetryBackoff,
		})
		
		isMaster = func() bool { return true }
	}

	redisClient := &Client{
		client:   client,
		config:   config,
		isMaster: isMaster,
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := redisClient.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return redisClient, nil
}

// GetClient returns the underlying Redis client
func (c *Client) GetClient() redis.UniversalClient {
	return c.client
}

// IsMaster returns true if connected to Redis master
func (c *Client) IsMaster() bool {
	return c.isMaster()
}

// Close closes the Redis connection
func (c *Client) Close() error {
	return c.client.Close()
}

// Ping pings the Redis server
func (c *Client) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// HealthCheck performs a comprehensive health check
func (c *Client) HealthCheck(ctx context.Context) error {
	// Test ping
	if err := c.Ping(ctx); err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}
	
	// Test write operation (if master)
	if c.IsMaster() {
		testKey := fmt.Sprintf("health_check_%d", time.Now().Unix())
		if err := c.client.Set(ctx, testKey, "test", time.Second).Err(); err != nil {
			return fmt.Errorf("write test failed: %w", err)
		}
		
		// Clean up test key
		c.client.Del(ctx, testKey)
	}
	
	// Test read operation
	if err := c.client.Get(ctx, "non_existent_key").Err(); err != redis.Nil && err != nil {
		return fmt.Errorf("read test failed: %w", err)
	}
	
	return nil
}

// Stats returns connection pool statistics
func (c *Client) Stats() map[string]interface{} {
	stats := c.client.PoolStats()
	
	return map[string]interface{}{
		"hits":          stats.Hits,
		"misses":        stats.Misses,
		"timeouts":      stats.Timeouts,
		"total_conns":   stats.TotalConns,
		"idle_conns":    stats.IdleConns,
		"stale_conns":   stats.StaleConns,
		"is_master":     c.IsMaster(),
	}
}

// Set sets a key-value pair with optional expiration
func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.client.Set(ctx, key, value, expiration).Err()
}

// Get gets a value by key
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.client.Get(ctx, key).Result()
}

// Del deletes one or more keys
func (c *Client) Del(ctx context.Context, keys ...string) error {
	return c.client.Del(ctx, keys...).Err()
}

// Exists checks if keys exist
func (c *Client) Exists(ctx context.Context, keys ...string) (int64, error) {
	return c.client.Exists(ctx, keys...).Result()
}

// Expire sets expiration for a key
func (c *Client) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return c.client.Expire(ctx, key, expiration).Err()
}

// TTL gets time to live for a key
func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.client.TTL(ctx, key).Result()
}

// Incr increments a counter
func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	return c.client.Incr(ctx, key).Result()
}

// IncrBy increments a counter by specified amount
func (c *Client) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	return c.client.IncrBy(ctx, key, value).Result()
}

// HSet sets field in hash
func (c *Client) HSet(ctx context.Context, key string, values ...interface{}) error {
	return c.client.HSet(ctx, key, values...).Err()
}

// HGet gets field from hash
func (c *Client) HGet(ctx context.Context, key, field string) (string, error) {
	return c.client.HGet(ctx, key, field).Result()
}

// HGetAll gets all fields from hash
func (c *Client) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return c.client.HGetAll(ctx, key).Result()
}

// HDel deletes fields from hash
func (c *Client) HDel(ctx context.Context, key string, fields ...string) error {
	return c.client.HDel(ctx, key, fields...).Err()
}

// LPush pushes elements to the head of list
func (c *Client) LPush(ctx context.Context, key string, values ...interface{}) error {
	return c.client.LPush(ctx, key, values...).Err()
}

// RPop pops element from tail of list
func (c *Client) RPop(ctx context.Context, key string) (string, error) {
	return c.client.RPop(ctx, key).Result()
}

// BRPop blocks and pops element from tail of list
func (c *Client) BRPop(ctx context.Context, timeout time.Duration, keys ...string) ([]string, error) {
	return c.client.BRPop(ctx, timeout, keys...).Result()
}

// SAdd adds members to set
func (c *Client) SAdd(ctx context.Context, key string, members ...interface{}) error {
	return c.client.SAdd(ctx, key, members...).Err()
}

// SMembers gets all members of set
func (c *Client) SMembers(ctx context.Context, key string) ([]string, error) {
	return c.client.SMembers(ctx, key).Result()
}

// SRem removes members from set
func (c *Client) SRem(ctx context.Context, key string, members ...interface{}) error {
	return c.client.SRem(ctx, key, members...).Err()
}

// Publish publishes message to channel
func (c *Client) Publish(ctx context.Context, channel string, message interface{}) error {
	return c.client.Publish(ctx, channel, message).Err()
}

// Subscribe subscribes to channels
func (c *Client) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return c.client.Subscribe(ctx, channels...)
}

// PSubscribe subscribes to channels by pattern
func (c *Client) PSubscribe(ctx context.Context, patterns ...string) *redis.PubSub {
	return c.client.PSubscribe(ctx, patterns...)
}

// Pipeline creates a new pipeline
func (c *Client) Pipeline() redis.Pipeliner {
	return c.client.Pipeline()
}

// TxPipeline creates a new transaction pipeline
func (c *Client) TxPipeline() redis.Pipeliner {
	return c.client.TxPipeline()
}

// DefaultConfig returns a default Redis configuration
func DefaultConfig() *Config {
	return &Config{
		// Default to localhost for development
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
		
		// Connection pool settings
		PoolSize:        10,
		MinIdleConns:    5,
		MaxConnAge:      30 * time.Minute,
		PoolTimeout:     5 * time.Second,
		IdleTimeout:     5 * time.Minute,
		IdleCheckFreq:   1 * time.Minute,
		
		// Timeouts
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		DialTimeout:  5 * time.Second,
		
		// Retry configuration
		MaxRetries:      3,
		MinRetryBackoff: 8 * time.Millisecond,
		MaxRetryBackoff: 512 * time.Millisecond,
	}
}

// SentinelConfig returns a Redis configuration for Sentinel setup
func SentinelConfig(sentinelAddrs []string, masterName string) *Config {
	config := DefaultConfig()
	config.SentinelAddrs = sentinelAddrs
	config.MasterName = masterName
	return config
}

// MonitorSentinel monitors Sentinel events and logs important changes
func (c *Client) MonitorSentinel(ctx context.Context) {
	if len(c.config.SentinelAddrs) == 0 {
		return // Not using Sentinel
	}
	
	// Subscribe to Sentinel events
	pubsub := c.client.Subscribe(ctx, "+switch-master", "+slave-reconf-done", "+sdown", "-sdown")
	defer pubsub.Close()
	
	ch := pubsub.Channel()
	
	for {
		select {
		case msg := <-ch:
			log.Printf("Sentinel event: %s - %s", msg.Channel, msg.Payload)
		case <-ctx.Done():
			return
		}
	}
}
