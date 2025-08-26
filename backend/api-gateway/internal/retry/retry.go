package retry

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

type RetryConfig struct {
	MaxRetries int
	BaseDelay  time.Duration
	MaxDelay   time.Duration
	Jitter     bool
}

type Retrier struct {
	config      *RetryConfig
	attempts    int64
	successes   int64
	failures    int64
	totalDelay  int64
	mutex       sync.RWMutex
}

type RetryableFunc func(ctx context.Context) error

func NewRetrier(config *RetryConfig) *Retrier {
	return &Retrier{
		config: config,
	}
}

func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries: 3,
		BaseDelay:  100 * time.Millisecond,
		MaxDelay:   5 * time.Second,
		Jitter:     true,
	}
}

func AggressiveRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries: 5,
		BaseDelay:  50 * time.Millisecond,
		MaxDelay:   2 * time.Second,
		Jitter:     true,
	}
}

func ConservativeRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries: 2,
		BaseDelay:  500 * time.Millisecond,
		MaxDelay:   10 * time.Second,
		Jitter:     true,
	}
}

func (r *Retrier) Execute(ctx context.Context, fn RetryableFunc) error {
	atomic.AddInt64(&r.attempts, 1)
	
	var lastErr error
	
	for attempt := 0; attempt <= r.config.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := r.calculateDelay(attempt)
			
			select {
			case <-ctx.Done():
				atomic.AddInt64(&r.failures, 1)
				return fmt.Errorf("context cancelled during retry: %w", ctx.Err())
			case <-time.After(delay):
				atomic.AddInt64(&r.totalDelay, int64(delay))
			}
		}
		
		if err := fn(ctx); err != nil {
			lastErr = err
			
			// Check if error is retryable
			if !r.isRetryableError(err) {
				atomic.AddInt64(&r.failures, 1)
				return fmt.Errorf("non-retryable error: %w", err)
			}
			
			if attempt == r.config.MaxRetries {
				atomic.AddInt64(&r.failures, 1)
				return fmt.Errorf("max retries exceeded: %w", err)
			}
			
			continue
		}
		
		atomic.AddInt64(&r.successes, 1)
		return nil
	}
	
	atomic.AddInt64(&r.failures, 1)
	return fmt.Errorf("retry failed: %w", lastErr)
}

func (r *Retrier) calculateDelay(attempt int) time.Duration {
	delay := r.config.BaseDelay
	
	// Exponential backoff
	for i := 1; i < attempt; i++ {
		delay *= 2
		if delay > r.config.MaxDelay {
			delay = r.config.MaxDelay
			break
		}
	}
	
	// Add jitter if enabled
	if r.config.Jitter && delay > 0 {
		jitter := time.Duration(rand.Int63n(int64(delay / 2)))
		delay = delay + jitter
	}
	
	return delay
}

func (r *Retrier) isRetryableError(err error) bool {
	// Simple implementation - in practice, you'd check for specific error types
	// like network timeouts, 5xx HTTP responses, etc.
	return err != nil
}

func (r *Retrier) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"attempts":     atomic.LoadInt64(&r.attempts),
		"successes":    atomic.LoadInt64(&r.successes),
		"failures":     atomic.LoadInt64(&r.failures),
		"total_delay":  atomic.LoadInt64(&r.totalDelay),
		"max_retries":  r.config.MaxRetries,
	}
}

func (r *Retrier) Reset() {
	atomic.StoreInt64(&r.attempts, 0)
	atomic.StoreInt64(&r.successes, 0)
	atomic.StoreInt64(&r.failures, 0)
	atomic.StoreInt64(&r.totalDelay, 0)
}