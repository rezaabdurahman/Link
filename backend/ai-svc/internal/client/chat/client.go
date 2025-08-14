package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/google/uuid"
	"github.com/link-app/ai-svc/internal/config"
	"github.com/rs/zerolog"
)

// Client represents the chat service client
type Client struct {
	baseURL        string
	httpClient     *http.Client
	retryer        *Retryer
	circuitBreaker *CircuitBreaker
	logger         zerolog.Logger
	jwtToken       string
}

// ClientConfig holds configuration for the chat client
type ClientConfig struct {
	Config   config.ChatServiceConfig
	Logger   zerolog.Logger
	JWTToken string
}

// NewClient creates a new chat service client
func NewClient(cfg ClientConfig) *Client {
	httpClient := &http.Client{
		Timeout: cfg.Config.Timeout,
	}

	// Configure retry mechanism
	retryConfig := RetryConfig{
		MaxRetries:        cfg.Config.MaxRetries,
		InitialDelay:      cfg.Config.RetryDelay,
		BackoffMultiplier: cfg.Config.RetryBackoffMultiplier,
		Jitter:           true,
		RetryableErrors:  isRetryableHTTPError,
	}
	retryer := NewRetryer(retryConfig)

	var circuitBreaker *CircuitBreaker
	if cfg.Config.CircuitBreakerEnabled {
		cbConfig := CircuitBreakerConfig{
			MaxFailures: cfg.Config.CircuitBreakerMaxFails,
			Timeout:     cfg.Config.CircuitBreakerTimeout,
			OnStateChange: func(from, to CircuitBreakerState) {
				cfg.Logger.Info().
					Str("from", from.String()).
					Str("to", to.String()).
					Msg("Circuit breaker state changed")
			},
		}
		circuitBreaker = NewCircuitBreaker(cbConfig)
	}

	return &Client{
		baseURL:        cfg.Config.BaseURL,
		httpClient:     httpClient,
		retryer:        retryer,
		circuitBreaker: circuitBreaker,
		logger:         cfg.Logger,
		jwtToken:       cfg.JWTToken,
	}
}

// GetRecentMessages retrieves recent messages from a conversation
func (c *Client) GetRecentMessages(ctx context.Context, conversationID uuid.UUID, limit int) (*GetMessagesResponse, error) {
	if limit <= 0 {
		limit = 10 // Default limit
	}

	// Build URL with query parameters
	u, err := url.Parse(fmt.Sprintf("%s/api/v1/chat/conversations/%s/messages", c.baseURL, conversationID.String()))
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}

	query := u.Query()
	query.Set("limit", strconv.Itoa(limit))
	u.RawQuery = query.Encode()

	// Execute with resilience patterns
	var response *GetMessagesResponse
	executeFunc := func() error {
		resp, err := c.makeRequest(ctx, "GET", u.String(), nil)
		if err != nil {
			return err
		}
		response = resp
		return nil
	}

	// Apply circuit breaker if enabled
	if c.circuitBreaker != nil {
		err = c.circuitBreaker.Execute(ctx, func() error {
			return c.retryer.Execute(ctx, executeFunc)
		})
	} else {
		err = c.retryer.Execute(ctx, executeFunc)
	}

	if err != nil {
		c.logger.Error().
			Err(err).
			Str("conversation_id", conversationID.String()).
			Int("limit", limit).
			Msg("Failed to get recent messages")
		return nil, err
	}

	c.logger.Info().
		Str("conversation_id", conversationID.String()).
		Int("limit", limit).
		Int("messages_count", len(response.Messages)).
		Msg("Successfully retrieved recent messages")

	return response, nil
}

// makeRequest performs the actual HTTP request
func (c *Client) makeRequest(ctx context.Context, method, url string, body io.Reader) (*GetMessagesResponse, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.jwtToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.jwtToken))
	}

	// Make the request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for HTTP errors
	if resp.StatusCode >= 400 {
		var errorResp ErrorResponse
		if err := json.Unmarshal(respBody, &errorResp); err != nil {
			return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
		}
		return nil, fmt.Errorf("HTTP %d: %s - %s", resp.StatusCode, errorResp.Error, errorResp.Message)
	}

	// Parse successful response
	var response GetMessagesResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// UpdateJWTToken updates the JWT token used for authentication
func (c *Client) UpdateJWTToken(token string) {
	c.jwtToken = token
}

// GetCircuitBreakerState returns the current circuit breaker state
func (c *Client) GetCircuitBreakerState() CircuitBreakerState {
	if c.circuitBreaker == nil {
		return CircuitBreakerClosed // Default when circuit breaker is disabled
	}
	return c.circuitBreaker.GetState()
}

// ResetCircuitBreaker resets the circuit breaker to its initial state
func (c *Client) ResetCircuitBreaker() {
	if c.circuitBreaker != nil {
		c.circuitBreaker.Reset()
	}
}

// Health checks if the chat service is healthy
func (c *Client) Health(ctx context.Context) error {
	healthURL := fmt.Sprintf("%s/health", c.baseURL)
	
	executeFunc := func() error {
		req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
		if err != nil {
			return fmt.Errorf("failed to create health check request: %w", err)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("health check request failed: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
		}

		return nil
	}

	// Apply circuit breaker if enabled
	if c.circuitBreaker != nil {
		return c.circuitBreaker.Execute(ctx, executeFunc)
	}

	return executeFunc()
}

// isRetryableHTTPError determines if an HTTP error is retryable
func isRetryableHTTPError(err error) bool {
	if err == nil {
		return false
	}

	// Don't retry circuit breaker errors
	if err == ErrCircuitBreakerOpen {
		return false
	}

	// Don't retry context cancellation
	if err == context.Canceled || err == context.DeadlineExceeded {
		return false
	}

	// For HTTP errors, we could parse the error message to determine status codes
	// For now, retry on any other error
	return true
}
