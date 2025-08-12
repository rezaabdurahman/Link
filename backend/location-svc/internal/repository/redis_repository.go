package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/link-app/backend/location-svc/internal/config"
	"github.com/link-app/backend/location-svc/internal/dto"
)

// RedisRepository interface defines Redis operations
type RedisRepository interface {
	// GEO operations for real-time location
	SetUserLocation(ctx context.Context, userID uuid.UUID, lat, lon float64) error
	GetUserLocation(ctx context.Context, userID uuid.UUID) (*redis.GeoPos, error)
	GetNearbyUsers(ctx context.Context, lat, lon float64, radius float64, unit string, count int64) ([]redis.GeoLocation, error)
	RemoveUserLocation(ctx context.Context, userID uuid.UUID) error
	GetUserDistance(ctx context.Context, userID1, userID2 uuid.UUID) (float64, error)
	
	// Caching operations
	SetLocationCache(ctx context.Context, key string, data interface{}, ttl time.Duration) error
	GetLocationCache(ctx context.Context, key string, dest interface{}) error
	DeleteLocationCache(ctx context.Context, key string) error
	SetPrivacyCache(ctx context.Context, userID uuid.UUID, settings interface{}, ttl time.Duration) error
	GetPrivacyCache(ctx context.Context, userID uuid.UUID, dest interface{}) error
	
	// Pub/Sub operations
	PublishUserAvailable(ctx context.Context, event *dto.UserAvailableEvent) error
	PublishLocationUpdate(ctx context.Context, userID uuid.UUID, lat, lon float64) error
	PublishProximityEvent(ctx context.Context, userID, otherUserID uuid.UUID, distance float64, eventType string) error
}

type redisRepository struct {
	client *redis.Client
}

// NewRedisRepository creates a new Redis repository
func NewRedisRepository(client *redis.Client) RedisRepository {
	return &redisRepository{
		client: client,
	}
}

// SetUserLocation stores user's current location using Redis GEO
func (r *redisRepository) SetUserLocation(ctx context.Context, userID uuid.UUID, lat, lon float64) error {
	_, err := r.client.GeoAdd(ctx, config.RedisKeyUserLocations, &redis.GeoLocation{
		Name:      userID.String(),
		Longitude: lon,
		Latitude:  lat,
	}).Result()
	
	if err != nil {
		return fmt.Errorf("failed to set user location in Redis: %w", err)
	}
	
	return nil
}

// GetUserLocation retrieves user's current location from Redis GEO
func (r *redisRepository) GetUserLocation(ctx context.Context, userID uuid.UUID) (*redis.GeoPos, error) {
	positions, err := r.client.GeoPos(ctx, config.RedisKeyUserLocations, userID.String()).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get user location from Redis: %w", err)
	}
	
	if len(positions) == 0 || positions[0] == nil {
		return nil, nil
	}
	
	return positions[0], nil
}

// GetNearbyUsers finds nearby users using Redis GEORADIUS
func (r *redisRepository) GetNearbyUsers(ctx context.Context, lat, lon float64, radius float64, unit string, count int64) ([]redis.GeoLocation, error) {
	query := &redis.GeoRadiusQuery{
		Radius:    radius,
		Unit:      unit,
		WithCoord: true,
		WithDist:  true,
		Count:     int(count),
		Sort:      "ASC",
	}
	
	results, err := r.client.GeoRadius(ctx, config.RedisKeyUserLocations, lon, lat, query).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to find nearby users in Redis: %w", err)
	}
	
	return results, nil
}

// RemoveUserLocation removes user's location from Redis GEO
func (r *redisRepository) RemoveUserLocation(ctx context.Context, userID uuid.UUID) error {
	_, err := r.client.ZRem(ctx, config.RedisKeyUserLocations, userID.String()).Result()
	if err != nil {
		return fmt.Errorf("failed to remove user location from Redis: %w", err)
	}
	
	return nil
}

// GetUserDistance calculates distance between two users using Redis GEODIST
func (r *redisRepository) GetUserDistance(ctx context.Context, userID1, userID2 uuid.UUID) (float64, error) {
	distance, err := r.client.GeoDist(ctx, config.RedisKeyUserLocations, 
		userID1.String(), userID2.String(), "m").Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get user distance from Redis: %w", err)
	}
	
	return distance, nil
}

