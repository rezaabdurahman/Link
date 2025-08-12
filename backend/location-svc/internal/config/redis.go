package config

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// GetRedisConfig returns Redis configuration from environment variables
func GetRedisConfig() *RedisConfig {
	dbNum, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))
	
	return &RedisConfig{
		Host:     getEnv("REDIS_HOST", "localhost"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       dbNum,
	}
}

// ConnectRedis establishes Redis connection
func ConnectRedis() (*redis.Client, error) {
	config := GetRedisConfig()

	addr := fmt.Sprintf("%s:%s", config.Host, config.Port)
	
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     config.Password,
		DB:           config.DB,
		PoolSize:     10,
		MinIdleConns: 2,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		IdleTimeout:  5 * time.Minute,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return rdb, nil
}

// Redis key constants for different data types
const (
	// Geo keys for real-time location tracking
	RedisKeyUserLocations = "locations:users"
	
	// Cache keys with TTL
	RedisKeyLocationCache = "cache:location:"
	RedisKeyNearbyCache   = "cache:nearby:"
	RedisKeyPrivacyCache  = "cache:privacy:"
	
	// Pub/Sub channels
	RedisChannelUserAvailable   = "user_available"
	RedisChannelLocationUpdate  = "location_update"
	RedisChannelProximityEvent  = "proximity_event"
)

// Cache TTL configurations
var (
	LocationCacheTTL = time.Duration(getEnvAsInt("LOCATION_CACHE_TTL_MINUTES", 5)) * time.Minute
	NearbyCacheTTL   = time.Duration(getEnvAsInt("NEARBY_CACHE_TTL_MINUTES", 2)) * time.Minute
	PrivacyCacheTTL  = time.Duration(getEnvAsInt("PRIVACY_CACHE_TTL_MINUTES", 30)) * time.Minute
)

// getEnvAsInt gets an environment variable as integer with default
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
