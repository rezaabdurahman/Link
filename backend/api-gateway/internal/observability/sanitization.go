package observability

import (
	"crypto/sha256"
	"fmt"
	"regexp"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// ObservabilityDataSanitizer handles sanitization of sensitive data across all observability components
type ObservabilityDataSanitizer struct {
	// Patterns to identify sensitive data
	emailPattern     *regexp.Regexp
	phonePattern     *regexp.Regexp
	ccPattern        *regexp.Regexp
	ssnPattern       *regexp.Regexp
	passwordPattern  *regexp.Regexp
	ipAddressPattern *regexp.Regexp
	tokenPattern     *regexp.Regexp
	apiKeyPattern    *regexp.Regexp

	// Configuration
	config SanitizationConfig
}

// SanitizationConfig controls how data is sanitized
type SanitizationConfig struct {
	// HashLength controls how many characters of hash to show
	HashLength int
	// PreserveDomains keeps email domains for debugging
	PreserveDomains bool
	// PreserveIPSubnets keeps IP subnets (e.g., 192.168.1.xxx)
	PreserveIPSubnets bool
	// RedactionText is the text used to replace sensitive data
	RedactionText string
}

// DefaultSanitizationConfig provides secure defaults
func DefaultSanitizationConfig() SanitizationConfig {
	return SanitizationConfig{
		HashLength:        8,
		PreserveDomains:   true,  // Useful for debugging
		PreserveIPSubnets: false, // More secure
		RedactionText:     "[REDACTED]",
	}
}

// NewObservabilityDataSanitizer creates a new unified data sanitizer
func NewObservabilityDataSanitizer(config SanitizationConfig) *ObservabilityDataSanitizer {
	return &ObservabilityDataSanitizer{
		emailPattern:     regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`),
		phonePattern:     regexp.MustCompile(`\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`),
		ccPattern:        regexp.MustCompile(`\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`),
		ssnPattern:       regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
		passwordPattern:  regexp.MustCompile(`(?i)(password|passwd|pwd|secret|token|key)[\s:=]+\S+`),
		ipAddressPattern: regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`),
		tokenPattern:     regexp.MustCompile(`(?i)(bearer\s+)?[a-zA-Z0-9_-]{20,}`),
		apiKeyPattern:    regexp.MustCompile(`(?i)(api[_-]?key|apikey)[\s:=]+[a-zA-Z0-9_-]+`),
		config:           config,
	}
}

// NewDefaultSanitizer creates a sanitizer with default configuration
func NewDefaultSanitizer() *ObservabilityDataSanitizer {
	return NewObservabilityDataSanitizer(DefaultSanitizationConfig())
}

// SanitizeString removes or masks sensitive data from strings
func (s *ObservabilityDataSanitizer) SanitizeString(input string) string {
	result := input

	// Replace emails with hashed version (optionally preserving domain)
	result = s.emailPattern.ReplaceAllStringFunc(result, func(email string) string {
		if s.config.PreserveDomains {
			parts := strings.Split(email, "@")
			if len(parts) == 2 {
				hash := sha256.Sum256([]byte(strings.ToLower(parts[0])))
				return fmt.Sprintf("user_%x@%s", hash[:4], parts[1])
			}
		}
		return s.hashValue("EMAIL", email)
	})

	// Replace IP addresses
	result = s.ipAddressPattern.ReplaceAllStringFunc(result, func(ip string) string {
		if s.config.PreserveIPSubnets {
			parts := strings.Split(ip, ".")
			if len(parts) == 4 {
				return fmt.Sprintf("%s.%s.%s.xxx", parts[0], parts[1], parts[2])
			}
		}
		return s.hashValue("IP", ip)
	})

	// Replace phone numbers
	result = s.phonePattern.ReplaceAllString(result, "[PHONE_REDACTED]")

	// Replace credit card numbers
	result = s.ccPattern.ReplaceAllString(result, "[CC_REDACTED]")

	// Replace SSNs
	result = s.ssnPattern.ReplaceAllString(result, "[SSN_REDACTED]")

	// Replace password-like patterns
	result = s.passwordPattern.ReplaceAllString(result, "[CREDENTIAL_REDACTED]")

	// Replace tokens
	result = s.tokenPattern.ReplaceAllString(result, "[TOKEN_REDACTED]")

	// Replace API keys
	result = s.apiKeyPattern.ReplaceAllString(result, "[APIKEY_REDACTED]")

	return result
}

