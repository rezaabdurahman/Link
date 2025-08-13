package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// DiscoveryClient handles communication with discovery-svc
type DiscoveryClient interface {
	GetAvailableUsers(ctx context.Context) ([]uuid.UUID, error)
}

type discoveryClient struct {
	baseURL    string
	httpClient *http.Client
	authToken  string // Service-to-service auth token
}

// NewDiscoveryClient creates a new discovery service client
func NewDiscoveryClient(baseURL, authToken string) DiscoveryClient {
	return &discoveryClient{
		baseURL:   baseURL,
		authToken: authToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// AvailableUsersResponse represents the response from discovery-svc
type AvailableUsersResponse struct {
	UserIDs []uuid.UUID `json:"user_ids"`
	Count   int         `json:"count"`
}

// GetAvailableUsers fetches currently available user IDs from discovery-svc
func (c *discoveryClient) GetAvailableUsers(ctx context.Context) ([]uuid.UUID, error) {
	url := fmt.Sprintf("%s/available-users", c.baseURL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add service auth header
	if c.authToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.authToken))
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to discovery-svc: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discovery-svc returned status %d: %s", resp.StatusCode, string(body))
	}

	var response AvailableUsersResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return response.UserIDs, nil
}
