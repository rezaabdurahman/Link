# Discovery Service API Documentation

## Overview

The Discovery Service handles user availability tracking, location-based discovery, and intelligent matching for the Link platform. It serves as the orchestrator between availability data and the Search Service for AI-powered user discovery.

**Service Details:**
- **Base URL**: `http://localhost:8084/api/v1` (development)
- **Gateway Route**: `/discovery/*` → `discovery-svc/api/v1/*`
- **Authentication**: JWT Bearer tokens required for most endpoints
- **Database**: PostgreSQL for availability data, integrates with Search Service
- **Real-time**: WebSocket support for live availability updates

## Core Features

- **Availability Tracking**: Real-time user availability and status management
- **Location-Based Discovery**: Find users based on geographic proximity
- **Intelligent Matching**: Integration with Search Service for semantic matching
- **Ranking System**: Configurable weights for match scoring algorithms
- **Real-time Updates**: Live availability updates via WebSocket

## Availability Management

### Update User Availability
```http
POST /api/v1/availability
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "status": "available",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 10.5,
    "address": "San Francisco, CA"
  },
  "activity": "looking_for_coffee",
  "message": "Free for coffee and conversation!",
  "expires_at": "2024-01-01T18:00:00Z"
}
```

**Status Values:**
- `available`: Ready to meet new people
- `busy`: Online but not available for discovery
- `away`: Temporarily unavailable
- `invisible`: Online but hidden from discovery

**Activity Types:**
- `looking_for_coffee`: Seeking casual coffee meetings
- `looking_for_lunch`: Available for lunch meetups
- `networking`: Professional networking
- `social`: General social interaction
- `study_group`: Looking for study companions
- `workout`: Fitness activities
- `custom`: User-defined activity

**Response (200):**
```json
{
  "id": "availability-uuid",
  "user_id": "user-uuid",
  "status": "available",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 10.5,
    "address": "San Francisco, CA"
  },
  "activity": "looking_for_coffee",
  "message": "Free for coffee and conversation!",
  "created_at": "2024-01-01T15:00:00Z",
  "updated_at": "2024-01-01T15:00:00Z",
  "expires_at": "2024-01-01T18:00:00Z",
  "is_active": true
}
```

### Get User's Availability
```http
GET /api/v1/availability
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "id": "availability-uuid",
  "user_id": "user-uuid",
  "status": "available",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 10.5,
    "address": "San Francisco, CA"
  },
  "activity": "looking_for_coffee",
  "message": "Free for coffee and conversation!",
  "created_at": "2024-01-01T15:00:00Z",
  "updated_at": "2024-01-01T15:00:00Z",
  "expires_at": "2024-01-01T18:00:00Z",
  "is_active": true,
  "stats": {
    "discovery_count": 12,
    "match_count": 3,
    "last_discovered": "2024-01-01T15:30:00Z"
  }
}
```

### Delete Availability
```http
DELETE /api/v1/availability
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Availability status removed"
}
```

### Send Heartbeat
```http
POST /api/v1/availability/heartbeat
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Heartbeat received",
  "next_heartbeat": "2024-01-01T15:05:00Z",
  "is_active": true
}
```

## User Discovery

