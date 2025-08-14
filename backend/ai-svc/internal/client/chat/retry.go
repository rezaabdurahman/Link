package chat

import (
	"context"
	"math"
	"math/rand"
	"time"
)

// RetryConfig holds configuration for the retry mechanism
type RetryConfig struct {
	MaxRetries         int
	InitialDelay       time.Duration
	BackoffMultiplier  float64
	MaxDelay           time.Duration
	Jitter             bool
	RetryableErrors    func(error) bool
}

// DefaultRetryableErrors defines which errors should trigger a retry
func DefaultRetryableErrors(err error) bool {
	if err == nil {
		return false
	}

	// Retry on circuit breaker open errors
	if err == ErrCircuitBreakerOpen {
		return false // Don't retry circuit breaker errors
	}

	// Add more specific error type checking here
	// For now, retry on any error except circuit breaker
	return true
}

// Retryer implements retry logic with exponential backoff
type Retryer struct {
	config RetryConfig
	rand   *rand.Rand
}

// NewRetryer creates a new retryer with the given configuration
func NewRetryer(config RetryConfig) *Retryer {
	if config.RetryableErrors == nil {
		config.RetryableErrors = DefaultRetryableErrors
	}
	if config.MaxDelay == 0 {
		config.MaxDelay = 30 * time.Second
	}

	return &Retryer{
		config: config,
		rand:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Execute executes the given function with retry logic
func (r *Retryer) Execute(ctx context.Context, fn func() error) error {
	var lastErr error

	for attempt := 0; attempt <= r.config.MaxRetries; attempt++ {
		// Check context cancellation
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Execute the function
		err := fn()
		if err == nil {
			return nil // Success
		}

		lastErr = err

		// Check if we should retry this error
		if !r.config.RetryableErrors(err) {
			return err
		}

		// Don't sleep after the last attempt
		if attempt == r.config.MaxRetries {
			break
		}

		// Calculate delay for next attempt
		delay := r.calculateDelay(attempt)

		// Wait before retrying
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	return lastErr
}

// calculateDelay calculates the delay for the given attempt with exponential backoff
func (r *Retryer) calculateDelay(attempt int) time.Duration {
	// Calculate exponential backoff
	backoff := float64(r.config.InitialDelay) * math.Pow(r.config.BackoffMultiplier, float64(attempt))
	delay := time.Duration(backoff)

	// Apply maximum delay limit
	if delay > r.config.MaxDelay {
		delay = r.config.MaxDelay
	}

	// Apply jitter if enabled
	if r.config.Jitter {
		jitter := time.Duration(r.rand.Int63n(int64(delay)))
		delay = delay/2 + jitter
	}

	return delay
}

// GetNextDelay returns the delay that would be used for the given attempt
func (r *Retryer) GetNextDelay(attempt int) time.Duration {
	return r.calculateDelay(attempt)
}
