package cache

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// LoadConfigFromEnv loads cache configuration from environment variables
func LoadConfigFromEnv() (*CacheConfig, error) {
	config := &CacheConfig{}

	// Provider
	provider := os.Getenv("CACHE_PROVIDER")
	if provider == "" {
		provider = "redis" // default
	}
	config.Provider = CacheProvider(provider)

	// Endpoints
	endpoints := os.Getenv("CACHE_ENDPOINTS")
	if endpoints != "" {
		config.Endpoints = strings.Split(endpoints, ",")
		// Trim whitespace
		for i, endpoint := range config.Endpoints {
			config.Endpoints[i] = strings.TrimSpace(endpoint)
		}
	} else {
		// Default Redis endpoint
		config.Endpoints = []string{"localhost:6379"}
	}

	// Authentication
	config.Username = os.Getenv("CACHE_USERNAME")
	config.Password = os.Getenv("CACHE_PASSWORD")

	// Database
	if dbStr := os.Getenv("CACHE_DATABASE"); dbStr != "" {
		if db, err := strconv.Atoi(dbStr); err == nil {
			config.Database = db
		}
	}

	// Pool settings
	if poolSizeStr := os.Getenv("CACHE_POOL_SIZE"); poolSizeStr != "" {
		if poolSize, err := strconv.Atoi(poolSizeStr); err == nil {
			config.PoolSize = poolSize
		}
	}

	if minIdleStr := os.Getenv("CACHE_MIN_IDLE_CONNS"); minIdleStr != "" {
		if minIdle, err := strconv.Atoi(minIdleStr); err == nil {
			config.MinIdleConns = minIdle
		}
	}

	if maxRetriesStr := os.Getenv("CACHE_MAX_RETRIES"); maxRetriesStr != "" {
		if maxRetries, err := strconv.Atoi(maxRetriesStr); err == nil {
			config.MaxRetries = maxRetries
		}
	}

	// Timeouts
	if dialTimeoutStr := os.Getenv("CACHE_DIAL_TIMEOUT"); dialTimeoutStr != "" {
		if dialTimeout, err := time.ParseDuration(dialTimeoutStr); err == nil {
			config.DialTimeout = dialTimeout
		}
	}

	if readTimeoutStr := os.Getenv("CACHE_READ_TIMEOUT"); readTimeoutStr != "" {
		if readTimeout, err := time.ParseDuration(readTimeoutStr); err == nil {
			config.ReadTimeout = readTimeout
		}
	}

	if writeTimeoutStr := os.Getenv("CACHE_WRITE_TIMEOUT"); writeTimeoutStr != "" {
		if writeTimeout, err := time.ParseDuration(writeTimeoutStr); err == nil {
			config.WriteTimeout = writeTimeout
		}
	}

	if poolTimeoutStr := os.Getenv("CACHE_POOL_TIMEOUT"); poolTimeoutStr != "" {
		if poolTimeout, err := time.ParseDuration(poolTimeoutStr); err == nil {
			config.PoolTimeout = poolTimeout
		}
	}

	// Cache behavior
	if defaultTTLStr := os.Getenv("CACHE_DEFAULT_TTL"); defaultTTLStr != "" {
		if defaultTTL, err := time.ParseDuration(defaultTTLStr); err == nil {
			config.DefaultTTL = defaultTTL
		}
	}

	config.KeyPrefix = os.Getenv("CACHE_KEY_PREFIX")

	// Redis Sentinel specific
	config.MasterName = os.Getenv("CACHE_MASTER_NAME")
	sentinelAddrs := os.Getenv("CACHE_SENTINEL_ADDRS")
	if sentinelAddrs != "" {
		config.SentinelAddrs = strings.Split(sentinelAddrs, ",")
		// Trim whitespace
		for i, addr := range config.SentinelAddrs {
			config.SentinelAddrs[i] = strings.TrimSpace(addr)
		}
	}

	// AWS specific
	config.Region = os.Getenv("CACHE_AWS_REGION")
	config.AccessKey = os.Getenv("CACHE_AWS_ACCESS_KEY")
	config.SecretKey = os.Getenv("CACHE_AWS_SECRET_KEY")
	config.TableName = os.Getenv("CACHE_DYNAMODB_TABLE")

	// TLS settings
	if tlsEnabledStr := os.Getenv("CACHE_TLS_ENABLED"); tlsEnabledStr != "" {
		config.TLSEnabled = tlsEnabledStr == "true"
	}

	if tlsSkipVerifyStr := os.Getenv("CACHE_TLS_SKIP_VERIFY"); tlsSkipVerifyStr != "" {
		config.TLSSkipVerify = tlsSkipVerifyStr == "true"
	}

	config.CertFile = os.Getenv("CACHE_TLS_CERT_FILE")
	config.KeyFile = os.Getenv("CACHE_TLS_KEY_FILE")
	config.CAFile = os.Getenv("CACHE_TLS_CA_FILE")

	// Monitoring
	if metricsEnabledStr := os.Getenv("CACHE_METRICS_ENABLED"); metricsEnabledStr != "" {
		config.MetricsEnabled = metricsEnabledStr == "true"
	} else {
		config.MetricsEnabled = true // default enabled
	}

	config.LogLevel = os.Getenv("CACHE_LOG_LEVEL")
	if config.LogLevel == "" {
		config.LogLevel = "info"
	}

	return config, nil
}

