# Structured Logging Package

Provides consistent, structured logging across all Link microservices with support for distributed tracing, request correlation, and production-safe data sanitization.

## Features

- **Structured JSON Logging**: Consistent log format across all services
- **Request Correlation**: Automatic request ID generation and correlation
- **Distributed Tracing**: OpenTelemetry integration for trace correlation
- **Context-Aware**: Automatic extraction of user and request context
- **Production Safe**: Automatic PII sanitization in production environments
- **Framework Integration**: Built-in Gin middleware for HTTP request logging
- **Observability**: Optimized for Prometheus metrics and Loki log aggregation

## Usage

### Basic Logger Setup

```go
import "github.com/link-app/shared-libs/logging"

func main() {
    // Create structured logger for your service
    logger := logging.NewStructuredLogger("user-svc")
    
    // Basic logging
    logger.Info("Service starting up")
    logger.WithFields(logrus.Fields{
        "port": 8080,
        "env":  "production",
    }).Info("Server configuration loaded")
}
```

### Gin Framework Integration

```go
import (
    "github.com/gin-gonic/gin"
    "github.com/link-app/shared-libs/logging"
)

func setupRouter() *gin.Engine {
    logger := logging.NewStructuredLogger("user-svc")
    
    r := gin.New()
    
    // Add structured logging middleware (replaces gin.Logger())
    r.Use(logger.GinMiddleware())
    
    // Add structured error handling (replaces gin.Recovery())
    r.Use(logger.GinRecoveryHandler())
    
    // Add error logging for any errors that occur
    r.Use(logger.GinErrorHandler())
    
    return r
}
```

### Context-Aware Logging

```go
func getUserHandler(c *gin.Context) {
    logger := logging.NewStructuredLogger("user-svc")
    
    userID := c.Param("id")
    
    // Context-aware logging automatically includes:
    // - Request ID
    // - Trace ID (if available)
    // - User ID (if in context)
    // - Service name and environment
    logger.WithContext(c.Request.Context()).WithField("user_id", userID).Info("Fetching user details")
    
    // ... your business logic ...
    
    // Log business events
    logger.LogBusinessEventGin(c, "user_profile_viewed", map[string]interface{}{
        "user_id":    userID,
        "viewer_id":  c.GetString("user_id"),
        "view_count": 1,
    })
}
```

### Database Operation Logging

```go
func createUser(ctx context.Context, user *User) error {
    logger := logging.NewStructuredLogger("user-svc")
    
    start := time.Now()
    err := db.Create(user).Error
    duration := time.Since(start)
    
    // Log database operations with timing and error info
    logger.LogDatabaseOperation(ctx, "INSERT", "users", duration, err)
    
    return err
}
```

### External API Call Logging

```go
func callExternalAPI(ctx context.Context) (*Response, error) {
    logger := logging.NewStructuredLogger("user-svc")
    
    start := time.Now()
    resp, err := http.Get("https://api.example.com/data")
    duration := time.Since(start)
    
    status := 0
    if resp != nil {
        status = resp.StatusCode
    }
    
    // Log external API calls
    logger.LogExternalAPICall(ctx, "example-api", "/data", status, duration, err)
    
    return parseResponse(resp), err
}
```

### Security and Audit Logging

```go
func loginHandler(c *gin.Context) {
    logger := logging.NewStructuredLogger("user-svc")
    
    // ... authentication logic ...
    
    if authSuccess {
        // Log successful authentication
        logger.LogSecurityEventGin(c, "user_login_success", 
            fmt.Sprintf("User %s logged in", userEmail), "low")
        
        // Log user action for audit
        logger.LogUserActionGin(c, "login", "user_session", "success")
    } else {
        // Log failed authentication attempts
        logger.LogSecurityEventGin(c, "user_login_failure", 
            fmt.Sprintf("Failed login attempt for %s", userEmail), "medium")
    }
}
```

### Cache Operation Logging

```go
func getCachedData(ctx context.Context, key string) ([]byte, error) {
    logger := logging.NewStructuredLogger("user-svc")
    
    start := time.Now()
    data, err := redis.Get(key).Bytes()
    duration := time.Since(start)
    
    hit := err == nil
    
    // Log cache operations
    logger.LogCacheOperation(ctx, "GET", key, hit, duration)
    
    return data, err
}
```

## Log Levels and Environment Behavior

### Development
- **Format**: Pretty-printed JSON or console output
- **Level**: Debug level enabled
- **PII**: Full data logging for debugging
- **Stack Traces**: Enabled for errors

### Production
- **Format**: Compact JSON for log aggregation
- **Level**: Info level and above
- **PII**: Automatic sanitization of emails, IPs, sensitive data
- **Stack Traces**: Limited to prevent log bloat

## Automatic Context Extraction

The logger automatically extracts and includes:

- **Request ID**: From `X-Request-ID` or `X-Correlation-ID` headers, or generates new UUID
- **Trace ID**: From OpenTelemetry span context
- **User Information**: From `X-User-ID`, `X-User-Email` headers (set by API Gateway)
- **Service Metadata**: Service name, environment, timestamp
- **Request Metadata**: HTTP method, URL, remote IP, user agent

## Environment Variables

- `LOG_LEVEL`: Set log level (debug, info, warn, error) - defaults to "info"
- `ENVIRONMENT`: Environment name (development, staging, production) - affects sanitization
- `APP_ENV`: Alternative environment variable name

## Integration with Observability Stack

### Loki (Log Aggregation)
- JSON format optimized for Loki ingestion
- Service and environment labels for efficient querying
- Request correlation for distributed tracing

### Prometheus (Metrics)
- Use alongside metrics middleware for complete observability
- Log timing information correlates with metrics

### Jaeger/OpenTelemetry (Tracing)
- Automatic trace ID extraction and inclusion
- Correlate logs with distributed traces

## Migration from Service-Specific Logging

### From logrus (user-svc, api-gateway, etc.)
```go
// Old way
logger := logrus.New()
logger.WithFields(logrus.Fields{"user_id": userID}).Info("Processing request")

// New way
logger := logging.NewStructuredLogger("user-svc")
logger.WithContext(ctx).WithField("user_id", userID).Info("Processing request")
```

### From zerolog (summarygen-svc)
```go
// Old way  
log.Info().Str("user_id", userID).Msg("Processing request")

// New way
logger := logging.NewStructuredLogger("ai-svc")
logger.WithContext(ctx).WithField("user_id", userID).Info("Processing request")
```

### Replacing Custom Middleware
```go
// Replace custom logging middleware with:
r.Use(logger.GinMiddleware())
r.Use(logger.GinRecoveryHandler())
r.Use(logger.GinErrorHandler())
```

## Best Practices

1. **Use Context**: Always pass context to logging methods for automatic correlation
2. **Structured Fields**: Use WithField/WithFields for structured data, not string concatenation
3. **Appropriate Levels**: Debug for detailed info, Info for business events, Warn for recoverable issues, Error for failures
4. **Security Events**: Always log authentication, authorization, and data access events
5. **Performance**: Log slow operations (>100ms DB, >5s HTTP, >30s external API)
6. **Business Events**: Log important business actions for analytics and audit
7. **Error Context**: Include relevant context when logging errors, not just the error message

## Security and Privacy

- **Automatic PII Sanitization**: Emails and IP addresses masked in production
- **UUID Validation**: User IDs validated to prevent data leakage
- **Configurable Sanitization**: Extend sanitization rules as needed
- **Audit Trail**: User actions logged with full context for compliance
- **Security Events**: Separate logging for security-related events with severity levels