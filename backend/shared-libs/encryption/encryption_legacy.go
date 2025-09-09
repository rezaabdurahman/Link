package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/pbkdf2"
)

// Constants for encryption validation
const (
	// MinEncryptedDataLength is the minimum length for valid encrypted data
	// 32 bytes salt + 12 bytes nonce = 44 bytes minimum
	MinEncryptedDataLength = 44
	
	// MinBase64EncryptedLength is minimum base64-encoded length that could contain valid encrypted data
	MinBase64EncryptedLength = 64
)

// DataEncryptor provides field-level encryption for sensitive data
type DataEncryptor struct {
	encryptionKey string
}

// NewLegacyDataEncryptor creates a new data encryptor with the provided key (legacy implementation)
// Deprecated: Use NewDataEncryptor from the main encryption package instead
func NewLegacyDataEncryptor(encryptionKey string) *DataEncryptor {
	return &DataEncryptor{
		encryptionKey: encryptionKey,
	}
}

// EncryptString encrypts a plaintext string and returns base64-encoded ciphertext
func (e *DataEncryptor) EncryptString(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	if e.encryptionKey == "" {
		return "", fmt.Errorf("encryption key not provided")
	}

	ciphertext, err := e.encryptData([]byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("encryption failed: %w", err)
	}

	// Return base64-encoded for database storage
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts a base64-encoded ciphertext and returns plaintext
func (e *DataEncryptor) DecryptString(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	if e.encryptionKey == "" {
		return "", fmt.Errorf("encryption key not provided")
	}

	// Decode from base64
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	plaintext, err := e.decryptData(data)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// encryptData encrypts data using AES-256-GCM with PBKDF2 key derivation
// Following the established pattern from backup/backup.go
func (e *DataEncryptor) encryptData(plaintext []byte) ([]byte, error) {
	// Generate random salt (32 bytes)
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Derive key using PBKDF2 with 100,000 iterations
	key := pbkdf2.Key([]byte(e.encryptionKey), salt, 100000, 32, sha256.New)

	// Create AES cipher
	block, err := aes.NewCipher(key)
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

// decryptData decrypts data encrypted with encryptData
func (e *DataEncryptor) decryptData(cipherdata []byte) ([]byte, error) {
	if len(cipherdata) < 44 { // 32 bytes salt + 12 bytes nonce
		return nil, fmt.Errorf("cipherdata too short")
	}

	// Extract salt, nonce, and ciphertext
	salt := cipherdata[:32]
	nonce := cipherdata[32:44]
	ciphertext := cipherdata[44:]

	// Derive key using PBKDF2
	key := pbkdf2.Key([]byte(e.encryptionKey), salt, 100000, 32, sha256.New)

	// Create AES cipher
	block, err := aes.NewCipher(key)
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

// IsEncrypted checks if a string appears to be encrypted (base64 format with minimum length)
func (e *DataEncryptor) IsEncrypted(data string) bool {
	if len(data) < MinBase64EncryptedLength {
		return false
	}
	
	// Try to decode as base64
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return false
	}
	
	// Check if decoded data has minimum expected length
	return len(decoded) >= MinEncryptedDataLength
}