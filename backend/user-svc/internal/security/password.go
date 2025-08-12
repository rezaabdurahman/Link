package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"os"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// Password hashing configuration
type PasswordConfig struct {
	// Bcrypt settings
	BcryptCost int

	// Argon2 settings
	Argon2Time    uint32 // Number of passes
	Argon2Memory  uint32 // Memory usage in KB
	Argon2Threads uint8  // Number of threads
	Argon2KeyLen  uint32 // Length of generated key

	// Hash algorithm preference
	PreferredAlgo string // "bcrypt" or "argon2"
}

// GetPasswordConfig returns password hashing configuration from environment
func GetPasswordConfig() *PasswordConfig {
	return &PasswordConfig{
		BcryptCost:    getEnvInt("BCRYPT_COST", 12),        // Increased from default 10
		Argon2Time:    uint32(getEnvInt("ARGON2_TIME", 3)), // 3 passes
		Argon2Memory:  uint32(getEnvInt("ARGON2_MEMORY", 64*1024)), // 64 MB
		Argon2Threads: uint8(getEnvInt("ARGON2_THREADS", 4)),       // 4 threads
		Argon2KeyLen:  uint32(getEnvInt("ARGON2_KEYLEN", 32)),      // 32 bytes
		PreferredAlgo: getEnv("PASSWORD_HASH_ALGO", "bcrypt"),
	}
}

// PasswordHasher provides secure password hashing with multiple algorithms
type PasswordHasher struct {
	config *PasswordConfig
}

// NewPasswordHasher creates a new password hasher
func NewPasswordHasher(config *PasswordConfig) *PasswordHasher {
	return &PasswordHasher{
		config: config,
	}
}

// HashPassword hashes a password using the configured algorithm
func (ph *PasswordHasher) HashPassword(password string) (string, error) {
	switch ph.config.PreferredAlgo {
	case "argon2":
		return ph.hashWithArgon2(password)
	case "bcrypt":
		fallthrough
	default:
		return ph.hashWithBcrypt(password)
	}
}

// VerifyPassword verifies a password against a hash, auto-detecting the algorithm
func (ph *PasswordHasher) VerifyPassword(password, hashedPassword string) (bool, error) {
	if strings.HasPrefix(hashedPassword, "$argon2id$") {
		return ph.verifyArgon2(password, hashedPassword)
	}
	
	// Default to bcrypt for backward compatibility
	return ph.verifyBcrypt(password, hashedPassword)
}

// ShouldRehash checks if a password should be rehashed (e.g., cost factor changed)
func (ph *PasswordHasher) ShouldRehash(hashedPassword string) bool {
	if strings.HasPrefix(hashedPassword, "$argon2id$") {
		// Parse Argon2 parameters and check if they match current config
		params, err := ph.parseArgon2Hash(hashedPassword)
		if err != nil {
			return true // Rehash if we can't parse
		}
		
		return params.Time != ph.config.Argon2Time ||
			   params.Memory != ph.config.Argon2Memory ||
			   params.Threads != ph.config.Argon2Threads ||
			   params.KeyLen != ph.config.Argon2KeyLen
	}
	
	// For bcrypt, check if cost has changed
	cost, err := bcrypt.Cost([]byte(hashedPassword))
	if err != nil {
		return true // Rehash if we can't determine cost
	}
	
	return cost < ph.config.BcryptCost
}

// hashWithBcrypt hashes password using bcrypt with configured cost
func (ph *PasswordHasher) hashWithBcrypt(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), ph.config.BcryptCost)
	if err != nil {
		return "", fmt.Errorf("bcrypt hash generation failed: %w", err)
	}
	return string(hash), nil
}

// verifyBcrypt verifies password against bcrypt hash
func (ph *PasswordHasher) verifyBcrypt(password, hashedPassword string) (bool, error) {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	if err != nil {
		if err == bcrypt.ErrMismatchedHashAndPassword {
			return false, nil
		}
		return false, fmt.Errorf("bcrypt verification failed: %w", err)
	}
	return true, nil
}

// Argon2 hash format: $argon2id$v=19$m=memory,t=time,p=threads$salt$hash
func (ph *PasswordHasher) hashWithArgon2(password string) (string, error) {
	// Generate random salt
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("salt generation failed: %w", err)
	}
	
	// Hash password
	hash := argon2.IDKey([]byte(password), salt, ph.config.Argon2Time, 
		ph.config.Argon2Memory, ph.config.Argon2Threads, ph.config.Argon2KeyLen)
	
	// Encode to string format
	saltB64 := base64.RawStdEncoding.EncodeToString(salt)
	hashB64 := base64.RawStdEncoding.EncodeToString(hash)
	
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		ph.config.Argon2Memory, ph.config.Argon2Time, ph.config.Argon2Threads,
		saltB64, hashB64), nil
}

// Argon2Params holds Argon2 parameters parsed from hash string
type Argon2Params struct {
	Memory  uint32
	Time    uint32
	Threads uint8
	KeyLen  uint32
	Salt    []byte
	Hash    []byte
}

// parseArgon2Hash parses an Argon2 hash string and extracts parameters
func (ph *PasswordHasher) parseArgon2Hash(hashedPassword string) (*Argon2Params, error) {
	parts := strings.Split(hashedPassword, "$")
	if len(parts) != 6 {
		return nil, fmt.Errorf("invalid argon2 hash format")
	}
	
	if parts[1] != "argon2id" || parts[2] != "v=19" {
		return nil, fmt.Errorf("unsupported argon2 variant or version")
	}
	
	// Parse parameters
	params := &Argon2Params{}
	paramParts := strings.Split(parts[3], ",")
	
	for _, param := range paramParts {
		if strings.HasPrefix(param, "m=") {
			memory, err := strconv.ParseUint(param[2:], 10, 32)
			if err != nil {
				return nil, fmt.Errorf("invalid memory parameter: %w", err)
			}
			params.Memory = uint32(memory)
		} else if strings.HasPrefix(param, "t=") {
			time, err := strconv.ParseUint(param[2:], 10, 32)
			if err != nil {
				return nil, fmt.Errorf("invalid time parameter: %w", err)
			}
			params.Time = uint32(time)
		} else if strings.HasPrefix(param, "p=") {
			threads, err := strconv.ParseUint(param[2:], 10, 8)
			if err != nil {
				return nil, fmt.Errorf("invalid threads parameter: %w", err)
			}
			params.Threads = uint8(threads)
		}
	}
	
	// Decode salt and hash
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, fmt.Errorf("invalid salt encoding: %w", err)
	}
	params.Salt = salt
	
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, fmt.Errorf("invalid hash encoding: %w", err)
	}
	params.Hash = hash
	params.KeyLen = uint32(len(hash))
	
	return params, nil
}

// verifyArgon2 verifies password against Argon2 hash
func (ph *PasswordHasher) verifyArgon2(password, hashedPassword string) (bool, error) {
	params, err := ph.parseArgon2Hash(hashedPassword)
	if err != nil {
		return false, fmt.Errorf("failed to parse argon2 hash: %w", err)
	}
	
	// Hash the password with the same parameters
	hash := argon2.IDKey([]byte(password), params.Salt, params.Time, 
		params.Memory, params.Threads, params.KeyLen)
	
	// Constant-time comparison
	return subtle.ConstantTimeCompare(hash, params.Hash) == 1, nil
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt gets an integer environment variable with a default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
