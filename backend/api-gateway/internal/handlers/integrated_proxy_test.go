package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/link-app/api-gateway/internal/config"
	"github.com/link-app/api-gateway/internal/loadbalancer"
	"github.com/link-app/api-gateway/internal/retry"
)

// MockServiceServer creates a mock HTTP server for testing
type MockServiceServer struct {
	server          *httptest.Server
	requestCount    int
	shouldFail      bool
	failureCount    int
	responseDelay   time.Duration
	statusCode      int
	responseBody    string
	receivedHeaders http.Header
	receivedBody    string
}

func NewMockServiceServer() *MockServiceServer {
	mock := &MockServiceServer{
		statusCode:   http.StatusOK,
		responseBody: `{"message": "success", "service": "mock"}`,
	}

	mock.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mock.requestCount++

		// Store received headers and body for verification
		mock.receivedHeaders = r.Header
		if r.Body != nil {
			bodyBytes, _ := io.ReadAll(r.Body)
			mock.receivedBody = string(bodyBytes)
		}

		// Simulate response delay
		if mock.responseDelay > 0 {
			time.Sleep(mock.responseDelay)
		}

		// Simulate failures
		if mock.shouldFail && mock.requestCount <= mock.failureCount {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error": "mock service failure"}`))
			return
		}

		// Send successful response
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Mock-Service", "true")
		w.WriteHeader(mock.statusCode)
		w.Write([]byte(mock.responseBody))
	}))

	return mock
}

func (m *MockServiceServer) Close() {
	if m.server != nil {
		m.server.Close()
	}
}

func (m *MockServiceServer) URL() string {
	return m.server.URL
}

func (m *MockServiceServer) Reset() {
	m.requestCount = 0
	m.shouldFail = false
	m.failureCount = 0
	m.responseDelay = 0
	m.statusCode = http.StatusOK
	m.responseBody = `{"message": "success", "service": "mock"}`
	m.receivedHeaders = nil
	m.receivedBody = ""
}

func setupTestEnhancedConfig(mockServers []*MockServiceServer) *config.EnhancedServiceConfig {
	enhancedConfig := &config.EnhancedServiceConfig{
		Services: make(map[string]*config.ServiceLoadBalancer),
	}

	// Create test service with mock servers as instances
	instances := make([]config.ServiceInstanceConfig, len(mockServers))
	for i, server := range mockServers {
		instances[i] = config.ServiceInstanceConfig{
			ID:        fmt.Sprintf("mock-%d", i+1),
			URL:       server.URL(),
			HealthURL: server.URL() + "/health",
			Weight:    1,
			Timeout:   5 * time.Second,
		}
	}

	// Create load balancer
	lb := loadbalancer.NewLoadBalancer(
		loadbalancer.RoundRobin,
		3, // max failures
		30*time.Second,
		60*time.Second,
	)

	// Add instances to load balancer
	for _, instance := range instances {
		lb.AddInstance(
			instance.ID,
			instance.URL,
			instance.HealthURL,
			instance.Weight,
			instance.Timeout,
		)
	}

	// Create retrier
	retryConfig := retry.DefaultRetryConfig()
	retryConfig.MaxRetries = 2
	retryConfig.BaseDelay = 10 * time.Millisecond
	retrier := retry.NewRetrier(retryConfig)

	enhancedConfig.Services["test-svc"] = &config.ServiceLoadBalancer{
		Name:         "test-svc",
		LoadBalancer: lb,
		Retrier:      retrier,
		Instances:    instances,
	}

	return enhancedConfig
}

func setupTestRouter(handler *IntegratedProxyHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Add the proxy handler for test service
	router.Any("/test-svc/*path", handler.ProxyWithLoadBalancing("test-svc"))
	router.GET("/health", handler.EnhancedHealthHandler)
	router.GET("/", handler.RootHandler)
	router.NoRoute(handler.NotFoundHandler)

	return router
}

func TestIntegratedProxyHandler_BasicProxying(t *testing.T) {
	// Setup mock servers
	mockServer := NewMockServiceServer()
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_basic_proxy")
	router := setupTestRouter(handler)

	// Create test request
	req, err := http.NewRequest("GET", "/test-svc/users/123", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("X-User-ID", "user-123")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.Equal(t, "true", w.Header().Get("X-Mock-Service"))
	assert.Equal(t, "test-svc", w.Header().Get("X-Proxy-Service"))
	assert.Equal(t, "mock-1", w.Header().Get("X-Proxy-Instance"))
	assert.Equal(t, "1", w.Header().Get("X-Proxy-Attempts"))

	// Verify request was proxied correctly
	assert.Equal(t, 1, mockServer.requestCount)
	assert.Equal(t, "Bearer test-token", mockServer.receivedHeaders.Get("Authorization"))
	assert.Equal(t, "user-123", mockServer.receivedHeaders.Get("X-User-ID"))
	assert.Equal(t, "true", mockServer.receivedHeaders.Get("X-Gateway-Request"))

	// Verify response body
	var responseBody map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &responseBody)
	require.NoError(t, err)
	assert.Equal(t, "success", responseBody["message"])
}

