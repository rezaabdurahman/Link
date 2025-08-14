package config

import (
	"os"
	"strconv"
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

	// AI configuration
	AI AIConfig

	// Chat service configuration
	ChatService ChatServiceConfig

	// Logging configuration
	LogLevel  string
	LogFormat string

	// CORS configuration
	CORSAllowedOrigins string
	CORSAllowedMethods string
	CORSAllowedHeaders string

	// Rate limiting
	RateLimitEnabled              bool
	RateLimitRequestsPerMinute    int
	RateLimitAIRequestsPerMinute  int

	// Health check
	HealthCheckInterval time.Duration

	// Monitoring
	EnableMetrics bool
	MetricsPort   string

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
	Host       string
	Port       string
	Password   string
	DB         int
	SummaryTTL time.Duration
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret    string
	ExpiresIn time.Duration
}

// AIConfig holds AI service configuration
type AIConfig struct {
	Provider   string
	APIKey     string
	Model      string
	MaxTokens  int
	Temperature float64
	Timeout    time.Duration
	MaxRetries int
}

// ChatServiceConfig holds chat service configuration
type ChatServiceConfig struct {
	BaseURL                string
	Timeout                time.Duration
	MaxRetries             int
	RetryDelay             time.Duration
	RetryBackoffMultiplier float64
	CircuitBreakerEnabled  bool
	CircuitBreakerTimeout  time.Duration
	CircuitBreakerMaxFails int
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		ServerHost: getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort: getEnv("SERVER_PORT", "8081"),

		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "5432"),
			Name:            getEnv("DB_NAME", "ai_db"),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", ""),
			SSLMode:         getEnv("DB_SSL_MODE", "disable"),
			MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: getEnvAsDuration("DB_CONN_MAX_LIFETIME", 300*time.Second),
		},

		Redis: RedisConfig{
			Host:       getEnv("REDIS_HOST", "localhost"),
			Port:       getEnv("REDIS_PORT", "6379"),
			Password:   getEnv("REDIS_PASSWORD", ""),
			DB:         getEnvAsInt("REDIS_DB", 1),
			SummaryTTL: getEnvAsDuration("SUMMARY_TTL", time.Hour),
		},

		JWT: JWTConfig{
			Secret:    getEnv("JWT_SECRET", "your_jwt_secret_key_here"),
			ExpiresIn: getEnvAsDuration("JWT_EXPIRES_IN", 24*time.Hour),
		},

		AI: AIConfig{
			Provider:    getEnv("AI_PROVIDER", "openai"),
			APIKey:      getEnv("AI_API_KEY", ""),
			Model:       getEnv("AI_MODEL", "gpt-4"),
			MaxTokens:   getEnvAsInt("AI_MAX_TOKENS", 2048),
			Temperature: getEnvAsFloat64("AI_TEMPERATURE", 0.7),
			Timeout:     getEnvAsDuration("AI_TIMEOUT", 30*time.Second),
			MaxRetries:  getEnvAsInt("AI_MAX_RETRIES", 3),
		},

		ChatService: ChatServiceConfig{
			BaseURL:                getEnv("CHAT_SERVICE_URL", "http://localhost:8080"),
			Timeout:                getEnvAsDuration("CHAT_SERVICE_TIMEOUT", 10*time.Second),
			MaxRetries:             getEnvAsInt("CHAT_SERVICE_MAX_RETRIES", 3),
			RetryDelay:             getEnvAsDuration("CHAT_SERVICE_RETRY_DELAY", 100*time.Millisecond),
			RetryBackoffMultiplier: getEnvAsFloat64("CHAT_SERVICE_RETRY_BACKOFF", 2.0),
			CircuitBreakerEnabled:  getEnvAsBool("CHAT_SERVICE_CIRCUIT_BREAKER_ENABLED", true),
			CircuitBreakerTimeout:  getEnvAsDuration("CHAT_SERVICE_CIRCUIT_BREAKER_TIMEOUT", 30*time.Second),
			CircuitBreakerMaxFails: getEnvAsInt("CHAT_SERVICE_CIRCUIT_BREAKER_MAX_FAILS", 5),
		},

		LogLevel:  getEnv("LOG_LEVEL", "info"),
		LogFormat: getEnv("LOG_FORMAT", "json"),

		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		CORSAllowedMethods: getEnv("CORS_ALLOWED_METHODS", "GET,POST,PUT,DELETE,OPTIONS"),
		CORSAllowedHeaders: getEnv("CORS_ALLOWED_HEADERS", "Content-Type,Authorization"),

		RateLimitEnabled:             getEnvAsBool("RATE_LIMIT_ENABLED", true),
		RateLimitRequestsPerMinute:   getEnvAsInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 60),
		RateLimitAIRequestsPerMinute: getEnvAsInt("RATE_LIMIT_AI_REQUESTS_PER_MINUTE", 10),

		HealthCheckInterval: getEnvAsDuration("HEALTH_CHECK_INTERVAL", 30*time.Second),

		EnableMetrics: getEnvAsBool("ENABLE_METRICS", true),
		MetricsPort:   getEnv("METRICS_PORT", "9090"),

		Environment: getEnv("ENVIRONMENT", "development"),
	}

	return cfg, nil
}

// Helper functions for environment variable parsing

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseBool(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	valueStr := getEnv(key, "")
	if value, err := time.ParseDuration(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsFloat64(key string, defaultValue float64) float64 {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
		return value
	}
	return defaultValue
}
