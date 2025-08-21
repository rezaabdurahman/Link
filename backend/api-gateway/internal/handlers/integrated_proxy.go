package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/link-app/api-gateway/internal/config"
	"github.com/link-app/api-gateway/internal/loadbalancer"
)

// IntegratedProxyHandler combines legacy features with enhanced load balancing
type IntegratedProxyHandler struct {
	enhancedConfig *config.EnhancedServiceConfig
	jwtValidator   *config.JWTValidator
	jwtConfig      *config.JWTConfig
	httpClient     *http.Client
	metrics        *IntegratedProxyMetrics
}

// IntegratedProxyMetrics combines legacy and enhanced metrics
type IntegratedProxyMetrics struct {
	// Legacy metrics (from Gin middleware)
	// These are handled by existing middleware

	// Enhanced metrics (from load balancing)
	requestsTotal       *prometheus.CounterVec
	requestDuration     *prometheus.HistogramVec
	instancesAvailable  *prometheus.GaugeVec
	circuitBreakerState *prometheus.GaugeVec
	retryAttempts       *prometheus.CounterVec
	loadBalancerErrors  *prometheus.CounterVec
}

// NewIntegratedProxyHandler creates a new integrated proxy handler
func NewIntegratedProxyHandler(enhancedConfig *config.EnhancedServiceConfig, jwtValidator *config.JWTValidator, jwtConfig *config.JWTConfig) *IntegratedProxyHandler {
	return NewIntegratedProxyHandlerWithMetrics(enhancedConfig, jwtValidator, jwtConfig, "integrated_proxy")
}

// NewIntegratedProxyHandlerWithMetrics creates a new integrated proxy handler with custom metric names
func NewIntegratedProxyHandlerWithMetrics(enhancedConfig *config.EnhancedServiceConfig, jwtValidator *config.JWTValidator, jwtConfig *config.JWTConfig, metricPrefix string) *IntegratedProxyHandler {
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 20,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	metrics := &IntegratedProxyMetrics{
		requestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: metricPrefix + "_requests_total",
				Help: "Total number of proxy requests with load balancing",
			},
			[]string{"service", "method", "status", "instance"},
		),
		requestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    metricPrefix + "_request_duration_seconds",
				Help:    "Duration of proxy requests with load balancing",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "method", "status"},
		),
		instancesAvailable: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: metricPrefix + "_instances_available",
				Help: "Number of available service instances",
			},
			[]string{"service"},
		),
		circuitBreakerState: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: metricPrefix + "_circuit_breaker_state",
				Help: "Circuit breaker state (0=closed, 1=open, 2=half-open)",
			},
			[]string{"service", "instance"},
		),
		retryAttempts: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: metricPrefix + "_retry_attempts_total",
				Help: "Total number of retry attempts",
			},
			[]string{"service", "attempt"},
		),
		loadBalancerErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: metricPrefix + "_load_balancer_errors_total",
				Help: "Total number of load balancer errors",
			},
			[]string{"service", "error_type"},
		),
	}

	return &IntegratedProxyHandler{
		enhancedConfig: enhancedConfig,
		jwtValidator:   jwtValidator,
		jwtConfig:      jwtConfig,
		httpClient:     client,
		metrics:        metrics,
	}
}

