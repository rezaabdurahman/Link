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
	GetUserFriends(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error)
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
	ID               uuid.UUID `json:"id"`
	Bio              string    `json:"bio"`
	Interests        []string  `json:"interests"`
	Profession       string    `json:"profession"`
	Skills           []string  `json:"skills,omitempty"`
	Location         string    `json:"location,omitempty"`
	ProfilePicture   *string   `json:"profile_picture,omitempty"`
	AdditionalPhotos []string  `json:"additional_photos,omitempty"`
	ImageDescriptions *string  `json:"image_descriptions,omitempty"` // Cached image analysis results
	UpdatedAt        time.Time `json:"updated_at"`
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

// FriendsResponse represents the friends response from user-svc
type FriendsResponse struct {
	Friends []Friend `json:"friends"`
	Page    int      `json:"page"`
	Limit   int      `json:"limit"`
	Count   int      `json:"count"`
}

// Friend represents a friend object from user-svc
type Friend struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Bio      string    `json:"bio,omitempty"`
}

// GetUserFriends fetches a user's friends from user-svc
func (c *userClient) GetUserFriends(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	url := fmt.Sprintf("%s/api/v1/users/friends", c.baseURL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add service auth header and user context
	if c.authToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.authToken))
	}
	// Set user context headers (simulate API gateway behavior)
	req.Header.Set("X-User-ID", userID.String())
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to user-svc: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user-svc returned status %d: %s", resp.StatusCode, string(body))
	}

	var response FriendsResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extract friend IDs
	friendIDs := make([]uuid.UUID, len(response.Friends))
	for i, friend := range response.Friends {
		friendIDs[i] = friend.ID
	}

	return friendIDs, nil
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

// ProfileToTextWithImages converts user profile to searchable text including cached image descriptions
func (p *UserProfile) ProfileToTextWithImages() string {
	text := p.ProfileToText()
	
	// Add cached image descriptions if available
	if p.ImageDescriptions != nil && *p.ImageDescriptions != "" {
		if text != "" {
			text += " " + *p.ImageDescriptions
		} else {
			text = *p.ImageDescriptions
		}
	}
	
	return text
}

// HasImages returns true if the profile has any images
func (p *UserProfile) HasImages() bool {
	return (p.ProfilePicture != nil && *p.ProfilePicture != "") || len(p.AdditionalPhotos) > 0
}

// GetImageURLs returns all image URLs for the profile
func (p *UserProfile) GetImageURLs() []string {
	var urls []string
	
	if p.ProfilePicture != nil && *p.ProfilePicture != "" {
		urls = append(urls, *p.ProfilePicture)
	}
	
	for _, photo := range p.AdditionalPhotos {
		if photo != "" {
			urls = append(urls, photo)
		}
	}
	
	return urls
}
