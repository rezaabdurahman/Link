package tracing

import (
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
	
	"github.com/link-app/api-gateway/internal/observability"
)

// DEPRECATED: Use the unified observability.ObservabilityDataSanitizer instead
// This wrapper maintains backward compatibility while using the new unified sanitizer

// SensitiveDataSanitizer is a legacy wrapper around the unified sanitizer
type SensitiveDataSanitizer struct {
	sanitizer *observability.ObservabilityDataSanitizer
}

// NewSensitiveDataSanitizer creates a new data sanitizer (legacy wrapper)
func NewSensitiveDataSanitizer() *SensitiveDataSanitizer {
	return &SensitiveDataSanitizer{
		sanitizer: observability.NewDefaultSanitizer(),
	}
}

// SanitizeString removes or masks sensitive data from strings (legacy wrapper)
func (s *SensitiveDataSanitizer) SanitizeString(input string) string {
	return s.sanitizer.SanitizeString(input)
}

// SecureSpanAttributes creates sanitized span attributes (legacy wrapper)
func (s *SensitiveDataSanitizer) SecureSpanAttributes(attrs ...attribute.KeyValue) []attribute.KeyValue {
	return s.sanitizer.SecureSpanAttributes(attrs...)
}

// isSensitiveKey checks if an attribute key might contain sensitive data (legacy wrapper)
func (s *SensitiveDataSanitizer) isSensitiveKey(key string) bool {
	return s.sanitizer.IsSensitiveKey(key) // This would need to be exposed in the unified lib
}

// SecureUserAttributes creates secure user attributes for spans
// Uses the unified sanitization library for consistency across all observability components
func SecureUserAttributes(userID, userEmail string) []attribute.KeyValue {
	return observability.SecureUserAttributes(userID, userEmail)
}

// AddSecureSpanError records an error without exposing sensitive data
// Uses the unified sanitization library for consistency
func AddSecureSpanError(span oteltrace.Span, err error) {
	observability.GetGlobalSanitizer().AddSecureSpanError(span, err)
}

// SecureSpanEvent adds an event with sanitized attributes
// Uses the unified sanitization library for consistency
func SecureSpanEvent(span oteltrace.Span, name string, attrs ...attribute.KeyValue) {
	observability.GetGlobalSanitizer().SecureSpanEvent(span, name, attrs...)
}