// SetLocationCache stores data in location cache with TTL
func (r *redisRepository) SetLocationCache(ctx context.Context, key string, data interface{}, ttl time.Duration) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal cache data: %w", err)
	}
	
	fullKey := config.RedisKeyLocationCache + key
	_, err = r.client.Set(ctx, fullKey, jsonData, ttl).Result()
	if err != nil {
		return fmt.Errorf("failed to set location cache: %w", err)
	}
	
	return nil
}

// GetLocationCache retrieves data from location cache
func (r *redisRepository) GetLocationCache(ctx context.Context, key string, dest interface{}) error {
	fullKey := config.RedisKeyLocationCache + key
	jsonData, err := r.client.Get(ctx, fullKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil // Cache miss
		}
		return fmt.Errorf("failed to get location cache: %w", err)
	}
	
	if err := json.Unmarshal([]byte(jsonData), dest); err != nil {
		return fmt.Errorf("failed to unmarshal cache data: %w", err)
	}
	
	return nil
}

// DeleteLocationCache removes data from location cache
func (r *redisRepository) DeleteLocationCache(ctx context.Context, key string) error {
	fullKey := config.RedisKeyLocationCache + key
	_, err := r.client.Del(ctx, fullKey).Result()
	if err != nil {
		return fmt.Errorf("failed to delete location cache: %w", err)
	}
	
	return nil
}

// SetPrivacyCache stores privacy settings in cache with TTL
func (r *redisRepository) SetPrivacyCache(ctx context.Context, userID uuid.UUID, settings interface{}, ttl time.Duration) error {
	jsonData, err := json.Marshal(settings)
	if err != nil {
		return fmt.Errorf("failed to marshal privacy settings: %w", err)
	}
	
	key := config.RedisKeyPrivacyCache + userID.String()
	_, err = r.client.Set(ctx, key, jsonData, ttl).Result()
	if err != nil {
		return fmt.Errorf("failed to set privacy cache: %w", err)
	}
	
	return nil
}

// GetPrivacyCache retrieves privacy settings from cache
func (r *redisRepository) GetPrivacyCache(ctx context.Context, userID uuid.UUID, dest interface{}) error {
	key := config.RedisKeyPrivacyCache + userID.String()
	jsonData, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil // Cache miss
		}
		return fmt.Errorf("failed to get privacy cache: %w", err)
	}
	
	if err := json.Unmarshal([]byte(jsonData), dest); err != nil {
		return fmt.Errorf("failed to unmarshal privacy settings: %w", err)
	}
	
	return nil
}

// PublishUserAvailable publishes user availability event
func (r *redisRepository) PublishUserAvailable(ctx context.Context, event *dto.UserAvailableEvent) error {
	jsonData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal user available event: %w", err)
	}
	
	_, err = r.client.Publish(ctx, config.RedisChannelUserAvailable, jsonData).Result()
	if err != nil {
		return fmt.Errorf("failed to publish user available event: %w", err)
	}
	
	return nil
}

// PublishLocationUpdate publishes location update event
func (r *redisRepository) PublishLocationUpdate(ctx context.Context, userID uuid.UUID, lat, lon float64) error {
	event := map[string]interface{}{
		"user_id":   userID,
		"latitude":  lat,
		"longitude": lon,
		"timestamp": time.Now(),
	}
	
	jsonData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal location update event: %w", err)
	}
	
	_, err = r.client.Publish(ctx, config.RedisChannelLocationUpdate, jsonData).Result()
	if err != nil {
		return fmt.Errorf("failed to publish location update event: %w", err)
	}
	
	return nil
}

// PublishProximityEvent publishes proximity event
func (r *redisRepository) PublishProximityEvent(ctx context.Context, userID, otherUserID uuid.UUID, distance float64, eventType string) error {
	event := map[string]interface{}{
		"user_id":        userID,
		"other_user_id":  otherUserID,
		"distance":       distance,
		"event_type":     eventType,
		"timestamp":      time.Now(),
	}
	
	jsonData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal proximity event: %w", err)
	}
	
	_, err = r.client.Publish(ctx, config.RedisChannelProximityEvent, jsonData).Result()
	if err != nil {
		return fmt.Errorf("failed to publish proximity event: %w", err)
	}
	
	return nil
}

// Helper function to generate cache keys
func (r *redisRepository) generateNearbyKey(lat, lon float64, radius int, userID uuid.UUID) string {
	latStr := strconv.FormatFloat(lat, 'f', 6, 64)
	lonStr := strconv.FormatFloat(lon, 'f', 6, 64)
	return fmt.Sprintf("nearby_%s_%s_%d_%s", latStr, lonStr, radius, userID.String())
}
