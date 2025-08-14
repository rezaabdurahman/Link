package ai

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/config"
)

// ServiceFactory creates AI service instances based on configuration
type ServiceFactory struct {
	logger zerolog.Logger
}

// NewServiceFactory creates a new service factory
func NewServiceFactory(logger zerolog.Logger) *ServiceFactory {
	return &ServiceFactory{
		logger: logger.With().Str("component", "ai_service_factory").Logger(),
	}
}

// CreateSummarizationService creates a summarization service based on the provider configuration
func (f *ServiceFactory) CreateSummarizationService(
	cfg *config.AIConfig,
	cacheService cache.SummaryCache,
) (SummarizationService, error) {
	provider := strings.ToLower(cfg.Provider)
	
	f.logger.Info().
		Str("provider", provider).
		Str("model", cfg.Model).
		Msg("Creating AI summarization service")

	switch provider {
	case "openai":
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("OpenAI API key is required")
		}
		
		service := NewOpenAIService(cfg, cacheService, f.logger)
		
		// Validate the configured model
		if !service.ValidateModel(cfg.Model) {
			f.logger.Warn().
				Str("model", cfg.Model).
				Strs("supported_models", service.GetSupportedModels()).
				Msg("Configured model is not in supported list, but will proceed")
		}
		
		return service, nil
	
	// Future providers can be added here
	case "anthropic":
		return nil, fmt.Errorf("Anthropic provider not yet implemented")
	
	case "google":
		return nil, fmt.Errorf("Google AI provider not yet implemented")
	
	case "azure":
		return nil, fmt.Errorf("Azure OpenAI provider not yet implemented")
	
	case "huggingface":
		return nil, fmt.Errorf("Hugging Face provider not yet implemented")
	
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s. Supported providers: openai", provider)
	}
}

// CreateAIProvider creates a full AI provider instance
func (f *ServiceFactory) CreateAIProvider(
	cfg *config.AIConfig,
	cacheService cache.SummaryCache,
) (AIProvider, error) {
	provider := strings.ToLower(cfg.Provider)
	
	switch provider {
	case "openai":
		service := NewOpenAIService(cfg, cacheService, f.logger)
		return &OpenAIProvider{service: service}, nil
	
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", provider)
	}
}

// ValidateConfiguration validates AI configuration
func (f *ServiceFactory) ValidateConfiguration(cfg *config.AIConfig) error {
	if cfg == nil {
		return fmt.Errorf("AI configuration is nil")
	}
	
	if cfg.Provider == "" {
		return fmt.Errorf("AI provider must be specified")
	}
	
	if cfg.APIKey == "" {
		return fmt.Errorf("API key must be specified")
	}
	
	if cfg.Model == "" {
		return fmt.Errorf("AI model must be specified")
	}
	
	if cfg.MaxTokens <= 0 {
		return fmt.Errorf("MaxTokens must be greater than 0")
	}
	
	if cfg.Temperature < 0 || cfg.Temperature > 2 {
		return fmt.Errorf("Temperature must be between 0 and 2")
	}
	
	if cfg.Timeout <= 0 {
		return fmt.Errorf("Timeout must be greater than 0")
	}
	
	if cfg.MaxRetries < 0 {
		return fmt.Errorf("MaxRetries must be 0 or greater")
	}
	
	f.logger.Info().
		Str("provider", cfg.Provider).
		Str("model", cfg.Model).
		Int("max_tokens", cfg.MaxTokens).
		Float64("temperature", cfg.Temperature).
		Dur("timeout", cfg.Timeout).
		Int("max_retries", cfg.MaxRetries).
		Msg("AI configuration validated successfully")
	
	return nil
}

// GetSupportedProviders returns the list of supported AI providers
func (f *ServiceFactory) GetSupportedProviders() []string {
	return []string{
		"openai",
		// Future providers:
		// "anthropic",
		// "google", 
		// "azure",
		// "huggingface",
	}
}

// OpenAIProvider wraps OpenAIService to implement AIProvider interface
type OpenAIProvider struct {
	service *OpenAIService
}

// Implement SummarizationService interface
func (p *OpenAIProvider) SummarizeMessages(ctx context.Context, req *SummarizeRequest) (*SummarizeResponse, error) {
	return p.service.SummarizeMessages(ctx, req)
}

func (p *OpenAIProvider) InvalidateConversationSummaries(ctx context.Context, conversationID uuid.UUID) error {
	return p.service.InvalidateConversationSummaries(ctx, conversationID)
}

func (p *OpenAIProvider) Health(ctx context.Context) error {
	return p.service.Health(ctx)
}

func (p *OpenAIProvider) GetSupportedModels() []string {
	return p.service.GetSupportedModels()
}

func (p *OpenAIProvider) ValidateModel(model string) bool {
	return p.service.ValidateModel(model)
}

