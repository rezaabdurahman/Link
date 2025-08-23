package chat

import (
	"github.com/link-app/ai-svc/internal/config"
	"github.com/rs/zerolog"
)

// NewChatService creates a new chat service client with the given configuration
func NewChatService(cfg config.ChatServiceConfig, logger zerolog.Logger, jwtToken string) Service {
	// Default to gRPC for service-to-service communication
	// Check if gRPC is enabled in config (default true)
	useGRPC := cfg.UseGRPC
	if useGRPC {
		client, err := NewGRPCClient(cfg.GRPCEndpoint)
		if err != nil {
			logger.Error().Err(err).Msg("Failed to create gRPC chat client, falling back to HTTP")
			// Fall back to HTTP client
		} else {
			logger.Info().Msg("Using gRPC chat client")
			return client
		}
	}

	// Default to HTTP client
	clientConfig := ClientConfig{
		Config:   cfg,
		Logger:   logger.With().Str("component", "chat_client").Logger(),
		JWTToken: jwtToken,
	}

	return NewClient(clientConfig)
}
