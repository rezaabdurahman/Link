package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

// Constants for versioned encryption
const (
	// Current encryption version
	CurrentVersion = uint16(2)
	
	// Version header size (2 bytes for version)
	VersionHeaderSize = 2
	
	// Legacy version identifiers
	LegacyV1 = uint16(1)
	
	// Minimum lengths including version header
	MinVersionedEncryptedLength = VersionHeaderSize + MinEncryptedDataLength
	MinVersionedBase64Length = MinBase64EncryptedLength + 4 // Account for version encoding
)

// VersionedDataEncryptor provides field-level encryption with key versioning support
type VersionedDataEncryptor struct {
	currentKey    string            // Current key for new encryptions
	currentVersion uint16           // Current version number
	legacyKeys    map[uint16]string // Legacy keys for decrypting old data
}

// KeyConfig represents encryption key configuration
type KeyConfig struct {
	CurrentKey     string            `json:"current_key"`
	CurrentVersion uint16            `json:"current_version"`
	LegacyKeys     map[uint16]string `json:"legacy_keys,omitempty"`
}

// NewVersionedDataEncryptor creates a new versioned data encryptor
func NewVersionedDataEncryptor(config KeyConfig) *VersionedDataEncryptor {
	if config.CurrentVersion == 0 {
		config.CurrentVersion = CurrentVersion
	}
	
	if config.LegacyKeys == nil {
		config.LegacyKeys = make(map[uint16]string)
	}
	
	return &VersionedDataEncryptor{
		currentKey:     config.CurrentKey,
		currentVersion: config.CurrentVersion,
		legacyKeys:     config.LegacyKeys,
	}
}

// NewEncryptor creates a versioned encryptor with just a current key (simplified constructor)
func NewEncryptor(currentKey string) *VersionedDataEncryptor {
	return NewVersionedDataEncryptor(KeyConfig{
		CurrentKey:     currentKey,
		CurrentVersion: CurrentVersion,
		LegacyKeys:     make(map[uint16]string),
	})
}

// AddLegacyKey adds a legacy key for backward compatibility during key rotation
func (e *VersionedDataEncryptor) AddLegacyKey(version uint16, key string) {
	if e.legacyKeys == nil {
		e.legacyKeys = make(map[uint16]string)
	}
	e.legacyKeys[version] = key
}

// RotateKey performs a key rotation, moving current key to legacy and setting new current
func (e *VersionedDataEncryptor) RotateKey(newKey string) {
	// Move current key to legacy
	if e.currentKey != "" {
		e.legacyKeys[e.currentVersion] = e.currentKey
	}
	
	// Set new key as current and increment version
	e.currentKey = newKey
	e.currentVersion++
}

// EncryptString encrypts a plaintext string using the current key and version
func (e *VersionedDataEncryptor) EncryptString(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	if e.currentKey == "" {
		return "", fmt.Errorf("encryption key not provided")
	}

	// Encrypt the data with current key
	ciphertext, err := e.encryptDataWithKey([]byte(plaintext), e.currentKey)
	if err != nil {
		return "", fmt.Errorf("encryption failed: %w", err)
	}

	// Prepend version header
	versionedCiphertext := e.prependVersion(ciphertext, e.currentVersion)

	// Return base64-encoded for database storage
	return base64.StdEncoding.EncodeToString(versionedCiphertext), nil
}

// DecryptString decrypts a base64-encoded ciphertext using the appropriate key version
func (e *VersionedDataEncryptor) DecryptString(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	// Decode from base64
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	// Check if this is versioned data
	if len(data) < VersionHeaderSize {
		// Try to decrypt as legacy v1 data (no version header)
		return e.decryptLegacyV1(data)
	}

	// Extract version
	version := binary.BigEndian.Uint16(data[:VersionHeaderSize])
	encryptedData := data[VersionHeaderSize:]

	// Decrypt with appropriate key
	plaintext, err := e.decryptWithVersion(encryptedData, version)
	if err != nil {
		// Fallback: try as legacy v1 if version-based decryption fails
		if legacyPlaintext, legacyErr := e.decryptLegacyV1(data); legacyErr == nil {
			return legacyPlaintext, nil
		}
		return "", fmt.Errorf("decryption failed for version %d: %w", version, err)
	}

	return string(plaintext), nil
}

