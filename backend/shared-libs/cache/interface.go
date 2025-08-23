package cache

import (
	"context"
	"time"
)

// CacheProvider represents different cache backends
type CacheProvider string

const (
	ProviderRedis       CacheProvider = "redis"
	ProviderMemcached   CacheProvider = "memcached"
	ProviderMemory      CacheProvider = "memory"
	ProviderDynamoDB    CacheProvider = "dynamodb"
	ProviderElastiCache CacheProvider = "elasticache"
	ProviderCloudflare  CacheProvider = "cloudflare"
)

// CacheInterface defines the contract for all cache implementations
// This interface enables easy switching between different cache providers
type CacheInterface interface {
	// Basic operations
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	Exists(ctx context.Context, key string) (bool, error)

	// Batch operations
	GetMulti(ctx context.Context, keys []string) (map[string][]byte, error)
	SetMulti(ctx context.Context, items map[string]CacheItem) error
	DeleteMulti(ctx context.Context, keys []string) error

	// Advanced operations
	Increment(ctx context.Context, key string, delta int64) (int64, error)
	Decrement(ctx context.Context, key string, delta int64) (int64, error)
	Expire(ctx context.Context, key string, ttl time.Duration) error
	TTL(ctx context.Context, key string) (time.Duration, error)

	// Pattern operations
	Keys(ctx context.Context, pattern string) ([]string, error)
	Scan(ctx context.Context, cursor uint64, pattern string, count int64) ([]string, uint64, error)
	DeletePattern(ctx context.Context, pattern string) error

	// Pipeline operations (for performance)
	Pipeline() CachePipeline

	// Health and monitoring
	Ping(ctx context.Context) error
	Stats(ctx context.Context) (*CacheStats, error)

	// Connection management
	Close() error
}

// CacheItem represents a cache entry with metadata
type CacheItem struct {
	Key   string
	Value []byte
	TTL   time.Duration
}

// CachePipeline allows batching multiple operations for performance
type CachePipeline interface {
	Get(key string) *PipelineCmd
	Set(key string, value []byte, ttl time.Duration) *PipelineCmd
	Delete(key string) *PipelineCmd
	Increment(key string, delta int64) *PipelineCmd
	Exec(ctx context.Context) error
	Discard()
}

// PipelineCmd represents a command in a pipeline
type PipelineCmd struct {
	Key    string
	Result []byte
	Error  error
}

// CacheStats provides cache performance metrics
type CacheStats struct {
	Provider      CacheProvider    `json:"provider"`
	Connected     bool             `json:"connected"`
	Uptime        time.Duration    `json:"uptime"`
	HitCount      int64            `json:"hit_count"`
	MissCount     int64            `json:"miss_count"`
	HitRate       float64          `json:"hit_rate"`
	KeyCount      int64            `json:"key_count"`
	Memory        *MemoryStats     `json:"memory,omitempty"`
	Connections   *ConnectionStats `json:"connections,omitempty"`
	Operations    *OperationStats  `json:"operations,omitempty"`
	LastResetTime time.Time        `json:"last_reset_time"`
}

// MemoryStats provides memory usage information
type MemoryStats struct {
	UsedBytes    int64   `json:"used_bytes"`
	MaxBytes     int64   `json:"max_bytes"`
	UsagePercent float64 `json:"usage_percent"`
	EvictedKeys  int64   `json:"evicted_keys"`
}

// ConnectionStats provides connection pool information
type ConnectionStats struct {
	ActiveConns int `json:"active_connections"`
	IdleConns   int `json:"idle_connections"`
	MaxConns    int `json:"max_connections"`
	TotalConns  int `json:"total_connections"`
}

