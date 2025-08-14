package chat

import (
	"context"
	"errors"
	"sync"
	"time"
)

// CircuitBreakerState represents the state of the circuit breaker
type CircuitBreakerState int

const (
	// CircuitBreakerClosed allows requests to pass through
	CircuitBreakerClosed CircuitBreakerState = iota
	// CircuitBreakerOpen prevents requests from passing through
	CircuitBreakerOpen
	// CircuitBreakerHalfOpen allows a limited number of test requests
	CircuitBreakerHalfOpen
)

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	mutex         sync.RWMutex
	state         CircuitBreakerState
	failureCount  int
	lastFailTime  time.Time
	successCount  int
	maxFailures   int
	timeout       time.Duration
	onStateChange func(from, to CircuitBreakerState)
}

// CircuitBreakerConfig holds configuration for the circuit breaker
type CircuitBreakerConfig struct {
	MaxFailures   int
	Timeout       time.Duration
	OnStateChange func(from, to CircuitBreakerState)
}

// NewCircuitBreaker creates a new circuit breaker instance
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		state:         CircuitBreakerClosed,
		maxFailures:   config.MaxFailures,
		timeout:       config.Timeout,
		onStateChange: config.OnStateChange,
	}
}

// ErrCircuitBreakerOpen is returned when the circuit breaker is open
var ErrCircuitBreakerOpen = errors.New("circuit breaker is open")

// Execute runs the given function if the circuit breaker allows it
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	// Check if we can execute
	if !cb.canExecute() {
		return ErrCircuitBreakerOpen
	}

	// Execute the function
	err := fn()

	// Record the result
	if err != nil {
		cb.recordFailure()
	} else {
		cb.recordSuccess()
	}

	return err
}

// canExecute determines if the circuit breaker allows execution
func (cb *CircuitBreaker) canExecute() bool {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	now := time.Now()

	switch cb.state {
	case CircuitBreakerClosed:
		return true
	case CircuitBreakerOpen:
		// Check if timeout has passed
		if now.After(cb.lastFailTime.Add(cb.timeout)) {
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

// recordFailure records a failure and potentially changes state
func (cb *CircuitBreaker) recordFailure() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.failureCount++
	cb.lastFailTime = time.Now()

	switch cb.state {
	case CircuitBreakerClosed:
		if cb.failureCount >= cb.maxFailures {
			cb.setState(CircuitBreakerOpen)
		}
	case CircuitBreakerHalfOpen:
		cb.setState(CircuitBreakerOpen)
	}
}

// recordSuccess records a success and potentially changes state
func (cb *CircuitBreaker) recordSuccess() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.successCount++

	switch cb.state {
	case CircuitBreakerHalfOpen:
		// Reset counters and close circuit
		cb.failureCount = 0
		cb.successCount = 0
		cb.setState(CircuitBreakerClosed)
	case CircuitBreakerClosed:
		// Reset failure count on success
		cb.failureCount = 0
	}
}

// setState changes the circuit breaker state and calls the callback
func (cb *CircuitBreaker) setState(newState CircuitBreakerState) {
	if cb.state == newState {
		return
	}

	oldState := cb.state
	cb.state = newState

	if cb.onStateChange != nil {
		// Call callback without holding lock to avoid potential deadlocks
		go cb.onStateChange(oldState, newState)
	}
}

// GetState returns the current state of the circuit breaker
func (cb *CircuitBreaker) GetState() CircuitBreakerState {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()
	return cb.state
}

// GetFailureCount returns the current failure count
func (cb *CircuitBreaker) GetFailureCount() int {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()
	return cb.failureCount
}

// Reset resets the circuit breaker to its initial state
func (cb *CircuitBreaker) Reset() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	oldState := cb.state
	cb.state = CircuitBreakerClosed
	cb.failureCount = 0
	cb.successCount = 0

	if cb.onStateChange != nil && oldState != CircuitBreakerClosed {
		go cb.onStateChange(oldState, CircuitBreakerClosed)
	}
}

// String returns a string representation of the circuit breaker state
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
