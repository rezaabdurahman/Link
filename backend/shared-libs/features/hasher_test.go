package features

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDefaultAssignmentHasher(t *testing.T) {
	hasher := NewAssignmentHasher()
	salt := "default"

	t.Run("should return consistent hash for same input", func(t *testing.T) {
		userID := "user-123"
		key := "test_flag"

		hash1 := hasher.Hash(userID, key, salt)
		hash2 := hasher.Hash(userID, key, salt)

		assert.Equal(t, hash1, hash2, "Hash should be consistent for same input")
	})

	t.Run("should return different hashes for different users", func(t *testing.T) {
		key := "test_flag"

		hash1 := hasher.Hash("user-123", key, salt)
		hash2 := hasher.Hash("user-456", key, salt)

		assert.NotEqual(t, hash1, hash2, "Hash should be different for different users")
	})

	t.Run("should return different hashes for different keys", func(t *testing.T) {
		userID := "user-123"

		hash1 := hasher.Hash(userID, "flag1", salt)
		hash2 := hasher.Hash(userID, "flag2", salt)

		assert.NotEqual(t, hash1, hash2, "Hash should be different for different keys")
	})

	t.Run("should return percentage within valid range", func(t *testing.T) {
		userID := "user-123"
		key := "test_flag"

		percentage := hasher.HashToPercentage(userID, key, salt)

		assert.GreaterOrEqual(t, percentage, 0)
		assert.LessOrEqual(t, percentage, 100)
	})

	t.Run("should distribute users evenly across percentage range", func(t *testing.T) {
		key := "test_flag"
		buckets := make([]int, 10) // 10 buckets of 10% each

		// Test 1000 different users
		for i := 0; i < 1000; i++ {
			userID := fmt.Sprintf("user-%d", i)
			percentage := hasher.HashToPercentage(userID, key, salt)
			bucket := percentage / 10
			if bucket >= 10 {
				bucket = 9 // Handle edge case where percentage is exactly 100
			}
			buckets[bucket]++
		}

		// Each bucket should have roughly 100 users (1000 / 10)
		// Allow some variance but expect relatively even distribution
		for i, count := range buckets {
			assert.Greater(t, count, 50, "Bucket %d should have at least 50 users", i)
			assert.Less(t, count, 150, "Bucket %d should have at most 150 users", i)
		}
	})

	t.Run("should handle empty strings gracefully", func(t *testing.T) {
		// Should not panic
		hash1 := hasher.Hash("", "test_flag", salt)
		hash2 := hasher.Hash("user-123", "", salt)
		hash3 := hasher.Hash("", "", salt)

		assert.NotEqual(t, hash1, hash2)
		assert.NotEqual(t, hash2, hash3)
		assert.NotEqual(t, hash1, hash3)
	})

	t.Run("should handle special characters in user ID and key", func(t *testing.T) {
		userID := "user@example.com"
		key := "feature-flag_test.123"

		// Should not panic
		hash := hasher.Hash(userID, key, salt)
		percentage := hasher.HashToPercentage(userID, key, salt)

		assert.Greater(t, hash, 0)
		assert.GreaterOrEqual(t, percentage, 0)
		assert.LessOrEqual(t, percentage, 100)
	})

	t.Run("should produce different results with different salts", func(t *testing.T) {
		userID := "user-123"
		key := "test_flag"

		hash1 := hasher.Hash(userID, key, "salt1")
		hash2 := hasher.Hash(userID, key, "salt2")

		assert.NotEqual(t, hash1, hash2, "Different salts should produce different hashes")
	})
}