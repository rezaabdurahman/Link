package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
)

// ChiErrorHandler is a middleware for Chi router to handle API errors consistently
func ChiErrorHandler(logger *logrus.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
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
					apiError.WithRequestID(getChiRequestID(r)).WithPath(r.URL.Path)
					
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
							"user_agent":   r.UserAgent(),
							"remote_addr":  r.RemoteAddr,
						})
						
						logEntry.Log(logLevel, apiError.Message)
					}
					
					// Send JSON response
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(httpStatus)
					json.NewEncoder(w).Encode(apiError)
				}
			}()
			
			next.ServeHTTP(w, r)
		})
	}
}

// ChiRespondWithError sends a structured error response for Chi
func ChiRespondWithError(w http.ResponseWriter, r *http.Request, code ErrorCode, message string, details interface{}) {
	apiError := NewAPIError(code, message, details).
		WithRequestID(getChiRequestID(r)).
		WithPath(r.URL.Path)
	
	httpStatus := HTTPStatusMap[code]
	if httpStatus == 0 {
		httpStatus = http.StatusInternalServerError
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	json.NewEncoder(w).Encode(apiError)
}

// ChiRespondWithValidationError sends a validation error with field details
func ChiRespondWithValidationError(w http.ResponseWriter, r *http.Request, fieldErrors map[string]string) {
	ChiRespondWithError(w, r, ErrCodeValidationFailed, "Input validation failed", fieldErrors)
}

// ChiRespondWithNotFound sends a 404 error response
func ChiRespondWithNotFound(w http.ResponseWriter, r *http.Request, resource string) {
	message := fmt.Sprintf("%s not found", resource)
	ChiRespondWithError(w, r, ErrCodeNotFound, message, nil)
}

// ChiRespondWithUnauthorized sends a 401 error response
func ChiRespondWithUnauthorized(w http.ResponseWriter, r *http.Request, message string) {
	if message == "" {
		message = "Authentication required"
	}
	ChiRespondWithError(w, r, ErrCodeUnauthorized, message, nil)
}

// ChiRespondWithForbidden sends a 403 error response
func ChiRespondWithForbidden(w http.ResponseWriter, r *http.Request, message string) {
	if message == "" {
		message = "Access forbidden"
	}
	ChiRespondWithError(w, r, ErrCodeForbidden, message, nil)
}

// ChiRespondWithInternalError sends a 500 error response
func ChiRespondWithInternalError(w http.ResponseWriter, r *http.Request) {
	ChiRespondWithError(w, r, ErrCodeInternalError, "Internal server error", nil)
}

// Helper functions for Chi

func getChiRequestID(r *http.Request) string {
	// Try to get request ID from various sources
	if requestID := r.Header.Get("X-Request-ID"); requestID != "" {
		return requestID
	}
	if requestID := r.Header.Get("X-Correlation-ID"); requestID != "" {
		return requestID
	}
	// Generate a simple request ID if none found
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}