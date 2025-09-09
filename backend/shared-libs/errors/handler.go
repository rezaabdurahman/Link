package errors

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// APIError represents a standard API error response
type APIError struct {
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	Details   interface{}       `json:"details,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
	RequestID string            `json:"request_id,omitempty"`
	Path      string            `json:"path,omitempty"`
	Meta      map[string]string `json:"meta,omitempty"`
}

// Error implements the error interface
func (e APIError) Error() string {
	return fmt.Sprintf("API Error %s: %s", e.Code, e.Message)
}

// ErrorCode represents standard error codes across services
type ErrorCode string

const (
	// Authentication & Authorization
	ErrCodeUnauthorized       ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden         ErrorCode = "FORBIDDEN"
	ErrCodeInvalidToken      ErrorCode = "INVALID_TOKEN"
	ErrCodeExpiredToken      ErrorCode = "EXPIRED_TOKEN"
	
	// Input Validation
	ErrCodeValidationFailed  ErrorCode = "VALIDATION_FAILED"
	ErrCodeInvalidInput      ErrorCode = "INVALID_INPUT"
	ErrCodeMissingParameter  ErrorCode = "MISSING_PARAMETER"
	ErrCodeInvalidFormat     ErrorCode = "INVALID_FORMAT"
	
	// Resource Management
	ErrCodeNotFound          ErrorCode = "NOT_FOUND"
	ErrCodeAlreadyExists     ErrorCode = "ALREADY_EXISTS"
	ErrCodeConflict          ErrorCode = "CONFLICT"
	ErrCodePreconditionFailed ErrorCode = "PRECONDITION_FAILED"
	
	// Rate Limiting
	ErrCodeRateLimitExceeded ErrorCode = "RATE_LIMIT_EXCEEDED"
	ErrCodeQuotaExceeded     ErrorCode = "QUOTA_EXCEEDED"
	
	// External Dependencies
	ErrCodeServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
	ErrCodeDatabaseError     ErrorCode = "DATABASE_ERROR"
	ErrCodeCacheError        ErrorCode = "CACHE_ERROR"
	ErrCodeExternalService   ErrorCode = "EXTERNAL_SERVICE_ERROR"
	
	// Generic Server Errors
	ErrCodeInternalError     ErrorCode = "INTERNAL_ERROR"
	ErrCodeTimeoutError      ErrorCode = "TIMEOUT_ERROR"
	ErrCodeConfigurationError ErrorCode = "CONFIGURATION_ERROR"
	
	// Business Logic
	ErrCodeBusinessRule      ErrorCode = "BUSINESS_RULE_VIOLATION"
	ErrCodeInsufficientPermissions ErrorCode = "INSUFFICIENT_PERMISSIONS"
)

// HTTPStatusMap maps error codes to HTTP status codes
var HTTPStatusMap = map[ErrorCode]int{
	ErrCodeUnauthorized:       http.StatusUnauthorized,
	ErrCodeForbidden:         http.StatusForbidden,
	ErrCodeInvalidToken:      http.StatusUnauthorized,
	ErrCodeExpiredToken:      http.StatusUnauthorized,
	
	ErrCodeValidationFailed:  http.StatusBadRequest,
	ErrCodeInvalidInput:      http.StatusBadRequest,
	ErrCodeMissingParameter:  http.StatusBadRequest,
	ErrCodeInvalidFormat:     http.StatusBadRequest,
	
	ErrCodeNotFound:          http.StatusNotFound,
	ErrCodeAlreadyExists:     http.StatusConflict,
	ErrCodeConflict:          http.StatusConflict,
	ErrCodePreconditionFailed: http.StatusPreconditionFailed,
	
	ErrCodeRateLimitExceeded: http.StatusTooManyRequests,
	ErrCodeQuotaExceeded:     http.StatusTooManyRequests,
	
	ErrCodeServiceUnavailable: http.StatusServiceUnavailable,
	ErrCodeDatabaseError:     http.StatusInternalServerError,
	ErrCodeCacheError:        http.StatusInternalServerError,
	ErrCodeExternalService:   http.StatusBadGateway,
	
	ErrCodeInternalError:     http.StatusInternalServerError,
	ErrCodeTimeoutError:      http.StatusGatewayTimeout,
	ErrCodeConfigurationError: http.StatusInternalServerError,
	
	ErrCodeBusinessRule:      http.StatusUnprocessableEntity,
	ErrCodeInsufficientPermissions: http.StatusForbidden,
}

// NewAPIError creates a new API error
func NewAPIError(code ErrorCode, message string, details interface{}) *APIError {
	return &APIError{
		Code:      string(code),
		Message:   message,
		Details:   details,
		Timestamp: time.Now().UTC(),
	}
}

// WithRequestID adds a request ID to the error
func (e *APIError) WithRequestID(requestID string) *APIError {
	e.RequestID = requestID
	return e
}

// WithPath adds the request path to the error
func (e *APIError) WithPath(path string) *APIError {
	e.Path = path
	return e
}

// WithMeta adds metadata to the error
func (e *APIError) WithMeta(key, value string) *APIError {
	if e.Meta == nil {
		e.Meta = make(map[string]string)
	}
	e.Meta[key] = value
	return e
}

// ErrorHandler is a Gin middleware for handling API errors consistently
func ErrorHandler(logger *logrus.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, err interface{}) {
		var apiError *APIError
		
		switch e := err.(type) {
		case *APIError:
			apiError = e
		case APIError:
			apiError = &e
		case error:
			apiError = NewAPIError(ErrCodeInternalError, "Internal server error", nil)
			if logger != nil {
				logger.WithError(e).Error("Unhandled error in request")
			}
		default:
			apiError = NewAPIError(ErrCodeInternalError, "Unknown error occurred", nil)
			if logger != nil {
				logger.WithField("error", fmt.Sprintf("%v", err)).Error("Unknown error in request")
			}
		}
		
		// Add request context
		apiError.WithRequestID(getRequestID(c)).WithPath(c.Request.URL.Path)
		
		// Get HTTP status code
		httpStatus := HTTPStatusMap[ErrorCode(apiError.Code)]
		if httpStatus == 0 {
			httpStatus = http.StatusInternalServerError
		}
		
		// Log the error with appropriate level
		if logger != nil {
			logLevel := getLogLevel(httpStatus)
			logEntry := logger.WithFields(logrus.Fields{
				"error_code":   apiError.Code,
				"http_status":  httpStatus,
				"request_id":   apiError.RequestID,
				"path":         apiError.Path,
				"user_agent":   c.Request.UserAgent(),
				"remote_addr":  c.ClientIP(),
			})
			
			logEntry.Log(logLevel, apiError.Message)
		}
		
		c.JSON(httpStatus, apiError)
		c.Abort()
	})
}

// RespondWithError sends a structured error response
func RespondWithError(c *gin.Context, code ErrorCode, message string, details interface{}) {
	apiError := NewAPIError(code, message, details).
		WithRequestID(getRequestID(c)).
		WithPath(c.Request.URL.Path)
	
	httpStatus := HTTPStatusMap[code]
	if httpStatus == 0 {
		httpStatus = http.StatusInternalServerError
	}
	
	c.JSON(httpStatus, apiError)
}

// RespondWithValidationError sends a validation error with field details
func RespondWithValidationError(c *gin.Context, fieldErrors map[string]string) {
	RespondWithError(c, ErrCodeValidationFailed, "Input validation failed", fieldErrors)
}

// RespondWithNotFound sends a 404 error response
func RespondWithNotFound(c *gin.Context, resource string) {
	message := fmt.Sprintf("%s not found", resource)
	RespondWithError(c, ErrCodeNotFound, message, nil)
}

// RespondWithUnauthorized sends a 401 error response
func RespondWithUnauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "Authentication required"
	}
	RespondWithError(c, ErrCodeUnauthorized, message, nil)
}

// RespondWithForbidden sends a 403 error response
func RespondWithForbidden(c *gin.Context, message string) {
	if message == "" {
		message = "Access forbidden"
	}
	RespondWithError(c, ErrCodeForbidden, message, nil)
}

// RespondWithInternalError sends a 500 error response
func RespondWithInternalError(c *gin.Context) {
	RespondWithError(c, ErrCodeInternalError, "Internal server error", nil)
}

// Helper functions

func getRequestID(c *gin.Context) string {
	// Try to get request ID from various sources
	if requestID := c.GetString("request_id"); requestID != "" {
		return requestID
	}
	if requestID := c.Request.Header.Get("X-Request-ID"); requestID != "" {
		return requestID
	}
	if requestID := c.Request.Header.Get("X-Correlation-ID"); requestID != "" {
		return requestID
	}
	// Generate a simple request ID if none found
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}

func getLogLevel(httpStatus int) logrus.Level {
	switch {
	case httpStatus >= 500:
		return logrus.ErrorLevel
	case httpStatus >= 400:
		return logrus.WarnLevel
	default:
		return logrus.InfoLevel
	}
}