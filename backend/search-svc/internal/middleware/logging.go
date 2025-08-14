package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/search-svc/internal/dto"
)

// RequestLogger logs all HTTP requests with timing information
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)
		status := c.Writer.Status()
		userID := c.GetString("user_id")
		
		// Log request details
		log.Printf("[%s] %s %s - Status: %d - Latency: %v - User: %s",
			method, path, c.ClientIP(), status, latency, userID)

		// Log errors if any
		if len(c.Errors) > 0 {
			log.Printf("Request errors: %v", c.Errors.String())
		}
	}
}

// ErrorHandler handles panics and converts them to proper error responses
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Log the panic
				log.Printf("PANIC: %v\nStack trace:\n%s", err, debug.Stack())

				// Return internal server error
				c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
					Error:   "INTERNAL_ERROR",
					Message: "An unexpected error occurred",
				})

				c.Abort()
			}
		}()

		c.Next()
	}
}
