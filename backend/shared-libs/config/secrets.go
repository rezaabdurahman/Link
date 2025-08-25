package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/link-app/shared-libs/secrets"
)

// Global secrets manager instance
var globalSecretsManager *secrets.SecretManager

// InitSecrets initializes the global secrets manager
func InitSecrets() error {
	environment := GetEnv("ENVIRONMENT", "local")
	
	secretsConfig := &secrets.Config{
		Environment:       environment,
		AWSRegion:         GetEnv("AWS_REGION", "us-west-2"),
		SecretPrefix:      "link-app",
		KubernetesEnabled: os.Getenv("KUBERNETES_SERVICE_HOST") != "",
	}

	manager, err := secrets.NewSecretManager(secretsConfig)
	if err != nil {
		return fmt.Errorf("failed to initialize secrets manager: %w", err)
	}

	globalSecretsManager = manager
	return nil
}

// CloseSecrets closes the global secrets manager
func CloseSecrets() error {
	if globalSecretsManager != nil {
		return globalSecretsManager.Close()
	}
	return nil
}

// GetEnv retrieves a non-sensitive environment variable with fallback
// Use this for non-sensitive configuration like ports, hosts, etc.
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

// GetEnvAsFloat64 retrieves an environment variable as float64
func GetEnvAsFloat64(key string, defaultValue float64) float64 {
	valueStr := GetEnv(key, "")
	if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
		return value
	}
	return defaultValue
}

// GetSecret retrieves a sensitive value using environment-aware secrets management
// Use this for passwords, API keys, tokens, etc.
func GetSecret(key, defaultValue string) string {
	environment := GetEnv("ENVIRONMENT", "local")
	
	// For local and test environments, use environment variables directly
	if environment == "local" || environment == "test" {
		if value := os.Getenv(key); value != "" {
			return value
		}
		return defaultValue
	}

	// For staging and production, use the secrets manager
	if globalSecretsManager != nil {
		if value, err := globalSecretsManager.GetSecret(key); err == nil && value != "" {
			return value
		}
	}

	// Fallback to environment variable
	if value := os.Getenv(key); value != "" {
		return value
	}

	return defaultValue
}

// Common secrets - these should be used across all services

// GetDatabasePassword retrieves database password
func GetDatabasePassword() string {
	return GetSecret("DB_PASSWORD", "linkpass")
}

// GetJWTSecret retrieves JWT signing secret
func GetJWTSecret() string {
	return GetSecret("JWT_SECRET", "dev-secret-key-change-in-production")
}

// GetRedisPassword retrieves Redis password
func GetRedisPassword() string {
	return GetSecret("REDIS_PASSWORD", "")
}

// GetAWSKMSKeyID retrieves AWS KMS key ID for encryption
func GetAWSKMSKeyID() string {
	return GetSecret("AWS_KMS_KEY_ID", "")
}

// GetOpenAIAPIKey retrieves OpenAI API key
func GetOpenAIAPIKey() string {
	return GetSecret("OPENAI_API_KEY", "")
}

// GetSentryDSN retrieves Sentry DSN for error reporting
func GetSentryDSN() string {
	return GetSecret("SENTRY_DSN", "")
}

// GetQdrantAPIKey retrieves Qdrant API key for vector database
func GetQdrantAPIKey() string {
	return GetSecret("QDRANT_API_KEY", "")
}

// GetSlackWebhookURL retrieves Slack webhook URL for notifications
func GetSlackWebhookURL() string {
	return GetSecret("SLACK_WEBHOOK_URL", "")
}