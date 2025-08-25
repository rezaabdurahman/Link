package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	// Server configuration
	ServerHost string
	ServerPort string

	// Database configuration
	Database DatabaseConfig

	// Redis configuration
	Redis RedisConfig

	// JWT configuration
	JWT JWTConfig

	// WebSocket configuration
	WebSocket WebSocketConfig

	// Logging configuration
	LogLevel  string
	LogFormat string

	// CORS configuration
	CORSAllowedOrigins string
	CORSAllowedMethods string
	CORSAllowedHeaders string

	// Rate limiting
	RateLimitEnabled           bool
	RateLimitRequestsPerMinute int

	// Health check
	HealthCheckInterval time.Duration

	// Environment
	Environment string
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host            string
	Port            string
	Name            string
	User            string
	Password        string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret    string
	ExpiresIn time.Duration
}

// WebSocketConfig holds WebSocket configuration
type WebSocketConfig struct {
	ReadBufferSize  int
	WriteBufferSize int
	MaxMessageSize  int64
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		ServerHost: GetEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort: GetEnv("SERVER_PORT", "8080"),

		Database: DatabaseConfig{
			Host:            GetEnv("DB_HOST", "localhost"),
			Port:            GetEnv("DB_PORT", "5432"),
			Name:            GetEnv("DB_NAME", "chat_db"),
			User:            GetEnv("DB_USER", "postgres"),
			Password:        GetDatabasePassword(), // Use shared secrets management
			SSLMode:         GetEnv("DB_SSL_MODE", "disable"),
			MaxOpenConns:    GetEnvAsInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    GetEnvAsInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: GetEnvAsDuration("DB_CONN_MAX_LIFETIME", 300*time.Second),
		},

		Redis: RedisConfig{
			Host:     GetEnv("REDIS_HOST", "localhost"),
			Port:     GetEnv("REDIS_PORT", "6379"),
			Password: GetRedisPassword(), // Use shared secrets management
			DB:       GetEnvAsInt("REDIS_DB", 0),
		},

		JWT: JWTConfig{
			Secret:    GetJWTSecret(), // Use shared secrets management
			ExpiresIn: GetEnvAsDuration("JWT_EXPIRES_IN", 24*time.Hour),
		},

		WebSocket: WebSocketConfig{
			ReadBufferSize:  GetEnvAsInt("WS_READ_BUFFER_SIZE", 1024),
			WriteBufferSize: GetEnvAsInt("WS_WRITE_BUFFER_SIZE", 1024),
			MaxMessageSize:  int64(GetEnvAsInt("WS_MAX_MESSAGE_SIZE", 512)),
		},

		LogLevel:  GetEnv("LOG_LEVEL", "info"),
		LogFormat: GetEnv("LOG_FORMAT", "json"),

		CORSAllowedOrigins: GetEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		CORSAllowedMethods: GetEnv("CORS_ALLOWED_METHODS", "GET,POST,PUT,DELETE,OPTIONS"),
		CORSAllowedHeaders: GetEnv("CORS_ALLOWED_HEADERS", "Content-Type,Authorization"),

		RateLimitEnabled:           GetEnvAsBool("RATE_LIMIT_ENABLED", true),
		RateLimitRequestsPerMinute: GetEnvAsInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 100),

		HealthCheckInterval: GetEnvAsDuration("HEALTH_CHECK_INTERVAL", 30*time.Second),

		Environment: GetEnv("ENVIRONMENT", "development"),
	}

	return cfg, nil
}

// Helper functions for environment variable parsing

// GetEnv retrieves an environment variable with fallback
func GetEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetEnvAsInt retrieves an environment variable as integer
func GetEnvAsInt(key string, defaultValue int) int {
	valueStr := GetEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

// GetEnvAsBool retrieves an environment variable as boolean
func GetEnvAsBool(key string, defaultValue bool) bool {
	valueStr := strings.ToLower(GetEnv(key, ""))
	switch valueStr {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	default:
		return defaultValue
	}
}

// GetEnvAsDuration retrieves an environment variable as duration
func GetEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	valueStr := GetEnv(key, "")
	if value, err := time.ParseDuration(valueStr); err == nil {
		return value
	}
	return defaultValue
}

// GetDatabasePassword retrieves database password
func GetDatabasePassword() string {
	return GetEnv("DB_PASSWORD", "linkpass")
}

// GetJWTSecret retrieves JWT signing secret
func GetJWTSecret() string {
	return GetEnv("JWT_SECRET", "dev-secret-key-change-in-production")
}

// GetRedisPassword retrieves Redis password
func GetRedisPassword() string {
	return GetEnv("REDIS_PASSWORD", "")
}

