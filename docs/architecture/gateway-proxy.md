# API Gateway Proxy Pattern Documentation

## Overview

The API Gateway serves as the single entry point for all client requests in the Link microservices architecture. It implements a reverse proxy pattern that handles authentication, request routing, path transformation, header propagation, and service health aggregation.

## Architecture Components

### ProxyHandler Structure

```go
type ProxyHandler struct {
    httpClient *http.Client
}
```

The `ProxyHandler` is initialized with an HTTP client configured for:
- **Timeout**: 30 seconds default
- **Connection Pooling**: Max 100 idle connections, 10 per host
- **Idle Timeout**: 90 seconds

## Request Transformation Logic

### Path Transformation (`TransformPath`)

The gateway transforms incoming paths to service-specific paths:

```go
func TransformPath(gatewayPath string) string {
    // Add /api/v1 prefix if not already present
    if len(gatewayPath) > 0 && gatewayPath[0] == '/' && gatewayPath != "/health" {
        if len(gatewayPath) < 7 || gatewayPath[:7] != "/api/v1" {
            return "/api/v1" + gatewayPath
        }
    }
    return gatewayPath
}
```

**Transformation Rules:**
- Gateway path `/users/profile` → Service path `/api/v1/users/profile`
- Gateway path `/auth/login` → Service path `/api/v1/auth/login`
- Health check path `/health` → No transformation (pass-through)

### Service Routing (`RouteToService`)

The routing logic maps URL prefixes to backend services:

| Path Prefix | Target Service | Default URL | Timeout |
|-------------|----------------|-------------|---------|
| `/auth/`, `/users/` | User Service | `http://user-svc:8080` | 30s |
| `/location/` | Location Service | `http://location-svc:8080` | 30s |
| `/chat/`, `/ws` | Chat Service | `http://chat-svc:8080` | 30s |
| `/ai/` | AI Service | `http://ai-svc:8000` | 60s |
| `/broadcasts/`, `/discovery/` | Discovery Service | `http://discovery-svc:8080` | 30s |
| `/stories/` | Stories Service | `http://stories-svc:8080` | 30s |
| `/opportunities/` | Opportunities Service | `http://opportunities-svc:8080` | 30s |

## Header Propagation & Filtering

### Authentication Headers

The gateway propagates user context from JWT claims to downstream services:

```go
// Set user context headers for downstream services
c.Header("X-User-ID", claims.UserID.String())
c.Header("X-User-Email", claims.Email)
c.Header("X-User-Name", claims.Username)
```

### Gateway Identification Headers

```go
proxyReq.Header.Set("X-Gateway-Request", "true")
proxyReq.Header.Set("X-Forwarded-For", c.ClientIP())
proxyReq.Header.Set("X-Forwarded-Proto", "http") // https in production
```

### Hop-by-Hop Header Filtering

The `copyHeaders` function filters out HTTP hop-by-hop headers that shouldn't be forwarded:

```go
hopByHopHeaders := map[string]bool{
    "Connection":          true,
    "Keep-Alive":          true,
    "Proxy-Authenticate":  true,
    "Proxy-Authorization": true,
    "Te":                  true,
    "Trailers":            true,
    "Transfer-Encoding":   true,
    "Upgrade":             true,
}
```

**Filtered Headers:**
- Connection management headers (Connection, Keep-Alive)
- Proxy-specific headers (Proxy-Authenticate, Proxy-Authorization)
- Transfer encoding headers (Transfer-Encoding, Te, Trailers)
- Protocol upgrade headers (Upgrade)

## Per-Service Timeout Logic

Each service has configurable timeout values:

```go
client := &http.Client{
    Timeout: time.Duration(service.Timeout) * time.Second,
    Transport: p.httpClient.Transport,
}
```

**Service-Specific Timeouts:**
- **AI Service**: 60 seconds (longer for ML processing)
- **All Other Services**: 30 seconds default
- **Health Checks**: 5 seconds

Timeout values are configurable via environment variables:
- `USER_SVC_TIMEOUT`
- `AI_SVC_TIMEOUT`
- `CHAT_SVC_TIMEOUT`
- etc.

