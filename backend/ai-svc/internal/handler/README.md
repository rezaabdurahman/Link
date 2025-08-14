# SummarizeHandler Implementation

This document describes the complete implementation of the `SummarizeHandler` with the required flow: **auth → consent check → cache lookup → fetch messages → anonymize → call GPT → cache save → return JSON**.

## Overview

The `SummarizeHandler` provides AI-powered message summarization with comprehensive middleware stack including JWT validation, rate limiting (5 requests per minute per user), request logging, and panic recovery.

## Architecture

### Flow Diagram

```
HTTP Request → Panic Recovery → Request Logging → JWT Auth → Rate Limiting → Handler
                                                                             ↓
                                                               User ID from Context
                                                                             ↓
                                                               Parse Request Body
                                                                             ↓
                                                               Check AI Consent
                                                                             ↓
                                                               Cache Lookup
                                                              /              \
                                                         Cache Hit      Cache Miss
                                                            ↓               ↓
                                                       Return Cached    Fetch Messages
                                                        Summary              ↓
                                                                      Check Anonymization Consent
                                                                             ↓
                                                                        Call GPT API
                                                                             ↓
                                                                         Cache Result
                                                                             ↓
                                                                        Log Audit Event
                                                                             ↓
                                                                        Return JSON
```

## Implementation Details

### 1. Middleware Stack

The middleware is applied in the following order (specified in `Routes()` method):

1. **Panic Recovery**: Catches panics and returns 500 errors
2. **Request Logging**: Logs all HTTP requests with structured data
3. **JWT Authentication**: Validates JWT tokens and adds user info to context
4. **Rate Limiting**: Enforces 5 requests per minute per user

### 2. Handler Flow

#### Step 1: Authentication
- Extracts user ID from JWT context set by middleware
- Returns 401 if authentication failed

#### Step 2: Request Parsing
- Parses and validates JSON request body
- Sets default limit of 15 messages if not specified
- Returns 400 for invalid requests

#### Step 3: Consent Check
- Verifies user has given AI processing consent
- Returns 403 if consent not provided
- Uses `privacyService.HasAIProcessingConsent()`

#### Step 4: Cache Lookup
- Builds cache key from conversation ID, user ID, and limit
- Checks for existing cached summary
- Returns cached result immediately if found and not expired

#### Step 5: Fetch Messages
- Calls chat service to retrieve recent messages
- Converts chat messages to AI message format
- Returns 404 if no messages found

#### Step 6: Anonymization Check
- Checks if user has data anonymization consent
- Marks data for anonymization in AI request if needed

#### Step 7: AI Processing
- Calls OpenAI service with structured request
- Handles AI service errors gracefully
- Returns 500 if AI processing fails

