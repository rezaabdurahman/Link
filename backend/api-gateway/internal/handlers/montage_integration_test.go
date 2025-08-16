package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/api-gateway/internal/config"
	"github.com/stretchr/testify/assert"
)

// TestMontageRouting tests that montage requests are properly routed to the user service
func TestMontageRouting(t *testing.T) {
	// Set up test environment
	gin.SetMode(gin.TestMode)

	// Create a mock user service to receive proxied requests
	mockUserService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify that common headers are set
		assert.Equal(t, "test-user-123", r.Header.Get("X-User-ID"))
		assert.Equal(t, "test@example.com", r.Header.Get("X-User-Email"))
		assert.Equal(t, "Test User", r.Header.Get("X-User-Name"))
		assert.Equal(t, "true", r.Header.Get("X-Gateway-Request"))

		// Mock different responses based on the HTTP method and path
		switch {
		case r.Method == "GET" && r.URL.Path == "/api/v1/users/123/montage":
			// Mock a successful montage response
			response := map[string]interface{}{
				"type": "general",
				"items": []map[string]interface{}{
					{
						"checkin_id": "c1111111-e89b-12d3-a456-426614174000",
						"widget_type": "media",
						"widget_metadata": map[string]interface{}{
							"media_url": "https://example.com/photo.jpg",
							"tags": []string{"coffee", "morning"},
						},
					},
				},
				"metadata": map[string]interface{}{
					"total_count": 1,
					"generated_at": time.Now().Format(time.RFC3339),
				},
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)

		case r.Method == "POST" && r.URL.Path == "/api/v1/users/123/montage/regenerate":
			// Mock regeneration success
			response := map[string]interface{}{
				"message": "Montages regenerated successfully",
				"user_id": "123",
				"timestamp": time.Now().Format(time.RFC3339),
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)

		case r.Method == "DELETE" && strings.HasPrefix(r.URL.Path, "/api/v1/users/123/montage"):
			// Mock deletion success
			response := map[string]interface{}{
				"message": "Montage deleted successfully",
				"user_id": "123",
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)

		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	defer mockUserService.Close()

	// Override environment to use the mock service
	t.Setenv("USER_SVC_URL", mockUserService.URL)
	t.Setenv("USER_SVC_TIMEOUT", "10")

	// Create proxy handler
	proxyHandler := NewProxyHandler()

	// Create test router
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Mock auth middleware - set user context headers
		c.Header("X-User-ID", "test-user-123")
		c.Header("X-User-Email", "test@example.com")
		c.Header("X-User-Name", "Test User")
		c.Next()
	})

	// Add the users group with proxy handler
	usersGroup := router.Group("/users")
	{
		usersGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Test GET montage
	t.Run("GET montage", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/users/123/montage", nil)
		req.Header.Set("X-User-ID", "test-user-123")
		req.Header.Set("X-User-Email", "test@example.com")
		req.Header.Set("X-User-Name", "Test User")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "general", response["type"])
		assert.Contains(t, response, "items")
		assert.Contains(t, response, "metadata")
	})

	// Test POST montage regenerate
	t.Run("POST montage regenerate", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/users/123/montage/regenerate", nil)
		req.Header.Set("X-User-ID", "test-user-123")
		req.Header.Set("X-User-Email", "test@example.com")
		req.Header.Set("X-User-Name", "Test User")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "Montages regenerated successfully", response["message"])
	})

	// Test DELETE montage
	t.Run("DELETE montage", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", "/users/123/montage?interest=coffee", nil)
		req.Header.Set("X-User-ID", "test-user-123")
		req.Header.Set("X-User-Email", "test@example.com")
		req.Header.Set("X-User-Name", "Test User")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "Montage deleted successfully", response["message"])
	})
}

// TestMontageRoutingErrors tests error scenarios for montage routing
func TestMontageRoutingErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create a mock user service that returns different error codes
	mockUserService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/users/unauthorized/"):
			// Mock unauthorized access
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "ACCESS_DENIED",
				"message": "You don't have permission to view this user's montage",
			})
		case strings.Contains(r.URL.Path, "/users/notfound/"):
			// Mock user not found
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "NOT_FOUND",
				"message": "User not found",
			})
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer mockUserService.Close()

	// Override environment to use the mock service
	t.Setenv("USER_SVC_URL", mockUserService.URL)

	// Create proxy handler
	proxyHandler := NewProxyHandler()

	// Create test router
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Mock auth middleware
		c.Header("X-User-ID", "test-user-123")
		c.Header("X-User-Email", "test@example.com")
		c.Header("X-User-Name", "Test User")
		c.Next()
	})

	usersGroup := router.Group("/users")
	{
		usersGroup.Any("/*path", proxyHandler.ProxyRequest)
	}

	// Test 403 Forbidden
	t.Run("403 Forbidden", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/users/unauthorized/montage", nil)
		req.Header.Set("X-User-ID", "test-user-123")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "ACCESS_DENIED", response["error"])
	})

	// Test 404 Not Found
	t.Run("404 Not Found", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/users/notfound/montage", nil)
		req.Header.Set("X-User-ID", "test-user-123")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "NOT_FOUND", response["error"])
	})
}

// TestMontagePathTransformation tests that paths are correctly transformed for the backend service
func TestMontagePathTransformation(t *testing.T) {
	tests := []struct {
		name           string
		gatewayPath    string
		expectedPath   string
	}{
		{
			name:         "Basic montage path",
			gatewayPath:  "/users/123/montage",
			expectedPath: "/api/v1/users/123/montage",
		},
		{
			name:         "Montage with regenerate",
			gatewayPath:  "/users/456/montage/regenerate",
			expectedPath: "/api/v1/users/456/montage/regenerate",
		},
		{
			name:         "Montage with stats",
			gatewayPath:  "/users/789/montage/stats",
			expectedPath: "/api/v1/users/789/montage/stats",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transformed := config.TransformPath(tt.gatewayPath)
			assert.Equal(t, tt.expectedPath, transformed)
		})
	}
}

// TestMontageServiceRouting tests that montage paths are correctly routed to the user service
func TestMontageServiceRouting(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		expectError bool
	}{
		{
			name:        "Montage route",
			path:        "/users/123/montage",
			expectError: false,
		},
		{
			name:        "Montage regenerate route",
			path:        "/users/123/montage/regenerate",
			expectError: false,
		},
		{
			name:        "Montage stats route",
			path:        "/users/123/montage/stats",
			expectError: false,
		},
		{
			name:        "Invalid route",
			path:        "/invalid/path",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service, err := config.RouteToService(tt.path)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				// Verify it routes to user service
				expectedURL := config.GetServiceConfig().UserService.URL
				assert.Equal(t, expectedURL, service.URL)
			}
		})
	}
}
