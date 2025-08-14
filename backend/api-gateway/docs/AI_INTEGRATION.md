# AI Service Integration - Conversation Summarization

## Overview

This document describes the integration of the AI conversation summarization service (`ai-svc`) with the API Gateway, specifically focusing on the new `POST /ai/summarize` endpoint.

## Integration Components

### 1. Reverse Proxy Configuration

The API Gateway is configured to route all `/ai/*` requests to the AI service:

**Route Configuration:**
- **Source:** `POST /ai/summarize`
- **Target:** `http://ai-svc:8000/api/v1/ai/summarize`
- **Method:** Automatic path transformation with `/api/v1` prefix
- **Timeout:** 60 seconds (extended for AI processing)

### 2. Service Discovery Entry

The AI service is registered in the service discovery configuration:

```go
AIService: ServiceEndpoint{
    URL:       getEnv("AI_SVC_URL", "http://ai-svc:8000"),
    HealthURL: getEnv("AI_SVC_HEALTH_URL", "http://ai-svc:8000/health"),
    Timeout:   getEnvAsInt("AI_SVC_TIMEOUT", 60),
}
```

### 3. OpenAPI Specification

The summarization endpoint is fully documented in the gateway's OpenAPI specification:

**Request Schema:**
```yaml
SummarizationRequest:
  type: object
  properties:
    conversation_id:
      type: string
      description: Unique identifier for the conversation to summarize
    limit:
      type: integer
      minimum: 1
      maximum: 1000
      default: 100
    include_metadata:
      type: boolean
      default: true
  required: [conversation_id]
```

**Response Schema:**
```yaml
SummarizationResponse:
  type: object
  properties:
    summary:
      type: string
      description: AI-generated summary in markdown format
    conversation_id:
      type: string
    message_count:
      type: integer
    participants:
      type: array
      items:
        type: string
    generated_at:
      type: string
      format: date-time
    expires_at:
      type: string
      format: date-time
    confidence_score:
      type: number
      format: double
      minimum: 0
      maximum: 1
    word_count:
      type: integer
```

## Authentication & Authorization

### JWT Token Validation
- All AI endpoints require valid Bearer tokens
- Gateway validates JWT and forwards user context headers:
  - `X-User-ID`
  - `X-User-Email` 
  - `X-User-Name`

### Access Control
- Users can only summarize conversations they have access to
- Permission validation is handled by the AI service
- Gateway forwards authentication context transparently

## Request Flow

1. **Client Request:** `POST /ai/summarize` with JWT token
2. **Gateway Processing:**
   - Validates JWT token
   - Extracts user context
   - Applies rate limiting
   - Transforms path to `/api/v1/ai/summarize`
3. **Service Routing:** Routes to `ai-svc:8000`
4. **AI Processing:** Service generates summary
5. **Response Handling:** Gateway forwards response to client

## Error Handling

The gateway handles various error scenarios:

| Status Code | Description | Action |
|-------------|-------------|--------|
| 400 | Invalid request parameters | Forward to client |
| 401 | Invalid/missing JWT token | Return auth error |
| 403 | Insufficient permissions | Forward to client |
| 404 | Conversation not found | Forward to client |
| 429 | Rate limit exceeded | Return rate limit error |
| 500 | AI service internal error | Forward to client |
| 503 | AI service unavailable | Return service unavailable |
| 504 | Request timeout (>60s) | Return gateway timeout |

## WebSocket Placeholder

### Current Implementation
WebSocket connections are currently proxied to the chat service at `/ws`:

```go
// WebSocket endpoint for chat (current implementation)
// TODO: Implement dedicated WebSocket handling for real-time features
// This will include chat messaging, notifications, and live updates
router.Any("/ws", proxyHandler.ProxyRequest)
```

### Future Enhancements
- Dedicated WebSocket handler for real-time features
- Live conversation summarization updates
- Real-time AI insights streaming
- System-wide event broadcasting

## Performance Considerations

### Timeouts
- **Standard Services:** 30 seconds
- **AI Service:** 60 seconds (extended for processing time)
- **Health Checks:** 5 seconds

### Connection Pooling
- HTTP client with connection pooling enabled
- `MaxIdleConns: 100`
- `MaxIdleConnsPerHost: 10`
- `IdleConnTimeout: 90 seconds`

### Caching Strategy
The AI service implements response caching:
- Summary responses include `expires_at` timestamp
- Gateway forwards cache headers transparently
- Client-side caching recommended for better performance

## Monitoring & Health Checks

### Health Status Integration
- AI service health is monitored via `/health` endpoint
- Gateway aggregates health status in `GET /health`
- Service status affects overall gateway health

### Request Logging
All AI requests are logged with:
- Request ID and timestamp
- User context (anonymized)
- Response time and status
- Error details (if any)

## Development & Testing

### Local Development
```bash
# Start AI service
cd ai-svc && go run main.go

# Start API Gateway
cd api-gateway && go run main.go

# Test endpoint
curl -X POST http://localhost:8080/ai/summarize \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "conv_123456789"}'
```

### API Documentation
Interactive API documentation is available at:
- Local: `http://localhost:8080/docs`
- Staging: `https://staging-api.linkapp.com/docs`
- Production: `https://api.linkapp.com/docs`

## Security Considerations

### Data Privacy
- Conversation data is processed securely
- User consent is required for AI processing
- Compliance with GDPR and CCPA regulations

### API Security
- Rate limiting prevents abuse
- JWT tokens have expiration times
- CORS headers configured for web clients
- Request/response logging excludes sensitive data

## Deployment Notes

### Environment Variables
Required environment variables for production:

```bash
AI_SVC_URL=https://ai-svc.internal:8000
AI_SVC_HEALTH_URL=https://ai-svc.internal:8000/health
AI_SVC_TIMEOUT=60

# JWT Configuration
JWT_SECRET=<secure-secret>
JWT_EXPIRY=24h

# Service URLs
CHAT_SVC_URL=https://chat-svc.internal:8080
USER_SVC_URL=https://user-svc.internal:8080
```

### Container Configuration
```yaml
# docker-compose.yml excerpt
api-gateway:
  environment:
    - AI_SVC_URL=http://ai-svc:8000
    - AI_SVC_TIMEOUT=60
  depends_on:
    - ai-svc
    - chat-svc
    - user-svc
```

This integration provides a robust, scalable foundation for AI-powered conversation summarization while maintaining security, performance, and observability standards.