#### Step 8: Cache Storage
- Stores successful results in cache with 1-hour TTL
- Continues if caching fails (doesn't break the request)

#### Step 9: Audit Logging
- Logs all summarization attempts for compliance
- Records user ID, conversation ID, processing details
- Includes anonymization status and performance metrics

#### Step 10: Response
- Returns structured JSON response with summary data
- Includes processing time, token usage, and metadata

## API Specification

### Endpoint
```
POST /api/v1/ai/summarize
```

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
  "limit": 15
}
```

### Successful Response (200)
```json
{
  "id": "summary-uuid-here",
  "conversation_id": "123e4567-e89b-12d3-a456-426614174000", 
  "summary": "The conversation discusses the new product launch...",
  "message_count": 15,
  "tokens_used": 256,
  "model": "gpt-4",
  "processing_time": "2.5s",
  "cached_result": false,
  "metadata": {
    "anonymized_fields": ["email"],
    "model_used": "gpt-4",
    "prompt_tokens": 200,
    "completion_tokens": 56
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid JWT token |
| 403 | CONSENT_REQUIRED | AI processing consent required |
| 404 | NO_MESSAGES | No messages found for conversation |
| 429 | RATE_LIMIT_EXCEEDED | Rate limit exceeded (5 req/min) |
| 500 | INTERNAL_ERROR | Server error |

## Middleware Details

### JWT Authentication Middleware
- Validates `Authorization: Bearer <token>` header
- Parses JWT with configurable secret
- Adds user context: user_id, user_email, user_name, user_role
- Returns structured error responses for auth failures

### Rate Limiting Middleware
- Implements per-user rate limiting using token bucket algorithm
- Configured for 5 requests per minute per user (as specified)
- Includes burst capacity for short spikes
- Returns rate limit headers in response
- Automatic cleanup of unused limiters to prevent memory leaks

### Request Logging Middleware
- Logs all HTTP requests with structured JSON
- Includes user info, request timing, response status
- Different log levels based on response status (error/warn/info)
- Captures request ID for tracing

### Panic Recovery Middleware
- Catches panics in request processing
- Logs panic details with stack trace
- Returns 500 error to client instead of crashing

## Dependencies

### Services Required
1. **AI Service** (`ai.SummarizationService`)
   - OpenAI integration for text summarization
   - Model validation and health checking
   - Token usage tracking

2. **Chat Service** (`service.ChatService`) 
   - Fetches recent messages from conversations
   - Handles chat service communication errors
   - JWT token management for service-to-service auth

3. **Privacy Service** (`privacy.PrivacyService`)
   - User consent management
   - Audit logging for compliance
   - Data anonymization checks

4. **Cache Service** (`cache.SummaryCache`)
   - Redis-backed caching of summaries
   - Configurable TTL (1 hour default)
   - Conversation-based cache invalidation

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# AI Service Configuration  
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-api-key-here
AI_MODEL=gpt-4
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_TIMEOUT=30s
AI_MAX_RETRIES=3

# Rate Limiting
RATE_LIMIT_AI_REQUESTS_PER_MINUTE=5

# Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
SUMMARY_TTL=1h
```

## Security Features

### 1. Authentication & Authorization
- JWT token validation for all requests
- User context validation
- Secure token parsing with method validation

### 2. Privacy & Compliance
- User consent verification before AI processing
- Comprehensive audit logging for GDPR compliance
- Optional data anonymization based on user consent
- IP address and user agent tracking

### 3. Rate Limiting
- Per-user rate limiting to prevent abuse
- Configurable limits with burst capacity
- Automatic cleanup to prevent memory attacks

### 4. Error Handling
- Structured error responses with consistent format
- No sensitive data leakage in error messages
- Comprehensive logging for debugging without exposing internals

## Performance Considerations

### 1. Caching Strategy
- 1-hour TTL for summary caching
- User-specific cache keys to prevent data leaks
- Cache-first strategy to reduce AI API calls
- Graceful degradation if cache unavailable

### 2. Request Processing
- Async audit logging doesn't block response
- Early returns for cached results
- Timeout configuration for external service calls
- Connection pooling for database/Redis connections

### 3. Resource Management
- Rate limiting prevents resource exhaustion
- Automatic cleanup of rate limiters
- Bounded request sizes and timeouts
- Structured logging to avoid I/O blocking

## Monitoring & Observability

### Metrics Available
- Request count and response times
- Rate limit hit rates
- Cache hit/miss ratios
- AI service token usage
- Error rates by type

### Logging
- Structured JSON logs with consistent fields
- Request tracing with correlation IDs
- User activity tracking for audit
- Performance metrics per request

### Health Checks
- AI service connectivity
- Cache service availability
- Chat service health
- Database connection status

## Usage Example

```go
// Initialize services
aiService := ai.NewOpenAIService(cfg.AI, cacheService, logger)
chatService := chat.NewChatService(cfg.ChatService, logger)
privacyService := privacy.NewPrivacyService(dbService, logger)
cacheService := cache.NewRedisSummaryCache(cfg.Redis, logger)

// Create handler
summarizeHandler := handler.NewSummarizeHandler(
    aiService,
    chatService,
    privacyService,
    cacheService,
    &logger,
)

// Setup router with middleware
r := chi.NewRouter()
rateLimiter := middleware.NewRateLimiter(5, 10) // 5 req/min, burst 10

// Mount handler
r.Mount("/api/v1/ai/summarize", summarizeHandler.Routes(cfg.JWT.Secret, rateLimiter))
```

## Testing

The implementation supports comprehensive testing through:

1. **Unit Tests**: Each method can be tested in isolation
2. **Integration Tests**: Full request flow testing
3. **Middleware Tests**: Individual middleware component testing  
4. **Error Scenario Tests**: Comprehensive error handling validation

Example test scenarios:
- Valid summarization request
- Cached result return
- Rate limit enforcement
- JWT validation failures
- Consent requirement enforcement
- AI service error handling
- Cache failure resilience

## Compliance Notes

This implementation addresses GDPR and privacy requirements:

1. **Consent Management**: Explicit user consent required
2. **Audit Logging**: Complete audit trail of all operations
3. **Data Anonymization**: Optional PII anonymization
4. **Right to Withdraw**: Consent can be revoked
5. **Data Minimization**: Only necessary data processed
6. **Purpose Limitation**: Data only used for summarization

The implementation follows security best practices and provides a robust, scalable solution for AI-powered message summarization.
