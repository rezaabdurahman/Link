package encryption

import (
	"testing"
	"strings"
)

func TestVersionedEncryption_BasicEncryption(t *testing.T) {
	encryptor := NewEncryptor("test-key-123")
	
	plaintext := "sensitive data"
	encrypted, err := encryptor.EncryptString(plaintext)
	if err != nil {
		t.Fatalf("Encryption failed: %v", err)
	}
	
	decrypted, err := encryptor.DecryptString(encrypted)
	if err != nil {
		t.Fatalf("Decryption failed: %v", err)
	}
	
	if decrypted != plaintext {
		t.Errorf("Expected %q, got %q", plaintext, decrypted)
	}
}

func TestVersionedEncryption_KeyRotation(t *testing.T) {
	// Create encryptor with initial key
	encryptor := NewEncryptor("old-key")
	
	// Encrypt data with old key
	originalData := "important secret"
	oldEncrypted, err := encryptor.EncryptString(originalData)
	if err != nil {
		t.Fatalf("Initial encryption failed: %v", err)
	}
	
	// Rotate to new key
	encryptor.RotateKey("new-key")
	
	// Should still be able to decrypt old data
	decryptedOld, err := encryptor.DecryptString(oldEncrypted)
	if err != nil {
		t.Fatalf("Failed to decrypt old data after rotation: %v", err)
	}
	if decryptedOld != originalData {
		t.Errorf("Old data decryption failed: expected %q, got %q", originalData, decryptedOld)
	}
	
	// New encryptions should use new key
	newData := "new secret"
	newEncrypted, err := encryptor.EncryptString(newData)
	if err != nil {
		t.Fatalf("New encryption failed: %v", err)
	}
	
	decryptedNew, err := encryptor.DecryptString(newEncrypted)
	if err != nil {
		t.Fatalf("New decryption failed: %v", err)
	}
	if decryptedNew != newData {
		t.Errorf("New data decryption failed: expected %q, got %q", newData, decryptedNew)
	}
	
	// Verify versions are different
	oldVersion, err := encryptor.GetKeyVersion(oldEncrypted)
	if err != nil {
		t.Fatalf("Failed to get old version: %v", err)
	}
	
	newVersion, err := encryptor.GetKeyVersion(newEncrypted)
	if err != nil {
		t.Fatalf("Failed to get new version: %v", err)
	}
	
	if oldVersion >= newVersion {
		t.Errorf("Expected new version (%d) to be greater than old version (%d)", newVersion, oldVersion)
	}
}

func TestVersionedEncryption_MultipleRotations(t *testing.T) {
	encryptor := NewEncryptor("key-v1")
	
	// Encrypt data with v1
	data1 := "data from v1"
	encrypted1, err := encryptor.EncryptString(data1)
	if err != nil {
		t.Fatalf("V1 encryption failed: %v", err)
	}
	
	// Rotate to v2
	encryptor.RotateKey("key-v2")
	data2 := "data from v2"
	encrypted2, err := encryptor.EncryptString(data2)
	if err != nil {
		t.Fatalf("V2 encryption failed: %v", err)
	}
	
	// Rotate to v3
	encryptor.RotateKey("key-v3")
	data3 := "data from v3"
	encrypted3, err := encryptor.EncryptString(data3)
	if err != nil {
		t.Fatalf("V3 encryption failed: %v", err)
	}
	
	// Should be able to decrypt all versions
	decrypted1, err := encryptor.DecryptString(encrypted1)
	if err != nil {
		t.Fatalf("V1 decryption failed: %v", err)
	}
	if decrypted1 != data1 {
		t.Errorf("V1 data mismatch: expected %q, got %q", data1, decrypted1)
	}
	
	decrypted2, err := encryptor.DecryptString(encrypted2)
	if err != nil {
		t.Fatalf("V2 decryption failed: %v", err)
	}
	if decrypted2 != data2 {
		t.Errorf("V2 data mismatch: expected %q, got %q", data2, decrypted2)
	}
	
	decrypted3, err := encryptor.DecryptString(encrypted3)
	if err != nil {
		t.Fatalf("V3 decryption failed: %v", err)
	}
	if decrypted3 != data3 {
		t.Errorf("V3 data mismatch: expected %q, got %q", data3, decrypted3)
	}
}