// IsEncrypted checks if a string appears to be encrypted (versioned or legacy)
func (e *VersionedDataEncryptor) IsEncrypted(data string) bool {
	if len(data) < MinBase64EncryptedLength {
		return false
	}
	
	// Try to decode as base64
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return false
	}
	
	// Check for versioned format
	if len(decoded) >= MinVersionedEncryptedLength {
		return true
	}
	
	// Check for legacy format
	return len(decoded) >= MinEncryptedDataLength
}

// GetKeyVersion extracts the version from encrypted data without decrypting
func (e *VersionedDataEncryptor) GetKeyVersion(ciphertext string) (uint16, error) {
	if ciphertext == "" {
		return 0, fmt.Errorf("empty ciphertext")
	}

	// Decode from base64
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return 0, fmt.Errorf("failed to decode base64: %w", err)
	}

	// Check if versioned
	if len(data) < VersionHeaderSize {
		return LegacyV1, nil // Legacy v1 format
	}

	version := binary.BigEndian.Uint16(data[:VersionHeaderSize])
	return version, nil
}

// GetEncryptionStats returns statistics about encryption keys and versions
func (e *VersionedDataEncryptor) GetEncryptionStats() map[string]interface{} {
	stats := map[string]interface{}{
		"current_version": e.currentVersion,
		"legacy_versions": make([]uint16, 0, len(e.legacyKeys)),
		"has_current_key": e.currentKey != "",
		"legacy_key_count": len(e.legacyKeys),
	}
	
	for version := range e.legacyKeys {
		stats["legacy_versions"] = append(stats["legacy_versions"].([]uint16), version)
	}
	
	return stats
}

// IsProductionReady checks if the encryptor is using a production-grade key
func (e *VersionedDataEncryptor) IsProductionReady() bool {
	if e.currentKey == "" {
		return false
	}
	
	// Check if it's a development key pattern
	developmentPatterns := []string{
		"dev-encryption-key-change-in-production",
		"development",
		"dev-key",
		"test-key",
		"local-key",
		"change-me",
		"insecure",
		"default",
	}
	
	keyLower := strings.ToLower(e.currentKey)
	for _, pattern := range developmentPatterns {
		if strings.Contains(keyLower, pattern) {
			return false
		}
	}
	
	// Check for basic entropy requirements
	if len(e.currentKey) < 16 {
		return false
	}
	
	return true
}

// prependVersion adds version header to encrypted data
func (e *VersionedDataEncryptor) prependVersion(data []byte, version uint16) []byte {
	result := make([]byte, VersionHeaderSize+len(data))
	binary.BigEndian.PutUint16(result[:VersionHeaderSize], version)
	copy(result[VersionHeaderSize:], data)
	return result
}

// decryptWithVersion decrypts data using the key for the specified version
func (e *VersionedDataEncryptor) decryptWithVersion(data []byte, version uint16) ([]byte, error) {
	var key string
	
	// Get the appropriate key for this version
	if version == e.currentVersion {
		key = e.currentKey
	} else if legacyKey, exists := e.legacyKeys[version]; exists {
		key = legacyKey
	} else {
		return nil, fmt.Errorf("no key available for version %d", version)
	}
	
	if key == "" {
		return nil, fmt.Errorf("empty key for version %d", version)
	}
	
	return e.decryptDataWithKey(data, key)
}

// decryptLegacyV1 attempts to decrypt data using the original encryption format
func (e *VersionedDataEncryptor) decryptLegacyV1(data []byte) (string, error) {
	// Try with current key first
	if e.currentKey != "" {
		if plaintext, err := e.decryptDataWithKey(data, e.currentKey); err == nil {
			return string(plaintext), nil
		}
	}
	
	// Try with legacy keys
	for _, key := range e.legacyKeys {
		if plaintext, err := e.decryptDataWithKey(data, key); err == nil {
			return string(plaintext), nil
		}
	}
	
	return "", fmt.Errorf("failed to decrypt legacy v1 data with any available key")
}