### Get Available Users
```http
GET /api/v1/available-users
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `latitude`: User's current latitude (required for proximity)
- `longitude`: User's current longitude (required for proximity)  
- `radius`: Search radius in miles (default: 5, max: 25)
- `limit`: Maximum results (default: 10, max: 50)
- `activity`: Filter by activity type
- `q`: Natural language search query (triggers Search Service integration)
- `include_search_scores`: Include search relevance scores (default: false)

**Response (200) - Without Search Query:**
```json
{
  "available_users": [
    {
      "user_id": "user-uuid-1",
      "distance_miles": 0.3,
      "status": "available",
      "activity": "looking_for_coffee",
      "message": "Love discussing tech and startups!",
      "location": {
        "latitude": 37.7751,
        "longitude": -122.4180,
        "address": "Mission District, SF"
      },
      "last_seen": "2024-01-01T15:25:00Z",
      "user_profile": {
        "name": "Alice Johnson",
        "username": "alice_tech",
        "profile_picture": "https://example.com/avatar1.jpg",
        "bio": "Software engineer passionate about AI"
      }
    },
    {
      "user_id": "user-uuid-2", 
      "distance_miles": 1.2,
      "status": "available",
      "activity": "networking",
      "message": "Looking to connect with fellow entrepreneurs",
      "location": {
        "latitude": 37.7849,
        "longitude": -122.4094,
        "address": "SOMA, SF"
      },
      "last_seen": "2024-01-01T15:20:00Z",
      "user_profile": {
        "name": "Bob Smith",
        "username": "bob_startup",
        "profile_picture": "https://example.com/avatar2.jpg",
        "bio": "Startup founder in fintech space"
      }
    }
  ],
  "total_available": 15,
  "search_applied": false,
  "user_location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "search_radius_miles": 5
}
```

**Response (200) - With Search Query:**
```json
{
  "available_users": [
    {
      "user_id": "user-uuid-1",
      "distance_miles": 0.3,
      "status": "available",
      "activity": "looking_for_coffee",
      "message": "Love discussing tech and startups!",
      "location": {
        "latitude": 37.7751,
        "longitude": -122.4180,
        "address": "Mission District, SF"
      },
      "last_seen": "2024-01-01T15:25:00Z",
      "search_score": 0.89,
      "match_reasons": ["Software engineering experience", "AI interest", "Tech discussion"],
      "user_profile": {
        "name": "Alice Johnson",
        "username": "alice_tech",
        "profile_picture": "https://example.com/avatar1.jpg",
        "bio": "Software engineer passionate about AI"
      }
    }
  ],
  "total_available": 15,
  "search_applied": true,
  "search_time_ms": 45,
  "user_location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "search_radius_miles": 5
}
```

### Get Discovery History
```http
GET /api/v1/discovery/history
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `limit`: Results per page (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)
- `from_date`: ISO 8601 start date
- `to_date`: ISO 8601 end date