## Error Handling

### Timeout Errors

```go
if err, ok := err.(*url.Error); ok && err.Timeout() {
    c.JSON(http.StatusGatewayTimeout, gin.H{
        "error":     "GATEWAY_TIMEOUT",
        "message":   "Service request timed out",
        "code":      "SERVICE_TIMEOUT",
        "service":   service.URL,
        "timestamp": time.Now(),
    })
    return
}
```

### Service Unavailable Errors

```go
c.JSON(http.StatusBadGateway, gin.H{
    "error":     "BAD_GATEWAY",
    "message":   "Failed to reach backend service",
    "code":      "SERVICE_UNAVAILABLE",
    "service":   service.URL,
    "timestamp": time.Now(),
})
```

### Service Not Found Errors

```go
c.JSON(http.StatusNotFound, gin.H{
    "error":     "NOT_FOUND",
    "message":   "Service not found for this endpoint",
    "code":      "SERVICE_NOT_FOUND",
    "path":      c.Request.URL.Path,
    "timestamp": time.Now(),
})
```

### Request Body Reading Errors

```go
c.JSON(http.StatusBadRequest, gin.H{
    "error":     "VALIDATION_ERROR",
    "message":   "Failed to read request body",
    "code":      "BODY_READ_ERROR",
    "timestamp": time.Now(),
})
```

## Health Aggregation

The `HealthHandler` aggregates health status from all backend services:

### Health Check Process

1. **Service Discovery**: Enumerate all configured services
2. **Parallel Health Checks**: Query each service's health endpoint with 5-second timeout
3. **Status Aggregation**: Determine overall system health
4. **Response Generation**: Return aggregated status

### Health Check Implementation

```go
func (p *ProxyHandler) checkServiceHealth(healthURL string) string {
    client := &http.Client{
        Timeout: 5 * time.Second,
    }
    
    resp, err := client.Get(healthURL)
    if err != nil {
        return "unhealthy"
    }
    defer resp.Body.Close()
    
    if resp.StatusCode == http.StatusOK {
        return "healthy"
    }
    
    return "unhealthy"
}
```

### Health Response Format

```json
{
    "status": "healthy", // or "degraded"
    "gateway": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "services": {
        "user-svc": "healthy",
        "location-svc": "healthy",
        "chat-svc": "unhealthy",
        "ai-svc": "healthy",
        "discovery-svc": "healthy",
        "stories-svc": "healthy",
        "opportunities-svc": "healthy"
    }
}
```

### Health Status Logic

- **Overall Status**: `healthy` if all services are healthy, `degraded` otherwise
- **HTTP Status Code**: 200 OK for healthy, 503 Service Unavailable for degraded
- **Service Health URLs**: Configurable via environment variables

## Authentication Flow

### JWT Token Extraction

Tokens are extracted from multiple sources in order of precedence:

1. **Authorization Header**: `Bearer <token>`
2. **HTTP Cookie**: Named cookie (default: `link_auth`)

### Public Endpoints

Certain endpoints bypass authentication:

```go
publicEndpoints := map[string][]string{
    "POST": {
        "/auth/register",
        "/auth/login",
    },
    "GET": {
        "/health",
        "/users/profile/", // Public user profiles
    },
    "OPTIONS": {"*"}, // Allow all OPTIONS requests for CORS
}
```

### User Context Propagation

After successful JWT validation, user context is propagated via headers:

- `X-User-ID`: User UUID
- `X-User-Email`: User email address
- `X-User-Name`: Username

## WebSocket Handling

WebSocket connections are handled through the same proxy mechanism:

### WebSocket Routing

- Path: `/ws`
- Target Service: Chat Service (`http://chat-svc:8080`)
- Authentication: Required (JWT validation)
- Protocol Upgrade: Handled transparently

### WebSocket-Specific Headers

The proxy preserves WebSocket upgrade headers:
- `Upgrade: websocket`
- `Connection: Upgrade`
- `Sec-WebSocket-Key`
- `Sec-WebSocket-Version`
- `Sec-WebSocket-Protocol`

