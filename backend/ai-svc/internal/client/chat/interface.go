package chat

import (
	"context"

	"github.com/google/uuid"
)

// Service defines the interface for chat service operations
type Service interface {
	// GetRecentMessages retrieves recent messages from a conversation
	GetRecentMessages(ctx context.Context, conversationID uuid.UUID, limit int) (*GetMessagesResponse, error)
	
	// UpdateJWTToken updates the JWT token used for authentication
	UpdateJWTToken(token string)
	
	// Health checks if the chat service is healthy
	Health(ctx context.Context) error
	
	// GetCircuitBreakerState returns the current circuit breaker state
	GetCircuitBreakerState() CircuitBreakerState
	
	// ResetCircuitBreaker resets the circuit breaker to its initial state
	ResetCircuitBreaker()
}
