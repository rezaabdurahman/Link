package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/link-app/api-gateway/internal/config"
	"github.com/link-app/api-gateway/internal/loadbalancer"
)

// Enhanced proxy handler with load balancing and resilience patterns
type EnhancedProxyHandler struct {
	serviceConfig *config.EnhancedServiceConfig
	client        *http.Client
	metrics       *ProxyMetrics
}

// ProxyMetrics holds Prometheus metrics for the proxy
type ProxyMetrics struct {
	requestsTotal       *prometheus.CounterVec
	requestDuration     *prometheus.HistogramVec
	instancesAvailable  *prometheus.GaugeVec
	circuitBreakerState *prometheus.GaugeVec
	retryAttempts       *prometheus.CounterVec
	loadBalancerErrors  *prometheus.CounterVec
}

// NewEnhancedProxyHandler creates a new enhanced proxy handler
func NewEnhancedProxyHandler(serviceConfig *config.EnhancedServiceConfig) *EnhancedProxyHandler {
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 20,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	metrics := &ProxyMetrics{
		requestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "proxy_requests_total",
				Help: "Total number of proxy requests",
			},
			[]string{"service", "method", "status", "instance"},
		),
		requestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "proxy_request_duration_seconds",
				Help:    "Duration of proxy requests",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "method", "status"},
		),
		instancesAvailable: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "proxy_instances_available",
				Help: "Number of available service instances",
			},
			[]string{"service"},
		),
		circuitBreakerState: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "proxy_circuit_breaker_state",
				Help: "Circuit breaker state (0=closed, 1=open, 2=half-open)",
			},
			[]string{"service", "instance"},
		),
		retryAttempts: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "proxy_retry_attempts_total",
				Help: "Total number of retry attempts",
			},
			[]string{"service", "attempt"},
		),
		loadBalancerErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "proxy_load_balancer_errors_total",
				Help: "Total number of load balancer errors",
			},
			[]string{"service", "error_type"},
		),
	}

	return &EnhancedProxyHandler{
		serviceConfig: serviceConfig,
		client:        client,
		metrics:       metrics,
	}
}

// ServeHTTP handles incoming requests with load balancing and resilience
func (h *EnhancedProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	
	// Extract service name from path
	serviceName := h.extractServiceName(r.URL.Path)
	if serviceName == "" {
		h.writeErrorResponse(w, http.StatusNotFound, "Service not found")
		return
	}

	// Get load balancer for service
	lb, err := h.serviceConfig.GetLoadBalancer(serviceName)
	if err != nil {
		log.Printf("Error getting load balancer for service %s: %v", serviceName, err)
		h.metrics.loadBalancerErrors.WithLabelValues(serviceName, "no_load_balancer").Inc()
		h.writeErrorResponse(w, http.StatusServiceUnavailable, "Service unavailable")
		return
	}

	// Update available instances metric
	availableCount := lb.GetAvailableInstanceCount()
	h.metrics.instancesAvailable.WithLabelValues(serviceName).Set(float64(availableCount))

	if availableCount == 0 {
		log.Printf("No available instances for service %s", serviceName)
		h.metrics.loadBalancerErrors.WithLabelValues(serviceName, "no_instances").Inc()
		h.writeErrorResponse(w, http.StatusServiceUnavailable, "No healthy instances available")
		return
	}

	// Get retrier for service
	retrier, err := h.serviceConfig.GetRetrier(serviceName)
	if err != nil {
		log.Printf("Error getting retrier for service %s: %v", serviceName, err)
		// Continue without retry logic
		retrier = nil
	}

	// Read request body for potential retries
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, err = io.ReadAll(r.Body)
		if err != nil {
			log.Printf("Error reading request body: %v", err)
			h.writeErrorResponse(w, http.StatusBadRequest, "Error reading request")
			return
		}
		r.Body.Close()
	}

	// Execute request with retry logic
	var resp *http.Response
	var finalErr error
	var selectedInstance *loadbalancer.ServiceInstance
	var attempts int

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

		// Create new request for this attempt
		targetURL, err := h.buildTargetURL(instance.URL, r.URL.Path, serviceName)
		if err != nil {
			return fmt.Errorf("failed to build target URL: %w", err)
		}

		proxyReq, err := h.createProxyRequest(r, targetURL, bodyBytes)
		if err != nil {
			return fmt.Errorf("failed to create proxy request: %w", err)
		}

		// Execute request
		resp, err = h.client.Do(proxyReq.WithContext(ctx))
		if err != nil {
			// Record failure with load balancer
			lb.RecordResult(instance.ID, false, time.Since(start))
			return fmt.Errorf("request failed: %w", err)
		}

		// Check if response indicates success or failure
		success := resp.StatusCode < 500
		lb.RecordResult(instance.ID, success, time.Since(start))

		if !success {
			resp.Body.Close()
			return fmt.Errorf("service returned error status: %d", resp.StatusCode)
		}

		return nil
	}

	// Execute with retry logic if available
	if retrier != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
		defer cancel()

		// Convert executeRequest to RetryableFunc format
		retryableFunc := func() (*http.Response, error) {
			err := executeRequest(ctx)
			if err != nil {
				return nil, err
			}
			// Return the actual response if successful
			return resp, nil
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
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		finalErr = executeRequest(ctx)
	}

	// Handle final result
	duration := time.Since(start)
	
	if finalErr != nil {
		log.Printf("Failed to proxy request to %s after %d attempts: %v", serviceName, attempts, finalErr)
		h.recordMetrics(serviceName, r.Method, "error", "", duration)
		h.writeErrorResponse(w, http.StatusBadGateway, "Service temporarily unavailable")
		return
	}

	if resp == nil {
		log.Printf("No response received for service %s", serviceName)
		h.recordMetrics(serviceName, r.Method, "error", "", duration)
		h.writeErrorResponse(w, http.StatusBadGateway, "No response from service")
		return
	}

	defer resp.Body.Close()

	// Record successful metrics
	instanceID := ""
	if selectedInstance != nil {
		instanceID = selectedInstance.ID
	}
	h.recordMetrics(serviceName, r.Method, strconv.Itoa(resp.StatusCode), instanceID, duration)

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Add proxy headers
	w.Header().Set("X-Proxy-Service", serviceName)
	if selectedInstance != nil {
		w.Header().Set("X-Proxy-Instance", selectedInstance.ID)
	}
	w.Header().Set("X-Proxy-Attempts", strconv.Itoa(attempts))

	// Write status code and body
	w.WriteHeader(resp.StatusCode)
	_, copyErr := io.Copy(w, resp.Body)
	if copyErr != nil {
		log.Printf("Error copying response body: %v", copyErr)
	}
}

