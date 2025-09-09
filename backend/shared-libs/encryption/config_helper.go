package encryption

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
)

// NewVersionedEncryptorFromConfig creates a versioned encryptor from configuration
func NewVersionedEncryptorFromConfig(configMap map[string]string) (*VersionedDataEncryptor, error) {
	currentKey, exists := configMap["current_key"]
	if !exists || currentKey == "" {
		return nil, fmt.Errorf("current_key is required")
	}
	
	// Parse current version
	currentVersionStr := configMap["current_version"]
	if currentVersionStr == "" {
		currentVersionStr = "2" // Default to v2
	}
	
	currentVersionInt, err := strconv.Atoi(currentVersionStr)
	if err != nil {
		return nil, fmt.Errorf("invalid current_version: %w", err)
	}
	currentVersion := uint16(currentVersionInt)
	
	// Parse legacy keys
	legacyKeys := make(map[uint16]string)
	legacyKeysStr := configMap["legacy_keys"]
	if legacyKeysStr != "" && legacyKeysStr != "{}" {
		var legacyKeysMap map[string]string
		if err := json.Unmarshal([]byte(legacyKeysStr), &legacyKeysMap); err != nil {
			return nil, fmt.Errorf("invalid legacy_keys JSON: %w", err)
		}
		
		for versionStr, key := range legacyKeysMap {
			version, err := strconv.Atoi(versionStr)
			if err != nil {
				return nil, fmt.Errorf("invalid legacy key version %s: %w", versionStr, err)
			}
			legacyKeys[uint16(version)] = key
		}
	}
	
	config := KeyConfig{
		CurrentKey:     currentKey,
		CurrentVersion: currentVersion,
		LegacyKeys:     legacyKeys,
	}
	
	return NewVersionedDataEncryptor(config), nil
}

// NewServiceEncryptor creates a versioned encryptor from environment variables
// This is the main function services should use
func NewServiceEncryptor() (*VersionedDataEncryptor, error) {
	// Get configuration from environment variables (set by K8s secrets)
	configMap := map[string]string{
		"current_key":     getEnvOrDefault("DATA_ENCRYPTION_KEY", "dev-encryption-key-change-in-production"),
		"current_version": getEnvOrDefault("DATA_ENCRYPTION_VERSION", "2"),
		"legacy_keys":     getEnvOrDefault("DATA_ENCRYPTION_LEGACY_KEYS", "{}"),
	}
	
	return NewVersionedEncryptorFromConfig(configMap)
}

// Helper function to get environment variables with defaults
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// SafeKeyRotation performs a safe key rotation with validation
func SafeKeyRotation(encryptor *VersionedDataEncryptor, newKey string) error {
	if newKey == "" {
		return fmt.Errorf("new key cannot be empty")
	}
	
	// Test the new key works
	testData := "key-rotation-validation-test"
	tempEncryptor := NewEncryptor(newKey)
	encrypted, err := tempEncryptor.EncryptString(testData)
	if err != nil {
		return fmt.Errorf("new key validation failed: %w", err)
	}
	
	decrypted, err := tempEncryptor.DecryptString(encrypted)
	if err != nil {
		return fmt.Errorf("new key validation failed on decrypt: %w", err)
	}
	
	if decrypted != testData {
		return fmt.Errorf("new key validation failed: data mismatch")
	}
	
	// Validate current keys before rotation
	if err := encryptor.ValidateAllKeys(); err != nil {
		return fmt.Errorf("current keys validation failed: %w", err)
	}
	
	// Perform the rotation
	encryptor.RotateKey(newKey)
	
	// Validate after rotation
	if err := encryptor.ValidateAllKeys(); err != nil {
		return fmt.Errorf("post-rotation validation failed: %w", err)
	}
	
	return nil
}

// GetEncryptionMetrics returns metrics about encryption usage
type EncryptionMetrics struct {
	CurrentVersion    uint16            `json:"current_version"`
	LegacyVersions    []uint16          `json:"legacy_versions"`
	HasCurrentKey     bool              `json:"has_current_key"`
	LegacyKeyCount    int               `json:"legacy_key_count"`
	KeyStats          map[string]interface{} `json:"key_stats"`
}

func GetEncryptionMetrics(encryptor *VersionedDataEncryptor) EncryptionMetrics {
	stats := encryptor.GetEncryptionStats()
	
	return EncryptionMetrics{
		CurrentVersion: stats["current_version"].(uint16),
		LegacyVersions: stats["legacy_versions"].([]uint16),
		HasCurrentKey:  stats["has_current_key"].(bool),
		LegacyKeyCount: stats["legacy_key_count"].(int),
		KeyStats:      stats,
	}
}