// hashValue creates a consistent hash of a value for tracking
func (s *ObservabilityDataSanitizer) hashValue(prefix, value string) string {
	hash := sha256.Sum256([]byte(strings.ToLower(value)))
	return fmt.Sprintf("[%s_HASH_%x]", prefix, hash[:s.config.HashLength/2])
}

// SanitizeLogEntry sanitizes a complete log entry (for Promtail/Loki)
type LogEntry struct {
	Message    string                 `json:"msg"`
	Level      string                 `json:"level"`
	Time       string                 `json:"time"`
	Service    string                 `json:"service"`
	UserID     string                 `json:"user_id,omitempty"`
	UserEmail  string                 `json:"user_email,omitempty"`
	RequestID  string                 `json:"request_id,omitempty"`
	Method     string                 `json:"method,omitempty"`
	URL        string                 `json:"url,omitempty"`
	Status     interface{}            `json:"status,omitempty"`
	Duration   string                 `json:"duration,omitempty"`
	RemoteAddr string                 `json:"remote_addr,omitempty"`
	Extra      map[string]interface{} `json:"-"`
}

// SanitizeLogEntry sanitizes a log entry for safe storage
func (s *ObservabilityDataSanitizer) SanitizeLogEntry(entry *LogEntry) *LogEntry {
	sanitized := &LogEntry{
		Message:   s.SanitizeString(entry.Message),
		Level:     entry.Level,
		Time:      entry.Time,
		Service:   entry.Service,
		RequestID: entry.RequestID,
		Method:    entry.Method,
		URL:       s.sanitizeURL(entry.URL),
		Status:    entry.Status,
		Duration:  entry.Duration,
	}

	// Hash sensitive user data
	if entry.UserID != "" {
		sanitized.UserID = s.hashValue("USER_ID", entry.UserID)
	}

	if entry.UserEmail != "" {
		sanitized.UserEmail = s.sanitizeEmail(entry.UserEmail)
	}

	if entry.RemoteAddr != "" {
		sanitized.RemoteAddr = s.sanitizeIPAddress(entry.RemoteAddr)
	}

	return sanitized
}

// sanitizeEmail handles email sanitization with domain preservation
func (s *ObservabilityDataSanitizer) sanitizeEmail(email string) string {
	if s.config.PreserveDomains {
		parts := strings.Split(email, "@")
		if len(parts) == 2 {
			hash := sha256.Sum256([]byte(strings.ToLower(parts[0])))
			return fmt.Sprintf("user_%x@%s", hash[:s.config.HashLength/2], parts[1])
		}
	}
	return s.hashValue("EMAIL", email)
}

// sanitizeIPAddress handles IP address sanitization
func (s *ObservabilityDataSanitizer) sanitizeIPAddress(ip string) string {
	if s.config.PreserveIPSubnets {
		parts := strings.Split(ip, ".")
		if len(parts) == 4 {
			return fmt.Sprintf("%s.%s.%s.xxx", parts[0], parts[1], parts[2])
		}
	}
	return s.hashValue("IP", ip)
}

// sanitizeURL removes sensitive data from URLs
func (s *ObservabilityDataSanitizer) sanitizeURL(url string) string {
	// Remove query parameters that might contain sensitive data
	if strings.Contains(url, "?") {
		parts := strings.Split(url, "?")
		// Keep the path, sanitize query parameters
		return parts[0] + "?[QUERY_SANITIZED]"
	}
	return s.SanitizeString(url)
}

// === TRACING SANITIZATION ===

// SecureSpanAttributes creates sanitized span attributes
func (s *ObservabilityDataSanitizer) SecureSpanAttributes(attrs ...attribute.KeyValue) []attribute.KeyValue {
	sanitized := make([]attribute.KeyValue, len(attrs))

	for i, attr := range attrs {
		key := string(attr.Key)
		value := attr.Value.AsString()

		// Check if attribute key suggests sensitive data
		if s.isSensitiveKey(key) {
			// Hash the value instead of storing plaintext
			if value != "" {
				sanitized[i] = attribute.String(key+"_hash", s.hashValue("ATTR", value))
			} else {
				sanitized[i] = attribute.String(key, s.config.RedactionText)
			}
		} else {
			// Still sanitize the value for PII
			sanitizedValue := s.SanitizeString(value)
			sanitized[i] = attribute.String(key, sanitizedValue)
		}
	}

	return sanitized
}

