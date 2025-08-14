# API Gateway Routing Guide

## Overview

The API Gateway serves as the single entry point for all client requests to the Link platform microservices. It handles routing, authentication, rate limiting, and service discovery.

## Service Discovery & Routing

### Current Service Mappings

| Route Prefix | Target Service | Purpose | Port | Health Endpoint |
|--------------|----------------|---------|------|-----------------|
| `/auth/*`, `/users/*` | user-svc | Authentication & user management | 8080 | `/health` |
| `/location/*` | location-svc | Location sharing & proximity | 8080 | `/health` |
| `/chat/*` | chat-svc | Real-time messaging | 8080 | `/health` |
| `/ai/*` | ai-svc | AI-powered features | 8000 | `/health` |
| `/broadcasts/*`, `/discovery/*` | discovery-svc | Service discovery & broadcasts | 8080 | `/health` |
| `/stories/*` | stories-svc | Stories sharing (planned) | 8080 | `/health` |
| `/opportunities/*` | opportunities-svc | Social opportunities (planned) | 8080 | `/health` |
| `/ws` | chat-svc | WebSocket connections | 8080 | `/health` |

### AI Service Endpoints

The AI service (`ai-svc`) provides several endpoints:

#### 🆕 Conversation Summarization
- **POST `/ai/summarize`** - Generate AI-powered conversation summaries
  - Accepts `conversation_id`, optional `limit` and `include_metadata` parameters
  - Returns structured summary with key topics, decisions, and action items
  - Includes confidence scoring and metadata
  - Cached responses with TTL

#### Existing AI Features
- **GET `/ai/insights`** - Get user insights and behavioral analysis
- **GET `/ai/conversation-starters`** - Generate conversation starters
- **GET `/ai/relationship-scores/{userId}`** - Calculate relationship compatibility

## Path Transformation

The gateway automatically transforms incoming paths for backend services:

```
/ai/summarize → /api/v1/ai/summarize (ai-svc)
/auth/login → /api/v1/auth/login (user-svc)
/chat/messages → /api/v1/chat/messages (chat-svc)
```

## Authentication & Security

- All endpoints require Bearer JWT authentication except those marked as public
- Authentication middleware validates tokens and sets user context headers
- Rate limiting is applied globally
- CORS headers are configured for web clients

## WebSocket Support

- WebSocket connections are available at `/ws`
- Currently proxied to chat-svc for real-time messaging
- Future: Dedicated WebSocket handling for chat, notifications, and live updates

## Environment Configuration

Service URLs are configurable via environment variables:

```bash
# AI Service Configuration
AI_SVC_URL=http://ai-svc:8000
AI_SVC_HEALTH_URL=http://ai-svc:8000/health
AI_SVC_TIMEOUT=60

# Other service configurations...
USER_SVC_URL=http://user-svc:8080
CHAT_SVC_URL=http://chat-svc:8080
LOCATION_SVC_URL=http://location-svc:8080
DISCOVERY_SVC_URL=http://discovery-svc:8080
```

## Health Monitoring

The gateway provides comprehensive health monitoring:

- **GET `/health`** - Gateway and all service health status
- Individual service health checks with 5-second timeout
- Overall status: `healthy`, `degraded`, or `unhealthy`
- Service-specific status reporting

## API Documentation

- **GET `/docs`** - OpenAPI documentation (Swagger UI)
- Complete API specification with examples and schemas
- Interactive testing interface
- Service-specific endpoint documentation

## Load Balancing & Performance

- HTTP connection pooling for backend requests
- Configurable timeouts per service (default: 30s, AI: 60s)
- Automatic retry logic for transient failures
- Header forwarding with hop-by-hop filtering

## Future Enhancements

### WebSocket Improvements
- Dedicated WebSocket handler with connection pooling
- Real-time notifications beyond chat
- Live location updates
- System-wide event broadcasting

### Service Discovery
- Dynamic service registration and discovery
- Automatic failover and load balancing
- Health-based routing decisions
- Service mesh integration

### Rate Limiting
- Per-user and per-endpoint rate limiting
- Adaptive rate limiting based on service health
- Premium user tier support

### Caching
- Response caching for expensive AI operations
- CDN integration for static assets
- Cache invalidation strategies

## Development Setup

1. Ensure all services are running and healthy
2. Configure environment variables for service URLs
3. Start the gateway: `go run main.go`
4. Access API docs at `http://localhost:8080/docs`
5. Test endpoints using the interactive documentation

## Monitoring & Debugging

- Request logging middleware captures all traffic
- Service-specific error codes and messages
- Timeout and circuit breaker patterns
- Health check aggregation and reporting

For detailed API specifications, see the OpenAPI documentation at `/docs`.
