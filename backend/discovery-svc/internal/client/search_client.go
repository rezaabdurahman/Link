package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// SearchClient handles communication with the search service
type SearchClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewSearchClient creates a new search client
func NewSearchClient(baseURL string) *SearchClient {
	return &SearchClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SearchRequest represents the request to search-svc
type SearchRequest struct {
	Query   string      `json:"query"`
	UserIDs []uuid.UUID `json:"user_ids,omitempty"`
	Limit   *int        `json:"limit,omitempty"`
}

// SearchResponse represents the response from search-svc
type SearchResponse struct {
	Results         []SearchResult `json:"results"`
	QueryProcessed  string         `json:"query_processed"`
	TotalCandidates int            `json:"total_candidates"`
	SearchTimeMs    int            `json:"search_time_ms"`
}

// SearchResult represents an individual search result
type SearchResult struct {
	UserID       uuid.UUID `json:"user_id"`
	Score        float64   `json:"score"`
	MatchReasons []string  `json:"match_reasons,omitempty"`
}

// Search performs a search against the search service
func (c *SearchClient) Search(ctx context.Context, userID uuid.UUID, req *SearchRequest) (*SearchResponse, error) {
	// Prepare request body
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search request: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/api/v1/search", c.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", userID.String())

	// Make the request
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %w", err)
	}
	defer resp.Body.Close()

	// Handle non-2xx responses
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("search service returned status %d", resp.StatusCode)
	}

	// Parse response
	var searchResp SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	return &searchResp, nil
}

// HealthCheck checks if the search service is available
func (c *SearchClient) HealthCheck(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("search service unhealthy: status %d", resp.StatusCode)
	}

	return nil
}