**Response (200):**
```json
{
  "discoveries": [
    {
      "id": "discovery-uuid",
      "user_id": "user-uuid",
      "discovered_user_id": "discovered-user-uuid",
      "discovery_type": "proximity",
      "distance_miles": 0.5,
      "search_query": null,
      "search_score": null,
      "created_at": "2024-01-01T15:30:00Z",
      "discovered_user": {
        "name": "Alice Johnson",
        "username": "alice_tech",
        "profile_picture": "https://example.com/avatar1.jpg"
      }
    },
    {
      "id": "discovery-uuid-2",
      "user_id": "user-uuid", 
      "discovered_user_id": "discovered-user-uuid-2",
      "discovery_type": "search",
      "distance_miles": 2.3,
      "search_query": "software engineer with React experience",
      "search_score": 0.76,
      "created_at": "2024-01-01T14:15:00Z",
      "discovered_user": {
        "name": "Bob Smith",
        "username": "bob_react",
        "profile_picture": "https://example.com/avatar2.jpg"
      }
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

## Match Ranking System

### Get Current Ranking Weights
```http
GET /api/v1/ranking/weights
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "data": {
    "semantic_similarity": 0.6,
    "interest_overlap": 0.2,
    "geo_proximity": 0.1,
    "recent_activity": 0.1
  },
  "status": "success"
}
```

### Update Ranking Weights (Admin Only)
```http
PUT /api/v1/ranking/weights
Authorization: Bearer {admin-jwt-token}
```

**Request Body:**
```json
{
  "semantic_similarity": 0.5,
  "interest_overlap": 0.3,
  "geo_proximity": 0.1,
  "recent_activity": 0.1
}
```

**Validation Rules:**
- All weights must be between 0.0 and 1.0
- Total sum must equal 1.0 (±0.01)
- At least one weight must be provided

**Response (200):**
```json
{
  "data": {
    "semantic_similarity": 0.5,
    "interest_overlap": 0.3,
    "geo_proximity": 0.1,
    "recent_activity": 0.1
  },
  "status": "success",
  "message": "Ranking weights updated successfully"
}
```

### Reset Ranking Weights to Defaults (Admin Only)
```http
POST /api/v1/ranking/weights/reset
Authorization: Bearer {admin-jwt-token}
```

**Response (200):**
```json
{
  "data": {
    "semantic_similarity": 0.6,
    "interest_overlap": 0.2,
    "geo_proximity": 0.1,
    "recent_activity": 0.1
  },
  "status": "success",
  "message": "Ranking weights reset to defaults"
}
```

### Validate Ranking Weights
```http
GET /api/v1/ranking/weights/validate
Authorization: Bearer {jwt-token}
```

**Response (200) - Valid Weights:**
```json
{
  "valid": true,
  "status": "validation_passed",
  "weights": {
    "semantic_similarity": 0.6,
    "interest_overlap": 0.2,
    "geo_proximity": 0.1,
    "recent_activity": 0.1
  },
  "sum": 1.0,
  "message": "Ranking weights are valid"
}
```

**Response (400) - Invalid Weights:**
```json
{
  "valid": false,
  "error": "ranking weights sum to 1.05, expected ~1.0",
  "status": "validation_failed"
}
```

### Get Ranking Algorithm Information
```http
GET /api/v1/ranking/info
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "algorithm": {
    "version": "v1",
    "formula": "Score = semantic_similarity_weight × semantic_similarity + interest_overlap_weight × interest_overlap + geo_proximity_weight × geo_proximity + recent_activity_weight × recent_activity",
    "components": {
      "semantic_similarity": {
        "description": "Cosine similarity from pgvector embeddings",
        "weight": 0.6
      },
      "interest_overlap": {
        "description": "Jaccard coefficient over interests (pre-computed bitset)",
        "weight": 0.2
      },
      "geo_proximity": {
        "description": "Normalized distance within search radius",
        "weight": 0.1
      },
      "recent_activity": {
        "description": "Inverse of minutes since last heartbeat",
        "weight": 0.1
      }
    }
  },
  "current_weights": {
    "semantic_similarity": 0.6,
    "interest_overlap": 0.2,
    "geo_proximity": 0.1,
    "recent_activity": 0.1
  },
  "weights_sum": 1.0,
  "is_adjustable": true,
  "is_ab_ready": true,
  "status": "active"
}
```

## Location and Geolocation

### Update Location
```http
POST /api/v1/location
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 15.2,
  "altitude": 52.0,
  "address": "San Francisco, CA, USA"
}
```

**Response (200):**
```json
{
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 15.2,
    "altitude": 52.0,
    "address": "San Francisco, CA, USA"
  },
  "updated_at": "2024-01-01T15:30:00Z",
  "message": "Location updated successfully"
}
```

### Geocode Address
```http
POST /api/v1/location/geocode
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "address": "1600 Amphitheatre Parkway, Mountain View, CA"
}
```

**Response (200):**
```json
{
  "results": [
    {
      "latitude": 37.4221,
      "longitude": -122.0841,
      "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "accuracy": "ROOFTOP",
      "place_id": "ChIJ2eUgeAK6j4ARbn5u_wAGqWA"
    }
  ],
  "status": "OK"
}
```

### Reverse Geocode Coordinates
```http
GET /api/v1/location/reverse-geocode
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `latitude`: Latitude coordinate (required)
- `longitude`: Longitude coordinate (required)

**Response (200):**
```json
{
  "results": [
    {
      "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "address_components": [
        {
          "long_name": "1600",
          "short_name": "1600",
          "types": ["street_number"]
        },
        {
          "long_name": "Amphitheatre Parkway",
          "short_name": "Amphitheatre Pkwy",
          "types": ["route"]
        }
      ],
      "place_id": "ChIJ2eUgeAK6j4ARbn5u_wAGqWA"
    }
  ],
  "status": "OK"
}
```

## Real-Time WebSocket API

### Connection Setup
```javascript
const ws = new WebSocket(
  `ws://localhost:8084/ws/discovery?token=${jwtToken}`
);
```

### Client → Server Messages

#### Subscribe to Availability Updates
```json
{
  "type": "subscribe_availability",
  "radius_miles": 5,
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}
```

#### Update User Status
```json
{
  "type": "status_update",
  "status": "available",
  "activity": "looking_for_coffee"
}
```

#### Send Heartbeat
```json
{
  "type": "heartbeat"
}
```

### Server → Client Events

#### New User Available
```json
{
  "type": "user_available",
  "user_id": "new-user-uuid",
  "distance_miles": 0.8,
  "status": "available",
  "activity": "networking",
  "user_profile": {
    "name": "John Doe",
    "username": "john_networking",
    "profile_picture": "https://example.com/avatar.jpg"
  }
}
```

#### User Status Changed
```json
{
  "type": "user_status_changed",
  "user_id": "user-uuid",
  "old_status": "available",
  "new_status": "busy"
}
```

#### User No Longer Available
```json
{
  "type": "user_unavailable",
  "user_id": "user-uuid",
  "reason": "status_changed"
}
```

## Analytics and Insights

### Get Discovery Analytics
```http
GET /api/v1/analytics/discovery
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `period`: Time period (`day`, `week`, `month`)
- `from_date`: ISO 8601 start date
- `to_date`: ISO 8601 end date

