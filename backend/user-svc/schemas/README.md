# Event Schemas

This directory contains event schemas in both Protobuf and Avro formats for user and onboarding events.

## Schema Files

### Protobuf Schemas
- `events.proto` - Complete event definitions for all user and onboarding events

### Avro Schemas  
- `user_registered_event.avsc` - Schema for UserRegistered event
- `user_onboarded_event.avsc` - Schema for UserOnboarded event

## Events Defined

### UserRegistered Event
Emitted when a new user registers in the system.

**Fields:**
- `user_id` - Unique identifier for the user
- `email` - User's email address
- `username` - User's chosen username
- `first_name` - User's first name
- `last_name` - User's last name
- `date_of_birth` - Optional date of birth
- `registered_at` - Timestamp of registration

### UserOnboarded Event
Emitted when a user completes the onboarding process.

**Fields:**
- `user_id` - Unique identifier for the user
- `completed_at` - Timestamp when onboarding completed
- `started_at` - Timestamp when onboarding started
- `duration` - Human readable duration string
- `completed_steps` - Array of completed onboarding steps

### UserOnboardingStarted Event
Emitted when a user begins the onboarding process.

**Fields:**
- `user_id` - Unique identifier for the user
- `started_at` - Timestamp when onboarding started

### UserOnboardingProgressed Event
Emitted when a user completes an onboarding step.

**Fields:**
- `user_id` - Unique identifier for the user
- `completed_step` - The step that was just completed
- `current_step` - The next step in the process (optional)
- `completed_steps` - Array of all completed steps
- `progressed_at` - Timestamp of the progress

### UserOnboardingSkipped Event
Emitted when a user skips the onboarding process.

**Fields:**
- `user_id` - Unique identifier for the user
- `skipped_at` - Timestamp when onboarding was skipped
- `started_at` - Timestamp when onboarding started (optional)
- `partial_steps` - Array of steps completed before skipping

## Usage

### Generating Go Code from Protobuf

```bash
# Install protoc and Go plugin
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

# Generate Go code
protoc --go_out=. --go_opt=paths=source_relative events.proto
```

### Using with Kafka

```go
// Producer
producer, err := kafka.NewProducer(&kafka.ConfigMap{"bootstrap.servers": "localhost:9092"})
event := events.NewUserRegisteredEvent(userID, email, username, firstName, lastName, dateOfBirth)
eventBytes, _ := json.Marshal(event)
producer.Produce(&kafka.Message{
    TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
    Value: eventBytes,
}, nil)

// Consumer  
consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
    "bootstrap.servers": "localhost:9092",
    "group.id": "onboarding-service",
    "auto.offset.reset": "earliest",
})
consumer.Subscribe("user-events", nil)
```

### Using with NATS

```go
// Publisher
nc, _ := nats.Connect(nats.DefaultURL)
event := events.NewUserRegisteredEvent(userID, email, username, firstName, lastName, dateOfBirth)
eventBytes, _ := json.Marshal(event)
nc.Publish("user.registered", eventBytes)

// Subscriber
nc.Subscribe("user.registered", func(msg *nats.Msg) {
    var event events.UserRegisteredEvent
    json.Unmarshal(msg.Data, &event)
    // Handle event
})
```

## Schema Evolution

### Protobuf
Protobuf supports schema evolution through:
- Adding optional fields
- Using field numbers consistently
- Avoiding removing required fields

### Avro
Avro supports evolution through:
- Adding fields with default values
- Removing fields
- Changing field types (with compatibility rules)

## Validation

Both schemas include validation rules:
- Required fields must be present
- UUIDs must be valid format
- Timestamps must be in correct format
- Arrays cannot be null (but can be empty)

## Future Considerations

When extracting the onboarding service:

1. **Schema Registry** - Consider using Confluent Schema Registry or similar for centralized schema management
2. **Versioning** - Implement proper schema versioning strategy  
3. **Compatibility** - Ensure backward/forward compatibility between service versions
4. **Monitoring** - Add schema validation metrics and alerts
