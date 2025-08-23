# gRPC Architecture Documentation

## Overview

The Link backend uses a **hybrid communication architecture** with both REST and gRPC protocols serving different purposes:

- **REST**: External API (frontend, external integrations) via API Gateway
- **gRPC**: Internal service-to-service communication (default)

## Architecture Diagram

```
┌─────────────┐    REST/HTTP    ┌─────────────┐    gRPC     ┌──────────────┐
│   Frontend  │────────────────▶│ API Gateway │────────────▶│   Services   │
│   (React)   │                 │             │             │              │
└─────────────┘                 └─────────────┘             └──────────────┘
                                       │                           │
┌─────────────┐    REST/HTTP           │                           │ gRPC
│  External   │────────────────────────┘                           │
│    APIs     │                                                    │
└─────────────┘                 ┌─────────────┐    gRPC     ┌──────▼──────┐
                                │   Service   │◀────────────│   Service   │
                                │      A      │             │      B      │
                                └─────────────┘             └─────────────┘
```

## Service Ports

Each service runs multiple servers:

| Service | HTTP Port | gRPC Port | Metrics Port |
|---------|-----------|-----------|--------------|
| user-svc | 8081 | 50051 | 9090 |
| discovery-svc | 8083 | 50052 | 9091 |
| chat-svc | 8082 | 50053 | 9092 |
| ai-svc | 8084 | 50054 | 9093 |
| search-svc | 8085 | 50055 | 9094 |

## Communication Patterns

### 1. Frontend → Services
- **Protocol**: REST over HTTP/1.1
- **Path**: Frontend → API Gateway → Services (HTTP)
- **Authentication**: JWT tokens
- **Format**: JSON

### 2. External APIs → Services  
- **Protocol**: REST over HTTP/1.1
- **Path**: External Client → API Gateway → Services (HTTP)
- **Authentication**: API Keys/JWT tokens
- **Format**: JSON

### 3. API Gateway → Services
- **Protocol**: HTTP/1.1 (Current) / gRPC (Planned)
- **Path**: API Gateway → Services 
- **Authentication**: Service-to-service tokens/interceptors
- **Format**: JSON (Current) / Protocol Buffers (Planned)
- **Note**: Can be upgraded to gRPC for better performance

### 4. Service → Service (Internal)
- **Protocol**: gRPC over HTTP/2 (Default)
- **Path**: Direct service-to-service communication
- **Authentication**: Service auth interceptors
- **Format**: Protocol Buffers
- **Fallback**: HTTP/REST if gRPC unavailable

## Configuration

### Environment Variables

#### Service-to-Service Communication
```bash
# Default to gRPC for internal communication
USE_GRPC=true

# gRPC endpoints (used when USE_GRPC=true)
USER_GRPC_ENDPOINT=user-svc:50051
DISCOVERY_GRPC_ENDPOINT=discovery-svc:50052
CHAT_GRPC_ENDPOINT=chat-svc:50053
AI_GRPC_ENDPOINT=ai-svc:50054
SEARCH_GRPC_ENDPOINT=search-svc:50055

# HTTP fallback endpoints
USER_SVC_URL=http://user-svc:8081
DISCOVERY_SVC_URL=http://discovery-svc:8083
CHAT_SVC_URL=http://chat-svc:8082
AI_SVC_URL=http://ai-svc:8084
SEARCH_SVC_URL=http://search-svc:8085
```

#### Individual Service Ports
```bash
# HTTP server
PORT=8081
HTTP_PORT=8081

# gRPC server  
GRPC_PORT=50051

# Metrics endpoint
METRICS_PORT=9090
```

## Service Implementation

### Server Setup

Each service runs both HTTP and gRPC servers:

```go
// HTTP Server (main.go)
func main() {
    router := gin.Default()
    // Setup REST endpoints...
    
    server := &http.Server{
        Addr:    ":8081",
        Handler: router,
    }
    go server.ListenAndServe()
}

// gRPC Server (cmd/grpc-server/main.go)  
func main() {
    grpcServer := grpc.NewServer(
        grpc.ChainUnaryInterceptor(
            interceptors.UnaryLoggingInterceptor(),
            interceptors.UnaryMetricsInterceptor(),
            interceptors.UnaryAuthInterceptor(),
        ),
    )
    
    listener, _ := net.Listen("tcp", ":50051")
    grpcServer.Serve(listener)
}
```

