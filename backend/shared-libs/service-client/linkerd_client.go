package serviceclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// LinkerdHTTPClient provides service-to-service communication via Linkerd mTLS
// 
// KEY INSIGHT: With Linkerd, service authentication is AUTOMATIC
// - Just make normal HTTP calls to service URLs
// - Linkerd handles mTLS, certificate rotation, identity verification
// - No tokens, no authentication headers, no manual configuration needed!
type LinkerdHTTPClient struct {
	httpClient  *http.Client
	baseURL     string
	serviceName string
}

// NewLinkerdHTTPClient creates a service client with automatic mTLS authentication
func NewLinkerdHTTPClient(serviceName string) *LinkerdHTTPClient {
	// Kubernetes service URL format
	baseURL := fmt.Sprintf("http://%s.link-services.svc.cluster.local:8080", serviceName)

	return &LinkerdHTTPClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL:     baseURL,
		serviceName: serviceName,
	}
}

// NewLinkerdHTTPClientWithTimeout creates a client with custom timeout
func NewLinkerdHTTPClientWithTimeout(serviceName string, timeout time.Duration) *LinkerdHTTPClient {
	client := NewLinkerdHTTPClient(serviceName)
	client.httpClient.Timeout = timeout
	return client
}

// Do performs an HTTP request with automatic mTLS authentication via Linkerd
// 
// IMPORTANT: No authentication headers needed!
// Linkerd proxy handles everything automatically
func (c *LinkerdHTTPClient) Do(req *http.Request) (*http.Response, error) {
	// Add observability headers only (not for auth)
	req.Header.Set("User-Agent", fmt.Sprintf("linkerd-client/%s", c.serviceName))
	
	// That's it! Linkerd handles:
	// - mTLS handshake 
	// - Certificate validation
	// - Service identity verification
	// - Adding l5d-client-id header
	// - Encryption/decryption
	// - Load balancing
	// - Retries and circuit breaking
	
	return c.httpClient.Do(req)
}

// Get performs a GET request
func (c *LinkerdHTTPClient) Get(ctx context.Context, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create GET request: %w", err)
	}
	return c.Do(req)
}

// Post performs a POST request
func (c *LinkerdHTTPClient) Post(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = strings.NewReader(string(jsonData))
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create POST request: %w", err)
	}
	
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	return c.Do(req)
}

// Put performs a PUT request  
func (c *LinkerdHTTPClient) Put(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = strings.NewReader(string(jsonData))
	}
	
	req, err := http.NewRequestWithContext(ctx, "PUT", c.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create PUT request: %w", err)
	}
	
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	return c.Do(req)
}

// Delete performs a DELETE request
func (c *LinkerdHTTPClient) Delete(ctx context.Context, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create DELETE request: %w", err)
	}
	return c.Do(req)
}

// Utility methods

func (c *LinkerdHTTPClient) GetServiceURL() string {
	return c.baseURL
}

func (c *LinkerdHTTPClient) GetServiceName() string {
	return c.serviceName
}

// Example service clients

// UserServiceClient demonstrates how simple service calls become with Linkerd
type UserServiceClient struct {
	client *LinkerdHTTPClient
}

func NewUserServiceClient() *UserServiceClient {
	return &UserServiceClient{
		client: NewLinkerdHTTPClient("user-svc"),
	}
}

// GetUser gets user info - NO AUTHENTICATION CODE NEEDED!
func (c *UserServiceClient) GetUser(ctx context.Context, userID string) (*User, error) {
	resp, err := c.client.Get(ctx, fmt.Sprintf("/api/v1/users/%s", userID))
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get user failed with status %d", resp.StatusCode)
	}
	
	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user: %w", err)
	}
	
	return &user, nil
}

// ChatServiceClient for chat operations  
type ChatServiceClient struct {
	client *LinkerdHTTPClient
}

func NewChatServiceClient() *ChatServiceClient {
	return &ChatServiceClient{
		client: NewLinkerdHTTPClient("chat-svc"),
	}
}

// SendMessage sends a chat message - NO AUTHENTICATION HEADERS!
func (c *ChatServiceClient) SendMessage(ctx context.Context, roomID, userID, message string) error {
	payload := map[string]string{
		"user_id": userID,
		"message": message,
	}
	
	resp, err := c.client.Post(ctx, fmt.Sprintf("/api/v1/rooms/%s/messages", roomID), payload)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("send message failed with status %d", resp.StatusCode)
	}
	
	return nil
}

// User represents a user entity
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// Usage Examples:

// Example 1: Basic service call
func ExampleBasicCall() {
	userClient := NewUserServiceClient()
	user, err := userClient.GetUser(context.Background(), "user-123")
	if err != nil {
		panic(err)
	}
	fmt.Printf("User: %+v\n", user)
}

// Example 2: With timeout
func ExampleWithTimeout() {
	client := NewLinkerdHTTPClientWithTimeout("ai-svc", 10*time.Second)
	resp, err := client.Get(context.Background(), "/api/v1/summarize")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
}

// Example 3: Direct HTTP client usage
func ExampleDirectHTTP() {
	// Even simpler - just use standard http.Client!
	// Linkerd handles authentication automatically
	client := &http.Client{Timeout: 30 * time.Second}
	
	resp, err := client.Get("http://user-svc.link-services.svc.cluster.local:8080/api/v1/users/123")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	
	// That's it! No auth headers, no tokens, no certificates to manage
	// Linkerd proxy automatically:
	// - Performs mTLS handshake
	// - Validates service certificates  
	// - Adds service identity headers
	// - Encrypts all traffic
	// - Provides retries and load balancing
}