// encryptDataWithKey encrypts data using the specified key (same algorithm as original)
func (e *VersionedDataEncryptor) encryptDataWithKey(plaintext []byte, key string) ([]byte, error) {
	// Generate random salt (32 bytes)
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Derive key using PBKDF2 with 100,000 iterations
	derivedKey := pbkdf2.Key([]byte(key), salt, 100000, 32, sha256.New)

	// Create AES cipher
	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt the data
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	// Format: salt (32 bytes) + nonce (12 bytes) + ciphertext
	result := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	result = append(result, salt...)
	result = append(result, nonce...)
	result = append(result, ciphertext...)

	return result, nil
}

// decryptDataWithKey decrypts data using the specified key (same algorithm as original)
func (e *VersionedDataEncryptor) decryptDataWithKey(cipherdata []byte, key string) ([]byte, error) {
	if len(cipherdata) < 44 { // 32 bytes salt + 12 bytes nonce
		return nil, fmt.Errorf("cipherdata too short")
	}

	// Extract salt, nonce, and ciphertext
	salt := cipherdata[:32]
	nonce := cipherdata[32:44]
	ciphertext := cipherdata[44:]

	// Derive key using PBKDF2
	derivedKey := pbkdf2.Key([]byte(key), salt, 100000, 32, sha256.New)

	// Create AES cipher
	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt the data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// NewDataEncryptor creates a versioned encryptor for backward compatibility with legacy code
// Deprecated: Use NewServiceEncryptor() for new code or NewEncryptor() for simple cases
func NewDataEncryptor(encryptionKey string) *VersionedDataEncryptor {
	return NewEncryptor(encryptionKey)
}

// MigrateDataToCurrentVersion re-encrypts data with the current key version
func (e *VersionedDataEncryptor) MigrateDataToCurrentVersion(oldCiphertext string) (string, error) {
	// First decrypt with whatever key works
	plaintext, err := e.DecryptString(oldCiphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt for migration: %w", err)
	}
	
	// Re-encrypt with current key and version
	return e.EncryptString(plaintext)
}

// ValidateAllKeys tests that all configured keys can decrypt their respective test data
func (e *VersionedDataEncryptor) ValidateAllKeys() error {
	testData := "encryption-key-validation-test-data"
	
	// Test current key
	if e.currentKey != "" {
		encrypted, err := e.EncryptString(testData)
		if err != nil {
			return fmt.Errorf("current key encryption failed: %w", err)
		}
		
		decrypted, err := e.DecryptString(encrypted)
		if err != nil {
			return fmt.Errorf("current key decryption failed: %w", err)
		}
		
		if decrypted != testData {
			return fmt.Errorf("current key validation failed: data mismatch")
		}
	}
	
	// Test legacy keys by creating test data with each
	for version, key := range e.legacyKeys {
		if key == "" {
			continue
		}
		
		// Create a temporary encryptor with this key as current
		tempEncryptor := NewVersionedDataEncryptor(KeyConfig{
			CurrentKey:     key,
			CurrentVersion: version,
		})
		
		encrypted, err := tempEncryptor.EncryptString(testData)
		if err != nil {
			return fmt.Errorf("legacy key v%d encryption failed: %w", version, err)
		}
		
		// Test that our main encryptor can decrypt it
		decrypted, err := e.DecryptString(encrypted)
		if err != nil {
			return fmt.Errorf("legacy key v%d decryption failed: %w", version, err)
		}
		
		if decrypted != testData {
			return fmt.Errorf("legacy key v%d validation failed: data mismatch", version)
		}
	}
	
	return nil
}

// Helper function to parse JSON key configuration
func ParseKeyConfig(jsonConfig string) (KeyConfig, error) {
	var config KeyConfig
	
	// Simple JSON parsing for basic cases
	if strings.Contains(jsonConfig, "current_key") {
		// This is a simplified parser - in production use json.Unmarshal
		return config, fmt.Errorf("JSON parsing not implemented - use struct initialization")
	}
	
	// For now, assume it's just a simple key string
	config.CurrentKey = jsonConfig
	config.CurrentVersion = CurrentVersion
	config.LegacyKeys = make(map[uint16]string)
	
	return config, nil
}