// OperationStats provides operation performance metrics
type OperationStats struct {
	TotalOps     int64   `json:"total_operations"`
	OpsPerSecond float64 `json:"operations_per_second"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
	ErrorCount   int64   `json:"error_count"`
	ErrorRate    float64 `json:"error_rate"`
	SlowOps      int64   `json:"slow_operations"`
}

// CacheConfig holds configuration for cache providers
type CacheConfig struct {
	Provider CacheProvider `json:"provider" yaml:"provider"`

	// Connection settings
	Endpoints []string `json:"endpoints" yaml:"endpoints"`
	Username  string   `json:"username,omitempty" yaml:"username,omitempty"`
	Password  string   `json:"password,omitempty" yaml:"password,omitempty"`
	Database  int      `json:"database,omitempty" yaml:"database,omitempty"`

	// Pool settings
	PoolSize     int `json:"pool_size" yaml:"pool_size"`
	MinIdleConns int `json:"min_idle_conns" yaml:"min_idle_conns"`
	MaxRetries   int `json:"max_retries" yaml:"max_retries"`

	// Timeout settings
	DialTimeout  time.Duration `json:"dial_timeout" yaml:"dial_timeout"`
	ReadTimeout  time.Duration `json:"read_timeout" yaml:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout" yaml:"write_timeout"`
	PoolTimeout  time.Duration `json:"pool_timeout" yaml:"pool_timeout"`

	// Cache behavior
	DefaultTTL time.Duration `json:"default_ttl" yaml:"default_ttl"`
	KeyPrefix  string        `json:"key_prefix" yaml:"key_prefix"`

	// Redis-specific
	MasterName    string   `json:"master_name,omitempty" yaml:"master_name,omitempty"` // For Redis Sentinel
	SentinelAddrs []string `json:"sentinel_addrs,omitempty" yaml:"sentinel_addrs,omitempty"`

	// AWS-specific (for ElastiCache/DynamoDB)
	Region    string `json:"region,omitempty" yaml:"region,omitempty"`
	AccessKey string `json:"access_key,omitempty" yaml:"access_key,omitempty"`
	SecretKey string `json:"secret_key,omitempty" yaml:"secret_key,omitempty"`
	TableName string `json:"table_name,omitempty" yaml:"table_name,omitempty"`

	// TLS settings
	TLSEnabled    bool   `json:"tls_enabled" yaml:"tls_enabled"`
	TLSSkipVerify bool   `json:"tls_skip_verify" yaml:"tls_skip_verify"`
	CertFile      string `json:"cert_file,omitempty" yaml:"cert_file,omitempty"`
	KeyFile       string `json:"key_file,omitempty" yaml:"key_file,omitempty"`
	CAFile        string `json:"ca_file,omitempty" yaml:"ca_file,omitempty"`

	// Monitoring
	MetricsEnabled bool   `json:"metrics_enabled" yaml:"metrics_enabled"`
	LogLevel       string `json:"log_level" yaml:"log_level"`
}

// Common cache errors
var (
	ErrCacheMiss     = NewCacheError("cache miss", ErrorTypeMiss)
	ErrCacheTimeout  = NewCacheError("cache timeout", ErrorTypeTimeout)
	ErrCacheNotFound = NewCacheError("cache not found", ErrorTypeNotFound)
	ErrCacheInvalid  = NewCacheError("invalid cache operation", ErrorTypeInvalid)
	ErrCacheConnFail = NewCacheError("cache connection failed", ErrorTypeConnection)
)

// ErrorType represents different types of cache errors
type ErrorType string

const (
	ErrorTypeMiss       ErrorType = "miss"
	ErrorTypeTimeout    ErrorType = "timeout"
	ErrorTypeNotFound   ErrorType = "not_found"
	ErrorTypeInvalid    ErrorType = "invalid"
	ErrorTypeConnection ErrorType = "connection"
	ErrorTypeInternal   ErrorType = "internal"
)

// CacheError provides structured error information
type CacheError struct {
	Type     ErrorType     `json:"type"`
	Message  string        `json:"message"`
	Provider CacheProvider `json:"provider,omitempty"`
	Key      string        `json:"key,omitempty"`
	Cause    error         `json:"cause,omitempty"`
}

func (e *CacheError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e *CacheError) Unwrap() error {
	return e.Cause
}

func (e *CacheError) IsMiss() bool {
	return e.Type == ErrorTypeMiss
}

func (e *CacheError) IsTimeout() bool {
	return e.Type == ErrorTypeTimeout
}

func (e *CacheError) IsConnectionError() bool {
	return e.Type == ErrorTypeConnection
}

// NewCacheError creates a new cache error
func NewCacheError(message string, errorType ErrorType) *CacheError {
	return &CacheError{
		Type:    errorType,
		Message: message,
	}
}

// WrapCacheError wraps an existing error as a cache error
func WrapCacheError(err error, errorType ErrorType, message string) *CacheError {
	return &CacheError{
		Type:    errorType,
		Message: message,
		Cause:   err,
	}
}
