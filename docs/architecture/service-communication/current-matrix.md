# Service Communication Matrix

**Generated:** 2025-01-02  
**Purpose:** Catalogue current service-to-service communication flows

## Executive Summary

This document provides a comprehensive matrix of service-to-service communication patterns in the Link application. The system consists of an API Gateway that routes requests to 7 backend microservices, all connected through a `link_network` bridge network using HTTP transport.

## 1. Container Analysis (docker-compose.yml)

### Infrastructure Services
| Container Name | Published Port | Internal Port | Networks | Health Check |
|---------------|----------------|---------------|----------|-------------|
| link_postgres | 5432:5432 | 5432 | link_network | pg_isready |
| link_redis | 6379:6379 | 6379 | link_network | redis-cli ping |

### Application Services
| Container Name | Published Port | Internal Port | Networks | Health Check |
|---------------|----------------|---------------|----------|-------------|
| link_api_gateway | 8080:8080 | 8080 | link_network | curl /health |
| link_user_svc | 8081:8080 | 8080 | link_network | curl /health |
| link_location_svc | 8082:8080 | 8080 | link_network | - |
| link_discovery_svc | 8087:8080 | 8080 | link_network | - |
| link_chat_svc | 8083:8080 | 8080 | link_network | - |
| link_ai_svc | 8084:8000 | 8000 | link_network | - |
| link_stories_svc | 8085:8080 | 8080 | link_network | - |
| link_opportunities_svc | 8086:8080 | 8080 | link_network | - |
| link_frontend | 3000:3000 | 3000 | link_network | - |

## 2. API Gateway Service Configuration

### Service Endpoints (from api-gateway/internal/config/services.go)

| Service | Environment Variable | Default URL | Health URL | Timeout |
|---------|---------------------|-------------|------------|---------|
| UserService | USER_SVC_URL | http://user-svc:8080 | http://user-svc:8080/health | 30s |
| LocationService | LOCATION_SVC_URL | http://location-svc:8080 | http://location-svc:8080/health | 30s |
| ChatService | CHAT_SVC_URL | http://chat-svc:8080 | http://chat-svc:8080/health | 30s |
| AIService | AI_SVC_URL | http://ai-svc:8000 | http://ai-svc:8000/health | 60s |
| DiscoveryService | DISCOVERY_SVC_URL | http://discovery-svc:8080 | http://discovery-svc:8080/health | 30s |
| StoriesService | STORIES_SVC_URL | http://stories-svc:8080 | http://stories-svc:8080/health | 30s |
| OpportunitiesService | OPPORTUNITIES_SVC_URL | http://opportunities-svc:8080 | http://opportunities-svc:8080/health | 30s |

### Gateway Route Mapping (RouteToService function)

| Gateway Path Prefix | Target Service | Service URL | Path Transformation |
|-------------------|----------------|-------------|-------------------|
| `/auth/` | UserService | http://user-svc:8080 | Add `/api/v1` prefix |
| `/users/` | UserService | http://user-svc:8080 | Add `/api/v1` prefix |
| `/location/` | LocationService | http://location-svc:8080 | Add `/api/v1` prefix |
| `/chat/` | ChatService | http://chat-svc:8080 | Add `/api/v1` prefix |
| `/ws` | ChatService | http://chat-svc:8080 | Add `/api/v1` prefix |
| `/ai/` | AIService | http://ai-svc:8000 | Add `/api/v1` prefix |
| `/broadcasts/` | DiscoveryService | http://discovery-svc:8080 | Add `/api/v1` prefix |
| `/discovery/` | DiscoveryService | http://discovery-svc:8080 | Add `/api/v1` prefix |
| `/stories/` | StoriesService | http://stories-svc:8080 | Add `/api/v1` prefix |
| `/opportunities/` | OpportunitiesService | http://opportunities-svc:8080 | Add `/api/v1` prefix |

## 3. Service Communication Matrix

### Complete Service-to-Service Flow

| Gateway Prefix | Target Service URL | Transport | Auth Headers Added | Timeout | Notes |
|---------------|-------------------|-----------|-------------------|---------|-------|
| `/auth/*` | http://user-svc:8080/api/v1/auth/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | User authentication and management |
| `/users/*` | http://user-svc:8080/api/v1/users/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | User profile operations |
| `/location/*` | http://location-svc:8080/api/v1/location/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | Location-based features |
| `/chat/*` | http://chat-svc:8080/api/v1/chat/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | Chat messaging |
| `/ws` | http://chat-svc:8080/api/v1/ws | HTTP/WebSocket | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | Real-time chat WebSocket |
| `/ai/*` | http://ai-svc:8000/api/v1/ai/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 60s | AI-powered features |
| `/broadcasts/*` | http://discovery-svc:8080/api/v1/broadcasts/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | Discovery broadcasts |
| `/discovery/*` | http://discovery-svc:8080/api/v1/discovery/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | User discovery features |
| `/stories/*` | http://stories-svc:8080/api/v1/stories/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | Stories and timeline |
| `/opportunities/*` | http://opportunities-svc:8080/api/v1/opportunities/* | HTTP | X-User-ID, X-User-Email, X-User-Name, X-Gateway-Request, X-Forwarded-For, X-Forwarded-Proto | 30s | Opportunity management |