## Performance Optimizations

### Connection Pooling

```go
Transport: &http.Transport{
    MaxIdleConns:        100,
    MaxIdleConnsPerHost: 10,
    IdleConnTimeout:     90 * time.Second,
},
```

### Request Body Optimization

- Request bodies are read once and reused via `bytes.NewReader`
- Prevents multiple reads and ensures body content is available for retries

### Response Streaming

- Uses `io.Copy` for efficient response body streaming
- Minimizes memory usage for large responses

## Security Features

### CORS Handling

```go
allowedOrigins := []string{
    "http://localhost:3000",    // Development frontend
    "http://localhost:5173",    // Vite dev server
    "http://localhost:8080",    // Local testing
    "https://link-app.com",     // Production domain
}
```

### Rate Limiting

- **Window**: 1 minute
- **Limit**: 100 requests per IP
- **Implementation**: In-memory (Redis recommended for production)

### Security Headers

- `X-Gateway-Request: true` - Identifies gateway-proxied requests
- `X-Forwarded-For` - Client IP preservation
- `X-Forwarded-Proto` - Protocol preservation

## Configuration Management

All configuration is environment-driven:

### Service URLs
```bash
USER_SVC_URL=http://user-svc:8080
LOCATION_SVC_URL=http://location-svc:8080
CHAT_SVC_URL=http://chat-svc:8080
AI_SVC_URL=http://ai-svc:8000
```

### Health Check URLs
```bash
USER_SVC_HEALTH_URL=http://user-svc:8080/health
CHAT_SVC_HEALTH_URL=http://chat-svc:8080/health
```

### Timeout Configuration
```bash
USER_SVC_TIMEOUT=30
AI_SVC_TIMEOUT=60
CHAT_SVC_TIMEOUT=30
```

### JWT Configuration
```bash
JWT_SECRET=your-secret-key
JWT_ISSUER=user-svc
JWT_COOKIE_NAME=link_auth
```

## Monitoring and Observability

### Request Logging

```go
gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
    return fmt.Sprintf("[GATEWAY] %s - [%s] \"%s %s %s\" %d %s \"%s\" \"%s\" %s\n",
        param.ClientIP,
        param.TimeStamp.Format("02/Jan/2006:15:04:05 -0700"),
        param.Method,
        param.Path,
        param.Request.Proto,
        param.StatusCode,
        param.Latency,
        param.Request.UserAgent(),
        param.Request.Referer(),
        param.ErrorMessage,
    )
})
```

### Health Monitoring

- Endpoint: `/health`
- Response includes individual service status
- Suitable for load balancer health checks
- Includes timestamp for monitoring freshness

## Error Response Standards

All error responses follow a consistent format:

```json
{
    "error": "ERROR_TYPE",
    "message": "Human-readable description",
    "code": "SPECIFIC_ERROR_CODE",
    "timestamp": "2024-01-15T10:30:00Z",
    "additional_context": "..."
}
```

### Error Types

- `AUTHENTICATION_ERROR`: JWT validation failures
- `GATEWAY_TIMEOUT`: Service timeout errors
- `BAD_GATEWAY`: Service connectivity issues
- `NOT_FOUND`: Service or endpoint not found
- `VALIDATION_ERROR`: Request validation failures
- `RATE_LIMIT_ERROR`: Rate limiting violations

## Best Practices

### Development
- Use environment-specific configuration
- Enable detailed logging in development
- Trust all proxies in development only

### Production
- Configure proper CORS origins
- Use HTTPS for all communication
- Implement distributed rate limiting (Redis)
- Monitor service health actively
- Set appropriate timeout values
- Use connection pooling
- Enable security headers

### Security
- Validate all JWT tokens
- Filter hop-by-hop headers
- Sanitize user input
- Use secure cookie settings
- Implement proper CORS policies

### Performance
- Use connection pooling
- Implement appropriate timeouts
- Stream response bodies
- Cache service configurations
- Monitor gateway metrics

This comprehensive proxy implementation provides a robust, secure, and scalable API Gateway that efficiently routes requests while maintaining proper error handling, authentication, and observability.
