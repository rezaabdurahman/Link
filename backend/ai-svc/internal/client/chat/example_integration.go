package chat

import (
	"context"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/link-app/ai-svc/internal/config"
	"github.com/rs/zerolog"
)

// ExampleIntegration demonstrates how to integrate the chat service client
// This is an example and should not be used in production code
func ExampleIntegration() error {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Create logger
	logger := zerolog.New(os.Stdout).With().
		Timestamp().
		Str("service", "ai-svc").
		Logger()

	// In a real application, you would get the JWT token from:
	// 1. Authentication middleware
	// 2. Token store/cache
	// 3. Request context
	jwtToken := "your-jwt-token-here"

	// Create chat service client
	chatService := NewChatService(cfg.ChatService, logger, jwtToken)

	// Example conversation ID (in practice, this would come from request parameters)
	conversationID := uuid.New()

	// Get recent messages with retry and circuit breaker protection
	ctx := context.Background()
	messages, err := chatService.GetRecentMessages(ctx, conversationID, 10)
	if err != nil {
		// Handle different types of errors
		switch err {
		case ErrCircuitBreakerOpen:
			logger.Warn().Msg("Chat service is temporarily unavailable (circuit breaker open)")
			// Return cached data or fallback response
			return fmt.Errorf("chat service temporarily unavailable: %w", err)
		case context.DeadlineExceeded:
			logger.Error().Msg("Chat service request timed out")
			return fmt.Errorf("chat service timeout: %w", err)
		default:
			logger.Error().Err(err).Msg("Failed to retrieve messages from chat service")
			return fmt.Errorf("chat service error: %w", err)
		}
	}

	// Process the messages
	logger.Info().
		Int("message_count", len(messages.Messages)).
		Int64("total_count", messages.TotalCount).
		Bool("has_more", messages.HasMore).
		Msg("Successfully retrieved messages")

	// Example: Process messages for AI summarization
	for _, message := range messages.Messages {
		logger.Debug().
			Str("message_id", message.ID.String()).
			Str("user_id", message.UserID.String()).
			Str("message_type", message.MessageType).
			Int("content_length", len(message.Content)).
			Msg("Processing message")

		// Here you would integrate with your AI service
		// processMessageForAI(message)
	}

	// Health check example
	if err := chatService.Health(ctx); err != nil {
		logger.Warn().Err(err).Msg("Chat service health check failed")
		// This doesn't necessarily mean failure, just that the service might be degraded
	}

	// Monitor circuit breaker state
	state := chatService.GetCircuitBreakerState()
	if state != CircuitBreakerClosed {
		logger.Warn().
			Str("circuit_breaker_state", state.String()).
			Msg("Chat service circuit breaker is not in normal state")
	}

	return nil
}

// TokenRefreshExample shows how to update JWT tokens when they're refreshed
func TokenRefreshExample(chatService Service, newToken string) {
	// Update the JWT token when it's refreshed
	// This should be called from your token refresh mechanism
	chatService.UpdateJWTToken(newToken)
	
	// Log the token update (don't log the actual token value)
	logger := zerolog.New(os.Stdout)
	logger.Info().Msg("Chat service JWT token updated")
}

// CircuitBreakerManagementExample shows circuit breaker management
func CircuitBreakerManagementExample(chatService Service) {
	logger := zerolog.New(os.Stdout)
	
	// Check circuit breaker state
	state := chatService.GetCircuitBreakerState()
	logger.Info().
		Str("circuit_breaker_state", state.String()).
		Msg("Current circuit breaker state")

	// Reset circuit breaker if needed (e.g., during maintenance)
	if state == CircuitBreakerOpen {
		logger.Info().Msg("Resetting circuit breaker")
		chatService.ResetCircuitBreaker()
	}
}

// ErrorHandlingExample demonstrates comprehensive error handling
func ErrorHandlingExample(chatService Service, conversationID uuid.UUID) error {
	ctx := context.Background()
	logger := zerolog.New(os.Stdout)

	messages, err := chatService.GetRecentMessages(ctx, conversationID, 10)
	if err != nil {
		// Log the error with context
		logger.Error().
			Err(err).
			Str("conversation_id", conversationID.String()).
			Str("operation", "get_recent_messages").
			Msg("Chat service request failed")

		// Handle specific error types
		switch err {
		case ErrCircuitBreakerOpen:
			// Circuit breaker is open - service is likely down
			// Return cached data or a degraded response
			logger.Warn().Msg("Using fallback due to circuit breaker")
			return handleCircuitBreakerOpen(conversationID)
		
		case context.DeadlineExceeded:
			// Request timed out - service might be slow
			// Consider returning partial data or cached data
			logger.Warn().Msg("Request timed out, checking for cached data")
			return handleTimeout(conversationID)
		
		case context.Canceled:
			// Request was canceled - client disconnected
			logger.Info().Msg("Request canceled by client")
			return err
		
		default:
			// Other errors - could be network issues, HTTP errors, etc.
			// Log and decide whether to retry, fallback, or fail
			if isTemporaryError(err) {
				logger.Warn().Msg("Temporary error detected, service will retry automatically")
				// The retry mechanism is already built into the client
			}
			return fmt.Errorf("chat service error: %w", err)
		}
	}

	// Success case
	logger.Info().
		Int("message_count", len(messages.Messages)).
		Msg("Successfully retrieved messages")

	return nil
}

// Helper functions for error handling examples

func handleCircuitBreakerOpen(conversationID uuid.UUID) error {
	// Implementation for circuit breaker fallback
	// This could involve:
	// 1. Returning cached messages
	// 2. Returning a default/empty response
	// 3. Queuing the request for later processing
	return fmt.Errorf("chat service temporarily unavailable")
}

func handleTimeout(conversationID uuid.UUID) error {
	// Implementation for timeout handling
	// This could involve:
	// 1. Returning cached messages if available
	// 2. Returning partial data
	// 3. Suggesting the client retry later
	return fmt.Errorf("chat service request timed out")
}

func isTemporaryError(err error) bool {
	// Determine if an error is temporary and might succeed on retry
	// This would check for specific error types like network errors,
	// 5xx HTTP responses, etc.
	return true // Simplified for example
}