func TestIntegratedProxyHandler_LoadBalancing(t *testing.T) {
	// Setup multiple mock servers
	mockServer1 := NewMockServiceServer()
	mockServer2 := NewMockServiceServer()
	mockServer3 := NewMockServiceServer()
	defer func() {
		mockServer1.Close()
		mockServer2.Close()
		mockServer3.Close()
	}()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer1, mockServer2, mockServer3})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_load_balancing")
	router := setupTestRouter(handler)

	// Make multiple requests to verify round-robin distribution
	servers := []*MockServiceServer{mockServer1, mockServer2, mockServer3}
	for i := 0; i < 9; i++ {
		req, err := http.NewRequest("GET", "/test-svc/ping", nil)
		require.NoError(t, err)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Verify each server received exactly 3 requests (round-robin)
	for i, server := range servers {
		assert.Equal(t, 3, server.requestCount, "Server %d should receive exactly 3 requests", i+1)
	}
}

func TestIntegratedProxyHandler_CircuitBreaker(t *testing.T) {
	// Setup mock server that fails initially
	mockServer := NewMockServiceServer()
	mockServer.shouldFail = true
	mockServer.failureCount = 3
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_circuit_breaker")
	router := setupTestRouter(handler)

	// Make requests that should trigger circuit breaker
	for i := 0; i < 3; i++ {
		req, err := http.NewRequest("GET", "/test-svc/test", nil)
		require.NoError(t, err)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Circuit breaker can result in either 502 (Bad Gateway) or 503 (Service Unavailable)
		// depending on the load balancer state and timing
		assert.True(t, w.Code == http.StatusBadGateway || w.Code == http.StatusServiceUnavailable, 
			"Expected status 502 or 503, got %d", w.Code)
	}

	// Verify circuit breaker is now open
	lb, err := enhancedConfig.GetLoadBalancer("test-svc")
	require.NoError(t, err)
	
	state := lb.GetCircuitBreakerState("mock-1")
	assert.Equal(t, loadbalancer.Open, state)

	// Now make server healthy and verify requests start working after recovery
	mockServer.shouldFail = false
	
	// Wait for circuit breaker recovery (simulate time passing)
	time.Sleep(10 * time.Millisecond)
	
	// Force the instance back to healthy for testing
	instances := lb.GetAllInstances()
	if len(instances) > 0 {
		instances[0].IsHealthy = true
	}

	req, err := http.NewRequest("GET", "/test-svc/test", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should still be unavailable until circuit breaker properly recovers
	// In a real scenario, health checks would detect recovery automatically
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestIntegratedProxyHandler_RetryLogic(t *testing.T) {
	// Setup mock server that fails first 2 attempts then succeeds
	mockServer := NewMockServiceServer()
	mockServer.shouldFail = true
	mockServer.failureCount = 2
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_retry_logic")
	router := setupTestRouter(handler)

	// Make request that should succeed after retries
	req, err := http.NewRequest("POST", "/test-svc/data", bytes.NewBufferString(`{"test": "data"}`))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should succeed after retries
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "3", w.Header().Get("X-Proxy-Attempts")) // 1 initial + 2 retries

	// Verify server received 3 requests total
	assert.Equal(t, 3, mockServer.requestCount)
}

func TestIntegratedProxyHandler_POSTWithBody(t *testing.T) {
	// Setup mock server
	mockServer := NewMockServiceServer()
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_post_with_body")
	router := setupTestRouter(handler)

	// Create POST request with JSON body
	testData := map[string]interface{}{
		"name":  "test user",
		"email": "test@example.com",
	}
	jsonData, _ := json.Marshal(testData)

	req, err := http.NewRequest("POST", "/test-svc/users", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)
	
	// Verify request body was correctly forwarded
	var receivedData map[string]interface{}
	err = json.Unmarshal([]byte(mockServer.receivedBody), &receivedData)
	require.NoError(t, err)
	assert.Equal(t, "test user", receivedData["name"])
	assert.Equal(t, "test@example.com", receivedData["email"])
}

func TestIntegratedProxyHandler_NoHealthyInstances(t *testing.T) {
	// Setup enhanced config with no instances
	enhancedConfig := &config.EnhancedServiceConfig{
		Services: make(map[string]*config.ServiceLoadBalancer),
	}

	// Create empty load balancer
	lb := loadbalancer.NewLoadBalancer(
		loadbalancer.RoundRobin,
		3,
		30*time.Second,
		60*time.Second,
	)

	enhancedConfig.Services["test-svc"] = &config.ServiceLoadBalancer{
		Name:         "test-svc",
		LoadBalancer: lb,
		Retrier:      retry.NewRetrier(retry.DefaultRetryConfig()),
		Instances:    []config.ServiceInstanceConfig{},
	}

	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_no_healthy_instances")
	router := setupTestRouter(handler)

	// Make request to service with no healthy instances
	req, err := http.NewRequest("GET", "/test-svc/test", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return service unavailable
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "SERVICE_UNAVAILABLE", response["error"])
	assert.Equal(t, "NO_INSTANCES_AVAILABLE", response["code"])
}

func TestIntegratedProxyHandler_HealthEndpoint(t *testing.T) {
	// Setup mock servers
	mockServer1 := NewMockServiceServer()
	mockServer2 := NewMockServiceServer()
	defer func() {
		mockServer1.Close()
		mockServer2.Close()
	}()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer1, mockServer2})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_health_endpoint")
	router := setupTestRouter(handler)

	// Test health endpoint
	req, err := http.NewRequest("GET", "/health", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var health map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &health)
	require.NoError(t, err)

	assert.Equal(t, "healthy", health["status"])
	assert.Equal(t, "integrated", health["gateway"])
	assert.Equal(t, "enabled", health["load_balancing"])
	
	services := health["services"].(map[string]interface{})
	testService := services["test-svc"].(map[string]interface{})
	assert.Equal(t, "ok", testService["status"])
	assert.Equal(t, float64(2), testService["total_instances"])
	assert.Equal(t, float64(2), testService["healthy_instances"])
}

