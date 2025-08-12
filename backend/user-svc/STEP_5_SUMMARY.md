# Step 5: Design for Future Extraction - Implementation Summary

This document summarizes the changes made in Step 5 to prepare the onboarding functionality for future extraction into a separate microservice.

## 🎯 Objectives Achieved

✅ **Interface-based Communication**: All calls from auth to onboarding now happen through interface methods  
✅ **Data Access Abstraction**: Onboarding data persists in the same `users` table but is gated behind its own repository  
✅ **Event Schemas**: Added protobuf/Avro schemas for `UserRegistered` and `UserOnboarded` events  
✅ **Event Publishing**: Auth service now publishes events to the event bus  
✅ **Extraction Readiness**: Architecture supports spinning up a new `onboarding-svc` that subscribes to events  

## 🏗️ Architecture Changes

### 1. Interface Layer
**New Files:**
- `internal/onboarding/interface.go` - `OnboardingInterface` for decoupled communication

**Key Changes:**
```go
type OnboardingInterface interface {
    NotifyUserRegistered(ctx context.Context, userID uuid.UUID, email, username, firstName, lastName string) error
    GetOnboardingStatus(ctx context.Context, userID uuid.UUID) (*OnboardingStatusResponse, error)  
    IsOnboardingComplete(ctx context.Context, userID uuid.UUID) (bool, error)
}
```

Auth service now calls onboarding through this interface rather than directly accessing structs.

### 2. Data Repository Abstraction
**New Files:**
- `internal/onboarding/data_repository.go` - `OnboardingDataRepository` interface

**Key Features:**
```go
type OnboardingDataRepository interface {
    // Standard CRUD operations
    CreateOnboardingProgress(progress *OnboardingProgress) error
    GetOnboardingProgressByUserID(userID uuid.UUID) (*OnboardingProgress, error)
    UpdateOnboardingProgress(progress *OnboardingProgress) error
    
    // Batch operations for future data migration
    GetAllOnboardingProgress(limit, offset int) ([]OnboardingProgress, error)
    GetAllUserPreferences(limit, offset int) ([]UserPreferences, error)
}
```

The existing repository now delegates to this data repository, providing clear separation.

### 3. Event System Enhancement
**Modified Files:**
- `internal/events/onboarding_events.go` - Added `UserRegisteredEvent`
- `internal/auth/service.go` - Now publishes events and calls onboarding interface

**New Events:**
```go
// UserRegistered event published when user registers
type UserRegisteredEvent struct {
    BaseEvent
}

type UserRegisteredEventData struct {
    UserID      uuid.UUID  `json:"user_id"`
    Email       string     `json:"email"`  
    Username    string     `json:"username"`
    FirstName   string     `json:"first_name"`
    LastName    string     `json:"last_name"`
    DateOfBirth *time.Time `json:"date_of_birth,omitempty"`
    RegisteredAt time.Time `json:"registered_at"`
}
```

### 4. Schema Definitions  
**New Files:**
- `schemas/events.proto` - Protobuf definitions for all events
- `schemas/user_registered_event.avsc` - Avro schema for UserRegistered event
- `schemas/user_onboarded_event.avsc` - Avro schema for UserOnboarded event
- `schemas/README.md` - Documentation for schema usage

## 🔄 Updated Registration Flow

The `RegisterUser` method in auth service now:

1. **Creates user** in database
2. **Publishes UserRegistered event** to event bus
3. **Notifies onboarding interface** to initialize onboarding
4. **Continues with token generation** and response

```go
// Publish UserRegistered event
ctx := context.Background()
userRegisteredEvent := events.NewUserRegisteredEvent(
    user.ID, user.Email, user.Username, user.FirstName, user.LastName, user.DateOfBirth,
)
if err := s.eventBus.Publish(ctx, userRegisteredEvent); err != nil {
    fmt.Printf("Failed to publish user registered event: %v\n", err)
}

// Notify onboarding service through interface (decoupled call)
if err := s.onboardingInterface.NotifyUserRegistered(
    ctx, user.ID, user.Email, user.Username, user.FirstName, user.LastName,
); err != nil {
    fmt.Printf("Failed to initialize onboarding for user %s: %v\n", user.ID, err)
}
```

## 📋 Dependencies Updated

The `AuthService` constructor now requires:
- `EventBus` - for publishing events
- `OnboardingInterface` - for decoupled onboarding calls

```go
func NewAuthService(
    userRepo repository.UserRepository, 
    jwtService *JWTService,
    eventBus events.EventBus,
    onboardingInterface onboarding.OnboardingInterface,
) AuthService
```

## 🚀 Future Extraction Process

When ready to extract the onboarding service:

### Phase 1: Deploy New Service
1. **Create `onboarding-svc`** with own database
2. **Subscribe to events**: `UserRegistered`, `UserOnboarded`
3. **Build read models** from event stream
4. **Implement HTTP API** matching current interface

### Phase 2: Switch Integration  
1. **Replace `OnboardingInterface`** implementation to call HTTP API
2. **Update auth service config** to point to new service
3. **Remove onboarding package** from user-svc (optional)

### Phase 3: Data Migration (if needed)
1. **Use batch operations** in `OnboardingDataRepository`
2. **Migrate existing data** to new service database  
3. **Drop onboarding tables** from users database

## 🔧 Configuration Changes Needed

Future main.go will need to wire up the new dependencies:

```go
func main() {
    // ... existing setup ...
    
    eventBus := events.NewInMemoryEventBus() // or NATS/Kafka
    onboardingRepo := onboarding.NewGormRepository(db)
    onboardingService := onboarding.NewService(onboardingRepo, eventBus)
    onboardingInterface := onboarding.NewOnboardingInterface(onboardingService)
    
    authService := auth.NewAuthService(userRepo, jwtService, eventBus, onboardingInterface)
    
    // ... rest of setup ...
}
```

## 📊 Benefits Achieved

1. **🔗 Loose Coupling**: Auth and onboarding communicate through interfaces
2. **📦 Clear Boundaries**: Data access is abstracted and controlled
3. **🎯 Event-Driven**: All state changes emit events for external consumption
4. **⚡ Zero-Downtime Migration**: Events enable parallel read model building
5. **🛡️ Resilient Design**: Auth continues working even if onboarding fails
6. **📈 Schema Evolution**: Protobuf/Avro support versioning and compatibility

## 🧪 Testing Recommendations

1. **Unit Tests**: Test interface implementations in isolation
2. **Integration Tests**: Verify event publishing and handling
3. **Contract Tests**: Validate event schema compatibility  
4. **Migration Tests**: Test data migration using batch operations
5. **Fallback Tests**: Ensure auth works when onboarding is unavailable

## 📚 Documentation Created

- `ONBOARDING_EXTRACTION_DESIGN.md` - Complete extraction strategy
- `schemas/README.md` - Event schema usage guide
- This summary document

## ✨ Next Steps

The architecture is now ready for extraction. When business requirements justify the split:

1. Follow the extraction process outlined in `ONBOARDING_EXTRACTION_DESIGN.md`
2. Monitor event flows and system performance
3. Gradually migrate to external service integration
4. Optimize based on production usage patterns

The foundation is solid for a smooth microservices transition! 🎉
