package logging

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"
)

// StructuredLogger provides consistent structured logging across all services
type StructuredLogger struct {
	*logrus.Logger
	serviceName string
	environment string
}

// LogEntry represents a structured log entry compatible with Loki
type LogEntry struct {
	Timestamp   time.Time              `json:"time"`
	Level       string                 `json:"level"`
	Message     string                 `json:"msg"`
	Service     string                 `json:"service"`
	Environment string                 `json:"environment"`
	RequestID   string                 `json:"request_id,omitempty"`
	TraceID     string                 `json:"trace_id,omitempty"`
	SpanID      string                 `json:"span_id,omitempty"`
	UserID      string                 `json:"user_id,omitempty"`
	UserEmail   string                 `json:"user_email,omitempty"`
	Method      string                 `json:"method,omitempty"`
	URL         string                 `json:"url,omitempty"`
	Status      int                    `json:"status,omitempty"`
	Duration    int64                  `json:"duration_ms,omitempty"`
	RemoteAddr  string                 `json:"remote_addr,omitempty"`
	Error       string                 `json:"error,omitempty"`
	StackTrace  string                 `json:"stack_trace,omitempty"`
	Fields      map[string]interface{} `json:"fields,omitempty"`
}

// NewStructuredLogger creates a new structured logger instance
func NewStructuredLogger(serviceName string) *StructuredLogger {
	logger := logrus.New()
	
	// Configure output format as JSON for Loki compatibility
	logger.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat:   time.RFC3339Nano,
		DisableTimestamp:  false,
		DisableHTMLEscape: true,
		PrettyPrint:       false,
		FieldMap: logrus.FieldMap{
			logrus.FieldKeyTime:  "time",
			logrus.FieldKeyLevel: "level",
			logrus.FieldKeyMsg:   "msg",
			logrus.FieldKeyFunc:  "func",
		},
	})
	
	// Set log level from environment
	level := os.Getenv("LOG_LEVEL")
	if level == "" {
		level = "info"
	}
	
	if logLevel, err := logrus.ParseLevel(level); err == nil {
		logger.SetLevel(logLevel)
	}
	
	// Get environment from ENV vars
	environment := os.Getenv("ENVIRONMENT")
	if environment == "" {
		environment = os.Getenv("APP_ENV")
		if environment == "" {
			environment = "development"
		}
	}
	
	return &StructuredLogger{
		Logger:      logger,
		serviceName: serviceName,
		environment: environment,
	}
}

// WithContext creates a logger entry with context information
func (sl *StructuredLogger) WithContext(ctx context.Context) *logrus.Entry {
	entry := sl.Logger.WithFields(logrus.Fields{
		"service":     sl.serviceName,
		"environment": sl.environment,
	})
	
	// Extract trace information if available
	span := trace.SpanFromContext(ctx)
	if span != nil {
		spanContext := span.SpanContext()
		if spanContext.IsValid() {
			entry = entry.WithFields(logrus.Fields{
				"trace_id": spanContext.TraceID().String(),
				"span_id":  spanContext.SpanID().String(),
			})
		}
	}
	
	// Extract request ID if available
	if requestID := ctx.Value("request_id"); requestID != nil {
		entry = entry.WithField("request_id", requestID)
	}
	
	// Extract user information if available
	if userID := ctx.Value("user_id"); userID != nil {
		entry = entry.WithField("user_id", userID)
	}
	
	if userEmail := ctx.Value("user_email"); userEmail != nil {
		entry = entry.WithField("user_email", userEmail)
	}
	
	return entry
}

// WithRequest creates a logger entry with HTTP request information
func (sl *StructuredLogger) WithRequest(ctx context.Context, method, url, remoteAddr string) *logrus.Entry {
	return sl.WithContext(ctx).WithFields(logrus.Fields{
		"method":      method,
		"url":         url,
		"remote_addr": remoteAddr,
	})
}

// WithError creates a logger entry with error information
func (sl *StructuredLogger) WithError(ctx context.Context, err error) *logrus.Entry {
	entry := sl.WithContext(ctx).WithError(err)
	
	// Add stack trace for debug level
	if sl.Logger.IsLevelEnabled(logrus.DebugLevel) {
		entry = entry.WithField("stack_trace", fmt.Sprintf("%+v", err))
	}
	
	return entry
}

// LogHTTPRequest logs an HTTP request with structured data
func (sl *StructuredLogger) LogHTTPRequest(ctx context.Context, method, url, remoteAddr string, status int, duration time.Duration) {
	entry := sl.WithRequest(ctx, method, url, remoteAddr).WithFields(logrus.Fields{
		"status":      status,
		"duration_ms": duration.Milliseconds(),
	})
	
	// Log level based on status code
	switch {
	case status >= 500:
		entry.Error("HTTP request completed with server error")
	case status >= 400:
		entry.Warn("HTTP request completed with client error")
	case duration > time.Second*5:
		entry.Warn("HTTP request completed (slow)")
	default:
		entry.Info("HTTP request completed")
	}
}