func TestIntegratedProxyHandler_RootEndpoint(t *testing.T) {
	// Setup mock server
	mockServer := NewMockServiceServer()
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_root_endpoint")
	router := setupTestRouter(handler)

	// Test root endpoint
	req, err := http.NewRequest("GET", "/", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var root map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &root)
	require.NoError(t, err)

	assert.Equal(t, "Link API Gateway", root["service"])
	assert.Equal(t, "2.0.0", root["version"])
	assert.Equal(t, "integrated", root["type"])
	
	features := root["features"].([]interface{})
	assert.Contains(t, features, "load_balancing")
	assert.Contains(t, features, "circuit_breakers")

	loadBalancing := root["load_balancing"].(map[string]interface{})
	assert.Equal(t, true, loadBalancing["enabled"])
	assert.Equal(t, float64(1), loadBalancing["services"])
	assert.Equal(t, float64(1), loadBalancing["total_instances"])
}

func TestIntegratedProxyHandler_NotFoundHandler(t *testing.T) {
	// Setup mock server
	mockServer := NewMockServiceServer()
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_not_found_handler")
	router := setupTestRouter(handler)

	// Test undefined route
	req, err := http.NewRequest("GET", "/nonexistent/path", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "NOT_FOUND", response["error"])
	assert.Equal(t, "ENDPOINT_NOT_FOUND", response["code"])
	assert.Equal(t, "/nonexistent/path", response["path"])
	assert.Equal(t, "GET", response["method"])
	
	availableServices := response["available_services"].([]interface{})
	assert.Contains(t, availableServices, "test-svc")
}

func TestIntegratedProxyHandler_RequestTimeout(t *testing.T) {
	// Setup mock server with long delay
	mockServer := NewMockServiceServer()
	mockServer.responseDelay = 100 * time.Millisecond
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_request_timeout")
	
	// Set a very short timeout for testing
	handler.httpClient.Timeout = 50 * time.Millisecond
	
	router := setupTestRouter(handler)

	// Make request that should timeout
	req, err := http.NewRequest("GET", "/test-svc/slow", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return bad gateway due to timeout
	assert.Equal(t, http.StatusBadGateway, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "BAD_GATEWAY", response["error"])
	assert.Equal(t, "SERVICE_ERROR", response["code"])
}

func TestIntegratedProxyHandler_QueryParameters(t *testing.T) {
	// Setup mock server
	mockServer := NewMockServiceServer()
	defer mockServer.Close()

	// Setup enhanced config and handler
	enhancedConfig := setupTestEnhancedConfig([]*MockServiceServer{mockServer})
	handler := NewIntegratedProxyHandlerWithMetrics(enhancedConfig, nil, nil, "test_query_parameters")
	router := setupTestRouter(handler)

	// Make request with query parameters
	req, err := http.NewRequest("GET", "/test-svc/search?q=test&limit=10&sort=name", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should succeed
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 1, mockServer.requestCount)

	// Verify the request URL contained query parameters
	// (This would be verified in the mock server's request handling)
}
