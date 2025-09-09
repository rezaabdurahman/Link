package logging

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GinMiddleware creates a Gin middleware that uses structured logging
func (sl *StructuredLogger) GinMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		start := time.Now()
		
		// Generate request ID if not present
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = c.GetHeader("X-Correlation-ID")
		}
		if requestID == "" {
			requestID = uuid.New().String()
		}
		
		// Add request ID to context and response header
		ctx := context.WithValue(c.Request.Context(), "request_id", requestID)
		c.Request = c.Request.WithContext(ctx)
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		
		// Add user information to context if available from headers
		if userID := c.GetHeader("X-User-ID"); userID != "" {
			ctx = context.WithValue(ctx, "user_id", userID)
			c.Request = c.Request.WithContext(ctx)
			c.Set("user_id", userID)
		}
		
		if userEmail := c.GetHeader("X-User-Email"); userEmail != "" {
			ctx = context.WithValue(ctx, "user_email", userEmail)
			c.Request = c.Request.WithContext(ctx)
			c.Set("user_email", userEmail)
		}

		// Process request
		c.Next()

		// Calculate request duration
		duration := time.Since(start)

		// Log the HTTP request
		sl.LogHTTPRequest(
			c.Request.Context(),
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			c.Writer.Status(),
			duration,
		)
	})
}

// GinErrorHandler creates a Gin middleware for error logging
func (sl *StructuredLogger) GinErrorHandler() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		c.Next()
		
		// Log any errors that occurred during request processing
		for _, ginErr := range c.Errors {
			sl.WithError(c.Request.Context(), ginErr.Err).WithField("error_type", ginErr.Type).Error("Request error occurred")
		}
	})
}

// GinRecoveryHandler creates a custom recovery handler with structured logging
func (sl *StructuredLogger) GinRecoveryHandler() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		// Log the panic with structured data
		entry := sl.WithContext(c.Request.Context()).WithFields(map[string]interface{}{
			"panic":       recovered,
			"method":      c.Request.Method,
			"url":         c.Request.URL.Path,
			"remote_addr": c.ClientIP(),
		})
		
		entry.Error("Panic recovered in HTTP handler")
		
		// Return 500 error
		c.JSON(500, gin.H{
			"error":      "Internal Server Error",
			"request_id": c.GetString("request_id"),
		})
		c.Abort()
	})
}

// LogUserAction is a helper method for logging user actions in Gin handlers
func (sl *StructuredLogger) LogUserActionGin(c *gin.Context, action, resource, result string) {
	sl.LogUserAction(c.Request.Context(), action, resource, result)
}

// LogBusinessEvent is a helper method for logging business events in Gin handlers
func (sl *StructuredLogger) LogBusinessEventGin(c *gin.Context, event string, data map[string]interface{}) {
	sl.LogBusinessEvent(c.Request.Context(), event, data)
}

// LogSecurityEvent is a helper method for logging security events in Gin handlers
func (sl *StructuredLogger) LogSecurityEventGin(c *gin.Context, event, details, severity string) {
	sl.LogSecurityEvent(c.Request.Context(), event, details, severity)
}