// ProxyWithLoadBalancing returns a Gin handler that uses load balancing for a specific service
func (h *IntegratedProxyHandler) ProxyWithLoadBalancing(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Get load balancer for service
		lb, err := h.enhancedConfig.GetLoadBalancer(serviceName)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":     "SERVICE_UNAVAILABLE",
				"message":   "Service load balancer not available",
				"code":      "LOAD_BALANCER_ERROR",
				"service":   serviceName,
				"timestamp": time.Now(),
			})
			h.metrics.loadBalancerErrors.WithLabelValues(serviceName, "no_load_balancer").Inc()
			return
		}

		// Update available instances metric
		availableCount := lb.GetAvailableInstanceCount()
		h.metrics.instancesAvailable.WithLabelValues(serviceName).Set(float64(availableCount))

		if availableCount == 0 {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":     "SERVICE_UNAVAILABLE",
				"message":   "No healthy service instances available",
				"code":      "NO_INSTANCES_AVAILABLE",
				"service":   serviceName,
				"timestamp": time.Now(),
			})
			h.metrics.loadBalancerErrors.WithLabelValues(serviceName, "no_instances").Inc()
			return
		}

		// Get retrier for service
		retrier, err := h.enhancedConfig.GetRetrier(serviceName)
		if err != nil {
			// Continue without retry logic if retrier is not available
			retrier = nil
		}

		// Read request body for potential retries
		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, err = io.ReadAll(c.Request.Body)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":     "BAD_REQUEST",
					"message":   "Failed to read request body",
					"code":      "BODY_READ_ERROR",
					"timestamp": time.Now(),
				})
				return
			}
			c.Request.Body.Close()
		}

		// Execute request with retry logic
		var selectedInstance *loadbalancer.ServiceInstance
		var attempts int
		var finalErr error

		executeRequest := func(ctx context.Context) error {
			attempts++

			// Select instance using load balancer
			instance, err := lb.SelectInstance()
			if err != nil {
				h.metrics.loadBalancerErrors.WithLabelValues(serviceName, "selection_failed").Inc()
				return fmt.Errorf("failed to select instance: %w", err)
			}
			selectedInstance = instance

			// Update circuit breaker state metric
			state := lb.GetCircuitBreakerState(instance.ID)
			var stateValue float64
			switch state {
			case loadbalancer.StateClosed:
				stateValue = 0
			case loadbalancer.StateOpen:
				stateValue = 1
			case loadbalancer.StateHalfOpen:
				stateValue = 2
			}
			h.metrics.circuitBreakerState.WithLabelValues(serviceName, instance.ID).Set(stateValue)

			// Build target URL
			targetPath := h.buildTargetPath(c.Request.URL.Path, serviceName)
			targetURL := instance.URL + targetPath
			if c.Request.URL.RawQuery != "" {
				targetURL += "?" + c.Request.URL.RawQuery
			}

			// Create proxy request
			var bodyReader io.Reader
			if len(bodyBytes) > 0 {
				bodyReader = bytes.NewReader(bodyBytes)
			}

			proxyReq, err := http.NewRequestWithContext(ctx, c.Request.Method, targetURL, bodyReader)
			if err != nil {
				return fmt.Errorf("failed to create proxy request: %w", err)
			}

			// Copy headers and add proxy-specific headers
			h.copyHeaders(c.Request.Header, proxyReq.Header)
			h.addProxyHeaders(c, proxyReq)

			// Execute request
			resp, err := h.httpClient.Do(proxyReq)
			if err != nil {
				// Record failure with load balancer
				lb.RecordResult(instance.ID, false, time.Since(start))
				return fmt.Errorf("request failed: %w", err)
			}
			defer resp.Body.Close()

			// Check if response indicates success or failure
			success := resp.StatusCode < 500
			lb.RecordResult(instance.ID, success, time.Since(start))

			if !success {
				return fmt.Errorf("service returned error status: %d", resp.StatusCode)
			}

			// Copy response to Gin context
			h.copyResponse(c, resp)
			return nil
		}

		// Execute with retry logic if available
		if retrier != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
			defer cancel()

			// Convert executeRequest to RetryableFunc format
			retryableFunc := func() (*http.Response, error) {
				err := executeRequest(ctx)
				if err != nil {
					return nil, err
				}
				// Return a dummy successful response since we handle response in executeRequest
				return &http.Response{StatusCode: 200}, nil
			}

			result := retrier.Do(ctx, retryableFunc)
			finalErr = result.Error
			attempts = result.Attempts

			// Record retry attempts
			if attempts > 1 {
				for i := 1; i <= attempts; i++ {
					h.metrics.retryAttempts.WithLabelValues(serviceName, strconv.Itoa(i)).Inc()
				}
			}
		} else {
			// Execute once without retry
			ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
			defer cancel()
			finalErr = executeRequest(ctx)
		}

		// Handle final result
		duration := time.Since(start)

		if finalErr != nil {
			c.JSON(http.StatusBadGateway, gin.H{
				"error":     "BAD_GATEWAY",
				"message":   "Service temporarily unavailable",
				"code":      "SERVICE_ERROR",
				"service":   serviceName,
				"attempts":  attempts,
				"timestamp": time.Now(),
			})
			h.recordMetrics(serviceName, c.Request.Method, "error", "", duration)
			return
		}

		// Record successful metrics
		instanceID := ""
		if selectedInstance != nil {
			instanceID = selectedInstance.ID
		}

		// Add proxy headers to response
		c.Header("X-Proxy-Service", serviceName)
		if selectedInstance != nil {
			c.Header("X-Proxy-Instance", selectedInstance.ID)
		}
		c.Header("X-Proxy-Attempts", strconv.Itoa(attempts))

		h.recordMetrics(serviceName, c.Request.Method, "success", instanceID, duration)
	}
}

