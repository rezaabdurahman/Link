package config

import (
	"context"
	"fmt"
	"os"

	"github.com/sashabaranov/go-openai"
	sharedconfig "github.com/link-app/shared-libs/config"
)

// EmbeddingProvider interface allows for different embedding providers
type EmbeddingProvider interface {
	GenerateEmbedding(ctx context.Context, text string) ([]float32, error)
	GetDimensions() int
	GetProviderName() string
	CheckHealth(ctx context.Context) error
}

// OpenAIEmbeddingProvider implements EmbeddingProvider using OpenAI
type OpenAIEmbeddingProvider struct {
	client *openai.Client
	model  string
}

// NewEmbeddingProvider creates a new embedding provider based on configuration
func NewEmbeddingProvider() (EmbeddingProvider, error) {
	providerType := sharedconfig.GetEnv("EMBEDDING_PROVIDER", "openai")
	
	switch providerType {
	case "openai":
		return newOpenAIProvider()
	default:
		return nil, fmt.Errorf("unsupported embedding provider: %s", providerType)
	}
}

// newOpenAIProvider creates a new OpenAI embedding provider
func newOpenAIProvider() (*OpenAIEmbeddingProvider, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable is required")
	}

	client := openai.NewClient(apiKey)
	model := sharedconfig.GetEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

	return &OpenAIEmbeddingProvider{
		client: client,
		model:  model,
	}, nil
}

// GenerateEmbedding generates an embedding for the given text using OpenAI
func (p *OpenAIEmbeddingProvider) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	// For now, use the available model from the library
	// The current library version doesn't support text-embedding-3-* models
	req := openai.EmbeddingRequest{
		Input: []string{text},
		Model: openai.AdaEmbeddingV2, // text-embedding-ada-002
	}

	resp, err := p.client.CreateEmbeddings(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create embeddings: %w", err)
	}

	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no embeddings returned from OpenAI")
	}

	return resp.Data[0].Embedding, nil
}

// GetDimensions returns the embedding dimensions based on the model
func (p *OpenAIEmbeddingProvider) GetDimensions() int {
	switch p.model {
	case "text-embedding-3-small":
		return 1536
	case "text-embedding-3-large":
		return 3072
	case "text-embedding-ada-002":
		return 1536
	default:
		return 1536 // Default to small model dimensions
	}
}

// GetProviderName returns the provider name
func (p *OpenAIEmbeddingProvider) GetProviderName() string {
	return "openai"
}

// CheckHealth checks if the embedding provider is healthy (stub implementation)
func (p *OpenAIEmbeddingProvider) CheckHealth(ctx context.Context) error {
	// Stub implementation - in a real app this would ping OpenAI API
	return nil
}
