# Errors Package

Provides consistent error handling and response formatting across all Link microservices.

## Features

- **Standardized Error Codes**: Common error codes used across all services
- **Structured Error Responses**: Consistent JSON error format with request tracking
- **Framework Support**: Middleware for both Gin and Chi frameworks
- **Logging Integration**: Automatic error logging with appropriate levels
- **Request Context**: Automatic request ID and path tracking
- **HTTP Status Mapping**: Automatic HTTP status code mapping from error codes

## Usage

### Gin Framework (Recommended)

```go
import (
    "github.com/link-app/shared-libs/errors"
    "github.com/gin-gonic/gin"
    "github.com/sirupsen/logrus"
)

func setupRouter(logger *logrus.Logger) *gin.Engine {
    router := gin.New()
    
    // Add error handling middleware
    router.Use(errors.ErrorHandler(logger))
    
    // Your routes here
    router.GET("/users/:id", getUserHandler)
    
    return router
}

func getUserHandler(c *gin.Context) {
    userID := c.Param("id")
    
    // Example: Not found error
    if userID == "" {
        errors.RespondWithNotFound(c, "User")
        return
    }
    
    // Example: Validation error
    if !isValidID(userID) {
        errors.RespondWithValidationError(c, map[string]string{
            "id": "Invalid user ID format",
        })
        return
    }
    
    // Example: Custom error
    errors.RespondWithError(c, errors.ErrCodeBusinessRule, "User account suspended", map[string]interface{}{
        "reason": "payment_overdue",
        "suspended_at": time.Now(),
    })
}
```

### Chi Framework (Legacy Support)

```go
import (
    "github.com/link-app/shared-libs/errors"
    "github.com/go-chi/chi/v5"
    "github.com/sirupsen/logrus"
)

func setupRouter(logger *logrus.Logger) *chi.Mux {
    router := chi.NewRouter()
    
    // Add error handling middleware
    router.Use(errors.ChiErrorHandler(logger))
    
    // Your routes here
    router.Get("/users/{id}", getUserHandler)
    
    return router
}

func getUserHandler(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    
    // Example: Not found error
    if userID == "" {
        errors.ChiRespondWithNotFound(w, r, "User")
        return
    }
    
    // Example: Custom error
    errors.ChiRespondWithError(w, r, errors.ErrCodeBusinessRule, "User account suspended", nil)
}
```

### Custom Error Creation

```go
// Create a custom API error
apiError := errors.NewAPIError(
    errors.ErrCodeValidationFailed,
    "Email address is required",
    map[string]string{
        "field": "email",
        "constraint": "required",
    },
).WithMeta("service", "user-svc")

// Use in panic (will be caught by middleware)
panic(apiError)
```

## Standard Error Codes

### Authentication & Authorization
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Access denied
- `INVALID_TOKEN` - Token is invalid
- `EXPIRED_TOKEN` - Token has expired

### Input Validation
- `VALIDATION_FAILED` - Input validation failed
- `INVALID_INPUT` - Invalid input data
- `MISSING_PARAMETER` - Required parameter missing
- `INVALID_FORMAT` - Data format is invalid

### Resource Management
- `NOT_FOUND` - Resource not found
- `ALREADY_EXISTS` - Resource already exists
- `CONFLICT` - Resource conflict
- `PRECONDITION_FAILED` - Precondition not met

### Rate Limiting
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `QUOTA_EXCEEDED` - Quota exceeded

### External Dependencies
- `SERVICE_UNAVAILABLE` - Service unavailable
- `DATABASE_ERROR` - Database error
- `CACHE_ERROR` - Cache error
- `EXTERNAL_SERVICE_ERROR` - External service error

### Server Errors
- `INTERNAL_ERROR` - Internal server error
- `TIMEOUT_ERROR` - Operation timed out
- `CONFIGURATION_ERROR` - Configuration error

### Business Logic
- `BUSINESS_RULE_VIOLATION` - Business rule violated
- `INSUFFICIENT_PERMISSIONS` - Insufficient permissions

## Error Response Format

All errors follow this consistent JSON structure:

```json
{
    "code": "VALIDATION_FAILED",
    "message": "Input validation failed",
    "details": {
        "email": "Invalid email format",
        "age": "Must be between 18 and 120"
    },
    "timestamp": "2023-12-07T15:30:45Z",
    "request_id": "req_1701961845123456789",
    "path": "/api/v1/users",
    "meta": {
        "service": "user-svc",
        "version": "1.0.0"
    }
}
```

## Migration Guide

### From Service-Specific Error Handling

**Before:**
```go
// Old way - inconsistent error responses
c.JSON(http.StatusBadRequest, gin.H{
    "error": "Invalid input",
    "message": "Email is required",
})
```

**After:**
```go
// New way - consistent error handling
errors.RespondWithValidationError(c, map[string]string{
    "email": "Email is required",
})
```

### Adding to Existing Services

1. Add the import:
```go
import "github.com/link-app/shared-libs/errors"
```

2. Add the middleware to your router setup:
```go
router.Use(errors.ErrorHandler(logger))
```

3. Replace existing error responses with standard functions:
```go
// Replace custom error handling
errors.RespondWithError(c, errors.ErrCodeNotFound, "User not found", nil)
```

## Logging

The error handler automatically logs errors with appropriate levels:
- **5xx errors**: `ERROR` level
- **4xx errors**: `WARN` level
- **Other errors**: `INFO` level

Log entries include:
- Error code
- HTTP status
- Request ID
- Request path
- User agent
- Remote address

## Best Practices

1. **Use Standard Error Codes**: Always use predefined error codes when possible
2. **Provide Helpful Details**: Include relevant details in the `details` field
3. **Add Request Context**: The middleware automatically adds request ID and path
4. **Log Appropriately**: Let the middleware handle logging - don't duplicate logs
5. **Be Consistent**: Use the same error code for the same type of error across services
6. **Security Considerations**: Don't expose sensitive information in error details

## Example Integration

See `examples/error_handling_integration.go` for a complete example of integrating the error package into a service.