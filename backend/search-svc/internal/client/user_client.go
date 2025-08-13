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

// UserClient handles communication with user-svc
type UserClient interface {
	GetUserProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error)
}

type userClient struct {
	baseURL    string
	httpClient *http.Client
	authToken  string // Service-to-service auth token
}

// NewUserClient creates a new user service client
func NewUserClient(baseURL, authToken string) UserClient {
	return &userClient{
		baseURL:   baseURL,
		authToken: authToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// UserProfile represents the public user profile from user-svc
type UserProfile struct {
	ID         uuid.UUID `json:"id"`
	Bio        string    `json:"bio"`
	Interests  []string  `json:"interests"`
	Profession string    `json:"profession"`
	Skills     []string  `json:"skills,omitempty"`
	Location   string    `json:"location,omitempty"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// GetUserProfile fetches a user's public profile from user-svc
func (c *userClient) GetUserProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error) {
	url := fmt.Sprintf("%s/api/v1/users/profile/%s", c.baseURL, userID.String())
	
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
		return nil, fmt.Errorf("failed to make request to user-svc: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("user profile not found: %s", userID.String())
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user-svc returned status %d: %s", resp.StatusCode, string(body))
	}

	var profile UserProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &profile, nil
}

// ProfileToText converts user profile to searchable text for embedding
func (p *UserProfile) ProfileToText() string {
	var text string
	
	if p.Bio != "" {
		text += p.Bio + " "
	}
	
	if p.Profession != "" {
		text += p.Profession + " "
	}
	
	if len(p.Interests) > 0 {
		text += "Interests: "
		for i, interest := range p.Interests {
			if i > 0 {
				text += ", "
			}
			text += interest
		}
		text += " "
	}
	
	if len(p.Skills) > 0 {
		text += "Skills: "
		for i, skill := range p.Skills {
			if i > 0 {
				text += ", "
			}
			text += skill
		}
		text += " "
	}
	
	if p.Location != "" {
		text += "Location: " + p.Location + " "
	}
	
	return text
}
