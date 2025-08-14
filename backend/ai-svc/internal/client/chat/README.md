# Chat Service Client

This package provides a resilient HTTP client for communicating with the chat service to retrieve recent messages from conversations.

## Features

- **JWT Authentication**: Uses existing JWT tokens for authentication
- **Retry Mechanism**: Exponential backoff with jitter for failed requests
- **Circuit Breaker**: Prevents cascading failures by temporarily stopping requests to unhealthy services
- **Comprehensive Logging**: Structured logging for monitoring and debugging
- **Health Checks**: Built-in health check functionality
- **Type Safety**: Full Go type safety with proper error handling

## Architecture

### Components

1. **Client**: Main HTTP client with resilience patterns
2. **CircuitBreaker**: Implements the circuit breaker pattern
3. **Retryer**: Handles retry logic with exponential backoff
4. **Models**: Data structures for chat service API

### Resilience Patterns

#### Circuit Breaker
- **States**: Closed (normal), Open (failing), Half-Open (testing)
- **Configuration**:
  - `MaxFailures`: Number of failures before opening circuit
  - `Timeout`: Time to wait before transitioning to half-open
  - `OnStateChange`: Callback for state transitions

#### Retry Mechanism
- **Exponential Backoff**: Delays increase exponentially with each retry
- **Jitter**: Random variation to prevent thundering herd
- **Configurable**:
  - `MaxRetries`: Maximum number of retry attempts
  - `InitialDelay`: Starting delay
  - `BackoffMultiplier`: Exponential growth factor

## Configuration

### Environment Variables

```bash
# Chat Service Configuration
CHAT_SERVICE_URL=http://localhost:8080
CHAT_SERVICE_TIMEOUT=10s
CHAT_SERVICE_MAX_RETRIES=3
CHAT_SERVICE_RETRY_DELAY=100ms
CHAT_SERVICE_RETRY_BACKOFF=2.0
CHAT_SERVICE_CIRCUIT_BREAKER_ENABLED=true
CHAT_SERVICE_CIRCUIT_BREAKER_TIMEOUT=30s
CHAT_SERVICE_CIRCUIT_BREAKER_MAX_FAILS=5
```

### Configuration Structure

```go
type ChatServiceConfig struct {
    BaseURL                string
    Timeout                time.Duration
    MaxRetries             int
    RetryDelay             time.Duration
    RetryBackoffMultiplier float64
    CircuitBreakerEnabled  bool
    CircuitBreakerTimeout  time.Duration
    CircuitBreakerMaxFails int
}
```

## Usage

### Basic Usage

```go
import (
    "context"
    "github.com/link-app/ai-svc/internal/client/chat"
    "github.com/link-app/ai-svc/internal/config"
    "github.com/rs/zerolog"
)

// Load configuration
cfg, err := config.Load()
if err != nil {
    log.Fatal(err)
}

// Create logger
logger := zerolog.New(os.Stdout)

// Create chat service client
chatService := chat.NewChatService(cfg.ChatService, logger, jwtToken)

// Get recent messages
conversationID := uuid.New()
messages, err := chatService.GetRecentMessages(context.Background(), conversationID, 10)
if err != nil {
    log.Printf("Failed to get messages: %v", err)
    return
}

// Process messages
for _, message := range messages.Messages {
    fmt.Printf("Message: %s\n", message.Content)
}
```

### Health Checks

```go
// Check service health
err := chatService.Health(context.Background())
if err != nil {
    log.Printf("Chat service is unhealthy: %v", err)
}
```

### Circuit Breaker Management

```go
// Get circuit breaker state
state := chatService.GetCircuitBreakerState()
fmt.Printf("Circuit breaker state: %s\n", state.String())

// Reset circuit breaker if needed
chatService.ResetCircuitBreaker()
```

### JWT Token Updates

```go
// Update JWT token when it changes
chatService.UpdateJWTToken("new-jwt-token")
```

## API Endpoints

### Get Recent Messages

**Endpoint**: `GET /api/v1/chat/conversations/{id}/messages?limit={n}`

**Request Headers**:
- `Authorization: Bearer <jwt-token>`
- `Content-Type: application/json`
- `Accept: application/json`

**Query Parameters**:
- `limit` (int): Maximum number of messages to retrieve

**Response**:
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "user_id": "uuid", 
      "content": "string",
      "message_type": "user|assistant|system",
      "metadata": {
        "attachment_count": 0,
        "mentions": [],
        "reactions": [],
        "edit_history": [],
        "custom_fields": {}
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "deleted_at": null
    }
  ],
  "total_count": 1,
  "has_more": false,
  "next_cursor": null
}
```

## Error Handling

The client handles various error scenarios:

### HTTP Errors
- 4xx errors: Client errors (authentication, validation)
- 5xx errors: Server errors (triggering retries)
- Network errors: Connection issues (triggering retries)

### Circuit Breaker Errors
- `ErrCircuitBreakerOpen`: Circuit is open, requests blocked

### Context Errors
- `context.Canceled`: Request canceled
- `context.DeadlineExceeded`: Request timeout

## Monitoring and Observability

### Logging

The client provides structured logging with the following fields:
- `component`: Always "chat_client"
- `conversation_id`: Conversation UUID
- `limit`: Message limit
- `messages_count`: Number of messages retrieved
- `error`: Error details if applicable

### Metrics

Circuit breaker state changes are logged for monitoring:
```json
{
  "level": "info",
  "component": "chat_client", 
  "from": "CLOSED",
  "to": "OPEN",
  "message": "Circuit breaker state changed"
}
```

## Testing

### Unit Tests

Run unit tests:
```bash
go test ./internal/client/chat/...
```

### Integration Tests

For integration testing, set up a test chat service or use the provided test server in the unit tests.

### Test Coverage

The package includes comprehensive tests covering:
- Successful message retrieval
- Retry mechanism
- Circuit breaker functionality
- Health checks
- Error handling

## Best Practices

### JWT Token Management
- Update tokens when they're refreshed
- Handle authentication errors gracefully
- Monitor token expiration

### Configuration
- Set appropriate timeouts based on SLA requirements
- Configure retry limits to prevent excessive load
- Enable circuit breaker in production environments

### Error Handling
- Always check for `ErrCircuitBreakerOpen` and handle gracefully
- Implement fallback mechanisms for degraded service
- Log errors with sufficient context for debugging

### Monitoring
- Monitor circuit breaker state changes
- Track request latency and error rates
- Set up alerts for service health issues

## Contributing

When extending this client:

1. Maintain backward compatibility
2. Add comprehensive tests
3. Update documentation
4. Follow existing patterns for resilience
5. Ensure proper error handling and logging
