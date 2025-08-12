# Onboarding Service Extraction Design

This document outlines the design implemented to enable easy extraction of the onboarding functionality into a separate microservice in the future.

## Current Architecture (Step 5 Implementation)

### 1. Interface-Based Communication

All interactions between the auth service and onboarding functionality now go through the `OnboardingInterface`:

- `NotifyUserRegistered()` - Called when a user registers to initialize onboarding
- `GetOnboardingStatus()` - Retrieves current onboarding status  
- `IsOnboardingComplete()` - Checks if onboarding is completed

This ensures no direct struct access between services, making extraction cleaner.

### 2. Data Access Abstraction

Created `OnboardingDataRepository` interface that abstracts access to onboarding data:

- Currently implemented using the shared users database
- Provides clear boundary for future database split
- Includes batch operations for data migration (`GetAllOnboardingProgress`, `GetAllUserPreferences`)

### 3. Event-Driven Architecture

#### Events Published

- **UserRegistered** - Emitted by auth service when user registers
- **UserOnboarded** - Emitted when user completes onboarding  
- **UserOnboardingStarted** - Emitted when onboarding begins
- **UserOnboardingProgressed** - Emitted on step completion
- **UserOnboardingSkipped** - Emitted when user skips onboarding

#### Schema Support

Event schemas are provided in both Protobuf and Avro formats:
- `schemas/events.proto` - Protobuf definitions
- `schemas/user_registered_event.avsc` - Avro schema for UserRegistered
- `schemas/user_onboarded_event.avsc` - Avro schema for UserOnboarded

## Future Extraction Process

When ready to extract the onboarding service:

### Step 1: Deploy New Onboarding Service

1. Create new `onboarding-svc` with its own database
2. Subscribe to `UserRegistered` and `UserOnboarded` events
3. Build denormalized read model from events
4. Implement event handlers for user registration

### Step 2: Migrate Data (Optional)

If you want to migrate existing data:

1. Use the batch operations in `OnboardingDataRepository`:
   ```go
   progress, err := repo.GetAllOnboardingProgress(1000, 0)
   preferences, err := repo.GetAllUserPreferences(1000, 0) 
   ```
2. Transform and load into new onboarding service database
3. Verify data consistency

### Step 3: Update Integration

1. Replace `OnboardingInterface` implementation to call external service
2. Update auth service configuration to point to new onboarding service
3. Remove onboarding package from user-svc (if desired)

### Step 4: Cleanup

1. Remove onboarding tables from users database
2. Update schemas and documentation
3. Monitor and verify functionality

## Benefits of This Design

1. **Clean Boundaries** - Interface-based communication prevents tight coupling
2. **Event Sourcing Ready** - All state changes emit events for rebuilding read models
3. **Zero Downtime Migration** - Events allow building parallel read models
4. **Schema Evolution** - Protobuf/Avro schemas support versioning
5. **Resilient Integration** - Auth service continues working even if onboarding fails

## Example Future Onboarding Service

```go
type OnboardingService struct {
    db       *sql.DB
    eventBus EventBus
}

func (s *OnboardingService) HandleUserRegistered(event UserRegisteredEvent) error {
    // Create onboarding record in dedicated database
    // Publish UserOnboardingStarted event
}

func (s *OnboardingService) HandleUserOnboarded(event UserOnboardedEvent) error {
    // Update denormalized read model
    // Trigger analytics/notifications
}
```

## Event Bus Configuration

Currently using in-memory event bus. For production extraction:

1. **NATS** - Lightweight, high performance
   ```yaml
   nats:
     url: "nats://nats-server:4222"
     subjects:
       user_registered: "user.registered"
       user_onboarded: "user.onboarded"
   ```

2. **Kafka** - High throughput, durable
   ```yaml
   kafka:
     brokers: ["kafka-1:9092", "kafka-2:9092"]
     topics:
       user_events: "user-events"
   ```

## Database Schema Changes Required

When extracting, create dedicated onboarding database:

```sql
-- New onboarding database
CREATE TABLE onboarding_progress (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    current_step VARCHAR(50),
    completed_steps JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    friend_requests BOOLEAN DEFAULT true,
    activity_updates BOOLEAN DEFAULT true,
    newsletter_opt_in BOOLEAN DEFAULT false,
    privacy_level VARCHAR(20) DEFAULT 'friends',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

Then drop tables from users database after migration is complete.

## Testing the Extraction

Use the interface to verify the design works:

```go
// Mock implementation for testing extraction
type mockOnboardingInterface struct{}

func (m *mockOnboardingInterface) NotifyUserRegistered(ctx context.Context, userID uuid.UUID, email, username, firstName, lastName string) error {
    // Call external onboarding service HTTP API
    return callOnboardingServiceAPI(userID, email, username, firstName, lastName)
}
```

This design ensures a smooth transition from monolith to microservices while maintaining system stability and data consistency.
