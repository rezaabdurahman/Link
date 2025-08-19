package logger

import (
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

var Logger *logrus.Logger

// InitLogger initializes the structured logger
func InitLogger() *logrus.Logger {
	Logger = logrus.New()

	// Set log level based on environment
	level := getLogLevel()
	Logger.SetLevel(level)

	// Set format based on environment
	if os.Getenv("ENVIRONMENT") == "production" {
		Logger.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: "2006-01-02T15:04:05.000Z",
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
			},
		})
	} else {
		Logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
			ForceColors:   true,
		})
	}

	// Add service context
	Logger = Logger.WithFields(logrus.Fields{
		"service": "api-gateway",
		"version": getVersion(),
	}).Logger

	return Logger
}

// getLogLevel returns the appropriate log level
func getLogLevel() logrus.Level {
	levelStr := strings.ToLower(os.Getenv("LOG_LEVEL"))
	switch levelStr {
	case "trace":
		return logrus.TraceLevel
	case "debug":
		return logrus.DebugLevel
	case "info":
		return logrus.InfoLevel
	case "warn", "warning":
		return logrus.WarnLevel
	case "error":
		return logrus.ErrorLevel
	case "fatal":
		return logrus.FatalLevel
	case "panic":
		return logrus.PanicLevel
	default:
		if os.Getenv("ENVIRONMENT") == "production" {
			return logrus.InfoLevel
		}
		return logrus.DebugLevel
	}
}

// getVersion returns the service version
func getVersion() string {
	version := os.Getenv("APP_VERSION")
	if version == "" {
		return "development"
	}
	return version
}

// CorrelationIDMiddleware adds correlation ID to requests and logs
func CorrelationIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for existing correlation ID in headers
		correlationID := c.GetHeader("X-Correlation-ID")
		if correlationID == "" {
			// Generate new correlation ID
			correlationID = uuid.New().String()
		}

		// Set correlation ID in context and response header
		c.Set("correlation_id", correlationID)
		c.Header("X-Correlation-ID", correlationID)

		// Add to logger context
		logger := Logger.WithField("correlation_id", correlationID)
		c.Set("logger", logger)

		c.Next()
	}
}

// StructuredLoggingMiddleware provides structured request logging
func StructuredLoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get start time
		start := time.Now()

		// Process request
		c.Next()

		// Calculate processing time
		latency := time.Since(start)

		// Get correlation ID and user info
		correlationID := c.GetString("correlation_id")
		userID := c.GetString("user_id")
		userEmail := c.GetString("user_email")

		// Create log entry with context
		logger := Logger.WithFields(logrus.Fields{
			"correlation_id": correlationID,
			"method":         c.Request.Method,
			"path":           c.Request.URL.Path,
			"status":         c.Writer.Status(),
			"latency_ms":     latency.Milliseconds(),
			"client_ip":      c.ClientIP(),
			"user_agent":     c.Request.UserAgent(),
			"request_size":   c.Request.ContentLength,
			"response_size":  c.Writer.Size(),
		})

		// Add user context if available
		if userID != "" {
			logger = logger.WithFields(logrus.Fields{
				"user_id":    userID,
				"user_email": userEmail,
			})
		}

		// Add query parameters for debugging (in development)
		if os.Getenv("ENVIRONMENT") != "production" && len(c.Request.URL.RawQuery) > 0 {
			logger = logger.WithField("query", c.Request.URL.RawQuery)
		}

		// Log based on status code
		status := c.Writer.Status()
		message := "Request processed"

		switch {
		case status >= 500:
			logger.Error(message)
		case status >= 400:
			logger.Warn(message)
		case status >= 300:
			logger.Info(message)
		default:
			logger.Debug(message)
		}

		// Log any errors that occurred
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				logger.WithField("error", err.Error()).Error("Request error")
			}
		}
	}
}

// GetLoggerFromContext gets the structured logger from gin context
func GetLoggerFromContext(c *gin.Context) *logrus.Entry {
	if logger, exists := c.Get("logger"); exists {
		if entry, ok := logger.(*logrus.Entry); ok {
			return entry
		}
	}
	// Fallback to default logger with correlation ID if available
	correlationID := c.GetString("correlation_id")
	if correlationID != "" {
		return Logger.WithField("correlation_id", correlationID)
	}
	return Logger.WithField("context", "unknown")
}

// WithCorrelation adds correlation ID to a log entry
func WithCorrelation(correlationID string) *logrus.Entry {
	return Logger.WithField("correlation_id", correlationID)
}