// extractServiceName extracts service name from request path
func (h *EnhancedProxyHandler) extractServiceName(path string) string {
	// Remove leading slash and extract first path segment
	trimmed := strings.TrimPrefix(path, "/")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) == 0 {
		return ""
	}
	
	serviceName := parts[0]
	
	// Validate service exists in configuration
	if _, err := h.serviceConfig.GetLoadBalancer(serviceName); err != nil {
		return ""
	}
	
	return serviceName
}

// buildTargetURL constructs the target URL for the backend service
func (h *EnhancedProxyHandler) buildTargetURL(instanceURL, requestPath, serviceName string) (*url.URL, error) {
	baseURL, err := url.Parse(instanceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid instance URL: %w", err)
	}

	// Remove service name from the beginning of the path
	targetPath := requestPath
	if strings.HasPrefix(requestPath, "/"+serviceName) {
		targetPath = strings.TrimPrefix(requestPath, "/"+serviceName)
		if targetPath == "" {
			targetPath = "/"
		}
	}

	targetURL := *baseURL
	targetURL.Path = strings.TrimSuffix(targetURL.Path, "/") + targetPath

	return &targetURL, nil
}

// createProxyRequest creates a new HTTP request for proxying
func (h *EnhancedProxyHandler) createProxyRequest(originalReq *http.Request, targetURL *url.URL, body []byte) (*http.Request, error) {
	var bodyReader io.Reader
	if len(body) > 0 {
		bodyReader = bytes.NewReader(body)
	}

	proxyReq, err := http.NewRequest(originalReq.Method, targetURL.String(), bodyReader)
	if err != nil {
		return nil, err
	}

	// Copy headers (excluding hop-by-hop headers)
	for key, values := range originalReq.Header {
		// Skip hop-by-hop headers
		if h.isHopByHopHeader(key) {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// Add/modify proxy-specific headers
	proxyReq.Header.Set("X-Forwarded-For", h.getClientIP(originalReq))
	proxyReq.Header.Set("X-Forwarded-Proto", h.getScheme(originalReq))
	proxyReq.Header.Set("X-Forwarded-Host", originalReq.Host)

	return proxyReq, nil
}

// isHopByHopHeader checks if a header is hop-by-hop
func (h *EnhancedProxyHandler) isHopByHopHeader(header string) bool {
	hopByHopHeaders := []string{
		"Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization",
		"Te", "Trailers", "Transfer-Encoding", "Upgrade",
	}
	
	header = strings.ToLower(header)
	for _, hopHeader := range hopByHopHeaders {
		if strings.ToLower(hopHeader) == header {
			return true
		}
	}
	return false
}

// getClientIP extracts client IP from request
func (h *EnhancedProxyHandler) getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	
	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to RemoteAddr
	if ip := r.RemoteAddr; ip != "" {
		// Remove port if present
		if idx := strings.LastIndex(ip, ":"); idx != -1 {
			return ip[:idx]
		}
		return ip
	}
	
	return "unknown"
}

// getScheme determines the request scheme
func (h *EnhancedProxyHandler) getScheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	
	if scheme := r.Header.Get("X-Forwarded-Proto"); scheme != "" {
		return scheme
	}
	
	return "http"
}

// recordMetrics records request metrics
func (h *EnhancedProxyHandler) recordMetrics(service, method, status, instance string, duration time.Duration) {
	h.metrics.requestsTotal.WithLabelValues(service, method, status, instance).Inc()
	h.metrics.requestDuration.WithLabelValues(service, method, status).Observe(duration.Seconds())
}

// writeErrorResponse writes an error response
func (h *EnhancedProxyHandler) writeErrorResponse(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	fmt.Fprintf(w, `{"error": "%s", "status": %d}`, message, statusCode)
}

// HealthCheck returns the health status of all services
func (h *EnhancedProxyHandler) HealthCheck() map[string]interface{} {
	serviceStats := make(map[string]interface{})
	
	for serviceName, service := range h.serviceConfig.Services {
		lb, err := h.serviceConfig.GetLoadBalancer(serviceName)
		if err != nil {
			serviceStats[serviceName] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
			continue
		}
		
		stats := lb.GetStats()
		healthyInstances := stats["healthy_instances"].(int)
		serviceStats[serviceName] = map[string]interface{}{
			"status":            "ok",
			"total_instances":   len(service.Instances),
			"healthy_instances": healthyInstances,
			"load_balancer_stats": stats,
			"strategy":          stats["strategy"].(string),
		}
	}
	
	return map[string]interface{}{
		"status":   "ok",
		"services": serviceStats,
	}
}
