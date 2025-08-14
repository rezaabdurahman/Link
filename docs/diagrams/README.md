# API Gateway Sequence Diagrams

This directory contains PlantUML sequence diagrams documenting the API Gateway proxy pattern implementation.

## Files

### `gateway-sequence.puml`
Contains comprehensive sequence diagrams showing:

1. **Authenticated Request Flow** (`/users/profile`)
   - JWT validation process
   - User context propagation
   - Request transformation and routing
   - Response handling

2. **WebSocket Upgrade Flow** (`/ws`)
   - WebSocket handshake through the proxy
   - Header preservation for protocol upgrade
   - Chat service integration

3. **Error Scenarios**
   - Authentication failures
   - Service timeouts
   - Service unavailable
   - Route not found

4. **Health Check Aggregation**
   - Parallel service health checking
   - Status aggregation logic
   - Load balancer integration

## Viewing the Diagrams

### Online Viewers
- **PlantUML Server**: http://www.plantuml.com/plantuml/uml/
- **VS Code Extension**: PlantUML extension by jebbs
- **IntelliJ Plugin**: PlantUML integration plugin

### Local Rendering
```bash
# Install PlantUML
brew install plantuml  # macOS
# or
sudo apt-get install plantuml  # Ubuntu

# Generate PNG images
plantuml docs/diagrams/gateway-sequence.puml

# Generate SVG images  
plantuml -tsvg docs/diagrams/gateway-sequence.puml
```

### Web-based Rendering
You can paste the contents of `gateway-sequence.puml` directly into:
- http://www.plantuml.com/plantuml/uml/
- https://plantuml-editor.kkeisuke.com/

## Diagram Details

### A) Authenticated Request: GET /users/profile
Shows the complete flow for a typical authenticated API request:
- JWT token validation in Auth middleware
- User context extraction and header propagation
- Service routing and path transformation
- Request proxying to User Service
- Response streaming back to client

**Key Components:**
- Path transformation: `/users/profile` → `/api/v1/users/profile`
- Header filtering: Removes hop-by-hop headers
- Context propagation: `X-User-ID`, `X-User-Email`, `X-User-Name`
- Timeout: 30 seconds (configurable via `USER_SVC_TIMEOUT`)

### B) WebSocket Upgrade: GET /ws
Demonstrates WebSocket connection establishment through the proxy:
- JWT validation for WebSocket connection
- Preservation of WebSocket-specific headers
- Protocol upgrade handling
- Transparent frame proxying

**Key Components:**
- WebSocket headers preserved: `Upgrade`, `Connection`, `Sec-WebSocket-*`
- Path transformation: `/ws` → `/api/v1/ws`
- User context available for chat authorization
- Bidirectional frame proxying once established

### Error Scenarios
Comprehensive error handling patterns:

1. **Authentication Failure (401)**
   - Missing or invalid JWT tokens
   - Standardized error response format

2. **Service Timeout (504)**
   - Configurable per-service timeouts
   - AI service: 60s, others: 30s default

3. **Service Unavailable (502)**
   - Connection refused scenarios
   - Network connectivity issues

4. **Route Not Found (404)**
   - Unrecognized path patterns
   - Available endpoints listing

### Health Check Aggregation
System health monitoring implementation:
- Parallel health checks with 5-second timeout
- Service status aggregation
- Load balancer integration
- Degraded vs healthy status determination

## Architecture Benefits

The proxy pattern implementation provides:

1. **Single Entry Point**: Centralized request handling
2. **Authentication**: Consistent JWT validation
3. **Service Discovery**: Path-based routing to microservices
4. **Header Management**: Context propagation and filtering
5. **Error Handling**: Standardized error responses
6. **Health Monitoring**: System-wide health aggregation
7. **Performance**: Connection pooling and request streaming
8. **Security**: CORS, rate limiting, and secure headers

## Related Documentation

- [Gateway Proxy Documentation](../architecture/gateway-proxy.md) - Detailed implementation analysis
- [API Gateway Main Code](../../backend/api-gateway/internal/handlers/proxy.go) - Source implementation
- [Configuration](../../backend/api-gateway/internal/config/services.go) - Service routing configuration

## Drawing Tools Integration

These diagrams can also be created/edited using:

- **Draw.io** (now diagrams.net): Import PlantUML or create equivalent sequence diagrams
- **Lucidchart**: Professional diagramming tool
- **Visio**: Microsoft diagramming software
- **Mermaid**: Alternative text-to-diagram syntax

For draw.io integration, you can:
1. Visit https://app.diagrams.net/
2. Use File → Import → Text and paste the PlantUML content
3. Or manually create equivalent sequence diagrams using the draw.io interface
