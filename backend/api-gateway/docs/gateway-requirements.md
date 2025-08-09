# API Gateway Requirements & Endpoint Analysis

## Executive Summary

This document outlines the complete API contract for the Link App API Gateway, which aggregates 5 microservices into a unified public interface. The gateway manages authentication, request routing, and response aggregation while maintaining service autonomy.

## Microservices Architecture Overview

### Active Services
1. **User Service** (Go/Fiber) - Port 8080
2. **Chat Service** (Go/Fiber/WebSocket) - Port 8083  
3. **Location Service** (Go/Fiber/PostGIS) - Port 8082
4. **AI Service** (Python/FastAPI) - Port 8084
5. **API Gateway** (Planned) - Port 8080

### Planned Services
- **Stories Service** (Schema defined, implementation pending)
- **Opportunities Service** (Schema defined, implementation pending)

---

## Endpoint Mapping & Routing Decisions

### 1. Authentication & User Management
**Gateway Prefix:** `/auth/`, `/users/`  
**Routes to:** User Service (8080)

| Gateway Endpoint | Service Endpoint | Auth | Description |
|------------------|------------------|------|-------------|
| `POST /auth/register` | `POST /api/v1/register` | Public | User registration |
| `POST /auth/login` | `POST /api/v1/login` | Public | User login |
| `GET /users/profile` | `GET /api/v1/profile` | JWT | Current user profile |
| `PUT /users/profile` | `PUT /api/v1/profile` | JWT | Update profile |
| `GET /users/profile/{id}` | `GET /api/v1/profile/{id}` | Public | Public profile |
| `GET /users/friends` | `GET /api/v1/friends` | JWT | Friends list |
| `GET /users/friend-requests` | `GET /api/v1/friend-requests` | JWT | Pending requests |
| `POST /users/friend-requests` | `POST /api/v1/friend-requests` | JWT | Send request |
| `PUT /users/friend-requests/{id}` | `PUT /api/v1/friend-requests/{id}` | JWT | Accept/decline |

**Aggregation Logic:** Direct routing - no aggregation required.

### 2. Real-time Chat & Messaging
**Gateway Prefix:** `/chat/`  
**Routes to:** Chat Service (8083)

| Gateway Endpoint | Service Endpoint | Auth | Description |
|------------------|------------------|------|-------------|
| `GET /chat/conversations` | `GET /api/v1/conversations` | JWT | User conversations |
| `POST /chat/conversations` | `POST /api/v1/conversations` | JWT | Create conversation |
| `GET /chat/conversations/{id}` | `GET /api/v1/conversations/{id}` | JWT | Conversation details |
| `GET /chat/conversations/{id}/messages` | `GET /api/v1/conversations/{id}/messages` | JWT | Message history |
| `POST /chat/messages` | `POST /api/v1/messages` | JWT | Send message |
| `PUT /chat/messages/{id}` | `PUT /api/v1/messages/{id}` | JWT | Edit message |
| `DELETE /chat/messages/{id}` | `DELETE /api/v1/messages/{id}` | JWT | Delete message |
| **WebSocket:** `ws://gateway/ws` | `ws://chat-svc/ws` | Query Param | Real-time messaging |

**Aggregation Logic:** 
- Conversation details enriched with user profile data from User Service
- Message sender information populated from User Service cache
- WebSocket connections proxied directly to Chat Service

### 3. Location & Proximity
**Gateway Prefix:** `/location/`  
**Routes to:** Location Service (8082)

| Gateway Endpoint | Service Endpoint | Auth | Description |
|------------------|------------------|------|-------------|
| `POST /location` | `POST /api/v1/location` | JWT | Update location |
| `DELETE /location` | `DELETE /api/v1/location` | JWT | Delete location |
| `GET /location/current` | `GET /api/v1/location/current` | JWT | Current location |
| `GET /location/nearby` | `GET /api/v1/nearby` | JWT | Find nearby users |

**Aggregation Logic:**
- Nearby users enriched with profile data from User Service
- Friend status determined by checking User Service relationships
- Privacy settings respected through Location Service privacy controls

### 4. AI-Powered Features
**Gateway Prefix:** `/ai/`  
**Routes to:** AI Service (8084)

| Gateway Endpoint | Service Endpoint | Auth | Description |
|------------------|------------------|------|-------------|
| `GET /ai/insights` | `GET /api/v1/ai/insights/user/{user_id}` | JWT | User insights |
| `GET /ai/conversation-starters` | `GET /api/v1/ai/conversation-starters/user/{user_id}` | JWT | Conversation starters |
| `GET /ai/relationship-scores/{id}` | `GET /api/v1/ai/relationship-scores/user/{user_id}` | JWT | Compatibility scores |

**Aggregation Logic:**
- User ID extracted from JWT token and passed to AI Service
- Target user profiles enriched from User Service for relationship scoring
- User behavior data aggregated from multiple services for insights

### 5. Aggregated Timeline
**Gateway Prefix:** `/timeline`  
**Aggregates:** Stories Service + Opportunities Service + AI Service + User Service

| Gateway Endpoint | Service Endpoints | Auth | Description |
|------------------|-------------------|------|-------------|
| `GET /timeline` | Multiple services | JWT | Personalized feed |

**Aggregation Logic:**
- **Stories**: Recent stories from friends (Stories Service + User Service for friends)
- **Opportunities**: Location-based events (Opportunities Service + Location Service)
- **AI Recommendations**: Personalized suggestions (AI Service)
- **Friend Activities**: Recent friend interactions (User Service)
- Sorted by priority score and recency
- Cached for 2-5 minutes depending on content type

