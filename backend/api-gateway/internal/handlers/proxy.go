package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/api-gateway/internal/config"
)

// ProxyHandler handles proxying requests to backend services
type ProxyHandler struct {
	httpClient *http.Client
}

// NewProxyHandler creates a new proxy handler
func NewProxyHandler() *ProxyHandler {
	return &ProxyHandler{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			// Add connection pooling for better performance
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// ProxyRequest proxies the request to the appropriate backend service
func (p *ProxyHandler) ProxyRequest(c *gin.Context) {
	// Determine target service based on path
	service, err := config.RouteToService(c.Request.URL.Path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "NOT_FOUND",
			"message":   "Service not found for this endpoint",
			"code":      "SERVICE_NOT_FOUND",
			"path":      c.Request.URL.Path,
			"timestamp": time.Now(),
		})
		return
	}

	// Transform the path for the target service
	servicePath := config.TransformPath(c.Request.URL.Path)

	// Build target URL
	targetURL, err := url.Parse(service.URL + servicePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "SERVER_ERROR",
			"message":   "Failed to parse service URL",
			"code":      "URL_PARSE_ERROR",
			"timestamp": time.Now(),
		})
		return
	}

	// Copy query parameters
	if c.Request.URL.RawQuery != "" {
		targetURL.RawQuery = c.Request.URL.RawQuery
	}

	// Read request body
	var bodyReader io.Reader
	if c.Request.Body != nil {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":     "VALIDATION_ERROR",
				"message":   "Failed to read request body",
				"code":      "BODY_READ_ERROR",
				"timestamp": time.Now(),
			})
			return
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	// Create the proxy request
	proxyReq, err := http.NewRequestWithContext(
		c.Request.Context(),
		c.Request.Method,
		targetURL.String(),
		bodyReader,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "SERVER_ERROR",
			"message":   "Failed to create proxy request",
			"code":      "PROXY_REQUEST_ERROR",
			"timestamp": time.Now(),
		})
		return
	}

	// Copy headers (except hop-by-hop headers)
	p.copyHeaders(c.Request.Header, proxyReq.Header)

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

	// Set timeout based on service configuration
	client := &http.Client{
		Timeout:   time.Duration(service.Timeout) * time.Second,
		Transport: p.httpClient.Transport,
	}

	// Execute the proxy request
	resp, err := client.Do(proxyReq)
	if err != nil {
		// Check if it's a timeout error
		if err, ok := err.(*url.Error); ok && err.Timeout() {
			c.JSON(http.StatusGatewayTimeout, gin.H{
				"error":     "GATEWAY_TIMEOUT",
				"message":   "Service request timed out",
				"code":      "SERVICE_TIMEOUT",
				"service":   service.URL,
				"timestamp": time.Now(),
			})
			return
		}

		c.JSON(http.StatusBadGateway, gin.H{
			"error":     "BAD_GATEWAY",
			"message":   "Failed to reach backend service",
			"code":      "SERVICE_UNAVAILABLE",
			"service":   service.URL,
			"timestamp": time.Now(),
		})
		return
	}
	defer resp.Body.Close()

	// Copy response headers (except hop-by-hop headers)
	p.copyHeaders(resp.Header, c.Writer.Header())

	// Set the status code
	c.Status(resp.StatusCode)

	// Copy response body
	_, err = io.Copy(c.Writer, resp.Body)
	if err != nil {
		// Log the error, but don't send another response since we've already started
		fmt.Printf("Error copying response body: %v\n", err)
	}
}

// copyHeaders copies HTTP headers, filtering out hop-by-hop headers
func (p *ProxyHandler) copyHeaders(src, dst http.Header) {
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

// HealthHandler aggregates health status from all services
func (p *ProxyHandler) HealthHandler(c *gin.Context) {
	serviceConfig := config.GetServiceConfig()

	healthStatus := gin.H{
		"status":    "healthy",
		"gateway":   "healthy",
		"timestamp": time.Now(),
		"services":  gin.H{},
	}

	// Check each service health
	services := map[string]config.ServiceEndpoint{
		"user-svc":          serviceConfig.UserService,
		"location-svc":      serviceConfig.LocationService,
		"chat-svc":          serviceConfig.ChatService,
		"ai-svc":            serviceConfig.AIService,
		"discovery-svc":     serviceConfig.DiscoveryService,
		"opportunities-svc": serviceConfig.OpportunitiesService,
	}

	overallHealthy := true
	serviceStatuses := gin.H{}

	for serviceName, serviceEndpoint := range services {
		status := p.checkServiceHealth(serviceEndpoint.HealthURL)
		serviceStatuses[serviceName] = status

		if status != "healthy" {
			overallHealthy = false
		}
	}

	healthStatus["services"] = serviceStatuses

	if overallHealthy {
		healthStatus["status"] = "healthy"
		c.JSON(http.StatusOK, healthStatus)
	} else {
		healthStatus["status"] = "degraded"
		c.JSON(http.StatusServiceUnavailable, healthStatus)
	}
}

// checkServiceHealth checks if a service is healthy
func (p *ProxyHandler) checkServiceHealth(healthURL string) string {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(healthURL)
	if err != nil {
		return "unhealthy"
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return "healthy"
	}

	return "unhealthy"
}

// NotFoundHandler handles 404 errors
func (p *ProxyHandler) NotFoundHandler(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{
		"error":     "NOT_FOUND",
		"message":   "Endpoint not found",
		"code":      "ENDPOINT_NOT_FOUND",
		"path":      c.Request.URL.Path,
		"method":    c.Request.Method,
		"timestamp": time.Now(),
		"available_prefixes": []string{
			"/auth/",
			"/users/",
			"/location/",
			"/chat/",
			"/ai/" + " (including /ai/summarize)",
			"/broadcasts/",
			"/discovery/",
			"/stories/",
			"/opportunities/",
			"/ws (WebSocket)",
		},
	})
}
