package features

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
)

// DefaultAssignmentHasher provides consistent hashing for user assignments
type DefaultAssignmentHasher struct{}

// NewAssignmentHasher creates a new assignment hasher
func NewAssignmentHasher() *DefaultAssignmentHasher {
	return &DefaultAssignmentHasher{}
}

// Hash generates a consistent hash for the given inputs
func (h *DefaultAssignmentHasher) Hash(userID string, flagKey string, salt string) int {
	input := fmt.Sprintf("%s:%s:%s", userID, flagKey, salt)
	hash := sha256.Sum256([]byte(input))
	
	// Convert first 4 bytes to int32 and ensure positive
	hashInt := int(binary.BigEndian.Uint32(hash[:4]))
	if hashInt < 0 {
		hashInt = -hashInt
	}
	
	return hashInt
}

// HashToPercentage returns a hash value between 0-100 for percentage-based rollouts
func (h *DefaultAssignmentHasher) HashToPercentage(userID string, flagKey string, salt string) int {
	hash := h.Hash(userID, flagKey, salt)
	return hash % 101 // 0-100 inclusive
}