**Response (200):**
```json
{
  "period": "week",
  "from_date": "2024-01-01T00:00:00Z",
  "to_date": "2024-01-07T23:59:59Z",
  "metrics": {
    "total_discoveries": 127,
    "unique_users_discovered": 45,
    "successful_matches": 8,
    "avg_discovery_radius": 3.2,
    "peak_discovery_hour": 18,
    "discovery_by_activity": {
      "looking_for_coffee": 52,
      "networking": 38,
      "social": 25,
      "study_group": 12
    },
    "discovery_by_day": [
      {"date": "2024-01-01", "count": 15},
      {"date": "2024-01-02", "count": 23},
      {"date": "2024-01-03", "count": 18}
    ]
  }
}
```

### Get Availability Statistics
```http
GET /api/v1/analytics/availability
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "user_stats": {
    "total_availability_sessions": 15,
    "avg_session_duration_minutes": 45,
    "total_discoveries": 67,
    "successful_matches": 8,
    "match_rate": 0.12,
    "most_active_location": "Mission District, SF",
    "preferred_activities": ["looking_for_coffee", "networking"],
    "peak_activity_hours": [12, 18, 19]
  },
  "platform_stats": {
    "currently_available": 89,
    "avg_users_available": 156,
    "discovery_success_rate": 0.15,
    "most_popular_activities": [
      {"activity": "looking_for_coffee", "count": 234},
      {"activity": "networking", "count": 187},
      {"activity": "social", "count": 145}
    ]
  }
}
```

## Privacy and Safety

### Update Privacy Settings
```http
PUT /api/v1/privacy
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "location_precision": "neighborhood",
  "profile_visibility": "friends_only",
  "discovery_enabled": true,
  "location_history_retention_days": 30,
  "block_anonymous_discovery": false
}
```

**Location Precision Options:**
- `exact`: Exact GPS coordinates
- `neighborhood`: Neighborhood-level precision (~0.5 mile radius)
- `city`: City-level precision
- `hidden`: Location not shared

**Response (200):**
```json
{
  "privacy_settings": {
    "location_precision": "neighborhood",
    "profile_visibility": "friends_only",
    "discovery_enabled": true,
    "location_history_retention_days": 30,
    "block_anonymous_discovery": false
  },
  "updated_at": "2024-01-01T15:30:00Z"
}
```

### Block User from Discovery
```http
POST /api/v1/privacy/block
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "blocked_user_id": "user-to-block-uuid",
  "reason": "unwanted_contact"
}
```

**Response (200):**
```json
{
  "blocked_user_id": "user-to-block-uuid",
  "blocked_at": "2024-01-01T15:30:00Z",
  "message": "User blocked from discovery"
}
```

### Report User
```http
POST /api/v1/safety/report
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "reported_user_id": "user-uuid",
  "reason": "inappropriate_behavior",
  "description": "User was making inappropriate comments during meetup",
  "incident_location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "Coffee shop on Mission St"
  }
}
```

**Report Reasons:**
- `inappropriate_behavior`
- `harassment`
- `fake_profile`
- `spam`
- `safety_concern`
- `other`

**Response (201):**
```json
{
  "report_id": "report-uuid",
  "status": "submitted",
  "reported_user_id": "user-uuid",
  "created_at": "2024-01-01T15:30:00Z",
  "message": "Report submitted successfully"
}
```

