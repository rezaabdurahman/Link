# gRPC Service Communication

Standardized gRPC client and server infrastructure for consistent service-to-service communication across the Link microservices platform.

## Features

- **Unified Service Clients**: Single point of access for all service-to-service calls
- **Automatic Interceptors**: Built-in logging, metrics, auth, and retry logic
- **Service Mesh Integration**: Linkerd mTLS support for secure communication
- **Connection Management**: Automatic connection pooling and health checking
- **Standardized Timeouts**: Consistent timeout policies across all services
- **Proto Management**: Centralized protocol buffer definitions

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │    │   Service Mesh   │    │   gRPC Server   │
│                 │    │    (Linkerd)     │    │                 │
│ HTTP/REST ────► │    │                  │    │ ◄──── gRPC      │
│                 │    │  mTLS + LB + OP  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Frontend/Mobile │    │ Service-to-Service│    │  Internal APIs  │
│    REST API     │    │   gRPC Calls     │    │  (Business Logic)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Usage

### Setting up Service Clients

```go
import (
    "context"
    "github.com/link-app/shared-libs/grpc"
)

func main() {
    // Create all service clients with default config
    clients, err := grpc.NewServiceClients(nil)
    if err != nil {
        log.Fatal("Failed to create service clients:", err)
    }
    defer clients.Close()
    
    // Use in your service
    userService := NewUserService(clients)
}
```

### Custom Configuration

```go
config := &grpc.ServiceClientConfig{
    UserServiceEndpoint:      "user-svc.production.svc.cluster.local:50051",
    ChatServiceEndpoint:      "chat-svc.production.svc.cluster.local:50051",
    DiscoveryServiceEndpoint: "discovery-svc.production.svc.cluster.local:50051",
    SearchServiceEndpoint:    "search-svc.production.svc.cluster.local:50051",
    AIServiceEndpoint:        "ai-svc.production.svc.cluster.local:50051",
    ConnectTimeout:           10 * time.Second,
    RequestTimeout:           30 * time.Second,
    MaxRetryAttempts:         3,
    UseServiceMesh:           true,
}

clients, err := grpc.NewServiceClients(config)
```

### Making Service Calls

```go
// Direct service call
func (s *MyService) getUserProfile(ctx context.Context, userID string) (*userpb.User, error) {
    ctx, cancel := s.clients.StandardTimeout()
    defer cancel()
    
    response, err := s.clients.User.GetUser(ctx, &userpb.GetUserRequest{
        UserId: userID,
    })
    
    if err != nil {
        return nil, fmt.Errorf("failed to get user: %w", err)
    }
    
    return response.User, nil
}

// Using helper methods with automatic error handling
func (s *MyService) updateUserPreferences(ctx context.Context, userID string, prefs map[string]string) error {
    return s.clients.UserServiceCall(ctx, func(client userpb.UserServiceClient) error {
        _, err := client.UpdatePreferences(ctx, &userpb.UpdatePreferencesRequest{
            UserId:      userID,
            Preferences: prefs,
        })
        return err
    })
}
```

### Service-Specific Examples

#### User Service Integration
```go
// Get user profile with caching
func (s *DiscoveryService) getUserForMatching(ctx context.Context, userID string) (*userpb.User, error) {
    return s.clients.UserServiceCall(ctx, func(client userpb.UserServiceClient) error {
        response, err := client.GetUser(ctx, &userpb.GetUserRequest{
            UserId: userID,
            IncludePreferences: true,
        })
        if err != nil {
            return err
        }
        // Use response.User for matching logic
        return nil
    })
}
```

#### Chat Service Integration
```go
// Send notification about new match
func (s *DiscoveryService) notifyMatch(ctx context.Context, userID1, userID2 string) error {
    return s.clients.ChatServiceCall(ctx, func(client chatpb.ChatServiceClient) error {
        _, err := client.CreateConversation(ctx, &chatpb.CreateConversationRequest{
            ParticipantIds: []string{userID1, userID2},
            ConversationType: chatpb.ConversationType_MATCH,
            InitialMessage: "You have a new match! 🎉",
        })
        return err
    })
}
```

#### Search Service Integration
```go
// Index user for discovery
func (s *UserService) indexUserForSearch(ctx context.Context, user *User) error {
    return s.clients.SearchServiceCall(ctx, func(client searchpb.SearchServiceClient) error {
        _, err := client.IndexUser(ctx, &searchpb.IndexUserRequest{
            UserId: user.ID,
            Profile: &searchpb.UserProfile{
                Bio: user.Bio,
                Interests: user.Interests,
                Location: &searchpb.Location{
                    Lat: user.Location.Latitude,
                    Lng: user.Location.Longitude,
                },
            },
        })
        return err
    })
}
```

#### AI Service Integration
```go
// Summarize conversation
func (s *ChatService) summarizeConversation(ctx context.Context, conversationID string) (string, error) {
    var summary string
    err := s.clients.AIServiceCall(ctx, func(client aipb.AIServiceClient) error {
        response, err := client.SummarizeConversation(ctx, &aipb.SummarizeRequest{
            ConversationId: conversationID,
            MaxLength: 200,
            Style: aipb.SummaryStyle_CASUAL,
        })
        if err != nil {
            return err
        }
        summary = response.Summary
        return nil
    })
    return summary, err
}
```

## Environment Configuration

