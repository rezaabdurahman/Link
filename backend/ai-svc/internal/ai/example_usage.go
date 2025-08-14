package ai

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/config"
)

// ExampleScenarios demonstrates various usage scenarios for the OpenAI service
type ExampleScenarios struct {
	factory *ServiceFactory
	logger  zerolog.Logger
}

// NewExampleScenarios creates a new example scenarios instance
func NewExampleScenarios(logger zerolog.Logger) *ExampleScenarios {
	return &ExampleScenarios{
		factory: NewServiceFactory(logger),
		logger:  logger,
	}
}

// RunBasicSummarizationExample demonstrates basic summarization functionality
func (e *ExampleScenarios) RunBasicSummarizationExample() error {
	e.logger.Info().Msg("=== Basic Summarization Example ===")

	// Create demo service (no real API calls)
	cacheService := NewMockSummaryCache()
	service := e.factory.CreateDemoService(cacheService)

	// Create sample conversation messages
	messages := []Message{
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Hi there! I'm having issues with my React application. The pages are loading very slowly.",
			Role:      "user",
			CreatedAt: time.Now().Add(-15 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "I can help you with that! Slow loading can be caused by several factors. Let me ask a few questions first.",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-14 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Are you using any large images or videos? Also, have you implemented code splitting?",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-13 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Yes, I have some large images. I haven't implemented code splitting yet. Can you guide me?",
			Role:      "user",
			CreatedAt: time.Now().Add(-12 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Absolutely! Let's start with image optimization. You can use next/image if you're using Next.js, or implement lazy loading.",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-11 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "I'm using Create React App, not Next.js. What would be the best approach for lazy loading images?",
			Role:      "user",
			CreatedAt: time.Now().Add(-10 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "For CRA, you can use the Intersection Observer API or libraries like react-lazy-load-image-component.",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-9 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "That sounds perfect! Can you also help me with code splitting using React.lazy?",
			Role:      "user",
			CreatedAt: time.Now().Add(-8 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Sure! React.lazy allows you to load components dynamically. Here's how you can implement it...",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-7 * time.Minute),
		},
	}

	// Create summarization request
	limit := 15
	request := &SummarizeRequest{
		ConversationID: uuid.New(),
		Messages:       messages,
		Limit:          &limit,
		UserID:         uuid.New(),
	}

	// Perform summarization
	ctx := context.Background()
	response, err := service.SummarizeMessages(ctx, request)
	if err != nil {
		e.logger.Error().Err(err).Msg("Summarization failed")
		return err
	}

	// Display results
	e.logger.Info().
		Str("summary", response.Summary).
		Int("message_count", response.MessageCount).
		Int("tokens_used", response.TokensUsed).
		Bool("cached", response.CachedResult).
		Msg("Summarization completed")

	return nil
}

// RunLimitedMessageExample demonstrates message limiting functionality
func (e *ExampleScenarios) RunLimitedMessageExample() error {
	e.logger.Info().Msg("=== Limited Message Example ===")

	// Create many messages (more than the limit)
	var messages []Message
	topics := []string{
		"database optimization",
		"API design patterns",
		"frontend performance",
		"security best practices",
		"deployment strategies",
		"monitoring setup",
		"error handling",
		"testing approaches",
		"code review process",
		"documentation standards",
	}

	for i, topic := range topics {
		// User question
		messages = append(messages, Message{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   fmt.Sprintf("Can you help me understand %s?", topic),
			Role:      "user",
			CreatedAt: time.Now().Add(time.Duration(-i*2-1) * time.Minute),
		})

		// Assistant response
		messages = append(messages, Message{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   fmt.Sprintf("I'd be happy to help with %s. Let me explain the key concepts...", topic),
			Role:      "assistant",
			CreatedAt: time.Now().Add(time.Duration(-i*2) * time.Minute),
		})
	}

	e.logger.Info().Int("total_messages", len(messages)).Msg("Created test messages")

	// Test different limits
	limits := []int{5, 10, 15}
	cacheService := NewMockSummaryCache()
	service := e.factory.CreateDemoService(cacheService)

	for _, limit := range limits {
		e.logger.Info().Int("limit", limit).Msg("Testing with limit")

		request := &SummarizeRequest{
			ConversationID: uuid.New(),
			Messages:       messages,
			Limit:          &limit,
			UserID:         uuid.New(),
		}

		ctx := context.Background()
		response, err := service.SummarizeMessages(ctx, request)
		if err != nil {
			e.logger.Error().Err(err).Int("limit", limit).Msg("Summarization failed")
			continue
		}

		e.logger.Info().
			Int("limit", limit).
			Int("processed_messages", response.MessageCount).
			Str("summary", response.Summary).
			Msg("Limited summarization completed")
	}

	return nil
}

// RunCachingExample demonstrates caching functionality
func (e *ExampleScenarios) RunCachingExample() error {
	e.logger.Info().Msg("=== Caching Example ===")

	// Create sample messages
	messages := []Message{
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "What are the best practices for Go error handling?",
			Role:      "user",
			CreatedAt: time.Now().Add(-5 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Go error handling follows several key principles: explicit error returns, error wrapping, and proper error checking.",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-4 * time.Minute),
		},
	}

	// Create mock cache that tracks operations
	cache := NewMockSummaryCache()
	service := e.factory.CreateDemoService(cache)

	limit := 15
	request := &SummarizeRequest{
		ConversationID: uuid.New(),
		Messages:       messages,
		Limit:          &limit,
		UserID:         uuid.New(),
	}

	ctx := context.Background()

	// First request - should be a cache miss
	e.logger.Info().Msg("First request (cache miss expected)")
	response1, err := service.SummarizeMessages(ctx, request)
	if err != nil {
		return err
	}

	e.logger.Info().
		Bool("cached_result", response1.CachedResult).
		Str("summary", response1.Summary).
		Msg("First request completed")

	// Second request with same data - should be cache hit if using real cache
	e.logger.Info().Msg("Second request (same data)")
	response2, err := service.SummarizeMessages(ctx, request)
	if err != nil {
		return err
	}

	e.logger.Info().
		Bool("cached_result", response2.CachedResult).
		Str("summary", response2.Summary).
		Msg("Second request completed")

	return nil
}

// RunPIIRedactionExample demonstrates PII redaction functionality
func (e *ExampleScenarios) RunPIIRedactionExample() error {
	e.logger.Info().Msg("=== PII Redaction Example ===")

	// Create messages with PII that would be redacted
	messages := []Message{
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Hi, my name is John Smith and my email is john.smith@company.com. I need help with my account.",
			Role:      "user",
			CreatedAt: time.Now().Add(-10 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "Hello John! I'd be happy to help you with your account. Can you provide more details?",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-9 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "My phone number is +1-555-123-4567 and I'm having trouble accessing my dashboard.",
			Role:      "user",
			CreatedAt: time.Now().Add(-8 * time.Minute),
		},
		{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Content:   "I understand. Let me help you troubleshoot the dashboard access issue.",
			Role:      "assistant",
			CreatedAt: time.Now().Add(-7 * time.Minute),
		},
	}

	e.logger.Info().Msg("Messages contain PII: email, phone, name")

	// Show what the messages would look like after anonymization
	// (In demo mode, we won't actually call the privacy service)
	e.logger.Info().Msg("In production, PII would be automatically redacted:")
	e.logger.Info().Msg("  john.smith@company.com → user1@example.com")
	e.logger.Info().Msg("  John Smith → John Doe")
	e.logger.Info().Msg("  +1-555-123-4567 → 555-0123")

	// Process with demo service
	cacheService := NewMockSummaryCache()
	service := e.factory.CreateDemoService(cacheService)

	limit := 15
	request := &SummarizeRequest{
		ConversationID: uuid.New(),
		Messages:       messages,
		Limit:          &limit,
		UserID:         uuid.New(),
	}

	ctx := context.Background()
	response, err := service.SummarizeMessages(ctx, request)
	if err != nil {
		return err
	}

	e.logger.Info().
		Str("summary", response.Summary).
		Msg("Summary generated (PII would be redacted in production)")

	return nil
}

// RunHealthCheckExample demonstrates health checking functionality
func (e *ExampleScenarios) RunHealthCheckExample() error {
	e.logger.Info().Msg("=== Health Check Example ===")

	// Create demo service
	cacheService := NewMockSummaryCache()
	service := e.factory.CreateDemoService(cacheService)

	// Perform health check
	ctx := context.Background()
	err := service.Health(ctx)
	if err != nil {
		e.logger.Error().Err(err).Msg("Health check failed")
		return err
	}

	e.logger.Info().Msg("Health check passed")

	// Show supported models
	models := service.GetSupportedModels()
	e.logger.Info().Strs("supported_models", models).Msg("Supported models")

	// Validate models
	testModels := []string{"demo-model", "invalid-model", "gpt-4"}
	for _, model := range testModels {
		isValid := service.ValidateModel(model)
		e.logger.Info().
			Str("model", model).
			Bool("is_valid", isValid).
			Msg("Model validation result")
	}

	return nil
}

// RunConfigurationExample demonstrates configuration validation
func (e *ExampleScenarios) RunConfigurationExample() error {
	e.logger.Info().Msg("=== Configuration Validation Example ===")

	// Test valid configuration
	validConfig := &config.AIConfig{
		Provider:    "openai",
		APIKey:      "test-key",
		Model:       "gpt-3.5-turbo",
		MaxTokens:   2048,
		Temperature: 0.7,
		Timeout:     30 * time.Second,
		MaxRetries:  3,
	}

	err := e.factory.ValidateConfiguration(validConfig)
	if err != nil {
		e.logger.Error().Err(err).Msg("Valid configuration failed validation")
		return err
	}
	e.logger.Info().Msg("Valid configuration passed validation")

	// Test invalid configurations
	invalidConfigs := []*config.AIConfig{
		{
			Provider: "",
			APIKey:   "test-key",
			Model:    "gpt-3.5-turbo",
		},
		{
			Provider: "openai",
			APIKey:   "",
			Model:    "gpt-3.5-turbo",
		},
		{
			Provider:    "openai",
			APIKey:      "test-key",
			Model:       "",
			MaxTokens:   2048,
			Temperature: 0.7,
		},
		{
			Provider:    "openai",
			APIKey:      "test-key",
			Model:       "gpt-3.5-turbo",
			MaxTokens:   -1,
			Temperature: 0.7,
		},
		{
			Provider:    "openai",
			APIKey:      "test-key",
			Model:       "gpt-3.5-turbo",
			MaxTokens:   2048,
			Temperature: 5.0, // Invalid temperature
		},
	}

	for i, invalidConfig := range invalidConfigs {
		err := e.factory.ValidateConfiguration(invalidConfig)
		if err == nil {
			e.logger.Error().Int("config_index", i).Msg("Invalid configuration passed validation")
		} else {
			e.logger.Info().
				Int("config_index", i).
				Str("error", err.Error()).
				Msg("Invalid configuration correctly rejected")
		}
	}

	return nil
}

// RunProviderInfoExample demonstrates provider information retrieval
func (e *ExampleScenarios) RunProviderInfoExample() error {
	e.logger.Info().Msg("=== Provider Information Example ===")

	// Get supported providers
	providers := e.factory.GetSupportedProviders()
	e.logger.Info().Strs("supported_providers", providers).Msg("Supported providers")

	// Get detailed provider information
	providerInfo := e.factory.GetProviderInfo()
	for _, info := range providerInfo {
		e.logger.Info().
			Str("name", info.Name).
			Str("display_name", info.DisplayName).
			Str("default_model", info.DefaultModel).
			Strs("supported_models", info.SupportedModels).
			Strs("features", info.Features).
			Str("pricing", info.Pricing).
			Str("documentation", info.Documentation).
			Msg("Provider information")
	}

	return nil
}

// RunAllExamples runs all example scenarios
func (e *ExampleScenarios) RunAllExamples() error {
	e.logger.Info().Msg("Running all OpenAI service examples...")

	examples := []struct {
		name string
		fn   func() error
	}{
		{"Basic Summarization", e.RunBasicSummarizationExample},
		{"Limited Messages", e.RunLimitedMessageExample},
		{"Caching", e.RunCachingExample},
		{"PII Redaction", e.RunPIIRedactionExample},
		{"Health Checks", e.RunHealthCheckExample},
		{"Configuration", e.RunConfigurationExample},
		{"Provider Info", e.RunProviderInfoExample},
	}

	for _, example := range examples {
		e.logger.Info().Str("example", example.name).Msg("Starting example")
		
		if err := example.fn(); err != nil {
			e.logger.Error().
				Err(err).
				Str("example", example.name).
				Msg("Example failed")
			return err
		}
		
		e.logger.Info().Str("example", example.name).Msg("Example completed successfully")
		fmt.Println() // Add spacing between examples
	}

	e.logger.Info().Msg("All examples completed successfully!")
	return nil
}

// DemoMain demonstrates how to run the examples
func DemoMain() {
	// Setup logger
	logger := zerolog.New(os.Stdout).
		With().
		Timestamp().
		Caller().
		Logger().
		Level(zerolog.InfoLevel)

	// Create example scenarios
	examples := NewExampleScenarios(logger)

	// Run all examples
	if err := examples.RunAllExamples(); err != nil {
		logger.Fatal().Err(err).Msg("Examples failed")
	}
}

// ProductionExample demonstrates how to set up the service in production
func ProductionExample() {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

	// This example shows how you would set up the service in production
	logger.Info().Msg("=== Production Setup Example ===")
	logger.Info().Msg("This example shows production setup (requires real configuration)")

	// Load configuration from environment
	cfg, err := config.Load()
	if err != nil {
		logger.Error().Err(err).Msg("Failed to load configuration")
		return
	}

	// Create Redis cache
	cacheService, err := cache.NewRedisCache(&cfg.Redis, logger)
	if err != nil {
		logger.Error().Err(err).Msg("Failed to create Redis cache")
		return
	}
	defer cacheService.Close()

	// Create service factory
	factory := NewServiceFactory(logger)

	// Validate configuration
	if err := factory.ValidateConfiguration(&cfg.AI); err != nil {
		logger.Error().Err(err).Msg("Invalid AI configuration")
		return
	}

	// Create AI service
	aiService, err := factory.CreateSummarizationService(&cfg.AI, cacheService)
	if err != nil {
		logger.Error().Err(err).Msg("Failed to create AI service")
		return
	}

	// Test health
	ctx := context.Background()
	if err := aiService.Health(ctx); err != nil {
		logger.Warn().Err(err).Msg("AI service health check failed (expected without API key)")
	} else {
		logger.Info().Msg("AI service is healthy")
	}

	// Example usage would continue here...
	logger.Info().Msg("Production setup completed")
}
