package metrics

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ServiceMetrics holds all Prometheus metrics for a service
type ServiceMetrics struct {
	// HTTP request duration histogram
	httpRequestDuration *prometheus.HistogramVec

	// HTTP request counter
	httpRequestsTotal *prometheus.CounterVec

	// Current active requests gauge
	activeRequests *prometheus.GaugeVec

	// Request size histogram
	httpRequestSizeBytes *prometheus.HistogramVec

	// Response size histogram
	httpResponseSizeBytes *prometheus.HistogramVec

	// Service health status
	serviceHealthStatus prometheus.Gauge

	serviceName string
}

// NewServiceMetrics creates a new ServiceMetrics instance for a service
func NewServiceMetrics(serviceName string) *ServiceMetrics {
	namespace := strings.ReplaceAll(serviceName, "-", "_")
	
	return &ServiceMetrics{
		httpRequestDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "http_request_duration_seconds",
			Help:      "Duration of HTTP requests in seconds",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
		}, []string{"method", "path", "status_code"}),

		httpRequestsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests",
		}, []string{"method", "path", "status_code"}),

		activeRequests: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "http_requests_active",
			Help:      "Number of active HTTP requests",
		}, []string{"method", "path"}),

		httpRequestSizeBytes: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "http_request_size_bytes",
			Help:      "Size of HTTP requests in bytes",
			Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
		}, []string{"method", "path"}),

		httpResponseSizeBytes: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "http_response_size_bytes",
			Help:      "Size of HTTP responses in bytes",
			Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
		}, []string{"method", "path"}),

		serviceHealthStatus: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "service_health_status",
			Help:      "Health status of the service (1=healthy, 0=unhealthy)",
		}),

		serviceName: serviceName,
	}
}

// GinMiddleware creates a Gin middleware that collects Prometheus metrics
func (sm *ServiceMetrics) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip metrics for the /metrics endpoint itself
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Normalize path to avoid high cardinality
		normalizedPath := sm.normalizePath(path)

		// Track active requests
		sm.activeRequests.WithLabelValues(method, normalizedPath).Inc()
		defer sm.activeRequests.WithLabelValues(method, normalizedPath).Dec()

		// Track request size
		if c.Request.ContentLength > 0 {
			sm.httpRequestSizeBytes.WithLabelValues(method, normalizedPath).Observe(float64(c.Request.ContentLength))
		}

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Seconds()
		statusCode := strconv.Itoa(c.Writer.Status())

		// Record metrics
		sm.httpRequestDuration.WithLabelValues(method, normalizedPath, statusCode).Observe(duration)
		sm.httpRequestsTotal.WithLabelValues(method, normalizedPath, statusCode).Inc()

		// Track response size
		responseSize := c.Writer.Size()
		if responseSize > 0 {
			sm.httpResponseSizeBytes.WithLabelValues(method, normalizedPath).Observe(float64(responseSize))
		}
	}
}

// SetHealthy updates the health status of the service
func (sm *ServiceMetrics) SetHealthy(healthy bool) {
	value := 0.0
	if healthy {
		value = 1.0
	}
	sm.serviceHealthStatus.Set(value)
}

// normalizePath replaces UUIDs and numeric IDs in paths to reduce cardinality
func (sm *ServiceMetrics) normalizePath(path string) string {
	// Common endpoints that should be tracked as-is
	switch path {
	case "/", "/health", "/metrics", "/docs", "/ping", "/ready", "/live":
		return path
	}

	// Service-specific path normalization based on service name
	switch sm.serviceName {
	case "user-svc":
		return sm.normalizeUserSvcPath(path)
	case "chat-svc":
		return sm.normalizeChatSvcPath(path)
	case "discovery-svc":
		return sm.normalizeDiscoverySvcPath(path)
	case "search-svc":
		return sm.normalizeSearchSvcPath(path)
	case "ai-svc":
		return sm.normalizeAISvcPath(path)
	default:
		return sm.normalizeGenericPath(path)
	}
}

func (sm *ServiceMetrics) normalizeUserSvcPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/users/"):
		if strings.Contains(path, "/profile") {
			return "/users/*/profile"
		}
		if strings.Contains(path, "/friends") {
			return "/users/*/friends"
		}
		if strings.Contains(path, "/settings") {
			return "/users/*/settings"
		}
		return "/users/*"
	case strings.HasPrefix(path, "/auth/"):
		return "/auth/*"
	case strings.HasPrefix(path, "/profile"):
		return "/profile/*"
	default:
		return "/other"
	}
}

func (sm *ServiceMetrics) normalizeChatSvcPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/chats/"):
		return "/chats/*"
	case strings.HasPrefix(path, "/messages/"):
		return "/messages/*"
	case strings.HasPrefix(path, "/ws"):
		return "/ws"
	default:
		return "/other"
	}
}

func (sm *ServiceMetrics) normalizeDiscoverySvcPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/discovery/"):
		if strings.Contains(path, "/nearby") {
			return "/discovery/nearby"
		}
		if strings.Contains(path, "/availability") {
			return "/discovery/availability"
		}
		return "/discovery/*"
	case strings.HasPrefix(path, "/location"):
		return "/location/*"
	default:
		return "/other"
	}
}

func (sm *ServiceMetrics) normalizeSearchSvcPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/search"):
		if strings.Contains(path, "/users") {
			return "/search/users"
		}
		if strings.Contains(path, "/content") {
			return "/search/content"
		}
		return "/search/*"
	case strings.HasPrefix(path, "/index"):
		return "/index/*"
	default:
		return "/other"
	}
}

func (sm *ServiceMetrics) normalizeAISvcPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/ai/"):
		if strings.Contains(path, "/summarize") {
			return "/ai/summarize"
		}
		if strings.Contains(path, "/conversation") {
			return "/ai/conversation"
		}
		return "/ai/*"
	case strings.HasPrefix(path, "/embeddings"):
		return "/embeddings/*"
	default:
		return "/other"
	}
}

func (sm *ServiceMetrics) normalizeGenericPath(path string) string {
	// Generic fallback for unknown services
	pathSegments := strings.Split(strings.Trim(path, "/"), "/")
	if len(pathSegments) == 0 {
		return "/"
	}
	
	// Keep first segment, replace others with *
	if len(pathSegments) == 1 {
		return "/" + pathSegments[0]
	}
	
	return "/" + pathSegments[0] + "/*"
}