func TestVersionedEncryption_BackwardCompatibility(t *testing.T) {
	// Create original encryptor (simulating existing system)
	originalKey := "legacy-key-123"
	originalEncryptor := &DataEncryptor{encryptionKey: originalKey}
	
	// Encrypt with original system (no versioning)
	legacyData := "legacy encrypted data"
	legacyEncrypted, err := originalEncryptor.EncryptString(legacyData)
	if err != nil {
		t.Fatalf("Legacy encryption failed: %v", err)
	}
	
	// Create versioned encryptor with same key
	versionedEncryptor := NewEncryptor(originalKey)
	
	// Should be able to decrypt legacy data
	decrypted, err := versionedEncryptor.DecryptString(legacyEncrypted)
	if err != nil {
		t.Fatalf("Legacy decryption failed: %v", err)
	}
	if decrypted != legacyData {
		t.Errorf("Legacy data mismatch: expected %q, got %q", legacyData, decrypted)
	}
}

func TestVersionedEncryption_Migration(t *testing.T) {
	encryptor := NewEncryptor("old-key")
	
	// Encrypt with old version
	originalData := "data to migrate"
	oldEncrypted, err := encryptor.EncryptString(originalData)
	if err != nil {
		t.Fatalf("Initial encryption failed: %v", err)
	}
	
	oldVersion, _ := encryptor.GetKeyVersion(oldEncrypted)
	
	// Rotate key
	encryptor.RotateKey("new-key")
	
	// Migrate data to current version
	migratedEncrypted, err := encryptor.MigrateDataToCurrentVersion(oldEncrypted)
	if err != nil {
		t.Fatalf("Migration failed: %v", err)
	}
	
	newVersion, _ := encryptor.GetKeyVersion(migratedEncrypted)
	
	// Verify version changed
	if oldVersion >= newVersion {
		t.Errorf("Migration didn't update version: old=%d, new=%d", oldVersion, newVersion)
	}
	
	// Verify data is still correct
	decrypted, err := encryptor.DecryptString(migratedEncrypted)
	if err != nil {
		t.Fatalf("Migrated data decryption failed: %v", err)
	}
	if decrypted != originalData {
		t.Errorf("Migrated data mismatch: expected %q, got %q", originalData, decrypted)
	}
	
	// Both old and new encrypted data should decrypt to same value
	oldDecrypted, err := encryptor.DecryptString(oldEncrypted)
	if err != nil {
		t.Fatalf("Old data decryption failed: %v", err)
	}
	if oldDecrypted != decrypted {
		t.Errorf("Old and migrated data don't match: old=%q, new=%q", oldDecrypted, decrypted)
	}
}

func TestVersionedEncryption_KeyValidation(t *testing.T) {
	config := KeyConfig{
		CurrentKey:     "current-key",
		CurrentVersion: 3,
		LegacyKeys: map[uint16]string{
			1: "legacy-key-1",
			2: "legacy-key-2",
		},
	}
	
	encryptor := NewVersionedDataEncryptor(config)
	
	err := encryptor.ValidateAllKeys()
	if err != nil {
		t.Fatalf("Key validation failed: %v", err)
	}
}

func TestVersionedEncryption_InvalidKey(t *testing.T) {
	encryptor := NewEncryptor("correct-key")
	
	// Encrypt with correct key
	data := "secret data"
	encrypted, err := encryptor.EncryptString(data)
	if err != nil {
		t.Fatalf("Encryption failed: %v", err)
	}
	
	// Create encryptor with wrong key
	wrongEncryptor := NewEncryptor("wrong-key")
	
	// Should fail to decrypt
	_, err = wrongEncryptor.DecryptString(encrypted)
	if err == nil {
		t.Error("Expected decryption to fail with wrong key")
	}
}

