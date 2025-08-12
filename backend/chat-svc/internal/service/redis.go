package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"

	"github.com/link-app/chat-svc/internal/config"
	"github.com/link-app/chat-svc/internal/model"
)

// RedisService handles real-time messaging and presence tracking via Redis
type RedisService struct {
	client *redis.Client
	logger *logrus.Logger
}

// NewRedisService creates a new Redis service
func NewRedisService(cfg *config.RedisConfig, logger *logrus.Logger) *RedisService {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	return &RedisService{
		client: client,
		logger: logger,
	}
}

// PublishRealtimeEvent publishes a real-time event to subscribers
func (r *RedisService) PublishRealtimeEvent(ctx context.Context, event *model.RealtimeEvent) error {
	event.Timestamp = time.Now().UTC()
	
	data, err := json.Marshal(event)
	if err != nil {
		r.logger.WithError(err).Error("Failed to marshal realtime event")
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Publish to room-specific channel
	roomChannel := fmt.Sprintf("room:%s", event.RoomID.String())
	if err := r.client.Publish(ctx, roomChannel, data).Err(); err != nil {
		r.logger.WithError(err).WithField("channel", roomChannel).Error("Failed to publish to room channel")
		return fmt.Errorf("failed to publish to room channel: %w", err)
	}

	// Also publish to user-specific channels for participants
	if event.Type == model.EventTypeNewMessage || event.Type == model.EventTypeUserJoined || event.Type == model.EventTypeUserLeft {
		userChannel := fmt.Sprintf("user:%s", event.UserID.String())
		if err := r.client.Publish(ctx, userChannel, data).Err(); err != nil {
			r.logger.WithError(err).WithField("channel", userChannel).Warn("Failed to publish to user channel")
			// Don't fail the entire operation for user channel failures
		}
	}

	r.logger.WithFields(logrus.Fields{
		"event_type": event.Type,
		"room_id":    event.RoomID,
		"user_id":    event.UserID,
	}).Debug("Published realtime event")

	return nil
}

// SetUserPresence sets user presence status with TTL
func (r *RedisService) SetUserPresence(ctx context.Context, userID uuid.UUID, presence model.UserPresence) error {
	key := fmt.Sprintf("presence:%s", userID.String())
	
	data, err := json.Marshal(presence)
	if err != nil {
		return fmt.Errorf("failed to marshal presence: %w", err)
	}

	// Set presence with 5-minute TTL
	ttl := 5 * time.Minute
	if err := r.client.Set(ctx, key, data, ttl).Err(); err != nil {
		r.logger.WithError(err).WithField("user_id", userID).Error("Failed to set user presence")
		return fmt.Errorf("failed to set presence: %w", err)
	}

	// Add to online users set if online
	if presence.Status == model.PresenceOnline {
		onlineKey := "presence:online"
		if err := r.client.SAdd(ctx, onlineKey, userID.String()).Err(); err != nil {
			r.logger.WithError(err).Error("Failed to add user to online set")
		}
		// Set TTL for the online set key
		r.client.Expire(ctx, onlineKey, ttl)
	}

	// Publish presence update event
	if presence.RoomID != nil {
		event := &model.RealtimeEvent{
			Type:     model.EventTypePresenceUpdate,
			RoomID:   *presence.RoomID,
			UserID:   userID,
			Presence: &presence,
		}
		r.PublishRealtimeEvent(ctx, event)
	}

	r.logger.WithFields(logrus.Fields{
		"user_id": userID,
		"status":  presence.Status,
		"room_id": presence.RoomID,
	}).Debug("Set user presence")

	return nil
}

// GetUserPresence gets user presence status
func (r *RedisService) GetUserPresence(ctx context.Context, userID uuid.UUID) (*model.UserPresence, error) {
	key := fmt.Sprintf("presence:%s", userID.String())
	
	data, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			// Return offline status if no presence found
			return &model.UserPresence{
				UserID:   userID,
				Status:   model.PresenceOffline,
				LastSeen: time.Now().UTC(),
			}, nil
		}
		return nil, fmt.Errorf("failed to get presence: %w", err)
	}

	var presence model.UserPresence
	if err := json.Unmarshal([]byte(data), &presence); err != nil {
		return nil, fmt.Errorf("failed to unmarshal presence: %w", err)
	}

	return &presence, nil
}

