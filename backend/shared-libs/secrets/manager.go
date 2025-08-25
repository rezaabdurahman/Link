package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

// SecretProvider defines the interface for different secret providers
type SecretProvider interface {
	GetSecret(ctx context.Context, key string) (string, error)
	GetSecretMap(ctx context.Context, key string) (map[string]string, error)
	RefreshSecrets(ctx context.Context) error
	Close() error
}

// SecretManager manages secrets from different providers based on environment
type SecretManager struct {
	provider SecretProvider
	cache    map[string]secretValue
	mutex    sync.RWMutex
	config   *Config
}

type secretValue struct {
	value     string
	expiresAt time.Time
}

// Config holds configuration for the secret manager
type Config struct {
	Environment       string
	CacheExpiration   time.Duration
	RefreshInterval   time.Duration
	AWSRegion         string
	SecretPrefix      string
	KubernetesEnabled bool
}

// NewSecretManager creates a new secret manager based on environment
func NewSecretManager(cfg *Config) (*SecretManager, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	var provider SecretProvider
	var err error

	switch strings.ToLower(cfg.Environment) {
	case "production", "staging":
		// Use AWS Secrets Manager for production/staging
		provider, err = NewAWSSecretsProvider(cfg)
	case "development":
		// Use K8s secrets for development cluster
		if cfg.KubernetesEnabled {
			provider, err = NewKubernetesSecretsProvider(cfg)
		} else {
			provider = NewEnvSecretsProvider(cfg)
		}
	case "local", "test":
		// Use environment variables/.env files for local development
		provider = NewEnvSecretsProvider(cfg)
	default:
		return nil, fmt.Errorf("unsupported environment: %s", cfg.Environment)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create secret provider: %w", err)
	}

	manager := &SecretManager{
		provider: provider,
		cache:    make(map[string]secretValue),
		config:   cfg,
	}

	// Start background refresh for production environments
	if strings.ToLower(cfg.Environment) == "production" || strings.ToLower(cfg.Environment) == "staging" {
		go manager.startBackgroundRefresh()
	}

	return manager, nil
}

// DefaultConfig returns a default configuration
func DefaultConfig() *Config {
	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		env = "local"
	}

	return &Config{
		Environment:       env,
		CacheExpiration:   15 * time.Minute,
		RefreshInterval:   5 * time.Minute,
		AWSRegion:         os.Getenv("AWS_REGION"),
		SecretPrefix:      "link-app",
		KubernetesEnabled: os.Getenv("KUBERNETES_SERVICE_HOST") != "",
	}
}

// GetSecret retrieves a secret value
func (m *SecretManager) GetSecret(key string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check cache first for production environments
	if m.config.Environment == "production" || m.config.Environment == "staging" {
		if cachedValue, found := m.getCachedSecret(key); found {
			return cachedValue, nil
		}
	}

	value, err := m.provider.GetSecret(ctx, key)
	if err != nil {
		return "", fmt.Errorf("failed to get secret %s: %w", key, err)
	}

	// Cache the value for production environments
	if m.config.Environment == "production" || m.config.Environment == "staging" {
		m.setCachedSecret(key, value)
	}

	return value, nil
}

// GetSecretMap retrieves a secret as a map (useful for JSON secrets)
func (m *SecretManager) GetSecretMap(key string) (map[string]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return m.provider.GetSecretMap(ctx, key)
}

// getCachedSecret retrieves a secret from cache if not expired
func (m *SecretManager) getCachedSecret(key string) (string, bool) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if cached, exists := m.cache[key]; exists {
		if time.Now().Before(cached.expiresAt) {
			return cached.value, true
		}
		// Remove expired cache entry
		delete(m.cache, key)
	}
	return "", false
}

// setCachedSecret stores a secret in cache
func (m *SecretManager) setCachedSecret(key, value string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.cache[key] = secretValue{
		value:     value,
		expiresAt: time.Now().Add(m.config.CacheExpiration),
	}
}

// startBackgroundRefresh starts a background goroutine to refresh secrets
func (m *SecretManager) startBackgroundRefresh() {
	ticker := time.NewTicker(m.config.RefreshInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		if err := m.provider.RefreshSecrets(ctx); err != nil {
			// Log error but don't fail - use cached values
			fmt.Printf("Failed to refresh secrets: %v\n", err)
		}
		cancel()
	}
}

// Close closes the secret manager and its provider
func (m *SecretManager) Close() error {
	return m.provider.Close()
}

// Global secret manager instance
var globalSecretManager *SecretManager
var initOnce sync.Once

// InitGlobalSecretManager initializes the global secret manager
func InitGlobalSecretManager(cfg *Config) error {
	var err error
	initOnce.Do(func() {
		globalSecretManager, err = NewSecretManager(cfg)
	})
	return err
}