### Authentication and Authorization Flow

#### User Authentication Headers (from middleware/auth.go)
When a user is authenticated, the following headers are added to downstream service requests:

| Header Name | Source | Purpose |
|------------|--------|---------|
| X-User-ID | JWT Claims (UserID) | Identify the authenticated user |
| X-User-Email | JWT Claims (Email) | User email for auditing/personalization |
| X-User-Name | JWT Claims (Username) | User display name |

#### Service Authentication Headers (from middleware/service_auth.go)
For service-to-service authentication, the following headers are optionally added:

| Header Name | Purpose | Generation Method |
|------------|---------|-------------------|
| X-Service-ID | Identify calling service | From SERVICE_ID env var (default: "api-gateway") |
| X-Service-Timestamp | Prevent replay attacks | Current Unix timestamp |
| X-Service-Signature | Verify request authenticity | HMAC-SHA256(service_id + timestamp + path, service_secret) |

#### Gateway Identification Headers (from handlers/proxy.go)
All proxied requests include these gateway-specific headers:

| Header Name | Value | Purpose |
|------------|--------|---------|
| X-Gateway-Request | "true" | Identify requests coming through gateway |
| X-Forwarded-For | Client IP | Original client IP address |
| X-Forwarded-Proto | "http" | Protocol used (http/https) |

## 4. Database and Cache Access Patterns

### Direct Database Connections
All services connect directly to shared infrastructure:

| Service | PostgreSQL Access | Redis Access | Environment Variables |
|---------|------------------|--------------|---------------------|
| user-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |
| location-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |
| chat-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |
| ai-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |
| discovery-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |
| stories-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |
| opportunities-svc | ✓ (port 5432) | ✓ (port 6379) | DB_HOST=postgres, REDIS_HOST=redis |

## 5. Network Architecture

### Network Configuration
- **Network Name:** `link_network`
- **Network Type:** Bridge driver
- **Internal DNS:** Docker's built-in service discovery allows services to communicate using service names (e.g., `user-svc:8080`)

### Service Discovery
Services communicate using Docker's internal DNS resolution:
- Services reference each other by container name
- No external service discovery mechanism (Consul, etcd, etc.)
- Container names resolve to internal IP addresses within the network

## 6. Security Considerations

### Authentication Flow
1. **Public Endpoints:** Bypass authentication middleware (health checks, etc.)
2. **Protected Endpoints:** Require valid JWT token via Authorization header or cookie
3. **Token Validation:** Gateway validates JWT and extracts user claims
4. **Header Injection:** User context headers added to downstream requests
5. **Service Authentication:** Optional HMAC-based service-to-service auth (not currently enforced)

### Network Security
- All services isolated within `link_network` bridge network
- Only API Gateway exposed externally (port 8080)
- Direct database access from all services (potential security concern)
- No mTLS or service mesh implementation

## 7. Observability and Monitoring

### Health Checks
| Service | Health Endpoint | Check Method | Notes |
|---------|----------------|-------------|-------|
| API Gateway | /health | Aggregates all service health | Returns 200 if all services healthy |
| PostgreSQL | Internal | pg_isready command | Docker healthcheck |
| Redis | Internal | redis-cli ping | Docker healthcheck |
| User Service | /health | curl HTTP check | 30s interval, 10s timeout |
| Other Services | /health | Expected but not configured | Should be added to docker-compose |

### Logging
- Request logging middleware in API Gateway
- Structured logging format includes client IP, timestamp, method, path, status code, latency
- No centralized log aggregation configured

## 8. Recommendations

### Immediate Actions
1. **Add Health Checks:** Configure health checks for all services in docker-compose.yml
2. **Implement Service Auth:** Enable and enforce service-to-service authentication
3. **Network Segmentation:** Consider separating database network from application network
4. **Add TLS:** Implement HTTPS/TLS for external communication

### Future Considerations
1. **Service Mesh:** Implement Istio or similar for advanced traffic management
2. **Distributed Tracing:** Add OpenTelemetry/Jaeger for request tracing
3. **Circuit Breakers:** Implement circuit breaker pattern for service resilience
4. **Load Balancing:** Add load balancer for high availability deployments

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-02  
**Reviewed By:** System Architecture Team
