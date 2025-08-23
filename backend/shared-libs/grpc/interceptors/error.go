package interceptors

import (
	"context"
	"fmt"
	"runtime/debug"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UnaryErrorInterceptor standardizes error responses for unary requests
func UnaryErrorInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		resp, err := handler(ctx, req)
		return resp, normalizeError(err)
	}
}

// StreamErrorInterceptor standardizes error responses for streaming requests
func StreamErrorInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		err := handler(srv, stream)
		return normalizeError(err)
	}
}

// UnaryRecoveryInterceptor recovers from panics in unary handlers
func UnaryRecoveryInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		defer func() {
			if r := recover(); r != nil {
				err = handlePanic(r, info.FullMethod)
			}
		}()

		return handler(ctx, req)
	}
}

// StreamRecoveryInterceptor recovers from panics in streaming handlers
func StreamRecoveryInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) (err error) {
		defer func() {
			if r := recover(); r != nil {
				err = handlePanic(r, info.FullMethod)
			}
		}()

		return handler(srv, stream)
	}
}

// normalizeError converts various error types to appropriate gRPC status errors
func normalizeError(err error) error {
	if err == nil {
		return nil
	}

	// If it's already a gRPC status error, return as-is
	if _, ok := status.FromError(err); ok {
		return err
	}

	// Convert common errors to appropriate gRPC codes
	switch {
	case isNotFoundError(err):
		return status.Error(codes.NotFound, err.Error())
	case isValidationError(err):
		return status.Error(codes.InvalidArgument, err.Error())
	case isUnauthorizedError(err):
		return status.Error(codes.Unauthenticated, err.Error())
	case isForbiddenError(err):
		return status.Error(codes.PermissionDenied, err.Error())
	case isConflictError(err):
		return status.Error(codes.AlreadyExists, err.Error())
	case isTimeoutError(err):
		return status.Error(codes.DeadlineExceeded, err.Error())
	case isServiceUnavailableError(err):
		return status.Error(codes.Unavailable, err.Error())
	default:
		// Default to internal server error
		return status.Error(codes.Internal, "internal server error")
	}
}

// handlePanic converts panics to gRPC errors
func handlePanic(r interface{}, method string) error {
	// Log the panic with stack trace
	fmt.Printf("Panic in gRPC handler %s: %v\n%s\n", method, r, string(debug.Stack()))

	// Convert panic to gRPC error
	switch v := r.(type) {
	case error:
		return status.Error(codes.Internal, fmt.Sprintf("internal error: %v", v))
	case string:
		return status.Error(codes.Internal, fmt.Sprintf("internal error: %s", v))
	default:
		return status.Error(codes.Internal, "internal server error")
	}
}

// Error type checking functions - customize these based on your error types

func isNotFoundError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "not found") || 
		   contains(errStr, "does not exist") ||
		   contains(errStr, "record not found")
}

func isValidationError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "validation") ||
		   contains(errStr, "invalid") ||
		   contains(errStr, "required") ||
		   contains(errStr, "bad request")
}

func isUnauthorizedError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "unauthorized") ||
		   contains(errStr, "unauthenticated") ||
		   contains(errStr, "authentication")
}

func isForbiddenError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "forbidden") ||
		   contains(errStr, "permission denied") ||
		   contains(errStr, "access denied")
}

func isConflictError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "conflict") ||
		   contains(errStr, "already exists") ||
		   contains(errStr, "duplicate")
}

func isTimeoutError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "timeout") ||
		   contains(errStr, "deadline") ||
		   contains(errStr, "context deadline exceeded")
}

func isServiceUnavailableError(err error) bool {
	errStr := err.Error()
	return contains(errStr, "unavailable") ||
		   contains(errStr, "service down") ||
		   contains(errStr, "connection refused")
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	// Simple case-insensitive contains check
	s = toLowerCase(s)
	substr = toLowerCase(substr)
	
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// toLowerCase converts string to lowercase
func toLowerCase(s string) string {
	result := make([]rune, len(s))
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			result[i] = r + 32
		} else {
			result[i] = r
		}
	}
	return string(result)
}

// Custom error types for better error handling

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("validation error for field '%s': %s", e.Field, e.Message)
}

// NotFoundError represents a resource not found error
type NotFoundError struct {
	Resource string
	ID       string
}

func (e NotFoundError) Error() string {
	return fmt.Sprintf("%s with ID '%s' not found", e.Resource, e.ID)
}

// ConflictError represents a resource conflict error
type ConflictError struct {
	Resource string
	Message  string
}

func (e ConflictError) Error() string {
	return fmt.Sprintf("conflict with %s: %s", e.Resource, e.Message)
}

// ServiceUnavailableError represents a service unavailable error
type ServiceUnavailableError struct {
	Service string
	Reason  string
}

func (e ServiceUnavailableError) Error() string {
	return fmt.Sprintf("service '%s' unavailable: %s", e.Service, e.Reason)
}

// Helper functions to create common errors

// NewValidationError creates a new validation error
func NewValidationError(field, message string) error {
	return ValidationError{Field: field, Message: message}
}

// NewNotFoundError creates a new not found error
func NewNotFoundError(resource, id string) error {
	return NotFoundError{Resource: resource, ID: id}
}

// NewConflictError creates a new conflict error
func NewConflictError(resource, message string) error {
	return ConflictError{Resource: resource, Message: message}
}

// NewServiceUnavailableError creates a new service unavailable error
func NewServiceUnavailableError(service, reason string) error {
	return ServiceUnavailableError{Service: service, Reason: reason}
}