### Client Setup

Services automatically choose gRPC by default with HTTP fallback:

```go
// Search Service example
useGRPC := getEnvOrDefault("USE_GRPC", "true") == "true"

if useGRPC {
    userClient, err = client.NewUserGRPCClient("user-svc:50051")
    if err != nil {
        log.Printf("gRPC failed, falling back to HTTP: %v", err)
        userClient = client.NewUserClient("http://user-svc:8081", token)
    }
} else {
    userClient = client.NewUserClient("http://user-svc:8081", token)
}
```

## API Endpoints

### REST Endpoints (API Gateway + Frontend)

These endpoints remain available for frontend and external access:

#### User Service
- `GET /api/v1/users/profile/:id` - Get user profile
- `GET /api/v1/users/friends` - Get user friends
- `PUT /api/v1/users/profile` - Update profile
- `POST /api/v1/friends/requests` - Send friend request

#### Discovery Service  
- `GET /api/v1/discovery/available` - Get available users
- `POST /api/v1/discovery/status` - Update availability

#### Search Service
- `POST /api/v1/search/users` - Search users
- `POST /api/v1/search/reindex` - Trigger reindexing

### gRPC Methods (Service-to-Service)

Internal communication uses gRPC methods defined in protobuf:

#### User Service
- `GetUserProfile(UUID) → UserProfile`
- `GetUserFriends(UUID) → []UUID`
- `UpdateUserProfile(UserProfile) → SuccessResponse`

#### Discovery Service
- `GetAvailableUsers() → []UUID`  
- `UpdateUserAvailability(UUID, Status) → SuccessResponse`

## Benefits of Hybrid Approach

### REST Benefits
- **Frontend Compatible**: Works with existing React application
- **External API Friendly**: Standard HTTP/JSON for external developers
- **Debugging**: Easy to test with curl, Postman, browser dev tools
- **Documentation**: OpenAPI/Swagger documentation generation

### gRPC Benefits  
- **Performance**: Binary protocol, HTTP/2, connection multiplexing
- **Type Safety**: Protobuf provides compile-time validation
- **Code Generation**: Automatic client/server code generation
- **Streaming**: Bidirectional streaming for real-time features
- **Service Mesh**: Better integration with Linkerd, Istio

## Migration Strategy

### Phase 1: Hybrid (Current) ✅
- Service-to-service uses gRPC by default
- Frontend uses REST via API Gateway
- Both protocols supported for compatibility

### Phase 2: Optimize Frontend (Future)
- Consider gRPC-Web for performance-critical frontend features
- Keep REST for external APIs and simple frontend operations

### Phase 3: Pure gRPC + Gateway (Long-term)
- Services expose only gRPC interfaces
- Use gRPC Gateway to auto-generate REST endpoints
- Single source of truth (protobuf definitions)

## Troubleshooting

### Common Issues

1. **gRPC Connection Failed**
   - Check if gRPC port is accessible
   - Verify service is running gRPC server
   - Check firewall/network policies
   - **Solution**: Services automatically fall back to HTTP

2. **Mixed Protocol Issues**
   - Ensure both HTTP and gRPC servers expose same functionality
   - Check port configurations
   - Verify environment variables

3. **Authentication Errors**
   - gRPC uses interceptors for auth
   - HTTP uses middleware  
   - Ensure service tokens are configured

### Debug Commands

```bash
# Test gRPC health check
grpcurl -plaintext user-svc:50051 grpc.health.v1.Health/Check

# Test HTTP health check  
curl http://user-svc:8081/health

# Check metrics
curl http://user-svc:9090/metrics

# View active connections
grpcurl -plaintext user-svc:50051 list
```

## Best Practices

1. **Always implement both protocols** during transition period
2. **Use environment variables** to control protocol selection
3. **Implement graceful fallbacks** from gRPC to HTTP
4. **Monitor both protocols** with separate metrics
5. **Document breaking changes** when deprecating HTTP endpoints
6. **Test both communication paths** in integration tests
7. **Use service discovery** for production deployments