// LogDatabaseOperation logs a database operation
func (sl *StructuredLogger) LogDatabaseOperation(ctx context.Context, operation, table string, duration time.Duration, err error) {
	entry := sl.WithContext(ctx).WithFields(logrus.Fields{
		"operation":   operation,
		"table":       table,
		"duration_ms": duration.Milliseconds(),
	})
	
	if err != nil {
		entry.WithError(err).Error("Database operation failed")
	} else {
		if duration > time.Millisecond*100 {
			entry.Warn("Database operation completed (slow)")
		} else {
			entry.Debug("Database operation completed")
		}
	}
}

// LogCacheOperation logs a cache operation
func (sl *StructuredLogger) LogCacheOperation(ctx context.Context, operation, key string, hit bool, duration time.Duration) {
	entry := sl.WithContext(ctx).WithFields(logrus.Fields{
		"operation":   operation,
		"cache_key":   key,
		"cache_hit":   hit,
		"duration_ms": duration.Milliseconds(),
	})
	
	if hit {
		entry.Debug("Cache operation completed (hit)")
	} else {
		entry.Debug("Cache operation completed (miss)")
	}
}

// LogExternalAPICall logs an external API call
func (sl *StructuredLogger) LogExternalAPICall(ctx context.Context, service, endpoint string, status int, duration time.Duration, err error) {
	entry := sl.WithContext(ctx).WithFields(logrus.Fields{
		"external_service": service,
		"endpoint":         endpoint,
		"status":           status,
		"duration_ms":      duration.Milliseconds(),
	})
	
	if err != nil {
		entry.WithError(err).Error("External API call failed")
	} else {
		switch {
		case status >= 500:
			entry.Error("External API call completed with server error")
		case status >= 400:
			entry.Warn("External API call completed with client error")
		case duration > time.Second*30:
			entry.Warn("External API call completed (slow)")
		default:
			entry.Info("External API call completed")
		}
	}
}

// LogBusinessEvent logs a business logic event
func (sl *StructuredLogger) LogBusinessEvent(ctx context.Context, event string, data map[string]interface{}) {
	entry := sl.WithContext(ctx).WithFields(logrus.Fields{
		"event":      event,
		"event_data": data,
	})
	
	entry.Info("Business event occurred")
}

// LogSecurityEvent logs a security-related event
func (sl *StructuredLogger) LogSecurityEvent(ctx context.Context, event, details string, severity string) {
	entry := sl.WithContext(ctx).WithFields(logrus.Fields{
		"security_event": event,
		"details":        details,
		"severity":       severity,
	})
	
	switch severity {
	case "critical":
		entry.Error("Security event (critical)")
	case "high":
		entry.Error("Security event (high)")
	case "medium":
		entry.Warn("Security event (medium)")
	default:
		entry.Info("Security event")
	}
}

// LogUserAction logs a user action for audit purposes
func (sl *StructuredLogger) LogUserAction(ctx context.Context, action string, resource string, result string) {
	entry := sl.WithContext(ctx).WithFields(logrus.Fields{
		"user_action": action,
		"resource":    resource,
		"result":      result,
		"audit":       true,
	})
	
	entry.Info("User action logged")
}

// SanitizeForProduction sanitizes log data for production environments
func (sl *StructuredLogger) SanitizeForProduction(entry *logrus.Entry) *logrus.Entry {
	if sl.environment != "production" {
		return entry
	}
	
	// Remove or mask sensitive data in production
	sanitizedFields := make(logrus.Fields)
	for key, value := range entry.Data {
		switch key {
		case "user_email", "email":
			// Mask email addresses
			if email, ok := value.(string); ok && email != "" {
				sanitizedFields[key] = maskEmail(email)
			}
		case "user_id":
			// Keep user IDs but ensure they're UUIDs only
			if userID, ok := value.(string); ok {
				if _, err := uuid.Parse(userID); err == nil {
					sanitizedFields[key] = userID
				} else {
					sanitizedFields[key] = "***"
				}
			}
		case "remote_addr", "ip":
			// Mask IP addresses
			if ip, ok := value.(string); ok && ip != "" {
				sanitizedFields[key] = maskIPAddress(ip)
			}
		default:
			sanitizedFields[key] = value
		}
	}
	
	return sl.Logger.WithFields(sanitizedFields)
}

// Helper functions for data sanitization
func maskEmail(email string) string {
	// Simple email masking: user@domain.com -> u***@d***.com
	if len(email) < 3 {
		return "***"
	}
	
	atIndex := -1
	for i, char := range email {
		if char == '@' {
			atIndex = i
			break
		}
	}
	
	if atIndex == -1 {
		return "***"
	}
	
	username := email[:atIndex]
	domain := email[atIndex+1:]
	
	maskedUsername := string(username[0]) + "***"
	
	dotIndex := -1
	for i, char := range domain {
		if char == '.' {
			dotIndex = i
			break
		}
	}
	
	if dotIndex == -1 {
		return maskedUsername + "@***"
	}
	
	maskedDomain := string(domain[0]) + "***" + domain[dotIndex:]
	return maskedUsername + "@" + maskedDomain
}

func maskIPAddress(ip string) string {
	// Mask IP address: 192.168.1.100 -> 192.168.***.***
	if len(ip) < 7 {
		return "***"
	}
	
	// Simple IPv4 masking
	dotCount := 0
	
	for i, char := range ip {
		if char == '.' {
			dotCount++
			if dotCount == 2 {
				return ip[:i] + ".***"
			}
		}
	}
	
	return "***"
}