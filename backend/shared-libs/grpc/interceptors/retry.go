package interceptors

import (
	"context"
	"math"
	"math/rand"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RetryConfig holds retry configuration
type RetryConfig struct {
	MaxAttempts       int
	InitialDelay      time.Duration
	MaxDelay          time.Duration
	BackoffMultiplier float64
	JitterEnabled     bool
	RetryableCodes    []codes.Code
}

// DefaultRetryConfig returns default retry configuration
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxAttempts:       3,
		InitialDelay:      100 * time.Millisecond,
		MaxDelay:          30 * time.Second,
		BackoffMultiplier: 2.0,
		JitterEnabled:     true,
		RetryableCodes: []codes.Code{
			codes.Unavailable,
			codes.DeadlineExceeded,
			codes.Aborted,
			codes.Internal,
		},
	}
}

// UnaryClientRetryInterceptor creates a retry interceptor for unary client calls
func UnaryClientRetryInterceptor(maxAttempts int) grpc.UnaryClientInterceptor {
	config := DefaultRetryConfig()
	config.MaxAttempts = maxAttempts
	return UnaryClientRetryInterceptorWithConfig(config)
}

// UnaryClientRetryInterceptorWithConfig creates a retry interceptor with custom config
func UnaryClientRetryInterceptorWithConfig(config *RetryConfig) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		var lastErr error
		
		for attempt := 0; attempt < config.MaxAttempts; attempt++ {
			// Create a new context for each attempt to reset timeouts
			attemptCtx := ctx
			if attempt > 0 {
				// Add delay before retry
				delay := calculateDelay(config, attempt)
				select {
				case <-time.After(delay):
					// Continue with retry
				case <-ctx.Done():
					return ctx.Err()
				}
			}

			// Make the call
			err := invoker(attemptCtx, method, req, reply, cc, opts...)
			if err == nil {
				return nil // Success
			}

			lastErr = err

			// Check if error is retryable
			if !isRetryableError(err, config.RetryableCodes) {
				return err // Non-retryable error
			}

			// Check if context is done
			if attemptCtx.Err() != nil {
				return attemptCtx.Err()
			}
		}

		return lastErr
	}
}

// StreamClientRetryInterceptor creates a retry interceptor for streaming client calls
func StreamClientRetryInterceptor(maxAttempts int) grpc.StreamClientInterceptor {
	config := DefaultRetryConfig()
	config.MaxAttempts = maxAttempts
	return StreamClientRetryInterceptorWithConfig(config)
}

// StreamClientRetryInterceptorWithConfig creates a retry interceptor with custom config
func StreamClientRetryInterceptorWithConfig(config *RetryConfig) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		var lastErr error
		
		for attempt := 0; attempt < config.MaxAttempts; attempt++ {
			if attempt > 0 {
				// Add delay before retry
				delay := calculateDelay(config, attempt)
				select {
				case <-time.After(delay):
					// Continue with retry
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}

			// Attempt to create stream
			stream, err := streamer(ctx, desc, cc, method, opts...)
			if err == nil {
				return stream, nil // Success
			}

			lastErr = err

			// Check if error is retryable
			if !isRetryableError(err, config.RetryableCodes) {
				return nil, err // Non-retryable error
			}

			// Check if context is done
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
		}

		return nil, lastErr
	}
}

// calculateDelay calculates the delay for a retry attempt
func calculateDelay(config *RetryConfig, attempt int) time.Duration {
	if attempt <= 0 {
		return 0
	}

	// Calculate exponential backoff delay
	delay := float64(config.InitialDelay) * math.Pow(config.BackoffMultiplier, float64(attempt-1))
	
	// Apply maximum delay cap
	if delay > float64(config.MaxDelay) {
		delay = float64(config.MaxDelay)
	}

	// Apply jitter if enabled
	if config.JitterEnabled {
		jitter := rand.Float64() * 0.1 * delay // ±10% jitter
		delay += jitter - (0.05 * delay)
	}

	return time.Duration(delay)
}

// isRetryableError checks if an error is retryable based on configuration
func isRetryableError(err error, retryableCodes []codes.Code) bool {
	st, ok := status.FromError(err)
	if !ok {
		return false
	}

	code := st.Code()
	for _, retryableCode := range retryableCodes {
		if code == retryableCode {
			return true
		}
	}

	return false
}