// buildTargetPath constructs the target path for the backend service
func (h *IntegratedProxyHandler) buildTargetPath(requestPath, serviceName string) string {
	// Remove service name from the beginning of the path
	targetPath := requestPath

	// Handle different service path patterns
	patterns := []string{
		"/" + serviceName,
		"/" + strings.TrimSuffix(serviceName, "-svc"), // Remove -svc suffix
	}

	for _, pattern := range patterns {
		if strings.HasPrefix(requestPath, pattern) {
			targetPath = strings.TrimPrefix(requestPath, pattern)
			if targetPath == "" {
				targetPath = "/"
			}
			break
		}
	}

	return targetPath
}

// copyHeaders copies HTTP headers, filtering out hop-by-hop headers
func (h *IntegratedProxyHandler) copyHeaders(src, dst http.Header) {
	// Hop-by-hop headers that shouldn't be forwarded
	hopByHopHeaders := map[string]bool{
		"Connection":          true,
		"Keep-Alive":          true,
		"Proxy-Authenticate":  true,
		"Proxy-Authorization": true,
		"Te":                  true,
		"Trailers":            true,
		"Transfer-Encoding":   true,
		"Upgrade":             true,
	}

	for key, values := range src {
		if !hopByHopHeaders[key] {
			for _, value := range values {
				dst.Add(key, value)
			}
		}
	}
}

// addProxyHeaders adds proxy-specific headers (preserves legacy behavior)
func (h *IntegratedProxyHandler) addProxyHeaders(c *gin.Context, proxyReq *http.Request) {
	// Add user context headers (set by auth middleware)
	if userID := c.GetHeader("X-User-ID"); userID != "" {
		proxyReq.Header.Set("X-User-ID", userID)
	}
	if userEmail := c.GetHeader("X-User-Email"); userEmail != "" {
		proxyReq.Header.Set("X-User-Email", userEmail)
	}
	if userName := c.GetHeader("X-User-Name"); userName != "" {
		proxyReq.Header.Set("X-User-Name", userName)
	}

	// Add gateway identification
	proxyReq.Header.Set("X-Gateway-Request", "true")
	proxyReq.Header.Set("X-Forwarded-For", c.ClientIP())
	proxyReq.Header.Set("X-Forwarded-Proto", "http") // or https in production
}

// copyResponse copies HTTP response to Gin context
func (h *IntegratedProxyHandler) copyResponse(c *gin.Context, resp *http.Response) {
	// Copy response headers (except hop-by-hop headers)
	h.copyHeaders(resp.Header, c.Writer.Header())

	// Set the status code
	c.Status(resp.StatusCode)

	// Copy response body
	_, err := io.Copy(c.Writer, resp.Body)
	if err != nil {
		// Log the error, but don't send another response since we've already started
		fmt.Printf("Error copying response body: %v\n", err)
	}
}