// Implement AIProvider interface
func (p *OpenAIProvider) GetProviderName() string {
	return "openai"
}

func (p *OpenAIProvider) GetDefaultModel() string {
	return "gpt-3.5-turbo"
}

func (p *OpenAIProvider) EstimateCost(tokenCount int, model string) float64 {
	// OpenAI pricing (approximate, as of 2024)
	// These would typically come from a pricing configuration
	pricePerToken := map[string]float64{
		"gpt-4":                    0.00003,  // $0.03 per 1K tokens
		"gpt-4-turbo-preview":      0.00001,  // $0.01 per 1K tokens
		"gpt-4-1106-preview":       0.00001,  // $0.01 per 1K tokens
		"gpt-3.5-turbo":            0.000002, // $0.002 per 1K tokens
		"gpt-3.5-turbo-1106":       0.000002, // $0.002 per 1K tokens
		"gpt-3.5-turbo-16k":        0.000002, // $0.002 per 1K tokens
	}
	
	if price, exists := pricePerToken[model]; exists {
		return float64(tokenCount) * price
	}
	
	// Default to GPT-3.5-turbo pricing
	return float64(tokenCount) * pricePerToken["gpt-3.5-turbo"]
}

// ProviderInfo contains information about an AI provider
type ProviderInfo struct {
	Name           string   `json:"name"`
	DisplayName    string   `json:"display_name"`
	SupportedModels []string `json:"supported_models"`
	DefaultModel   string   `json:"default_model"`
	Features       []string `json:"features"`
	Pricing        string   `json:"pricing"`
	Documentation  string   `json:"documentation"`
}

// GetProviderInfo returns information about supported providers
func (f *ServiceFactory) GetProviderInfo() []ProviderInfo {
	return []ProviderInfo{
		{
			Name:        "openai",
			DisplayName: "OpenAI GPT",
			SupportedModels: []string{
				"gpt-4",
				"gpt-4-turbo-preview",
				"gpt-4-1106-preview",
				"gpt-3.5-turbo",
				"gpt-3.5-turbo-1106",
				"gpt-3.5-turbo-16k",
			},
			DefaultModel: "gpt-3.5-turbo",
			Features: []string{
				"Text Summarization",
				"Chat Completion",
				"High Quality Responses",
				"Fast Response Times",
			},
			Pricing:       "Per token usage",
			Documentation: "https://platform.openai.com/docs/api-reference",
		},
		// Future providers would be added here
	}
}

// CreateDemoService creates a demo service for testing (doesn't make real API calls)
func (f *ServiceFactory) CreateDemoService(cacheService cache.SummaryCache) SummarizationService {
	return &DemoSummarizationService{
		logger: f.logger,
		cache:  cacheService,
	}
}

// DemoSummarizationService provides a demo implementation for testing
type DemoSummarizationService struct {
	logger zerolog.Logger
	cache  cache.SummaryCache
}

// Implement SummarizationService interface for demo
func (d *DemoSummarizationService) SummarizeMessages(ctx context.Context, req *SummarizeRequest) (*SummarizeResponse, error) {
	d.logger.Info().
		Str("conversation_id", req.ConversationID.String()).
		Int("message_count", len(req.Messages)).
		Msg("Demo summarization request")

	// Create a mock summary based on message count
	var summary string
	switch {
	case len(req.Messages) == 0:
		summary = "No messages to summarize."
	case len(req.Messages) == 1:
		summary = "Single message conversation about a brief topic."
	case len(req.Messages) <= 5:
		summary = "Short conversation covering a few key points and brief discussion."
	default:
		summary = "Extended conversation with multiple topics, decisions made, and follow-up actions discussed."
	}
	
	response := &SummarizeResponse{
		ID:             generateSummaryID(),
		ConversationID: req.ConversationID,
		Summary:        summary,
		MessageCount:   len(req.Messages),
		TokensUsed:     len(req.Messages) * 50, // Mock token count
		Model:          "demo-model",
		ProcessingTime: 100, // Mock processing time
		CachedResult:   false,
		Metadata: map[string]interface{}{
			"demo_mode":         true,
			"mock_token_count":  len(req.Messages) * 50,
			"message_count":     len(req.Messages),
		},
		CreatedAt: time.Now(),
	}
	
	return response, nil
}

func (d *DemoSummarizationService) InvalidateConversationSummaries(ctx context.Context, conversationID uuid.UUID) error {
	d.logger.Info().Str("conversation_id", conversationID.String()).Msg("Demo invalidation request")
	return nil
}

func (d *DemoSummarizationService) Health(ctx context.Context) error {
	return nil
}

func (d *DemoSummarizationService) GetSupportedModels() []string {
	return []string{"demo-model"}
}

func (d *DemoSummarizationService) ValidateModel(model string) bool {
	return model == "demo-model"
}