Set these environment variables to override default service endpoints:

```bash
# Service endpoints
USER_SERVICE_ENDPOINT=user-svc:50051
CHAT_SERVICE_ENDPOINT=chat-svc:50051
DISCOVERY_SERVICE_ENDPOINT=discovery-svc:50051
SEARCH_SERVICE_ENDPOINT=search-svc:50051
AI_SERVICE_ENDPOINT=ai-svc:50051

# Connection settings
USE_SERVICE_MESH=true
GRPC_CONNECT_TIMEOUT=30s
GRPC_REQUEST_TIMEOUT=30s
GRPC_MAX_RETRY_ATTEMPTS=3
```

## Interceptors

All gRPC calls automatically include these interceptors:

### Client Interceptors
- **Logging**: Request/response logging with correlation IDs
- **Metrics**: Request duration, error rates, throughput
- **Authentication**: Automatic service-to-service auth
- **Retry**: Exponential backoff with jitter
- **Circuit Breaker**: Fail-fast for unhealthy services

### Server Interceptors  
- **Auth Validation**: JWT and service mesh auth
- **Request Logging**: Structured request logs
- **Metrics Collection**: Prometheus metrics
- **Error Handling**: Consistent error responses
- **Rate Limiting**: Per-client rate limits

## Protocol Buffer Management

Proto definitions are centralized in the `backend/proto/` directory:

```
proto/
├── common/          # Shared types and enums
├── user/           # User service definitions
├── chat/           # Chat service definitions  
├── discovery/      # Discovery service definitions
├── search/         # Search service definitions
└── ai/             # AI service definitions
```

### Generating Proto Code

```bash
# Generate Go code for all services
make proto-gen

# Generate for specific service
make proto-gen-user
make proto-gen-chat
```

## Service Mesh Integration

When `USE_SERVICE_MESH=true` (default), the system:

- Uses Linkerd service names for service discovery
- Relies on mTLS for authentication between services  
- Leverages Linkerd's load balancing and circuit breaking
- Automatically gets observability via Linkerd's metrics

### Kubernetes Service Names

In production, services communicate via Kubernetes service names:

```
user-svc.default.svc.cluster.local:50051
chat-svc.default.svc.cluster.local:50051  
discovery-svc.default.svc.cluster.local:50051
search-svc.default.svc.cluster.local:50051
ai-svc.default.svc.cluster.local:50051
```

## Error Handling

All service calls use consistent error handling:

```go
// Automatic retry for transient errors
err := clients.UserServiceCall(ctx, func(client userpb.UserServiceClient) error {
    // This call will be automatically retried on network errors
    _, err := client.GetUser(ctx, &userpb.GetUserRequest{UserId: "123"})
    return err
})

// Handle specific gRPC errors
if err != nil {
    if status.Code(err) == codes.NotFound {
        return errors.New("user not found")
    }
    return fmt.Errorf("user service error: %w", err)
}
```

## Health Checking

Monitor service client health:

```go
// Check if all service connections are healthy
if err := clients.Health(ctx); err != nil {
    log.Warn("Some service connections are unhealthy:", err)
}

// Health check endpoint
func healthHandler(w http.ResponseWriter, r *http.Request) {
    if err := clients.Health(r.Context()); err != nil {
        http.Error(w, "Service connections unhealthy", 503)
        return
    }
    w.WriteHeader(200)
}
```

## Migration Guide

### From HTTP to gRPC

```go
// Old HTTP approach
type UserHTTPClient struct {
    baseURL    string
    httpClient *http.Client
}

func (c *UserHTTPClient) GetUser(userID string) (*User, error) {
    resp, err := c.httpClient.Get(c.baseURL + "/users/" + userID)
    // ... HTTP parsing logic
}

// New gRPC approach  
func (s *MyService) GetUser(ctx context.Context, userID string) (*userpb.User, error) {
    return s.clients.UserServiceCall(ctx, func(client userpb.UserServiceClient) error {
        response, err := client.GetUser(ctx, &userpb.GetUserRequest{
            UserId: userID,
        })
        return err
    })
}
```

### Service Integration Steps

1. **Add gRPC clients to your service**:
   ```go
   type MyService struct {
       clients *grpc.ServiceClients
       // ... other dependencies
   }
   ```

2. **Initialize clients in main.go**:
   ```go
   clients, err := grpc.NewServiceClients(nil)
   myService := NewMyService(clients, ...)
   defer clients.Close()
   ```

3. **Replace HTTP calls with gRPC**:
   - Replace REST API calls with proto method calls
   - Use standardized error handling
   - Leverage built-in timeouts and retries

4. **Update configuration**:
   - Set service endpoints via environment variables
   - Configure timeouts appropriate for your use case

## Best Practices

1. **Use Helper Methods**: Use `UserServiceCall()`, etc. for automatic timeout and error handling
2. **Context Propagation**: Always pass context through for distributed tracing
3. **Timeout Configuration**: Use appropriate timeouts (AI: 60s, others: 30s)
4. **Error Handling**: Handle gRPC status codes appropriately
5. **Connection Reuse**: Create clients once and reuse connections
6. **Graceful Shutdown**: Always call `clients.Close()` on shutdown
7. **Health Monitoring**: Monitor connection health in your health endpoints

This standardized approach ensures consistent, reliable, and observable service-to-service communication across the entire Link platform.