// SecureUserAttributes creates secure user attributes for spans
func (s *ObservabilityDataSanitizer) SecureUserAttributes(userID, userEmail string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{}

	if userID != "" {
		// Hash user ID for privacy while maintaining traceability
		attrs = append(attrs, attribute.String("user.id_hash", s.hashValue("USER_ID", userID)))
	}

	if userEmail != "" {
		// Extract domain for debugging, hash email for privacy
		attrs = append(attrs, attribute.String("user.email_domain", s.extractDomain(userEmail)))
		attrs = append(attrs, attribute.String("user.email_hash", s.hashValue("EMAIL", userEmail)))
	}

	return attrs
}

// AddSecureSpanError records an error without exposing sensitive data
func (s *ObservabilityDataSanitizer) AddSecureSpanError(span oteltrace.Span, err error) {
	sanitizedMessage := s.SanitizeString(err.Error())
	span.RecordError(fmt.Errorf(sanitizedMessage))
	span.SetStatus(codes.Error, sanitizedMessage)
}

// SecureSpanEvent adds an event with sanitized attributes
func (s *ObservabilityDataSanitizer) SecureSpanEvent(span oteltrace.Span, name string, attrs ...attribute.KeyValue) {
	secureAttrs := s.SecureSpanAttributes(attrs...)
	span.AddEvent(name, oteltrace.WithAttributes(secureAttrs...))
}

// === METRICS SANITIZATION ===

// SanitizeMetricLabels sanitizes labels for metrics
func (s *ObservabilityDataSanitizer) SanitizeMetricLabels(labels map[string]string) map[string]string {
	sanitized := make(map[string]string)

	for key, value := range labels {
		if s.isSensitiveKey(key) {
			sanitized[key+"_hash"] = s.hashValue("METRIC", value)
		} else {
			sanitized[key] = s.SanitizeString(value)
		}
	}

	return sanitized
}

// === UTILITY FUNCTIONS ===

// IsSensitiveKey checks if an attribute key might contain sensitive data (public method)
func (s *ObservabilityDataSanitizer) IsSensitiveKey(key string) bool {
	return s.isSensitiveKey(key)
}

// isSensitiveKey checks if an attribute key might contain sensitive data
func (s *ObservabilityDataSanitizer) isSensitiveKey(key string) bool {
	sensitiveKeys := []string{
		"user.email", "user.phone", "user.ssn", "user.cc", "user_email", "email",
		"password", "token", "secret", "key", "auth", "authorization", "bearer",
		"credit_card", "payment", "billing", "personal", "pii",
		"remote_addr", "ip", "client_ip", "user_agent",
		"session", "cookie", "csrf", "api_key", "apikey",
	}

	keyLower := strings.ToLower(key)
	for _, sensitiveKey := range sensitiveKeys {
		if strings.Contains(keyLower, sensitiveKey) {
			return true
		}
	}

	return false
}

// extractDomain extracts domain from email for debugging purposes
func (s *ObservabilityDataSanitizer) extractDomain(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		return parts[1]
	}
	return "unknown"
}

// === GLOBAL INSTANCE FOR CONVENIENCE ===

var globalSanitizer *ObservabilityDataSanitizer

// GetGlobalSanitizer returns the global sanitizer instance
func GetGlobalSanitizer() *ObservabilityDataSanitizer {
	if globalSanitizer == nil {
		globalSanitizer = NewDefaultSanitizer()
	}
	return globalSanitizer
}

// SetGlobalSanitizer sets a custom global sanitizer
func SetGlobalSanitizer(sanitizer *ObservabilityDataSanitizer) {
	globalSanitizer = sanitizer
}

// === CONVENIENCE FUNCTIONS USING GLOBAL INSTANCE ===

// SanitizeString sanitizes a string using the global sanitizer
func SanitizeString(input string) string {
	return GetGlobalSanitizer().SanitizeString(input)
}

// SecureUserAttributes creates secure user attributes using the global sanitizer
func SecureUserAttributes(userID, userEmail string) []attribute.KeyValue {
	return GetGlobalSanitizer().SecureUserAttributes(userID, userEmail)
}

// SecureSpanAttributes creates secure span attributes using the global sanitizer
func SecureSpanAttributes(attrs ...attribute.KeyValue) []attribute.KeyValue {
	return GetGlobalSanitizer().SecureSpanAttributes(attrs...)
}

// SanitizeLogEntry sanitizes a log entry using the global sanitizer
func SanitizeLogEntry(entry *LogEntry) *LogEntry {
	return GetGlobalSanitizer().SanitizeLogEntry(entry)
}