// recordMetrics records request metrics
func (h *IntegratedProxyHandler) recordMetrics(service, method, status, instance string, duration time.Duration) {
	h.metrics.requestsTotal.WithLabelValues(service, method, status, instance).Inc()
	h.metrics.requestDuration.WithLabelValues(service, method, status).Observe(duration.Seconds())
}

// EnhancedHealthHandler provides enhanced health check with load balancer status
func (h *IntegratedProxyHandler) EnhancedHealthHandler(c *gin.Context) {
	healthStatus := gin.H{
		"status":         "healthy",
		"gateway":        "integrated",
		"timestamp":      time.Now(),
		"load_balancing": "enabled",
		"services":       gin.H{},
	}

	services := make(gin.H)
	overallHealthy := true

	for serviceName, service := range h.enhancedConfig.Services {
		lb, err := h.enhancedConfig.GetLoadBalancer(serviceName)
		if err != nil {
			services[serviceName] = gin.H{
				"status": "error",
				"error":  err.Error(),
			}
			overallHealthy = false
			continue
		}

		stats := lb.GetStats()
		healthyInstances := stats["healthy_instances"].(int)
		serviceHealth := gin.H{
			"status":              "ok",
			"total_instances":     len(service.Instances),
			"healthy_instances":   healthyInstances,
			"load_balancer_stats": stats,
			"strategy":            stats["strategy"].(string),
		}

		if healthyInstances == 0 {
			serviceHealth["status"] = "unhealthy"
			overallHealthy = false
		}

		services[serviceName] = serviceHealth
	}

	healthStatus["services"] = services

	if !overallHealthy {
		healthStatus["status"] = "degraded"
		c.JSON(http.StatusServiceUnavailable, healthStatus)
	} else {
		c.JSON(http.StatusOK, healthStatus)
	}
}

// RootHandler provides service discovery information
func (h *IntegratedProxyHandler) RootHandler(c *gin.Context) {
	serviceEndpoints := make(gin.H)

	for serviceName := range h.enhancedConfig.Services {
		// Map service names to endpoint paths
		endpoint := "/" + strings.TrimSuffix(serviceName, "-svc") + "/*"
		serviceEndpoints[serviceName] = endpoint
	}

	c.JSON(http.StatusOK, gin.H{
		"service":   "Link API Gateway",
		"version":   "2.0.0",
		"status":    "healthy",
		"type":      "integrated",
		"features":  []string{"load_balancing", "circuit_breakers", "jwt_auth", "rate_limiting", "tracing"},
		"docs":      "https://api.linkapp.com/docs",
		"health":    "/health",
		"metrics":   "/metrics",
		"endpoints": serviceEndpoints,
		"load_balancing": gin.H{
			"enabled":         true,
			"services":        len(h.enhancedConfig.Services),
			"total_instances": h.getTotalInstances(),
		},
	})
}

// getTotalInstances returns total number of service instances
func (h *IntegratedProxyHandler) getTotalInstances() int {
	total := 0
	for _, service := range h.enhancedConfig.Services {
		total += len(service.Instances)
	}
	return total
}

// NotFoundHandler handles undefined routes
func (h *IntegratedProxyHandler) NotFoundHandler(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{
		"error":              "NOT_FOUND",
		"message":            "Endpoint not found",
		"code":               "ENDPOINT_NOT_FOUND",
		"path":               c.Request.URL.Path,
		"method":             c.Request.Method,
		"available_services": h.getAvailableServices(),
		"timestamp":          time.Now(),
	})
}

// getAvailableServices returns list of available services
func (h *IntegratedProxyHandler) getAvailableServices() []string {
	services := make([]string, 0, len(h.enhancedConfig.Services))
	for serviceName := range h.enhancedConfig.Services {
		services = append(services, serviceName)
	}
	return services
}
