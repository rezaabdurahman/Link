package lifecycle

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

// ServiceState represents the current state of the service
type ServiceState int

const (
	StateStarting ServiceState = iota
	StateHealthy
	StateDegraded
	StateShuttingDown
	StateStopped
)

func (s ServiceState) String() string {
	switch s {
	case StateStarting:
		return "starting"
	case StateHealthy:
		return "healthy"
	case StateDegraded:
		return "degraded"
	case StateShuttingDown:
		return "shutting_down"
	case StateStopped:
		return "stopped"
	default:
		return "unknown"
	}
}

// HealthChecker defines interface for service health checks
type HealthChecker interface {
	CheckHealth(ctx context.Context) error
}

// HealthCheckFunc is a function adapter for HealthChecker
type HealthCheckFunc func(ctx context.Context) error

func (f HealthCheckFunc) CheckHealth(ctx context.Context) error {
	return f(ctx)
}

// ServiceManager manages service lifecycle including health checks and graceful shutdown
type ServiceManager struct {
	mu                sync.RWMutex
	state             ServiceState
	startTime         time.Time
	lastHealthCheck   time.Time
	healthCheckers    map[string]HealthChecker
	server            *http.Server
	shutdownTimeout   time.Duration
	healthCheckPeriod time.Duration

	// Channels for lifecycle management
	shutdown     chan struct{}
	healthTicker *time.Ticker

	// Callbacks
	onStateChange func(oldState, newState ServiceState)
	onShutdown    func(ctx context.Context) error
}

// NewServiceManager creates a new service lifecycle manager
func NewServiceManager(server *http.Server) *ServiceManager {
	return &ServiceManager{
		state:             StateStarting,
		startTime:         time.Now(),
		healthCheckers:    make(map[string]HealthChecker),
		server:            server,
		shutdownTimeout:   30 * time.Second,
		healthCheckPeriod: 10 * time.Second,
		shutdown:          make(chan struct{}),
	}
}

// AddHealthChecker adds a health checker for a specific component
func (sm *ServiceManager) AddHealthChecker(name string, checker HealthChecker) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.healthCheckers[name] = checker
}

// RemoveHealthChecker removes a health checker
func (sm *ServiceManager) RemoveHealthChecker(name string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.healthCheckers, name)
}

// SetShutdownTimeout sets the graceful shutdown timeout
func (sm *ServiceManager) SetShutdownTimeout(timeout time.Duration) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.shutdownTimeout = timeout
}

// SetHealthCheckPeriod sets the health check interval
func (sm *ServiceManager) SetHealthCheckPeriod(period time.Duration) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.healthCheckPeriod = period
}

// OnStateChange sets a callback for state changes
func (sm *ServiceManager) OnStateChange(callback func(oldState, newState ServiceState)) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.onStateChange = callback
}

// OnShutdown sets a callback for shutdown preparation
func (sm *ServiceManager) OnShutdown(callback func(ctx context.Context) error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.onShutdown = callback
}

// GetState returns the current service state
func (sm *ServiceManager) GetState() ServiceState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.state
}

// GetHealthStatus returns detailed health status
func (sm *ServiceManager) GetHealthStatus(ctx context.Context) map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	status := map[string]interface{}{
		"state":             sm.state.String(),
		"uptime":            time.Since(sm.startTime).String(),
		"last_health_check": sm.lastHealthCheck.Format(time.RFC3339),
		"health_checks":     make(map[string]interface{}),
	}

	// Run health checks
	healthChecks := make(map[string]interface{})
	overallHealthy := true

	for name, checker := range sm.healthCheckers {
		checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := checker.CheckHealth(checkCtx)
		cancel()

		if err != nil {
			healthChecks[name] = map[string]interface{}{
				"status": "unhealthy",
				"error":  err.Error(),
			}
			overallHealthy = false
		} else {
			healthChecks[name] = map[string]interface{}{
				"status": "healthy",
			}
		}
	}

	status["health_checks"] = healthChecks
	status["overall_healthy"] = overallHealthy

	return status
}

// setState changes the service state and triggers callbacks
func (sm *ServiceManager) setState(newState ServiceState) {
	sm.mu.Lock()
	oldState := sm.state
	sm.state = newState
	callback := sm.onStateChange
	sm.mu.Unlock()

	if callback != nil && oldState != newState {
		callback(oldState, newState)
		log.Printf("Service state changed: %s -> %s", oldState.String(), newState.String())
	}
}