// LoadServiceSpecificConfig loads configuration for a specific service
func LoadServiceSpecificConfig(serviceName string) (*CacheConfig, error) {
	prefix := strings.ToUpper(serviceName) + "_CACHE_"

	config := &CacheConfig{}

	// Service-specific provider
	provider := os.Getenv(prefix + "PROVIDER")
	if provider == "" {
		provider = os.Getenv("CACHE_PROVIDER")
		if provider == "" {
			provider = "redis"
		}
	}
	config.Provider = CacheProvider(provider)

	// Service-specific endpoints
	endpoints := os.Getenv(prefix + "ENDPOINTS")
	if endpoints == "" {
		endpoints = os.Getenv("CACHE_ENDPOINTS")
	}
	if endpoints != "" {
		config.Endpoints = strings.Split(endpoints, ",")
		for i, endpoint := range config.Endpoints {
			config.Endpoints[i] = strings.TrimSpace(endpoint)
		}
	} else {
		// Default based on service
		config.Endpoints = getDefaultEndpointsForService(serviceName)
	}

	// Service-specific credentials
	config.Username = getEnvWithFallback(prefix+"USERNAME", "CACHE_USERNAME")
	config.Password = getEnvWithFallback(prefix+"PASSWORD", "CACHE_PASSWORD")

	// Service-specific database
	if dbStr := getEnvWithFallback(prefix+"DATABASE", "CACHE_DATABASE"); dbStr != "" {
		if db, err := strconv.Atoi(dbStr); err == nil {
			config.Database = db
		}
	}

	// Service-specific key prefix
	config.KeyPrefix = getEnvWithFallback(prefix+"KEY_PREFIX", "CACHE_KEY_PREFIX")
	if config.KeyPrefix == "" {
		config.KeyPrefix = serviceName // Use service name as default prefix
	}

	// Load other settings with fallbacks
	loadConfigWithFallbacks(config, prefix)

	return config, nil
}

// getDefaultEndpointsForService returns default cache endpoints for each service
func getDefaultEndpointsForService(serviceName string) []string {
	switch serviceName {
	case "api-gateway":
		return []string{"redis-gateway:6379"}
	case "user-svc":
		return []string{"redis-user:6379"}
	case "chat-svc":
		return []string{"redis-chat:6379"}
	case "discovery-svc":
		return []string{"redis-discovery:6379"}
	case "search-svc":
		return []string{"redis-user:6379"} // Share with user service
	case "ai-svc":
		return []string{"redis-gateway:6379"} // Share with gateway
	default:
		return []string{"localhost:6379"}
	}
}

// getEnvWithFallback gets environment variable with fallback
func getEnvWithFallback(primary, fallback string) string {
	if value := os.Getenv(primary); value != "" {
		return value
	}
	return os.Getenv(fallback)
}

