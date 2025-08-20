package retry

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"time"
)

// RetryConfig holds configuration for retry behavior
type RetryConfig struct {
	MaxRetries      int           // Maximum number of retry attempts
	BaseDelay       time.Duration // Base delay for exponential backoff
	MaxDelay        time.Duration // Maximum delay between retries
	Jitter          bool          // Whether to add random jitter
	RetryableErrors []int         // HTTP status codes that should trigger retries
}

// RetryStats holds statistics about retry attempts
type RetryStats struct {
	TotalRequests    int64
	TotalRetries     int64
	SuccessfulRetries int64
	FailedRetries    int64
	AverageRetryTime time.Duration
}

// RetryResult holds the result of a retry operation
type RetryResult struct {
	Response     *http.Response
	Error        error
	Attempts     int
	TotalTime    time.Duration
	WasRetried   bool
	LastAttemptError error
}

// RetryableFunc is a function that can be retried
type RetryableFunc func() (*http.Response, error)

// DefaultRetryConfig returns a default retry configuration
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:  3,
		BaseDelay:   100 * time.Millisecond,
		MaxDelay:    5 * time.Second,
		Jitter:      true,
		RetryableErrors: []int{
			http.StatusInternalServerError,     // 500
			http.StatusBadGateway,              // 502
			http.StatusServiceUnavailable,      // 503
			http.StatusGatewayTimeout,          // 504
		},
	}
}

// AggressiveRetryConfig returns a more aggressive retry configuration
func AggressiveRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:  5,
		BaseDelay:   50 * time.Millisecond,
		MaxDelay:    10 * time.Second,
		Jitter:      true,
		RetryableErrors: []int{
			http.StatusTooManyRequests,         // 429
			http.StatusInternalServerError,     // 500
			http.StatusBadGateway,              // 502
			http.StatusServiceUnavailable,      // 503
			http.StatusGatewayTimeout,          // 504
		},
	}
}

// ConservativeRetryConfig returns a conservative retry configuration
func ConservativeRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:  2,
		BaseDelay:   200 * time.Millisecond,
		MaxDelay:    3 * time.Second,
		Jitter:      false,
		RetryableErrors: []int{
			http.StatusBadGateway,              // 502
			http.StatusServiceUnavailable,      // 503
			http.StatusGatewayTimeout,          // 504
		},
	}
}

// Retrier handles retry logic with exponential backoff
type Retrier struct {
	config *RetryConfig
	stats  *RetryStats
}

// NewRetrier creates a new retrier with the given configuration
func NewRetrier(config *RetryConfig) *Retrier {
	if config == nil {
		config = DefaultRetryConfig()
	}
	
	return &Retrier{
		config: config,
		stats:  &RetryStats{},
	}
}

// Do executes a function with retry logic
func (r *Retrier) Do(ctx context.Context, fn RetryableFunc) *RetryResult {
	return r.DoWithCallback(ctx, fn, nil)
}

// DoWithCallback executes a function with retry logic and calls the callback on each attempt
func (r *Retrier) DoWithCallback(ctx context.Context, fn RetryableFunc, callback func(attempt int, err error)) *RetryResult {
	startTime := time.Now()
	
	result := &RetryResult{
		Attempts:    0,
		WasRetried:  false,
	}
	
	r.stats.TotalRequests++
	
	for attempt := 0; attempt <= r.config.MaxRetries; attempt++ {
		result.Attempts = attempt + 1
		
		// Check context cancellation
		select {
		case <-ctx.Done():
			result.Error = ctx.Err()
			result.TotalTime = time.Since(startTime)
			return result
		default:
		}
		
		// Execute the function
		resp, err := fn()
		result.LastAttemptError = err
		
		// Call callback if provided
		if callback != nil {
			callback(attempt+1, err)
		}
		
		// Check if the request was successful
		if err == nil && (resp == nil || !r.isRetryableStatusCode(resp.StatusCode)) {
			result.Response = resp
			result.TotalTime = time.Since(startTime)
			
			if attempt > 0 {
				result.WasRetried = true
				r.stats.SuccessfulRetries++
			}
			
			return result
		}
		
		// If this was the last attempt, return the error
		if attempt == r.config.MaxRetries {
			result.Error = err
			result.TotalTime = time.Since(startTime)
			r.stats.FailedRetries++
			return result
		}
		
		// This is a retry attempt
		if attempt > 0 {
			r.stats.TotalRetries++
		}
		result.WasRetried = true
		
		// Calculate delay for next attempt
		delay := r.calculateDelay(attempt)
		
		// Wait for the delay or context cancellation
		timer := time.NewTimer(delay)
		select {
		case <-timer.C:
			// Continue to next attempt
		case <-ctx.Done():
			timer.Stop()
			result.Error = ctx.Err()
			result.TotalTime = time.Since(startTime)
			return result
		}
	}
	
	// This should never be reached, but just in case
	result.Error = fmt.Errorf("unexpected end of retry loop")
	result.TotalTime = time.Since(startTime)
	return result
}

// calculateDelay calculates the delay for the next retry attempt using exponential backoff
func (r *Retrier) calculateDelay(attempt int) time.Duration {
	// Exponential backoff: delay = baseDelay * 2^attempt
	delay := time.Duration(float64(r.config.BaseDelay) * math.Pow(2, float64(attempt)))
	
	// Apply maximum delay limit
	if delay > r.config.MaxDelay {
		delay = r.config.MaxDelay
	}
	
	// Add jitter if enabled
	if r.config.Jitter {
		jitter := time.Duration(rand.Float64() * float64(delay) * 0.1) // 10% jitter
		delay += jitter
	}
	
	return delay
}

// isRetryableStatusCode checks if an HTTP status code should trigger a retry
func (r *Retrier) isRetryableStatusCode(statusCode int) bool {
	for _, retryableCode := range r.config.RetryableErrors {
		if statusCode == retryableCode {
			return true
		}
	}
	return false
}

// IsRetryableError determines if an error should trigger a retry
func (r *Retrier) IsRetryableError(err error) bool {
	if err == nil {
		return false
	}
	
	// Check for timeout errors
	if urlErr, ok := err.(*url.Error); ok {
		if urlErr.Timeout() {
			return true
		}
		if urlErr.Temporary() {
			return true
		}
	}
	
	// Check for context cancellation (should not retry)
	if err == context.Canceled || err == context.DeadlineExceeded {
		return false
	}
	
	// By default, retry on network-level errors
	return true
}

// GetStats returns retry statistics
func (r *Retrier) GetStats() RetryStats {
	return *r.stats
}

// ResetStats resets retry statistics
func (r *Retrier) ResetStats() {
	r.stats = &RetryStats{}
}

// UpdateConfig updates the retry configuration
func (r *Retrier) UpdateConfig(config *RetryConfig) {
	if config != nil {
		r.config = config
	}
}

// GetConfig returns the current retry configuration
func (r *Retrier) GetConfig() *RetryConfig {
	// Return a copy to prevent external modification
	configCopy := *r.config
	configCopy.RetryableErrors = make([]int, len(r.config.RetryableErrors))
	copy(configCopy.RetryableErrors, r.config.RetryableErrors)
	return &configCopy
}

// RetryHTTPRequest is a helper function to retry HTTP requests
func RetryHTTPRequest(ctx context.Context, client *http.Client, req *http.Request, config *RetryConfig) *RetryResult {
	retrier := NewRetrier(config)
	
	return retrier.Do(ctx, func() (*http.Response, error) {
		// Clone the request for each attempt
		reqClone := req.Clone(ctx)
		return client.Do(reqClone)
	})
}
