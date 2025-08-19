package sentry

import (
	"fmt"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gin-gonic/gin"
)

// InitSentry initializes Sentry for error reporting
func InitSentry() error {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		// Don't error if no DSN is provided - just skip initialization
		fmt.Println("SENTRY_DSN not provided, skipping Sentry initialization")
		return nil
	}

	environment := os.Getenv("ENVIRONMENT")
	if environment == "" {
		environment = "development"
	}

	release := os.Getenv("APP_VERSION")
	if release == "" {
		release = "unknown"
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      environment,
		Release:          release,
		TracesSampleRate: getTracesSampleRate(environment),
		
		// Set default tags
		Tags: map[string]string{
			"component": "api-gateway",
			"language":  "go",
		},

		// Configure before send to filter out noise
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			// Filter out health check related errors
			if event.Request != nil && event.Request.URL == "/health" {
				return nil
			}
			
			// Log the event in development
			if environment == "development" {
				fmt.Printf("Sentry event: %+v\n", event)
			}
			
			return event
		},
	})

	if err != nil {
		return fmt.Errorf("failed to initialize Sentry: %w", err)
	}

	fmt.Printf("Sentry initialized successfully (environment: %s, release: %s)\n", environment, release)
	return nil
}

// getTracesSampleRate returns appropriate sample rate based on environment
func getTracesSampleRate(environment string) float64 {
	switch environment {
	case "production":
		return 0.1 // 10% sampling in production
	case "staging":
		return 0.5 // 50% sampling in staging
	default:
		return 1.0 // 100% sampling in development
	}
}

// CaptureError captures an error with additional context
func CaptureError(err error, context map[string]interface{}) {
	if err == nil {
		return
	}

	sentry.WithScope(func(scope *sentry.Scope) {
		// Add context data
		for key, value := range context {
			scope.SetExtra(key, value)
		}
		
		// Capture the error
		sentry.CaptureException(err)
	})
}

// CaptureMessage captures a message with given level
func CaptureMessage(message string, level sentry.Level, context map[string]interface{}) {
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(level)
		
		// Add context data
		for key, value := range context {
			scope.SetExtra(key, value)
		}
		
		sentry.CaptureMessage(message)
	})
}

// SetUserContext sets user information for error reporting
func SetUserContext(userID, email, username string) {
	sentry.ConfigureScope(func(scope *sentry.Scope) {
		scope.SetUser(sentry.User{
			ID:       userID,
			Email:    email,
			Username: username,
		})
	})
}

// AddBreadcrumb adds a breadcrumb for debugging
func AddBreadcrumb(message, category string, level sentry.Level) {
	sentry.AddBreadcrumb(&sentry.Breadcrumb{
		Message:  message,
		Category: category,
		Level:    level,
		Timestamp: time.Now(),
	})
}

// GinSentryMiddleware returns a Gin middleware for automatic error capture
func GinSentryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Create a new scope for this request
		hub := sentry.GetHubFromContext(c.Request.Context())
		if hub == nil {
			hub = sentry.CurrentHub().Clone()
		}

		// Set request context
		hub.ConfigureScope(func(scope *sentry.Scope) {
			scope.SetRequest(c.Request)
			scope.SetTag("method", c.Request.Method)
			scope.SetTag("path", c.Request.URL.Path)
			scope.SetExtra("client_ip", c.ClientIP())
			
			// Set user context if available
			if userID := c.GetString("user_id"); userID != "" {
				scope.SetUser(sentry.User{
					ID:       userID,
					Email:    c.GetString("user_email"),
					Username: c.GetString("user_name"),
				})
			}
		})

		// Store hub in context for later use
		c.Request = c.Request.WithContext(sentry.SetHubOnContext(c.Request.Context(), hub))

		// Process request
		c.Next()

		// Capture any errors that occurred during request processing
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				hub.CaptureException(err.Err)
			}
		}

		// Capture HTTP errors (4xx, 5xx) as messages
		status := c.Writer.Status()
		if status >= 400 {
			hub.WithScope(func(scope *sentry.Scope) {
				scope.SetLevel(getSentryLevelFromHTTPStatus(status))
				scope.SetExtra("status_code", status)
				scope.SetExtra("response_size", c.Writer.Size())
				
				message := fmt.Sprintf("HTTP %d - %s %s", status, c.Request.Method, c.Request.URL.Path)
				hub.CaptureMessage(message)
			})
		}
	}
}

// getSentryLevelFromHTTPStatus converts HTTP status code to Sentry level
func getSentryLevelFromHTTPStatus(status int) sentry.Level {
	switch {
	case status >= 500:
		return sentry.LevelError
	case status >= 400:
		return sentry.LevelWarning
	default:
		return sentry.LevelInfo
	}
}

// Flush waits for all events to be sent (use during shutdown)
func Flush(timeout time.Duration) {
	sentry.Flush(timeout)
}
