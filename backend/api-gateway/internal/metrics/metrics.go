package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP request duration histogram
	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "api_gateway",
		Name:      "http_request_duration_seconds",
		Help:      "Duration of HTTP requests in seconds",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
	}, []string{"method", "path", "status_code"})

	// HTTP request counter
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "api_gateway",
		Name:      "http_requests_total",
		Help:      "Total number of HTTP requests",
	}, []string{"method", "path", "status_code"})

	// Current active requests gauge
	activeRequests = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "api_gateway",
		Name:      "http_requests_active",
		Help:      "Number of active HTTP requests",
	}, []string{"method", "path"})

	// Request size histogram
	httpRequestSizeBytes = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "api_gateway",
		Name:      "http_request_size_bytes",
		Help:      "Size of HTTP requests in bytes",
		Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
	}, []string{"method", "path"})

	// Response size histogram
	httpResponseSizeBytes = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "api_gateway",
		Name:      "http_response_size_bytes",
		Help:      "Size of HTTP responses in bytes",
		Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
	}, []string{"method", "path"})

	// JWT validation metrics
	jwtValidationTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "api_gateway",
		Name:      "jwt_validations_total",
		Help:      "Total number of JWT validation attempts",
	}, []string{"result"}) // result: success, failure, missing

	// Proxy request metrics
	proxyRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "api_gateway",
		Name:      "proxy_requests_total",
		Help:      "Total number of proxied requests",
	}, []string{"target_service", "status_code"})

	proxyRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "api_gateway",
		Name:      "proxy_request_duration_seconds",
		Help:      "Duration of proxied requests in seconds",
		Buckets:   []float64{.01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30},
	}, []string{"target_service"})

	// Service health metrics
	serviceHealthStatus = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "api_gateway",
		Name:      "service_health_status",
		Help:      "Health status of downstream services (1=healthy, 0=unhealthy)",
	}, []string{"service"})
)

// PrometheusMiddleware creates a middleware that collects Prometheus metrics
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip metrics for the /metrics endpoint itself
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Normalize path to avoid high cardinality (replace IDs with placeholders)
		normalizedPath := normalizePath(path)

		// Track active requests
		activeRequests.WithLabelValues(method, normalizedPath).Inc()
		defer activeRequests.WithLabelValues(method, normalizedPath).Dec()

		// Track request size
		if c.Request.ContentLength > 0 {
			httpRequestSizeBytes.WithLabelValues(method, normalizedPath).Observe(float64(c.Request.ContentLength))
		}

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Seconds()
		statusCode := strconv.Itoa(c.Writer.Status())

		// Record metrics
		httpRequestDuration.WithLabelValues(method, normalizedPath, statusCode).Observe(duration)
		httpRequestsTotal.WithLabelValues(method, normalizedPath, statusCode).Inc()

		// Track response size
		responseSize := c.Writer.Size()
		if responseSize > 0 {
			httpResponseSizeBytes.WithLabelValues(method, normalizedPath).Observe(float64(responseSize))
		}
	}
}

// JWTMetricsMiddleware tracks JWT validation metrics
func JWTMetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if JWT is present
		authHeader := c.GetHeader("Authorization")
		cookieValue, _ := c.Cookie("link_auth")

		if authHeader == "" && cookieValue == "" {
			jwtValidationTotal.WithLabelValues("missing").Inc()
		} else {
			// Process request to see if JWT validation succeeds
			c.Next()

			// Check if user context was set (indicates successful JWT validation)
			if userID := c.GetString("user_id"); userID != "" {
				jwtValidationTotal.WithLabelValues("success").Inc()
			} else if c.Writer.Status() == 401 {
				jwtValidationTotal.WithLabelValues("failure").Inc()
			}
			return
		}

		c.Next()
	}
}

// RecordProxyRequest records metrics for proxied requests
func RecordProxyRequest(targetService string, statusCode int, duration time.Duration) {
	proxyRequestsTotal.WithLabelValues(targetService, strconv.Itoa(statusCode)).Inc()
	proxyRequestDuration.WithLabelValues(targetService).Observe(duration.Seconds())
}

// UpdateServiceHealth updates the health status of a downstream service
func UpdateServiceHealth(serviceName string, healthy bool) {
	value := 0.0
	if healthy {
		value = 1.0
	}
	serviceHealthStatus.WithLabelValues(serviceName).Set(value)
}

// normalizePath replaces UUIDs and numeric IDs in paths to reduce cardinality
func normalizePath(path string) string {
	// Simple normalization - replace common ID patterns
	// In production, you might want more sophisticated path normalization

	// For now, return the path as-is but limit to known endpoints
	// You can extend this based on your actual API structure
	switch {
	case path == "/":
		return "/"
	case path == "/health":
		return "/health"
	case path == "/docs":
		return "/docs"
	case path[:5] == "/auth":
		return "/auth/*"
	case path[:6] == "/users":
		return "/users/*"
	case path[:9] == "/location":
		return "/location/*"
	case path[:5] == "/chat":
		return "/chat/*"
	case path[:3] == "/ai":
		return "/ai/*"
	case path[:11] == "/broadcasts":
		return "/broadcasts/*"
	case path[:10] == "/discovery":
		return "/discovery/*"
	case path[:8] == "/stories":
		return "/stories/*"
	case path[:14] == "/opportunities":
		return "/opportunities/*"
	case path[:3] == "/ws":
		return "/ws"
	default:
		return "/other"
	}
}