// Start begins the service lifecycle management
func (sm *ServiceManager) Start(ctx context.Context) error {
	// Start health check ticker
	sm.healthTicker = time.NewTicker(sm.healthCheckPeriod)

	// Start health checking goroutine
	go sm.healthCheckLoop(ctx)

	// Set up signal handling for graceful shutdown
	go sm.handleShutdownSignals()

	// Mark as healthy after successful start
	sm.setState(StateHealthy)

	log.Printf("Service lifecycle manager started - State: %s", sm.GetState().String())
	return nil
}

// healthCheckLoop runs periodic health checks
func (sm *ServiceManager) healthCheckLoop(ctx context.Context) {
	for {
		select {
		case <-sm.healthTicker.C:
			sm.performHealthCheck(ctx)
		case <-sm.shutdown:
			return
		case <-ctx.Done():
			return
		}
	}
}

// performHealthCheck runs all health checkers and updates state
func (sm *ServiceManager) performHealthCheck(ctx context.Context) {
	sm.mu.Lock()
	sm.lastHealthCheck = time.Now()
	checkers := make(map[string]HealthChecker)
	for name, checker := range sm.healthCheckers {
		checkers[name] = checker
	}
	currentState := sm.state
	sm.mu.Unlock()

	if currentState == StateShuttingDown || currentState == StateStopped {
		return
	}

	overallHealthy := true
	for name, checker := range checkers {
		checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := checker.CheckHealth(checkCtx)
		cancel()

		if err != nil {
			log.Printf("Health check failed for %s: %v", name, err)
			overallHealthy = false
		}
	}

	// Update state based on health checks
	if currentState == StateHealthy && !overallHealthy {
		sm.setState(StateDegraded)
	} else if currentState == StateDegraded && overallHealthy {
		sm.setState(StateHealthy)
	}
}

// handleShutdownSignals sets up graceful shutdown on OS signals
func (sm *ServiceManager) handleShutdownSignals() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	log.Println("Shutdown signal received, starting graceful shutdown...")

	if err := sm.Shutdown(context.Background()); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}

// Shutdown performs graceful service shutdown
func (sm *ServiceManager) Shutdown(ctx context.Context) error {
	sm.setState(StateShuttingDown)

	// Stop health checks
	close(sm.shutdown)
	if sm.healthTicker != nil {
		sm.healthTicker.Stop()
	}

	// Execute shutdown callback if provided
	if sm.onShutdown != nil {
		if err := sm.onShutdown(ctx); err != nil {
			log.Printf("Shutdown callback error: %v", err)
		}
	}

	// Create shutdown context with timeout
	shutdownCtx, cancel := context.WithTimeout(ctx, sm.shutdownTimeout)
	defer cancel()

	// Shutdown HTTP server gracefully
	if sm.server != nil {
		log.Println("Shutting down HTTP server...")
		if err := sm.server.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP server shutdown error: %v", err)
			return err
		}
	}

	sm.setState(StateStopped)
	log.Println("Graceful shutdown completed")
	return nil
}

// IsHealthy returns true if the service is in a healthy state
func (sm *ServiceManager) IsHealthy() bool {
	state := sm.GetState()
	return state == StateHealthy
}

// IsReady returns true if the service is ready to handle requests
func (sm *ServiceManager) IsReady() bool {
	state := sm.GetState()
	return state == StateHealthy || state == StateDegraded
}

// CreateHealthHandler creates a Gin handler for health checks
func (sm *ServiceManager) CreateHealthHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()

		healthStatus := sm.GetHealthStatus(ctx)

		// Determine HTTP status based on service state
		var httpStatus int
		state := sm.GetState()
		switch state {
		case StateHealthy:
			httpStatus = http.StatusOK
		case StateDegraded:
			httpStatus = http.StatusServiceUnavailable
		case StateStarting:
			httpStatus = http.StatusServiceUnavailable
		case StateShuttingDown, StateStopped:
			httpStatus = http.StatusServiceUnavailable
		default:
			httpStatus = http.StatusServiceUnavailable
		}

		c.JSON(httpStatus, healthStatus)
	}
}

// CreateReadinessHandler creates a Gin handler for readiness checks
func (sm *ServiceManager) CreateReadinessHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if sm.IsReady() {
			c.JSON(http.StatusOK, gin.H{
				"ready": true,
				"state": sm.GetState().String(),
			})
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"ready": false,
				"state": sm.GetState().String(),
			})
		}
	}
}

// CreateLivenessHandler creates a Gin handler for liveness checks
func (sm *ServiceManager) CreateLivenessHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		state := sm.GetState()
		if state != StateStopped {
			c.JSON(http.StatusOK, gin.H{
				"alive": true,
				"state": state.String(),
			})
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"alive": false,
				"state": state.String(),
			})
		}
	}
}
