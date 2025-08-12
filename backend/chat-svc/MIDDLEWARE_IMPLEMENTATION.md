# Chat Service Middleware Implementation

This document describes the middleware and authentication integration implemented for the chat service.

## Overview

The chat service now includes comprehensive middleware for:
- JWT authentication with dual-mode support (direct JWT validation and gateway-forwarded headers)
- CORS (Cross-Origin Resource Sharing) configuration
- Rate limiting with IP-based throttling
- Enhanced request logging
- Request compression and timeout handling

## Authentication Middleware

### Features

1. **Dual Authentication Mode**:
   - **Gateway Mode**: Extracts user context from headers (`X-User-ID`, `X-User-Email`, `X-User-Name`) when requests are pre-authenticated by the API gateway
   - **Direct Mode**: Validates JWT tokens directly from `Authorization: Bearer` headers or cookies

2. **Token Sources**:
   - Authorization header with Bearer token format
   - Gateway-issued cookies (`link_auth` cookie name)

3. **User Context**:
   - Stores user information in request context for downstream handlers
   - Provides helper functions to extract user data from context

### JWT Claims Structure

```go
type Claims struct {
    UserID   uuid.UUID `json:"user_id"`
    Email    string    `json:"email"`
    Username string    `json:"username"`
    jwt.RegisteredClaims
}
```

### Usage Examples

#### Protecting Routes
```go
// Protect all routes under /api/v1/chat
r.Route("/api/v1", func(r chi.Router) {
    r.Use(authMw.Middleware) // Apply auth middleware
    r.Mount("/chat", chatHandler.Routes())
})
```

#### Extracting User Context
```go
func someHandler(w http.ResponseWriter, r *http.Request) {
    userID, exists := middleware.GetUserIDFromContext(r.Context())
    if !exists {
        http.Error(w, "User not authenticated", http.StatusUnauthorized)
        return
    }
    
    userEmail, _ := middleware.GetUserEmailFromContext(r.Context())
    userName, _ := middleware.GetUserNameFromContext(r.Context())
    
    // Use user information...
}
```

## CORS Configuration

### Features

- **Flexible Origin Configuration**: Supports single origin, comma-separated multiple origins, or wildcard (*)
- **Credential Support**: Allows credentials for authenticated requests
- **Header Allowlist**: Includes standard headers plus gateway-specific headers
- **Method Support**: GET, POST, PUT, DELETE, OPTIONS

### Configuration

```go
// Environment variable examples
CORS_ALLOWED_ORIGINS="http://localhost:3000,https://app.example.com"
CORS_ALLOWED_METHODS="GET,POST,PUT,DELETE,OPTIONS"
CORS_ALLOWED_HEADERS="Accept,Authorization,Content-Type,X-CSRF-Token,X-User-ID,X-User-Email,X-User-Name"
```

### Default Headers Allowed

- `Accept`
- `Authorization`
- `Content-Type`
- `X-CSRF-Token`
- `X-User-ID` (for gateway forwarding)
- `X-User-Email` (for gateway forwarding)
- `X-User-Name` (for gateway forwarding)

## Rate Limiting

### Features

- **IP-based Rate Limiting**: Limits requests per IP address
- **Configurable Limits**: Set requests per minute via environment variables
- **Optional**: Can be disabled via configuration

### Configuration

```go
// Environment variables
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
```

### Default Settings

- **Enabled**: `true`
- **Limit**: `100 requests per minute per IP`
- **Time Window**: `1 minute`

## Request Logging

### Features

- **Structured Logging**: Uses JSON format for machine-readable logs
- **Request Tracking**: Includes request ID, method, path, and timing
- **Integration**: Works with existing logrus configuration
- **Production Ready**: No color output for production environments

### Log Format

```json
{
  "level": "info",
  "method": "POST",
  "path": "/api/v1/chat/rooms",
  "remote_addr": "192.168.1.100",
  "request_id": "abc123",
  "duration": "45ms",
  "status": 201,
  "msg": "request completed"
}
```

## Additional Middleware

### Compression
- **Algorithm**: Gzip compression with level 5
- **Content Types**: Automatically compresses JSON, HTML, CSS, JS, and other text content
- **Threshold**: Only compresses responses larger than default threshold

### Request Timeout
- **Duration**: 60 seconds
- **Scope**: Applies to all HTTP requests
- **Behavior**: Returns 503 Service Unavailable if timeout exceeded

### Recovery
- **Panic Recovery**: Prevents server crashes from panics in handlers
- **Error Logging**: Logs panic details for debugging
- **Response**: Returns 500 Internal Server Error to client

## Environment Variables

### Required JWT Configuration
```bash
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h
```

### Optional Middleware Configuration
```bash
# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Accept,Authorization,Content-Type,X-CSRF-Token

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## Security Considerations

### JWT Secret Management
- Use a strong, randomly generated secret key
- Store in environment variables, never in code
- Use different secrets for different environments
- Rotate secrets periodically

### CORS Security
- Never use wildcard (*) origins in production unless absolutely necessary
- Specify exact domains for allowed origins
- Be cautious with `AllowCredentials: true`

### Rate Limiting
- Adjust limits based on expected traffic patterns
- Consider implementing user-based rate limiting for authenticated requests
- Monitor for potential DDoS attacks

### Header Security
- Gateway headers (`X-User-*`) should only be trusted from internal gateway
- Implement IP whitelist or other verification for gateway requests
- Use HTTPS in production to protect header contents

## Testing

### JWT Authentication
```bash
# Test with Bearer token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8080/api/v1/chat/rooms

# Test with gateway headers
curl -H "X-User-ID: 123e4567-e89b-12d3-a456-426614174000" \
     -H "X-User-Email: user@example.com" \
     -H "X-User-Name: testuser" \
     http://localhost:8080/api/v1/chat/rooms
```

### CORS Testing
```bash
# Test preflight request
curl -X OPTIONS \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization" \
     http://localhost:8080/api/v1/chat/rooms
```

### Rate Limiting Testing
```bash
# Test rate limit (run multiple times quickly)
for i in {1..110}; do
  curl http://localhost:8080/health
done
```

## Integration with API Gateway

### Header Forwarding
The service expects the API Gateway to:
1. Validate JWT tokens
2. Extract user information from valid tokens
3. Forward user context via headers:
   - `X-User-ID`: User's UUID
   - `X-User-Email`: User's email address
   - `X-User-Name`: User's display name

### Fallback Behavior
If gateway headers are not present, the service will:
1. Extract JWT from Authorization header or cookies
2. Validate the token using the configured secret
3. Extract user information from token claims
4. Set user context for request processing

This dual-mode design ensures compatibility with both gateway-mediated and direct client requests.
