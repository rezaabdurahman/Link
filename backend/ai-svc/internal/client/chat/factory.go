package chat

import (
	"github.com/link-app/ai-svc/internal/config"
	"github.com/rs/zerolog"
)

// NewChatService creates a new chat service client with the given configuration
func NewChatService(cfg config.ChatServiceConfig, logger zerolog.Logger, jwtToken string) Service {
	clientConfig := ClientConfig{
		Config:   cfg,
		Logger:   logger.With().Str("component", "chat_client").Logger(),
		JWTToken: jwtToken,
	}

	return NewClient(clientConfig)
}