---

## Authentication & Authorization Strategy

### JWT Token Structure
```json
{
  "user_id": "uuid",
  "email": "user@example.com", 
  "username": "username",
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "user-svc",
  "sub": "uuid"
}
```

### Authorization Matrix
- **Public Endpoints**: User registration, login, public profiles
- **JWT Required**: All other endpoints require valid Bearer token
- **Service-to-Service**: Internal service communication uses service tokens
- **WebSocket Auth**: User ID extracted from JWT or query parameter

---

## Service-Specific Implementation Details

### User Service (Port 8080)
**Technology:** Go, Fiber, PostgreSQL, GORM  
**Endpoints:** 9 endpoints  
**Key Features:**
- JWT token generation and validation
- User profile management
- Friend relationship management
- Bcrypt password hashing

### Chat Service (Port 8083)  
**Technology:** Go, Fiber, PostgreSQL, Redis, WebSocket  
**Endpoints:** 12 HTTP endpoints + WebSocket  
**Key Features:**
- 10k+ concurrent WebSocket connections
- Real-time messaging with Redis pub/sub
- File attachments via S3 presigned URLs
- Message reactions and read receipts

### Location Service (Port 8082)
**Technology:** Go, Fiber, PostgreSQL + PostGIS, Redis  
**Endpoints:** 6 endpoints  
**Key Features:**
- PostGIS spatial queries for proximity search
- Privacy controls for location sharing
- Redis caching for performance
- Real-time location updates

### AI Service (Port 8084)
**Technology:** Python, FastAPI, PostgreSQL, Redis  
**Endpoints:** 8 endpoints  
**Key Features:**
- Mock LLM service for development
- OpenAI GPT integration for production
- User insights and behavior analysis
- Personalized conversation starters
- Multi-dimensional compatibility scoring

---

## Gateway Routing Strategy

### Route Prioritization
1. **Static Routes** (authentication, system)
2. **Service-Specific Routes** (user, chat, location, ai)
3. **Aggregated Routes** (timeline, search)
4. **Fallback Routes** (health checks, catch-all)

### Load Balancing
- **User Service**: Round-robin (stateless)
- **Chat Service**: Sticky sessions for WebSocket (user-based)
- **Location Service**: Geographically aware routing
- **AI Service**: Queue-based for intensive operations

### Caching Strategy
- **User Profiles**: 15 minutes TTL
- **Friend Lists**: 10 minutes TTL  
- **Location Data**: 2 minutes TTL
- **AI Insights**: 60 minutes TTL
- **Timeline Content**: 5 minutes TTL

---

## Error Handling & Fallbacks

### Standard Error Response Format
```json
{
  "error": "error_code",
  "message": "Human readable message",
  "code": 400,
  "timestamp": "2024-08-09T12:00:00Z"
}
```

### Circuit Breaker Patterns
- **User Service**: Graceful degradation with cached profiles
- **Chat Service**: Queue messages during outages  
- **Location Service**: Use last known locations
- **AI Service**: Fall back to cached insights

### Service Health Monitoring
Each service exposes `/health` endpoint:
- **200 OK**: Service healthy
- **503 Unavailable**: Service degraded/unhealthy
- Gateway aggregates all service health into unified status

---

## Future Service Integration

### Stories Service (Planned)
**Schema Status:** Complete (7 tables defined)  
**Expected Endpoints:**
- `GET/POST /stories` - Story CRUD operations
- `GET /stories/highlights` - Story highlights management
- `GET /stories/feed` - Friends' stories feed

### Opportunities Service (Planned)  
**Schema Status:** Complete (6 tables defined)  
**Expected Endpoints:**
- `GET/POST /opportunities` - Social event management
- `GET /opportunities/nearby` - Location-based opportunities
- `POST /opportunities/{id}/join` - Event participation

### Integration Points
- **Timeline Aggregation**: Both services will feed into `/timeline`
- **User Integration**: Profile enrichment from User Service
- **Location Integration**: Geospatial filtering from Location Service
- **AI Integration**: Personalized recommendations

---

## Performance & Scalability

### Expected Load
- **Concurrent Users**: 10,000+
- **API Requests**: 50,000 RPS peak
- **WebSocket Connections**: 10,000+ simultaneous
- **Database Queries**: 100,000+ QPS across all services

### Scaling Strategy
- **Horizontal Scaling**: Kubernetes-ready microservices
- **Database Sharding**: User-based sharding for Chat and Location
- **CDN Integration**: Static assets and file uploads
- **Redis Clustering**: Distributed caching and pub/sub

### Monitoring & Observability
- **Request tracing** across service boundaries
- **Performance metrics** for each endpoint
- **Business metrics** (user engagement, message volume)
- **Error rate monitoring** with alerting

---

## Security Considerations

### Data Protection
- **PII Encryption**: Sensitive data encrypted at rest
- **JWT Security**: RS256 signing with key rotation
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Per-user and per-endpoint limits

### Privacy Controls
- **Location Privacy**: Granular sharing controls
- **Profile Visibility**: Public/private profile settings  
- **Message Encryption**: End-to-end encryption planned
- **Data Retention**: Configurable retention policies

---

This comprehensive API contract serves as the source of truth for frontend development, testing, and service integration. All endpoints are fully specified with OpenAPI 3.1 schemas in the accompanying `openapi.yaml` file.