func TestVersionedEncryption_EmptyString(t *testing.T) {
	encryptor := NewEncryptor("test-key")
	
	// Empty string should return empty string
	encrypted, err := encryptor.EncryptString("")
	if err != nil {
		t.Fatalf("Empty string encryption failed: %v", err)
	}
	if encrypted != "" {
		t.Errorf("Expected empty string, got %q", encrypted)
	}
	
	decrypted, err := encryptor.DecryptString("")
	if err != nil {
		t.Fatalf("Empty string decryption failed: %v", err)
	}
	if decrypted != "" {
		t.Errorf("Expected empty string, got %q", decrypted)
	}
}

func TestVersionedEncryption_IsEncrypted(t *testing.T) {
	encryptor := NewEncryptor("test-key")
	
	// Test plaintext
	if encryptor.IsEncrypted("plain text") {
		t.Error("Plain text incorrectly identified as encrypted")
	}
	
	// Test encrypted data
	encrypted, err := encryptor.EncryptString("secret data")
	if err != nil {
		t.Fatalf("Encryption failed: %v", err)
	}
	
	if !encryptor.IsEncrypted(encrypted) {
		t.Error("Encrypted data not identified as encrypted")
	}
	
	// Test invalid base64
	if encryptor.IsEncrypted("not-valid-base64!") {
		t.Error("Invalid base64 incorrectly identified as encrypted")
	}
}

func TestVersionedEncryption_Stats(t *testing.T) {
	config := KeyConfig{
		CurrentKey:     "current",
		CurrentVersion: 5,
		LegacyKeys: map[uint16]string{
			3: "legacy-3",
			4: "legacy-4",
		},
	}
	
	encryptor := NewVersionedDataEncryptor(config)
	stats := encryptor.GetEncryptionStats()
	
	if stats["current_version"] != uint16(5) {
		t.Errorf("Expected current_version=5, got %v", stats["current_version"])
	}
	
	if stats["legacy_key_count"] != 2 {
		t.Errorf("Expected legacy_key_count=2, got %v", stats["legacy_key_count"])
	}
	
	if stats["has_current_key"] != true {
		t.Errorf("Expected has_current_key=true, got %v", stats["has_current_key"])
	}
}

func TestVersionedEncryption_LargeData(t *testing.T) {
	encryptor := NewEncryptor("test-key")
	
	// Test with large data
	largeData := strings.Repeat("This is a test of large data encryption. ", 1000)
	
	encrypted, err := encryptor.EncryptString(largeData)
	if err != nil {
		t.Fatalf("Large data encryption failed: %v", err)
	}
	
	decrypted, err := encryptor.DecryptString(encrypted)
	if err != nil {
		t.Fatalf("Large data decryption failed: %v", err)
	}
	
	if decrypted != largeData {
		t.Errorf("Large data mismatch: lengths original=%d, decrypted=%d", 
			len(largeData), len(decrypted))
	}
}

func BenchmarkVersionedEncryption_Encrypt(b *testing.B) {
	encryptor := NewEncryptor("benchmark-key")
	data := "benchmark data for encryption testing"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := encryptor.EncryptString(data)
		if err != nil {
			b.Fatalf("Encryption failed: %v", err)
		}
	}
}

func BenchmarkVersionedEncryption_Decrypt(b *testing.B) {
	encryptor := NewEncryptor("benchmark-key")
	data := "benchmark data for decryption testing"
	
	encrypted, err := encryptor.EncryptString(data)
	if err != nil {
		b.Fatalf("Setup encryption failed: %v", err)
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := encryptor.DecryptString(encrypted)
		if err != nil {
			b.Fatalf("Decryption failed: %v", err)
		}
	}
}