// loadConfigWithFallbacks loads configuration values with fallback logic
func loadConfigWithFallbacks(config *CacheConfig, prefix string) {
	// Pool settings
	if poolSizeStr := getEnvWithFallback(prefix+"POOL_SIZE", "CACHE_POOL_SIZE"); poolSizeStr != "" {
		if poolSize, err := strconv.Atoi(poolSizeStr); err == nil {
			config.PoolSize = poolSize
		}
	}

	if minIdleStr := getEnvWithFallback(prefix+"MIN_IDLE_CONNS", "CACHE_MIN_IDLE_CONNS"); minIdleStr != "" {
		if minIdle, err := strconv.Atoi(minIdleStr); err == nil {
			config.MinIdleConns = minIdle
		}
	}

	if maxRetriesStr := getEnvWithFallback(prefix+"MAX_RETRIES", "CACHE_MAX_RETRIES"); maxRetriesStr != "" {
		if maxRetries, err := strconv.Atoi(maxRetriesStr); err == nil {
			config.MaxRetries = maxRetries
		}
	}

	// Timeouts
	if dialTimeoutStr := getEnvWithFallback(prefix+"DIAL_TIMEOUT", "CACHE_DIAL_TIMEOUT"); dialTimeoutStr != "" {
		if dialTimeout, err := time.ParseDuration(dialTimeoutStr); err == nil {
			config.DialTimeout = dialTimeout
		}
	}

	if readTimeoutStr := getEnvWithFallback(prefix+"READ_TIMEOUT", "CACHE_READ_TIMEOUT"); readTimeoutStr != "" {
		if readTimeout, err := time.ParseDuration(readTimeoutStr); err == nil {
			config.ReadTimeout = readTimeout
		}
	}

	if writeTimeoutStr := getEnvWithFallback(prefix+"WRITE_TIMEOUT", "CACHE_WRITE_TIMEOUT"); writeTimeoutStr != "" {
		if writeTimeout, err := time.ParseDuration(writeTimeoutStr); err == nil {
			config.WriteTimeout = writeTimeout
		}
	}

	if poolTimeoutStr := getEnvWithFallback(prefix+"POOL_TIMEOUT", "CACHE_POOL_TIMEOUT"); poolTimeoutStr != "" {
		if poolTimeout, err := time.ParseDuration(poolTimeoutStr); err == nil {
			config.PoolTimeout = poolTimeout
		}
	}

	// Cache behavior
	if defaultTTLStr := getEnvWithFallback(prefix+"DEFAULT_TTL", "CACHE_DEFAULT_TTL"); defaultTTLStr != "" {
		if defaultTTL, err := time.ParseDuration(defaultTTLStr); err == nil {
			config.DefaultTTL = defaultTTL
		}
	}

	// Redis Sentinel specific
	config.MasterName = getEnvWithFallback(prefix+"MASTER_NAME", "CACHE_MASTER_NAME")
	sentinelAddrs := getEnvWithFallback(prefix+"SENTINEL_ADDRS", "CACHE_SENTINEL_ADDRS")
	if sentinelAddrs != "" {
		config.SentinelAddrs = strings.Split(sentinelAddrs, ",")
		for i, addr := range config.SentinelAddrs {
			config.SentinelAddrs[i] = strings.TrimSpace(addr)
		}
	}

	// TLS settings
	if tlsEnabledStr := getEnvWithFallback(prefix+"TLS_ENABLED", "CACHE_TLS_ENABLED"); tlsEnabledStr != "" {
		config.TLSEnabled = tlsEnabledStr == "true"
	}

	if tlsSkipVerifyStr := getEnvWithFallback(prefix+"TLS_SKIP_VERIFY", "CACHE_TLS_SKIP_VERIFY"); tlsSkipVerifyStr != "" {
		config.TLSSkipVerify = tlsSkipVerifyStr == "true"
	}

	config.CertFile = getEnvWithFallback(prefix+"TLS_CERT_FILE", "CACHE_TLS_CERT_FILE")
	config.KeyFile = getEnvWithFallback(prefix+"TLS_KEY_FILE", "CACHE_TLS_KEY_FILE")
	config.CAFile = getEnvWithFallback(prefix+"TLS_CA_FILE", "CACHE_TLS_CA_FILE")

	// Monitoring
	if metricsEnabledStr := getEnvWithFallback(prefix+"METRICS_ENABLED", "CACHE_METRICS_ENABLED"); metricsEnabledStr != "" {
		config.MetricsEnabled = metricsEnabledStr == "true"
	} else {
		config.MetricsEnabled = true
	}

	config.LogLevel = getEnvWithFallback(prefix+"LOG_LEVEL", "CACHE_LOG_LEVEL")
	if config.LogLevel == "" {
		config.LogLevel = "info"
	}
}

// ValidateConfig validates cache configuration
func ValidateConfig(config *CacheConfig) error {
	if config.Provider == "" {
		return fmt.Errorf("cache provider is required")
	}

	if len(config.Endpoints) == 0 && len(config.SentinelAddrs) == 0 {
		return fmt.Errorf("either endpoints or sentinel addresses must be provided")
	}

	if config.Provider == ProviderRedis && config.MasterName != "" && len(config.SentinelAddrs) == 0 {
		return fmt.Errorf("sentinel addresses required when master name is specified")
	}

	if config.PoolSize < 0 {
		return fmt.Errorf("pool size must be non-negative")
	}

	if config.MinIdleConns < 0 {
		return fmt.Errorf("minimum idle connections must be non-negative")
	}

	if config.MinIdleConns > config.PoolSize {
		return fmt.Errorf("minimum idle connections cannot exceed pool size")
	}

	if config.MaxRetries < 0 {
		return fmt.Errorf("max retries must be non-negative")
	}

	if config.DialTimeout < 0 {
		return fmt.Errorf("dial timeout must be non-negative")
	}

	if config.ReadTimeout < 0 {
		return fmt.Errorf("read timeout must be non-negative")
	}

	if config.WriteTimeout < 0 {
		return fmt.Errorf("write timeout must be non-negative")
	}

	if config.DefaultTTL < 0 {
		return fmt.Errorf("default TTL must be non-negative")
	}

	return nil
}
