# OpenAI GPT Integration & Summarization Logic

This package implements OpenAI GPT integration with comprehensive summarization logic for chat messages, including timeout handling, exponential backoff retry logic, PII redaction, and Redis caching.

## Features

- ✅ **Official OpenAI Go SDK**: Uses pinned version (v1.36.0)
- ✅ **Prompt Template**: "Summarize the following messages in 2-3 sentences..."
- ✅ **Message Limiting**: Respects `limit` parameter (default: 15)
- ✅ **Timeout Handling**: Configurable request timeouts
- ✅ **Exponential Backoff**: Intelligent retry logic for transient failures
- ✅ **PII Redaction**: Automatic removal of personal information before API calls
- ✅ **Redis Caching**: Stores responses in Redis for improved performance
- ✅ **Comprehensive Logging**: Structured logging with zerolog
- ✅ **Health Checks**: Service health monitoring
- ✅ **Error Handling**: Robust error classification and handling

## Configuration

Set the following environment variables:

```bash
# OpenAI Configuration
AI_PROVIDER=openai
AI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-3.5-turbo
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_TIMEOUT=30s
AI_MAX_RETRIES=3

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=""
REDIS_DB=1
SUMMARY_TTL=1h
```

## Usage

### Basic Usage

```go
package main

import (
    "context"
    "log"
    "time"

    "github.com/rs/zerolog"
    "github.com/link-app/ai-svc/internal/ai"
    "github.com/link-app/ai-svc/internal/cache"
    "github.com/link-app/ai-svc/internal/config"
)

func main() {
    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        log.Fatal("Failed to load config:", err)
    }

    // Create logger
    logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

    // Create cache service (Redis)
    cacheService, err := cache.NewRedisCache(&cfg.Redis, logger)
    if err != nil {
        log.Fatal("Failed to create cache:", err)
    }
    defer cacheService.Close()

    // Create OpenAI service
    aiService := ai.NewOpenAIService(&cfg.AI, cacheService, logger)

    // Create sample messages
    messages := []ai.Message{
        {
            ID:        uuid.New(),
            UserID:    uuid.New(),
            Content:   "Hi, I need help with my Go project",
            Role:      "user",
            CreatedAt: time.Now().Add(-10 * time.Minute),
        },
        {
            ID:        uuid.New(),
            UserID:    uuid.New(),
            Content:   "I'd be happy to help! What specific issues are you facing?",
            Role:      "assistant",
            CreatedAt: time.Now().Add(-9 * time.Minute),
        },
        {
            ID:        uuid.New(),
            UserID:    uuid.New(),
            Content:   "I'm having trouble with CORS in my web API",
            Role:      "user",
            CreatedAt: time.Now().Add(-8 * time.Minute),
        },
    }

    // Create summarization request
    limit := 15
    request := &ai.SummarizeRequest{
        ConversationID: uuid.New(),
        Messages:       messages,
        Limit:          &limit,
        UserID:         uuid.New(),
    }

    // Summarize messages
    ctx := context.Background()
    response, err := aiService.SummarizeMessages(ctx, request)
    if err != nil {
        log.Fatal("Summarization failed:", err)
    }

    log.Printf("Summary: %s", response.Summary)
    log.Printf("Tokens used: %d", response.TokensUsed)
    log.Printf("Processing time: %v", response.ProcessingTime)
    log.Printf("Cached result: %t", response.CachedResult)
}
```

### Using the Factory Pattern

```go
// Create service factory
factory := ai.NewServiceFactory(logger)

// Validate configuration
if err := factory.ValidateConfiguration(&cfg.AI); err != nil {
    log.Fatal("Invalid AI configuration:", err)
}

// Create summarization service
summaryService, err := factory.CreateSummarizationService(&cfg.AI, cacheService)
if err != nil {
    log.Fatal("Failed to create service:", err)
}

// Use the service
response, err := summaryService.SummarizeMessages(ctx, request)
```

### Demo Mode (for Testing)

```go
// Create demo service (no API calls made)
demoService := factory.CreateDemoService(cacheService)

// This will return mock responses without calling OpenAI
response, err := demoService.SummarizeMessages(ctx, request)
```

## API Reference

### Types

#### `SummarizeRequest`
```go
type SummarizeRequest struct {
    ConversationID uuid.UUID `json:"conversation_id"`
    Messages       []Message `json:"messages"`
    Limit          *int      `json:"limit,omitempty"` // Default 15
    UserID         uuid.UUID `json:"user_id"`
}
```

#### `Message`
```go
type Message struct {
    ID        uuid.UUID `json:"id"`
    UserID    uuid.UUID `json:"user_id"`
    Content   string    `json:"content"`
    Role      string    `json:"role"` // user, assistant, system
    CreatedAt time.Time `json:"created_at"`
}
```