## Health and Monitoring

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "service": "discovery-svc",
  "timestamp": "2024-01-01T15:30:00Z",
  "version": "1.0.0",
  "dependencies": {
    "database": "healthy",
    "search_service": "healthy",
    "redis": "healthy"
  }
}
```

### Service Statistics
```http
GET /api/v1/stats
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "active_users": 156,
  "available_users": 89,
  "total_discoveries_today": 1247,
  "avg_response_time_ms": 45,
  "search_integration_health": "healthy",
  "websocket_connections": 23,
  "cache_hit_rate": 0.87
}
```

## Error Handling

### Common Error Responses

```json
{
  "error": "LOCATION_REQUIRED",
  "message": "Location coordinates are required for discovery",
  "details": {
    "required_fields": ["latitude", "longitude"]
  },
  "timestamp": "2024-01-01T15:30:00Z"
}
```

### Error Codes:
- `LOCATION_REQUIRED`: Location data missing for proximity search
- `INVALID_RADIUS`: Search radius exceeds maximum allowed
- `AVAILABILITY_EXPIRED`: User availability has expired
- `SEARCH_SERVICE_ERROR`: Search service integration error
- `RANKING_WEIGHTS_INVALID`: Ranking weights validation failed
- `PRIVACY_VIOLATION`: Request violates user privacy settings
- `RATE_LIMIT_EXCEEDED`: Discovery rate limit exceeded

## Rate Limits

- **Availability Updates**: 10 updates/minute per user
- **Discovery Requests**: 30 requests/minute per user  
- **Location Updates**: 60 updates/minute per user
- **Analytics Requests**: 10 requests/minute per user
- **WebSocket Messages**: 100 messages/minute per connection

## Security Features

- **Location Privacy**: Configurable precision levels
- **User Blocking**: Prevent unwanted discovery interactions
- **Content Filtering**: Activity message content validation
- **Rate Limiting**: Prevent abuse and spam
- **Audit Logging**: All discovery interactions logged
- **Safety Reporting**: User reporting system for safety concerns

## Example Usage

### Complete Discovery Flow
```bash
# 1. Update availability
curl -X POST http://localhost:8084/api/v1/availability \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "available",
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "address": "San Francisco, CA"
    },
    "activity": "looking_for_coffee",
    "message": "Love discussing tech!"
  }'

# 2. Discover nearby users
curl -X GET "http://localhost:8084/api/v1/available-users?latitude=37.7749&longitude=-122.4194&radius=2&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"

# 3. Search with natural language
curl -X GET "http://localhost:8084/api/v1/available-users?latitude=37.7749&longitude=-122.4194&q=software%20engineers%20interested%20in%20AI" \
  -H "Authorization: Bearer ${TOKEN}"

# 4. Get discovery history  
curl -X GET http://localhost:8084/api/v1/discovery/history \
  -H "Authorization: Bearer ${TOKEN}"

# 5. Send heartbeat to stay active
curl -X POST http://localhost:8084/api/v1/availability/heartbeat \
  -H "Authorization: Bearer ${TOKEN}"
```

### WebSocket Discovery Client
```javascript
class DiscoveryClient {
  constructor(token) {
    this.token = token;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(`ws://localhost:8084/ws/discovery?token=${this.token}`);
    
    this.ws.onopen = () => {
      console.log('Connected to discovery service');
      this.subscribeToAvailability();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleDiscoveryEvent(data);
    };
  }

  subscribeToAvailability() {
    this.ws.send(JSON.stringify({
      type: 'subscribe_availability',
      radius_miles: 3,
      location: {
        latitude: 37.7749,
        longitude: -122.4194
      }
    }));
  }

  updateStatus(status, activity) {
    this.ws.send(JSON.stringify({
      type: 'status_update',
      status: status,
      activity: activity
    }));
  }

  handleDiscoveryEvent(data) {
    switch (data.type) {
      case 'user_available':
        this.onNewUserAvailable(data);
        break;
      case 'user_unavailable':
        this.onUserUnavailable(data);
        break;
      case 'user_status_changed':
        this.onUserStatusChanged(data);
        break;
    }
  }
}
```

## Service Integration

The Discovery Service integrates with:
- **Search Service**: AI-powered semantic matching and user embeddings
- **User Service**: Profile data and friend relationships for discovery filtering
- **Chat Service**: Direct connection facilitation for discovered matches
- **Feature Service**: A/B testing for ranking algorithms and discovery features
- **API Gateway**: Authentication, rate limiting, and request routing

All service-to-service communication uses mTLS via Linkerd service mesh with comprehensive observability through Prometheus metrics and distributed tracing.