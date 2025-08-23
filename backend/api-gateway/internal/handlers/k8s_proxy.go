package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/link-app/api-gateway/internal/config"
)

// K8sProxyHandler handles requests using Kubernetes service discovery
type K8sProxyHandler struct {
	k8sConfig    *config.K8sServiceConfig
	jwtValidator *config.JWTValidator
	jwtConfig    *config.JWTConfig
	httpClient   *http.Client
	metrics      *K8sProxyMetrics
}

// K8sProxyMetrics tracks proxy metrics for Kubernetes services
type K8sProxyMetrics struct {
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	requestErrors   *prometheus.CounterVec
}

// NewK8sProxyHandler creates a new Kubernetes proxy handler
func NewK8sProxyHandler(jwtValidator *config.JWTValidator, jwtConfig *config.JWTConfig) *K8sProxyHandler {
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 20,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	metrics := &K8sProxyMetrics{
		requestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "k8s_proxy_requests_total",
				Help: "Total number of proxy requests to K8s services",
			},
			[]string{"service", "method", "status"},
		),
		requestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "k8s_proxy_request_duration_seconds",
				Help:    "Duration of proxy requests to K8s services",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "method"},
		),
		requestErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "k8s_proxy_errors_total",
				Help: "Total number of proxy errors",
			},
			[]string{"service", "error_type"},
		),
	}

	return &K8sProxyHandler{
		k8sConfig:    config.GetK8sServiceConfig(),
		jwtValidator: jwtValidator,
		jwtConfig:    jwtConfig,
		httpClient:   client,
		metrics:      metrics,
	}
}

// ProxyToK8sService returns a Gin handler that proxies requests to a K8s service
func (h *K8sProxyHandler) ProxyToK8sService(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Get K8s service configuration
		service, err := config.GetK8sService(serviceName)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":     "SERVICE_UNAVAILABLE",
				"message":   "Service not configured",
				"code":      "SERVICE_NOT_FOUND",
				"service":   serviceName,
				"timestamp": time.Now(),
			})
			h.metrics.requestErrors.WithLabelValues(serviceName, "service_not_found").Inc()
			return
		}

		// Read request body
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
				h.metrics.requestErrors.WithLabelValues(serviceName, "body_read_error").Inc()
				return
			}
			c.Request.Body.Close()
		}

		// Build target URL
		targetPath := h.buildTargetPath(c.Request.URL.Path, serviceName)
		targetURL := service.URL + targetPath
		if c.Request.URL.RawQuery != "" {
			targetURL += "?" + c.Request.URL.RawQuery
		}

		// Create proxy request
		ctx, cancel := context.WithTimeout(c.Request.Context(), service.Timeout)
		defer cancel()

		var bodyReader io.Reader
		if len(bodyBytes) > 0 {
			bodyReader = bytes.NewReader(bodyBytes)
		}

		proxyReq, err := http.NewRequestWithContext(ctx, c.Request.Method, targetURL, bodyReader)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":     "INTERNAL_ERROR",
				"message":   "Failed to create proxy request",
				"code":      "PROXY_REQUEST_ERROR",
				"timestamp": time.Now(),
			})
			h.metrics.requestErrors.WithLabelValues(serviceName, "request_creation_error").Inc()
			return
		}

		// Copy headers and add proxy-specific headers
		h.copyHeaders(c.Request.Header, proxyReq.Header)
		h.addProxyHeaders(c, proxyReq)

		// Execute request
		resp, err := h.httpClient.Do(proxyReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{
				"error":     "BAD_GATEWAY",
				"message":   "Service temporarily unavailable",
				"code":      "SERVICE_ERROR",
				"service":   serviceName,
				"timestamp": time.Now(),
			})
			h.metrics.requestErrors.WithLabelValues(serviceName, "request_failed").Inc()
			h.recordMetrics(serviceName, c.Request.Method, "error", time.Since(start))
			return
		}
		defer resp.Body.Close()

		// Copy response to Gin context
		h.copyResponse(c, resp)

		// Add proxy headers to response
		c.Header("X-Proxy-Service", serviceName)
		c.Header("X-Proxy-K8s", "true")

		// Record metrics
		status := "success"
		if resp.StatusCode >= 400 {
			status = "error"
		}
		h.recordMetrics(serviceName, c.Request.Method, status, time.Since(start))
	}
}

// buildTargetPath constructs the target path for the backend service
func (h *K8sProxyHandler) buildTargetPath(requestPath, serviceName string) string {
	// Remove service name from the beginning of the path if present
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
func (h *K8sProxyHandler) copyHeaders(src, dst http.Header) {
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

// addProxyHeaders adds proxy-specific headers
func (h *K8sProxyHandler) addProxyHeaders(c *gin.Context, proxyReq *http.Request) {
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
func (h *K8sProxyHandler) copyResponse(c *gin.Context, resp *http.Response) {
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
func (h *K8sProxyHandler) recordMetrics(service, method, status string, duration time.Duration) {
	h.metrics.requestsTotal.WithLabelValues(service, method, status).Inc()
	h.metrics.requestDuration.WithLabelValues(service, method).Observe(duration.Seconds())
}

// HealthHandler provides health check for K8s services
func (h *K8sProxyHandler) HealthHandler(c *gin.Context) {
	healthStatus := gin.H{
		"status":         "healthy",
		"gateway":        "k8s-native",
		"timestamp":      time.Now(),
		"service_mesh":   "linkerd",
		"services":       gin.H{},
	}

	services := make(gin.H)
	for serviceName, service := range h.k8sConfig.Services {
		services[serviceName] = gin.H{
			"status":     "available",
			"url":        service.URL,
			"namespace":  service.Namespace,
			"timeout":    service.Timeout.String(),
		}
	}

	healthStatus["services"] = services
	c.JSON(http.StatusOK, healthStatus)
}

// RootHandler provides service discovery information
func (h *K8sProxyHandler) RootHandler(c *gin.Context) {
	serviceEndpoints := make(gin.H)

	for serviceName := range h.k8sConfig.Services {
		// Map service names to endpoint paths
		endpoint := "/" + strings.TrimSuffix(serviceName, "-svc") + "/*"
		serviceEndpoints[serviceName] = endpoint
	}

	c.JSON(http.StatusOK, gin.H{
		"service":     "Link API Gateway",
		"version":     "3.0.0",
		"status":      "healthy",
		"type":        "k8s-native",
		"features":    []string{"k8s_service_discovery", "linkerd_service_mesh", "jwt_auth", "rate_limiting", "tracing"},
		"docs":        "https://api.linkapp.com/docs",
		"health":      "/health",
		"metrics":     "/metrics",
		"endpoints":   serviceEndpoints,
		"k8s": gin.H{
			"namespace":     h.k8sConfig.Services["user-svc"].Namespace,
			"cluster_dns":   true,
			"service_mesh":  "linkerd",
			"load_balancing": "k8s + linkerd",
		},
	})
}

// NotFoundHandler handles undefined routes
func (h *K8sProxyHandler) NotFoundHandler(c *gin.Context) {
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
func (h *K8sProxyHandler) getAvailableServices() []string {
	services := make([]string, 0, len(h.k8sConfig.Services))
	for serviceName := range h.k8sConfig.Services {
		services = append(services, serviceName)
	}
	return services
}