# Encryption Key Versioning System

## Problem Statement

The original encryption implementation had a critical flaw: **key rotation would make all existing encrypted data unreadable**, potentially causing complete data loss.

```go
// DANGEROUS: Old approach
encryptor.RotateKey("new-key")
// All existing data encrypted with old key is now LOST!
```

## Solution: Versioned Encryption Keys

### Overview

We've implemented a **versioned encryption system** that supports:
- ✅ **Safe key rotation** without data loss
- ✅ **Backward compatibility** with existing encrypted data  
- ✅ **Automatic version detection** during decryption
- ✅ **Gradual migration** of old data to new keys
- ✅ **Multiple legacy key support**

## How It Works

### 1. Version Headers
All new encrypted data includes a 2-byte version header:

```
Encrypted Data Format: [Version(2 bytes)] + [Salt(32)] + [Nonce(12)] + [Ciphertext]
```

### 2. Key Management
```go
type VersionedDataEncryptor struct {
    currentKey     string            // For new encryptions (v3)
    currentVersion uint16            // Current version number
    legacyKeys     map[uint16]string // Legacy keys (v1, v2)
}
```

### 3. Encryption Process
```go
// Always encrypts with current key/version
encrypted := encryptor.EncryptString("sensitive data")
// Result: [v3 header] + [encrypted with v3 key]
```

### 4. Decryption Process
```go
// Automatically detects version and uses correct key
decrypted := encryptor.DecryptString(encrypted)

// Process:
// 1. Extract version from header
// 2. Use corresponding key (current or legacy)
// 3. Decrypt and return plaintext
```

## Key Rotation Process

### Before Rotation (Current State)
```json
{
  "data_encryption_key": "current-key-v2",
  "data_encryption_version": "2",
  "data_encryption_legacy_keys": {
    "1": "old-key-v1"
  }
}
```

### After Rotation
```json
{
  "data_encryption_key": "new-key-v3",
  "data_encryption_version": "3", 
  "data_encryption_legacy_keys": {
    "1": "old-key-v1",
    "2": "current-key-v2"  // Moved to legacy
  }
}
```

### What Happens to Data

**✅ All data remains readable:**
- Data encrypted with v1 key → Decrypts with legacy key v1
- Data encrypted with v2 key → Decrypts with legacy key v2  
- New data → Encrypts with current key v3

## Migration Strategy

### Phase 1: Deploy Versioned Encryption (No Rotation)
```go
// Services start using versioned encryptor
encryptor := NewVersionedEncryptor(config)
// All new data uses v2 with version headers
// Existing v1 data (no headers) still readable via legacy mode
```

### Phase 2: Enable Safe Rotation
```bash
# Now safe to rotate keys
./scripts/rotate-application-secrets.sh production
# Creates v3 key, moves v2 to legacy
```

### Phase 3: Background Migration (Optional)
```go
// Gradually re-encrypt old data with current key
migrator := NewDataMigrator(encryptor)
newEncrypted := migrator.MigrateDataToCurrentVersion(oldEncrypted)
```

### Phase 4: Legacy Key Cleanup
```bash
# After all data migrated, remove old legacy keys
# Keep last 2-3 versions for safety
```

## Code Changes Made

### 1. New Encryption Library
- `versioned_encryption.go` - Main versioned encryptor
- `migration_helper.go` - Data migration utilities  
- `config_helper.go` - Configuration management
- `versioned_encryption_test.go` - Comprehensive tests

### 2. Updated Configuration
```go
// backend/shared-libs/config/secrets.go
func GetDataEncryptionKeyConfig() map[string]string {
    return map[string]string{
        "current_key":     GetDataEncryptionKey(),
        "current_version": GetEnv("DATA_ENCRYPTION_VERSION", "2"),
        "legacy_keys":     GetSecret("DATA_ENCRYPTION_LEGACY_KEYS", "{}"),
    }
}
```

### 3. Updated Rotation Scripts
- `rotate-application-secrets.sh` - Now handles versioned keys safely
- `setup-application-secrets.sh` - Creates versioned key structure

### 4. Backward Compatibility
```go
// Existing code still works
encryptor := NewDataEncryptor("key") // Creates versioned encryptor internally
encrypted := encryptor.EncryptString("data") // Uses versioning automatically
```

## Usage Examples

### Service Integration
```go
// In your service startup
import "github.com/link-app/shared-libs/encryption"

func initEncryption() *encryption.VersionedDataEncryptor {
    config := config.GetDataEncryptionKeyConfig() 
    encryptor, err := encryption.NewVersionedEncryptorFromConfig(config)
    if err != nil {
        log.Fatal("Failed to initialize encryption:", err)
    }
    return encryptor
}

// Encrypt user data
encryptedEmail, err := encryptor.EncryptString(user.Email)
// Decrypt user data  
plainEmail, err := encryptor.DecryptString(encryptedEmail)
```

### Database Model Updates
```go
type User struct {
    ID            int    `json:"id"`
    Email         string `json:"email"`          // Encrypted with current key
    EncryptedSSN  string `json:"encrypted_ssn"`  // May be old key version
}

func (u *User) DecryptEmail(encryptor *encryption.VersionedDataEncryptor) string {
    decrypted, err := encryptor.DecryptString(u.Email)
    if err != nil {
        log.Warn("Failed to decrypt email for user", u.ID, err)
        return ""
    }
    return decrypted
}
```

## Security Benefits

### ✅ Data Loss Prevention
- **Zero data loss** during key rotation
- All historical data remains accessible
- Gradual migration without service interruption

### ✅ Security Improvements  
- **Regular key rotation** now safe to enable
- **Key compartmentalization** by version
- **Audit trail** of which keys encrypted what data

### ✅ Operational Benefits
- **No emergency rollbacks** needed
- **Safe to test** rotation in staging
- **Gradual cleanup** of legacy keys

## Implementation Timeline

### ✅ Completed
1. **Versioned encryption library** implemented
2. **Rotation scripts updated** to handle versioning
3. **Backward compatibility** ensured
4. **Migration tools** created

### 🔄 Next Steps  
1. **Deploy versioned encryption** (no rotation yet)
2. **Test on staging** environment
3. **Enable key rotation** after validation
4. **Plan data migration** strategy

### ⚠️ Critical Notes

**DO NOT rotate keys until versioned encryption is deployed!**

1. Deploy new encryption library first
2. Verify backward compatibility
3. Test rotation on staging
4. Only then enable production rotation

This ensures **zero data loss** and smooth transition to the new system.

## Vendor Consideration

### AWS KMS Alternative
For even better security, consider migrating to **AWS KMS**:
- ✅ **Automatic key rotation** with built-in versioning  
- ✅ **Hardware security modules** (HSMs)
- ✅ **Audit logging** and compliance
- ✅ **No key management complexity**

Our versioned system provides a **bridge** to AWS KMS if desired:
```go
// Future: AWS KMS integration
kmsKey := aws.KMSGetKey("link-app/encryption-key") 
encryptor := encryption.NewKMSVersionedEncryptor(kmsKey)
```

The versioned approach works with both **self-managed** and **AWS KMS** keys.