// GetGlobalSecret retrieves a secret using the global manager
func GetGlobalSecret(key string) (string, error) {
	if globalSecretManager == nil {
		return "", fmt.Errorf("secret manager not initialized")
	}
	return globalSecretManager.GetSecret(key)
}

// Helper functions for common secrets
func GetDatabasePassword() (string, error) {
	return GetGlobalSecret("DB_PASSWORD")
}

func GetJWTSecret() (string, error) {
	return GetGlobalSecret("JWT_SECRET")
}

func GetRedisPassword() (string, error) {
	return GetGlobalSecret("REDIS_PASSWORD")
}

func GetOpenAIAPIKey() (string, error) {
	return GetGlobalSecret("OPENAI_API_KEY")
}

// AWS Secrets Manager Provider
type AWSSecretsProvider struct {
	client *secretsmanager.Client
	config *Config
}

func NewAWSSecretsProvider(cfg *Config) (*AWSSecretsProvider, error) {
	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &AWSSecretsProvider{
		client: secretsmanager.NewFromConfig(awsCfg),
		config: cfg,
	}, nil
}

func (p *AWSSecretsProvider) GetSecret(ctx context.Context, key string) (string, error) {
	secretName := fmt.Sprintf("%s/%s", p.config.SecretPrefix, key)
	
	result, err := p.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(secretName),
	})
	if err != nil {
		return "", fmt.Errorf("failed to get secret from AWS: %w", err)
	}

	if result.SecretString != nil {
		return *result.SecretString, nil
	}

	return string(result.SecretBinary), nil
}

func (p *AWSSecretsProvider) GetSecretMap(ctx context.Context, key string) (map[string]string, error) {
	secretValue, err := p.GetSecret(ctx, key)
	if err != nil {
		return nil, err
	}

	var secretMap map[string]string
	if err := json.Unmarshal([]byte(secretValue), &secretMap); err != nil {
		return nil, fmt.Errorf("failed to parse secret as JSON: %w", err)
	}

	return secretMap, nil
}

func (p *AWSSecretsProvider) RefreshSecrets(ctx context.Context) error {
	// AWS Secrets Manager handles rotation automatically
	return nil
}

func (p *AWSSecretsProvider) Close() error {
	return nil
}

// Kubernetes Secrets Provider
type KubernetesSecretsProvider struct {
	config *Config
	// In a real implementation, this would use the Kubernetes client
}

func NewKubernetesSecretsProvider(cfg *Config) (*KubernetesSecretsProvider, error) {
	return &KubernetesSecretsProvider{
		config: cfg,
	}, nil
}

func (p *KubernetesSecretsProvider) GetSecret(ctx context.Context, key string) (string, error) {
	// For now, fall back to environment variables
	// In production, this would use the Kubernetes API
	secretPath := fmt.Sprintf("/var/secrets/%s", key)
	if data, err := os.ReadFile(secretPath); err == nil {
		return strings.TrimSpace(string(data)), nil
	}

	// Fallback to environment variable
	if value := os.Getenv(key); value != "" {
		return value, nil
	}

	return "", fmt.Errorf("secret not found: %s", key)
}

func (p *KubernetesSecretsProvider) GetSecretMap(ctx context.Context, key string) (map[string]string, error) {
	secretValue, err := p.GetSecret(ctx, key)
	if err != nil {
		return nil, err
	}

	var secretMap map[string]string
	if err := json.Unmarshal([]byte(secretValue), &secretMap); err != nil {
		// If not JSON, return as single key-value pair
		return map[string]string{key: secretValue}, nil
	}

	return secretMap, nil
}

func (p *KubernetesSecretsProvider) RefreshSecrets(ctx context.Context) error {
	return nil
}

func (p *KubernetesSecretsProvider) Close() error {
	return nil
}

// Environment Variables Provider (for local/dev)
type EnvSecretsProvider struct {
	config *Config
}

func NewEnvSecretsProvider(cfg *Config) *EnvSecretsProvider {
	return &EnvSecretsProvider{
		config: cfg,
	}
}

func (p *EnvSecretsProvider) GetSecret(ctx context.Context, key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("environment variable not found: %s", key)
	}
	return value, nil
}

func (p *EnvSecretsProvider) GetSecretMap(ctx context.Context, key string) (map[string]string, error) {
	secretValue, err := p.GetSecret(ctx, key)
	if err != nil {
		return nil, err
	}

	var secretMap map[string]string
	if err := json.Unmarshal([]byte(secretValue), &secretMap); err != nil {
		// If not JSON, return as single key-value pair
		return map[string]string{key: secretValue}, nil
	}

	return secretMap, nil
}

func (p *EnvSecretsProvider) RefreshSecrets(ctx context.Context) error {
	return nil
}

func (p *EnvSecretsProvider) Close() error {
	return nil
}