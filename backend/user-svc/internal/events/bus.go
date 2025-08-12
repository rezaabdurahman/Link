package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event represents a domain event
type Event interface {
	GetEventID() string
	GetEventType() string
	GetAggregateID() string
	GetOccurredAt() time.Time
	GetData() interface{}
}

// BaseEvent provides common event functionality
type BaseEvent struct {
	EventID     string    `json:"event_id"`
	EventType   string    `json:"event_type"`
	AggregateID string    `json:"aggregate_id"`
	OccurredAt  time.Time `json:"occurred_at"`
	Data        interface{} `json:"data"`
}

func (e BaseEvent) GetEventID() string     { return e.EventID }
func (e BaseEvent) GetEventType() string   { return e.EventType }
func (e BaseEvent) GetAggregateID() string { return e.AggregateID }
func (e BaseEvent) GetOccurredAt() time.Time { return e.OccurredAt }
func (e BaseEvent) GetData() interface{}   { return e.Data }

// EventHandler defines the interface for handling events
type EventHandler func(ctx context.Context, event Event) error

// EventBus defines the interface for publishing and subscribing to events
type EventBus interface {
	Publish(ctx context.Context, event Event) error
	Subscribe(eventType string, handler EventHandler) error
	Unsubscribe(eventType string, handler EventHandler) error
}

// InMemoryEventBus is a simple in-memory event bus implementation
// In production, this would be replaced with a proper message broker (RabbitMQ, Kafka, etc.)
type InMemoryEventBus struct {
	handlers map[string][]EventHandler
	mutex    sync.RWMutex
}

// NewInMemoryEventBus creates a new in-memory event bus
func NewInMemoryEventBus() *InMemoryEventBus {
	return &InMemoryEventBus{
		handlers: make(map[string][]EventHandler),
	}
}

// Publish publishes an event to all subscribed handlers
func (bus *InMemoryEventBus) Publish(ctx context.Context, event Event) error {
	bus.mutex.RLock()
	handlers, exists := bus.handlers[event.GetEventType()]
	bus.mutex.RUnlock()

	if !exists {
		log.Printf("No handlers registered for event type: %s", event.GetEventType())
		return nil
	}

	// Log the event for debugging
	eventData, _ := json.Marshal(event)
	log.Printf("Publishing event: %s - %s", event.GetEventType(), string(eventData))

	// Handle events asynchronously to prevent blocking
	for _, handler := range handlers {
		go func(h EventHandler) {
			if err := h(ctx, event); err != nil {
				log.Printf("Error handling event %s: %v", event.GetEventID(), err)
			}
		}(handler)
	}

	return nil
}

// Subscribe registers an event handler for a specific event type
func (bus *InMemoryEventBus) Subscribe(eventType string, handler EventHandler) error {
	bus.mutex.Lock()
	defer bus.mutex.Unlock()

	bus.handlers[eventType] = append(bus.handlers[eventType], handler)
	log.Printf("Subscribed handler for event type: %s", eventType)
	return nil
}

// Unsubscribe removes an event handler for a specific event type
func (bus *InMemoryEventBus) Unsubscribe(eventType string, handler EventHandler) error {
	bus.mutex.Lock()
	defer bus.mutex.Unlock()

	handlers, exists := bus.handlers[eventType]
	if !exists {
		return fmt.Errorf("no handlers found for event type: %s", eventType)
	}

	// Note: In a real implementation, you'd need a way to identify handlers
	// For now, this is a simple placeholder
	bus.handlers[eventType] = handlers[:len(handlers)-1]
	return nil
}

// NewBaseEvent creates a new base event
func NewBaseEvent(eventType, aggregateID string, data interface{}) BaseEvent {
	return BaseEvent{
		EventID:     uuid.New().String(),
		EventType:   eventType,
		AggregateID: aggregateID,
		OccurredAt:  time.Now().UTC(),
		Data:        data,
	}
}
