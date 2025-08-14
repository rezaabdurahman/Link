package utils

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"time"
)

// RetryConfig defines configuration for retry behavior
type RetryConfig struct {
	MaxRetries      int           // Maximum number of retries
	BaseDelay       time.Duration // Base delay between retries
	MaxDelay        time.Duration // Maximum delay between retries
	BackoffFactor   float64       // Exponential backoff multiplier
	EnableJitter    bool          // Add random jitter to prevent thundering herd
}

// DefaultRetryConfig returns sensible default retry configuration
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:    3,
		BaseDelay:     100 * time.Millisecond,
		MaxDelay:      5 * time.Second,
		BackoffFactor: 2.0,
		EnableJitter:  true,
	}
}

// RetryableFunc represents a function that can be retried
type RetryableFunc func() error

// IsRetryable represents a function that determines if an error is retryable
type IsRetryable func(error) bool

// RetryWithBackoff executes a function with exponential backoff
func RetryWithBackoff(ctx context.Context, config *RetryConfig, fn RetryableFunc, isRetryable IsRetryable) error {
	if config == nil {
		config = DefaultRetryConfig()
	}

	var lastErr error
	
	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		// First attempt doesn't wait
		if attempt > 0 {
			delay := calculateDelay(config, attempt)
			
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
				// Continue to retry
			}
		}

		if err := fn(); err != nil {
			lastErr = err
			
			// If this is the last attempt, don't check if retryable
			if attempt == config.MaxRetries {
				break
			}
			
			// Check if error is retryable
			if isRetryable != nil && !isRetryable(err) {
				return err
			}
			
			continue
		}

		// Success
		return nil
	}

	return fmt.Errorf("operation failed after %d attempts, last error: %w", config.MaxRetries+1, lastErr)
}

// calculateDelay calculates the delay for the given attempt
func calculateDelay(config *RetryConfig, attempt int) time.Duration {
	delay := time.Duration(float64(config.BaseDelay) * math.Pow(config.BackoffFactor, float64(attempt-1)))
	
	// Cap at max delay
	if delay > config.MaxDelay {
		delay = config.MaxDelay
	}
	
	// Add jitter if enabled
	if config.EnableJitter {
		jitter := time.Duration(rand.Float64() * float64(delay) * 0.1) // 10% jitter
		delay += jitter
	}
	
	return delay
}

// IsHTTPRetryable determines if an HTTP error is retryable based on common patterns
func IsHTTPRetryable(err error) bool {
	if err == nil {
		return false
	}
	
	errStr := err.Error()
	
	// Retry on network-level errors
	networkErrors := []string{
		"connection refused",
		"connection reset",
		"timeout",
		"temporary failure",
		"network unreachable",
		"no route to host",
	}
	
	for _, networkErr := range networkErrors {
		if contains(errStr, networkErr) {
			return true
		}
	}
	
	// Retry on specific HTTP status codes (5xx, 429)
	retryableStatuses := []string{
		"status 500",
		"status 502", 
		"status 503",
		"status 504",
		"status 429", // Rate limited
	}
	
	for _, status := range retryableStatuses {
		if contains(errStr, status) {
			return true
		}
	}
	
	return false
}

// contains checks if string contains substring (case insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || 
		(len(s) > len(substr) && 
			(s[:len(substr)] == substr || 
			 s[len(s)-len(substr):] == substr ||
			 findSubstring(s, substr))))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
