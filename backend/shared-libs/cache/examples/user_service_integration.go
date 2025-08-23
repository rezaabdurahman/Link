package examples

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/link-app/shared-libs/cache"
)

// This is an example of how to integrate the cache system into the user service

// UserService example with caching
type UserService struct {
	cacheManager *cache.ServiceCacheManager
	// ... other dependencies like database
}

// NewUserService creates a new user service with caching
func NewUserService() (*UserService, error) {
	cacheManager, err := cache.NewServiceCacheManager("user-svc")
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cache: %w", err)
	}

	return &UserService{
		cacheManager: cacheManager,
	}, nil
}

// GetUserProfile retrieves a user profile with caching
func (us *UserService) GetUserProfile(ctx context.Context, userID string) (*UserProfile, error) {
	var profile UserProfile

	// Try to get from cache using the cache helper
	err := us.cacheManager.User.GetProfile(ctx, userID, &profile)
	if err == nil {
		return &profile, nil // Cache hit
	}

	if !cache.IsCacheMiss(err) {
		// Log cache error but continue
		fmt.Printf("Cache error for user profile %s: %v\n", userID, err)
	}

	// Cache miss - fetch from database
	profile, err = us.fetchUserProfileFromDB(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Cache the result (15 minutes TTL)
	if err := us.cacheManager.User.SetProfile(ctx, userID, profile, 15*time.Minute); err != nil {
		fmt.Printf("Failed to cache user profile %s: %v\n", userID, err)
	}

	return &profile, nil
}

// UpdateUserProfile updates a user profile and invalidates cache
func (us *UserService) UpdateUserProfile(ctx context.Context, userID string, updates UserProfileUpdate) (*UserProfile, error) {
	// Update in database
	profile, err := us.updateUserProfileInDB(ctx, userID, updates)
	if err != nil {
		return nil, err
	}

	// Invalidate cache
	if err := us.cacheManager.User.InvalidateUser(ctx, userID); err != nil {
		fmt.Printf("Failed to invalidate user cache %s: %v\n", userID, err)
	}

	// Cache the updated profile
	if err := us.cacheManager.User.SetProfile(ctx, userID, profile, 15*time.Minute); err != nil {
		fmt.Printf("Failed to cache updated user profile %s: %v\n", userID, err)
	}

	return &profile, nil
}

// GetUserFriends retrieves user friends with caching
func (us *UserService) GetUserFriends(ctx context.Context, userID string) ([]Friend, error) {
	var friends []Friend

	// Use the generic helper for friends list
	err := us.cacheManager.Helper.GetOrSet(
		ctx,
		us.cacheManager.User.FriendsKey(userID),
		&friends,
		func() (interface{}, error) {
			return us.fetchUserFriendsFromDB(ctx, userID)
		},
		10*time.Minute, // 10 minutes TTL
	)

	return friends, err
}

// SetupCacheMiddleware sets up cache middleware for HTTP endpoints
func (us *UserService) SetupCacheMiddleware(router *gin.Engine) {
	// Create cache middleware config
	middlewareConfig := &cache.CacheMiddlewareConfig{
		Cache:      us.cacheManager.Cache,
		DefaultTTL: 5 * time.Minute,
		KeyPrefix:  "http:user",
		CacheHeaders: true,
		SkipPaths: []string{
			"/users/profile/me", // Don't cache user's own profile
			"/users/friends/requests", // Don't cache dynamic data
		},
		VaryHeaders: []string{"Authorization"}, // Include auth in cache key
		ConditionalHeaders: true,
		MaxBodySize: 512 * 1024, // 512KB max
	}

	cacheMiddleware := cache.NewCacheMiddleware(middlewareConfig)

	// Apply to public profile endpoints only
	profileGroup := router.Group("/users/profile")
	profileGroup.Use(gin.WrapH(cacheMiddleware.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// This wrapper converts http.Handler to gin middleware
	}))))
	{
		profileGroup.GET("/:id", us.handleGetProfile)
	}

	// Set global middleware for invalidation
	cache.SetGlobalCacheMiddleware(cacheMiddleware)
}

// HTTP handlers

func (us *UserService) handleGetProfile(c *gin.Context) {
	userID := c.Param("id")
	
	profile, err := us.GetUserProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, profile)
}

func (us *UserService) handleUpdateProfile(c *gin.Context) {
	userID := c.Param("id")
	
	var updates UserProfileUpdate
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	profile, err := us.UpdateUserProfile(c.Request.Context(), userID, updates)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	// Invalidate HTTP cache for this user
	if err := cache.InvalidateGlobalByPath(c.Request.Context(), fmt.Sprintf("/users/profile/%s", userID)); err != nil {
		fmt.Printf("Failed to invalidate HTTP cache: %v\n", err)
	}

	c.JSON(200, profile)
}

// Close closes the cache connections
func (us *UserService) Close() error {
	return us.cacheManager.Close()
}

// Placeholder types and methods (would be replaced with actual implementations)

type UserProfile struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	// ... other fields
}

type UserProfileUpdate struct {
	Name  *string `json:"name,omitempty"`
	Email *string `json:"email,omitempty"`
	// ... other fields
}

type Friend struct {
	UserID string `json:"user_id"`
	Name   string `json:"name"`
	// ... other fields
}

func (us *UserService) fetchUserProfileFromDB(ctx context.Context, userID string) (UserProfile, error) {
	// Database fetch logic here
	return UserProfile{}, nil
}

func (us *UserService) updateUserProfileInDB(ctx context.Context, userID string, updates UserProfileUpdate) (UserProfile, error) {
	// Database update logic here
	return UserProfile{}, nil
}

func (us *UserService) fetchUserFriendsFromDB(ctx context.Context, userID string) ([]Friend, error) {
	// Database fetch logic here
	return []Friend{}, nil
}