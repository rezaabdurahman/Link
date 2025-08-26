package config

import (
	"time"
	
	sharedConfig "github.com/link-app/shared-libs/config"
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
		ServerHost: sharedConfig.GetEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort: sharedConfig.GetEnv("SERVER_PORT", "8081"),

		Database: DatabaseConfig{
			Host:            sharedConfig.GetEnv("DB_HOST", "localhost"),
			Port:            sharedConfig.GetEnv("DB_PORT", "5432"),
			Name:            sharedConfig.GetEnv("DB_NAME", "ai_db"),
			User:            sharedConfig.GetEnv("DB_USER", "postgres"),
			Password:        sharedConfig.GetDatabasePassword(), // Use shared secrets management
			SSLMode:         sharedConfig.GetEnv("DB_SSL_MODE", "disable"),
			MaxOpenConns:    sharedConfig.GetEnvAsInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    sharedConfig.GetEnvAsInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: sharedConfig.GetEnvAsDuration("DB_CONN_MAX_LIFETIME", 300*time.Second),
		},

		Redis: RedisConfig{
			Host:       sharedConfig.GetEnv("REDIS_HOST", "localhost"),
			Port:       sharedConfig.GetEnv("REDIS_PORT", "6379"),
			Password:   sharedConfig.GetRedisPassword(), // Use shared secrets management
			DB:         sharedConfig.GetEnvAsInt("REDIS_DB", 1),
			SummaryTTL: sharedConfig.GetEnvAsDuration("SUMMARY_TTL", time.Hour),
		},

		JWT: JWTConfig{
			Secret:    sharedConfig.GetJWTSecret(), // Use shared secrets management
			ExpiresIn: sharedConfig.GetEnvAsDuration("JWT_EXPIRES_IN", 24*time.Hour),
		},

		AI: AIConfig{
			Provider:    sharedConfig.GetEnv("AI_PROVIDER", "openai"),
			APIKey:      sharedConfig.GetOpenAIAPIKey(), // Use shared secrets management
			Model:       sharedConfig.GetEnv("AI_MODEL", "gpt-4"),
			MaxTokens:   sharedConfig.GetEnvAsInt("AI_MAX_TOKENS", 2048),
			Temperature: sharedConfig.GetEnvAsFloat64("AI_TEMPERATURE", 0.7),
			Timeout:     sharedConfig.GetEnvAsDuration("AI_TIMEOUT", 30*time.Second),
			MaxRetries:  sharedConfig.GetEnvAsInt("AI_MAX_RETRIES", 3),
		},

		ChatService: ChatServiceConfig{
			BaseURL:                sharedConfig.GetEnv("CHAT_SERVICE_URL", "http://localhost:8080"),
			Timeout:                sharedConfig.GetEnvAsDuration("CHAT_SERVICE_TIMEOUT", 10*time.Second),
			MaxRetries:             sharedConfig.GetEnvAsInt("CHAT_SERVICE_MAX_RETRIES", 3),
			RetryDelay:             sharedConfig.GetEnvAsDuration("CHAT_SERVICE_RETRY_DELAY", 100*time.Millisecond),
			RetryBackoffMultiplier: sharedConfig.GetEnvAsFloat64("CHAT_SERVICE_RETRY_BACKOFF", 2.0),
			CircuitBreakerEnabled:  sharedConfig.GetEnvAsBool("CHAT_SERVICE_CIRCUIT_BREAKER_ENABLED", true),
			CircuitBreakerTimeout:  sharedConfig.GetEnvAsDuration("CHAT_SERVICE_CIRCUIT_BREAKER_TIMEOUT", 30*time.Second),
			CircuitBreakerMaxFails: sharedConfig.GetEnvAsInt("CHAT_SERVICE_CIRCUIT_BREAKER_MAX_FAILS", 5),
		},

		LogLevel:  sharedConfig.GetEnv("LOG_LEVEL", "info"),
		LogFormat: sharedConfig.GetEnv("LOG_FORMAT", "json"),

		CORSAllowedOrigins: sharedConfig.GetEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		CORSAllowedMethods: sharedConfig.GetEnv("CORS_ALLOWED_METHODS", "GET,POST,PUT,DELETE,OPTIONS"),
		CORSAllowedHeaders: sharedConfig.GetEnv("CORS_ALLOWED_HEADERS", "Content-Type,Authorization"),

		RateLimitEnabled:             sharedConfig.GetEnvAsBool("RATE_LIMIT_ENABLED", true),
		RateLimitRequestsPerMinute:   sharedConfig.GetEnvAsInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 60),
		RateLimitAIRequestsPerMinute: sharedConfig.GetEnvAsInt("RATE_LIMIT_AI_REQUESTS_PER_MINUTE", 10),

		HealthCheckInterval: sharedConfig.GetEnvAsDuration("HEALTH_CHECK_INTERVAL", 30*time.Second),

		EnableMetrics: sharedConfig.GetEnvAsBool("ENABLE_METRICS", true),
		MetricsPort:   sharedConfig.GetEnv("METRICS_PORT", "9090"),

		Environment: sharedConfig.GetEnv("ENVIRONMENT", "development"),
	}

	return cfg, nil
}