// GetOnlineUsers returns list of currently online users
func (r *RedisService) GetOnlineUsers(ctx context.Context) ([]uuid.UUID, error) {
	onlineKey := "presence:online"
	
	userIDs, err := r.client.SMembers(ctx, onlineKey).Result()
	if err != nil {
		if err == redis.Nil {
			return []uuid.UUID{}, nil
		}
		return nil, fmt.Errorf("failed to get online users: %w", err)
	}

	result := make([]uuid.UUID, 0, len(userIDs))
	for _, userIDStr := range userIDs {
		if userID, err := uuid.Parse(userIDStr); err == nil {
			result = append(result, userID)
		}
	}

	return result, nil
}

// RemoveUserPresence removes user from presence tracking (on logout)
func (r *RedisService) RemoveUserPresence(ctx context.Context, userID uuid.UUID) error {
	key := fmt.Sprintf("presence:%s", userID.String())
	onlineKey := "presence:online"
	
	// Remove presence data
	if err := r.client.Del(ctx, key).Err(); err != nil {
		r.logger.WithError(err).WithField("user_id", userID).Error("Failed to remove user presence")
	}

	// Remove from online users set
	if err := r.client.SRem(ctx, onlineKey, userID.String()).Err(); err != nil {
		r.logger.WithError(err).WithField("user_id", userID).Error("Failed to remove user from online set")
	}

	r.logger.WithField("user_id", userID).Debug("Removed user presence")
	return nil
}

// SetTypingIndicator sets typing indicator for a user in a room
func (r *RedisService) SetTypingIndicator(ctx context.Context, roomID, userID uuid.UUID, isTyping bool) error {
	key := fmt.Sprintf("typing:%s", roomID.String())
	
	if isTyping {
		// Add user to typing set with TTL
		if err := r.client.SAdd(ctx, key, userID.String()).Err(); err != nil {
			return fmt.Errorf("failed to set typing indicator: %w", err)
		}
		// Set TTL for typing indicator (auto-expire after 10 seconds)
		r.client.Expire(ctx, key, 10*time.Second)

		// Publish typing start event
		event := &model.RealtimeEvent{
			Type:   model.EventTypeTypingStart,
			RoomID: roomID,
			UserID: userID,
		}
		r.PublishRealtimeEvent(ctx, event)
	} else {
		// Remove user from typing set
		if err := r.client.SRem(ctx, key, userID.String()).Err(); err != nil {
			return fmt.Errorf("failed to remove typing indicator: %w", err)
		}

		// Publish typing stop event
		event := &model.RealtimeEvent{
			Type:   model.EventTypeTypingStop,
			RoomID: roomID,
			UserID: userID,
		}
		r.PublishRealtimeEvent(ctx, event)
	}

	return nil
}

// GetTypingUsers returns users currently typing in a room
func (r *RedisService) GetTypingUsers(ctx context.Context, roomID uuid.UUID) ([]uuid.UUID, error) {
	key := fmt.Sprintf("typing:%s", roomID.String())
	
	userIDs, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return []uuid.UUID{}, nil
		}
		return nil, fmt.Errorf("failed to get typing users: %w", err)
	}

	result := make([]uuid.UUID, 0, len(userIDs))
	for _, userIDStr := range userIDs {
		if userID, err := uuid.Parse(userIDStr); err == nil {
			result = append(result, userID)
		}
	}

	return result, nil
}

// IncrementUnreadCount increments unread message count for a user in a room
func (r *RedisService) IncrementUnreadCount(ctx context.Context, userID, roomID uuid.UUID) error {
	key := fmt.Sprintf("unread:%s:%s", userID.String(), roomID.String())
	
	if err := r.client.Incr(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to increment unread count: %w", err)
	}

	// Set TTL to prevent stale data (30 days)
	r.client.Expire(ctx, key, 30*24*time.Hour)
	
	return nil
}

// ResetUnreadCount resets unread message count for a user in a room
func (r *RedisService) ResetUnreadCount(ctx context.Context, userID, roomID uuid.UUID) error {
	key := fmt.Sprintf("unread:%s:%s", userID.String(), roomID.String())
	
	if err := r.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to reset unread count: %w", err)
	}
	
	return nil
}

// GetUnreadCount gets unread message count for a user in a room
func (r *RedisService) GetUnreadCount(ctx context.Context, userID, roomID uuid.UUID) (int, error) {
	key := fmt.Sprintf("unread:%s:%s", userID.String(), roomID.String())
	
	count, err := r.client.Get(ctx, key).Int()
	if err != nil {
		if err == redis.Nil {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}
	
	return count, nil
}

// Close closes the Redis connection
func (r *RedisService) Close() error {
	return r.client.Close()
}

// Health checks Redis connectivity
func (r *RedisService) Health(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}