#### `SummarizeResponse`
```go
type SummarizeResponse struct {
    ID             string                 `json:"id"`
    ConversationID uuid.UUID              `json:"conversation_id"`
    Summary        string                 `json:"summary"`
    MessageCount   int                    `json:"message_count"`
    TokensUsed     int                    `json:"tokens_used"`
    Model          string                 `json:"model"`
    ProcessingTime time.Duration          `json:"processing_time"`
    CachedResult   bool                   `json:"cached_result"`
    Metadata       map[string]interface{} `json:"metadata,omitempty"`
    CreatedAt      time.Time              `json:"created_at"`
}
```

### Interface: `SummarizationService`

```go
type SummarizationService interface {
    // SummarizeMessages creates a summary of conversation messages
    SummarizeMessages(ctx context.Context, req *SummarizeRequest) (*SummarizeResponse, error)
    
    // InvalidateConversationSummaries removes cached summaries for a conversation
    InvalidateConversationSummaries(ctx context.Context, conversationID uuid.UUID) error
    
    // Health checks the health of the AI service
    Health(ctx context.Context) error
    
    // GetSupportedModels returns the list of supported AI models
    GetSupportedModels() []string
    
    // ValidateModel checks if a model is supported
    ValidateModel(model string) bool
}
```

## Supported Models

- `gpt-4`
- `gpt-4-turbo-preview`
- `gpt-4-1106-preview`
- `gpt-3.5-turbo` (default)
- `gpt-3.5-turbo-1106`
- `gpt-3.5-turbo-16k`

## PII Redaction

The service automatically redacts personally identifiable information (PII) before sending messages to OpenAI:

- **Email addresses**: `john.doe@example.com` → `user1@example.com`
- **Phone numbers**: `+1-555-123-4567` → `555-0123`
- **Names**: `John Smith` → `John Doe`

PII redaction is handled by the privacy package and can be configured with custom anonymization options.

## Caching Strategy

- **Cache Key**: Generated from conversation ID, message IDs, timestamps, and limit
- **TTL**: 1 hour (configurable via `SUMMARY_TTL`)
- **Cache Hit**: Returns cached result immediately
- **Cache Miss**: Calls OpenAI API and caches the result
- **Invalidation**: Can invalidate all summaries for a conversation

## Retry Logic

Exponential backoff with jitter:

- **Base Delay**: 250ms
- **Max Delay**: 30s
- **Backoff Factor**: 2.0
- **Max Retries**: Configurable (default: 3)

Retryable errors include:
- Rate limiting
- Server errors (5xx)
- Network timeouts
- Connection issues

## Error Handling

The service classifies errors into:

- **Retryable**: Rate limits, server errors, network issues
- **Non-retryable**: Authentication failures, invalid requests
- **Context errors**: Timeout, cancellation (not retried)

## Monitoring & Observability

### Health Checks

```go
// Check service health
err := aiService.Health(ctx)
if err != nil {
    log.Printf("Service unhealthy: %v", err)
}
```

### Logging

All operations are logged with structured logging:

```json
{
  "level": "info",
  "component": "openai_service",
  "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
  "message_count": 5,
  "tokens_used": 150,
  "processing_time": "1.2s",
  "cached_result": false,
  "message": "Successfully generated summary"
}
```

### Metrics (Recommended)

Track these metrics in your monitoring system:

- Request count and duration
- Token usage and costs
- Cache hit/miss ratios
- Error rates by type
- Model usage distribution

## Testing

Run tests:

```bash
go test ./internal/ai/ -v
```

The test suite includes:

- Unit tests for all core functionality
- Mock implementations for testing
- Example usage patterns
- Error scenario testing

## Security Considerations

1. **API Key Security**: Store API keys in environment variables, never in code
2. **PII Protection**: All messages are anonymized before API calls
3. **Request Validation**: Input validation and sanitization
4. **Rate Limiting**: Implement application-level rate limiting
5. **Audit Logging**: Log all AI requests for compliance

## Performance Optimization

1. **Caching**: Redis caching reduces API calls and improves response times
2. **Message Limiting**: Process only recent messages (configurable limit)
3. **Connection Pooling**: Reuse HTTP connections to OpenAI API
4. **Timeouts**: Prevent hanging requests with appropriate timeouts

## Future Enhancements

- [ ] Support for additional AI providers (Anthropic, Google, etc.)
- [ ] Streaming responses for real-time summarization
- [ ] Custom prompt templates
- [ ] Advanced PII detection and redaction
- [ ] Cost optimization strategies
- [ ] A/B testing framework for different models

## Dependencies

- `github.com/sashabaranov/go-openai@v1.36.0` - Official OpenAI Go SDK
- `github.com/google/uuid` - UUID generation
- `github.com/rs/zerolog` - Structured logging
- `github.com/redis/go-redis/v9` - Redis client

## License

This implementation follows the project's license terms and includes proper attribution for all dependencies.

## Contributing

When contributing to this package:

1. Follow existing code patterns and interfaces
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure PII protection standards are maintained
5. Test with different OpenAI models and error scenarios

---

For more information, see the main service documentation and configuration guide.