// CircuitBreakerConfig holds circuit breaker configuration
type CircuitBreakerConfig struct {
	MaxFailures     int
	ResetTimeout    time.Duration
	FailureRatio    float64
	MinRequests     int
	OnStateChange   func(from, to CircuitBreakerState)
}

// CircuitBreakerState represents the state of a circuit breaker
type CircuitBreakerState int

const (
	CircuitBreakerClosed CircuitBreakerState = iota
	CircuitBreakerOpen
	CircuitBreakerHalfOpen
)

func (s CircuitBreakerState) String() string {
	switch s {
	case CircuitBreakerClosed:
		return "CLOSED"
	case CircuitBreakerOpen:
		return "OPEN"
	case CircuitBreakerHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	config        *CircuitBreakerConfig
	state         CircuitBreakerState
	failures      int
	requests      int
	lastFailTime  time.Time
	nextRetryTime time.Time
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(config *CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		config: config,
		state:  CircuitBreakerClosed,
	}
}

// Execute executes a function with circuit breaker protection
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	// Check if circuit breaker allows the request
	if !cb.allowRequest() {
		return status.Error(codes.Unavailable, "circuit breaker is open")
	}

	// Execute the function
	err := fn()
	
	// Record the result
	cb.recordResult(err == nil)
	
	return err
}

// allowRequest checks if the circuit breaker allows a request
func (cb *CircuitBreaker) allowRequest() bool {
	now := time.Now()

	switch cb.state {
	case CircuitBreakerClosed:
		return true
	case CircuitBreakerOpen:
		if now.After(cb.nextRetryTime) {
			cb.setState(CircuitBreakerHalfOpen)
			return true
		}
		return false
	case CircuitBreakerHalfOpen:
		return true
	default:
		return false
	}
}

// recordResult records the result of a request
func (cb *CircuitBreaker) recordResult(success bool) {
	cb.requests++

	if success {
		if cb.state == CircuitBreakerHalfOpen {
			cb.setState(CircuitBreakerClosed)
			cb.reset()
		}
	} else {
		cb.failures++
		cb.lastFailTime = time.Now()

		switch cb.state {
		case CircuitBreakerClosed:
			if cb.shouldTrip() {
				cb.setState(CircuitBreakerOpen)
				cb.nextRetryTime = time.Now().Add(cb.config.ResetTimeout)
			}
		case CircuitBreakerHalfOpen:
			cb.setState(CircuitBreakerOpen)
			cb.nextRetryTime = time.Now().Add(cb.config.ResetTimeout)
		}
	}
}

// shouldTrip checks if the circuit breaker should trip to open state
func (cb *CircuitBreaker) shouldTrip() bool {
	if cb.requests < cb.config.MinRequests {
		return false
	}

	failureRatio := float64(cb.failures) / float64(cb.requests)
	return failureRatio >= cb.config.FailureRatio || cb.failures >= cb.config.MaxFailures
}

// setState changes the circuit breaker state
func (cb *CircuitBreaker) setState(newState CircuitBreakerState) {
	if cb.state == newState {
		return
	}

	oldState := cb.state
	cb.state = newState

	if cb.config.OnStateChange != nil {
		cb.config.OnStateChange(oldState, newState)
	}
}

// reset resets the circuit breaker counters
func (cb *CircuitBreaker) reset() {
	cb.failures = 0
	cb.requests = 0
	cb.lastFailTime = time.Time{}
}

// GetState returns the current state of the circuit breaker
func (cb *CircuitBreaker) GetState() CircuitBreakerState {
	return cb.state
}

// GetStats returns circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"state":         cb.state.String(),
		"failures":      cb.failures,
		"requests":      cb.requests,
		"last_fail_time": cb.lastFailTime,
		"next_retry_time": cb.nextRetryTime,
	}
}

// UnaryClientCircuitBreakerInterceptor creates a circuit breaker interceptor for unary calls
func UnaryClientCircuitBreakerInterceptor(cb *CircuitBreaker) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		return cb.Execute(ctx, func() error {
			return invoker(ctx, method, req, reply, cc, opts...)
		})
	}
}

// StreamClientCircuitBreakerInterceptor creates a circuit breaker interceptor for streaming calls
func StreamClientCircuitBreakerInterceptor(cb *CircuitBreaker) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		var stream grpc.ClientStream
		err := cb.Execute(ctx, func() error {
			var err error
			stream, err = streamer(ctx, desc, cc, method, opts...)
			return err
		})
		return stream, err
	}
}