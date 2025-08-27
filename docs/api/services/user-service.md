# User Service API Documentation

## Overview

The User Service is the core authentication and profile management service for the Link platform. It handles user registration, authentication, profile management, friend relationships, and contact invitations.

**Service Details:**
- **Base URL**: `http://localhost:8081/api/v1` (development)
- **Gateway Route**: `/users/*` → `user-svc/api/v1/*`
- **Authentication**: JWT Bearer tokens required for most endpoints
- **Database**: PostgreSQL with encryption at rest

## Authentication Endpoints

### Register User
```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "username": "johndoe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 900
}
```

### Login User
```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 900
}
```

### Refresh Token
```http
POST /api/v1/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response (200):**
```json
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token",
  "expiresIn": 900
}
```

### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

## Profile Management

### Get User Profile
```http
GET /api/v1/profile
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "profilePicture": "https://example.com/avatar.jpg",
  "bio": "Software engineer passionate about connecting people",
  "location": "San Francisco, CA",
  "interests": ["technology", "hiking", "photography"],
  "emailVerified": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Gateway Route**: `GET /users/profile` → `user-svc/api/v1/profile`

### Update User Profile
```http
PUT /api/v1/profile
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "name": "John Smith",
  "bio": "Updated bio",
  "location": "New York, NY",
  "interests": ["technology", "music", "travel"]
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "John Smith",
  "email": "john@example.com",
  "username": "johndoe",
  "bio": "Updated bio",
  "location": "New York, NY",
  "interests": ["technology", "music", "travel"],
  "updatedAt": "2024-01-01T12:00:00Z"
}
```

### Upload Profile Picture
```http
POST /api/v1/uploads/profile-picture
Authorization: Bearer {jwt-token}
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Profile picture file (JPEG, PNG, max 5MB)

**Response (200):**
```json
{
  "url": "https://example.com/uploads/profile-pictures/uuid.jpg",
  "message": "Profile picture uploaded successfully"
}
```

## Friend Management

### Get Friends List
```http
GET /api/v1/friends
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `status`: Filter by status (`accepted`, `pending`, `blocked`)
- `limit`: Results per page (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)

**Response (200):**
```json
{
  "friends": [
    {
      "id": "uuid",
      "userId": "uuid",
      "friendId": "uuid",
      "status": "accepted",
      "friend": {
        "id": "uuid",
        "name": "Jane Doe",
        "username": "janedoe",
        "profilePicture": "https://example.com/avatar2.jpg"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

### Send Friend Request
```http
POST /api/v1/friends/request
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "friendId": "target-user-uuid"
}
```

**Response (201):**
```json
{
  "id": "friendship-uuid",
  "userId": "your-uuid",
  "friendId": "target-user-uuid",
  "status": "pending",
  "message": "Friend request sent successfully"
}
```

### Accept Friend Request
```http
POST /api/v1/friends/{friendshipId}/accept
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "id": "friendship-uuid",
  "userId": "uuid",
  "friendId": "uuid",
  "status": "accepted",
  "message": "Friend request accepted"
}
```

### Decline Friend Request
```http
POST /api/v1/friends/{friendshipId}/decline
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Friend request declined"
}
```

### Remove Friend
```http
DELETE /api/v1/friends/{friendshipId}
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Friend removed successfully"
}
```

## Contact Invitations

### Get Contacts
```http
GET /api/v1/users/contacts
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `limit`: Results per page (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by invitation status

**Response (200):**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "userId": "uuid",
      "email": "friend@example.com",
      "phone": "+1234567890",
      "name": "Friend Name",
      "status": "pending",
      "invitationToken": "token-uuid",
      "invitedAt": "2024-01-01T00:00:00Z",
      "respondedAt": null
    }
  ],
  "total": 10,
  "limit": 20,
  "offset": 0
}
```

### Send Contact Invitation
```http
POST /api/v1/users/contacts/invite
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "email": "friend@example.com",
  "phone": "+1234567890",
  "name": "Friend Name",
  "message": "Join me on Link!"
}
```

**Response (201):**
```json
{
  "id": "invitation-uuid",
  "email": "friend@example.com",
  "phone": "+1234567890",
  "name": "Friend Name",
  "status": "sent",
  "invitationToken": "token-uuid",
  "message": "Invitation sent successfully"
}
```

### Accept Invitation
```http
POST /api/v1/users/contacts/accept/{token}
```

**Response (200):**
```json
{
  "message": "Invitation accepted successfully",
  "friendshipCreated": true
}
```

### Bulk Upload Contacts
```http
POST /api/v1/users/contacts/bulk-upload
Authorization: Bearer {jwt-token}
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV file with contacts (name, email, phone columns)

**Response (200):**
```json
{
  "processed": 25,
  "invited": 20,
  "skipped": 5,
  "errors": [],
  "message": "Contacts processed successfully"
}
```

## Check-in Management

### Create Check-in
```http
POST /api/v1/checkins
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "San Francisco, CA"
  },
  "status": "available",
  "message": "Looking for coffee companions!",
  "expiresAt": "2024-01-01T18:00:00Z"
}
```

**Response (201):**
```json
{
  "id": "checkin-uuid",
  "userId": "uuid",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "San Francisco, CA"
  },
  "status": "available",
  "message": "Looking for coffee companions!",
  "createdAt": "2024-01-01T15:00:00Z",
  "expiresAt": "2024-01-01T18:00:00Z"
}
```

### Get User's Check-ins
```http
GET /api/v1/checkins
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `limit`: Results per page (default: 10, max: 50)
- `offset`: Pagination offset (default: 0)
- `active_only`: Only return active check-ins (default: false)

**Response (200):**
```json
{
  "checkins": [
    {
      "id": "checkin-uuid",
      "userId": "uuid",
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "name": "San Francisco, CA"
      },
      "status": "available",
      "message": "Looking for coffee companions!",
      "createdAt": "2024-01-01T15:00:00Z",
      "expiresAt": "2024-01-01T18:00:00Z",
      "isActive": true
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

### Delete Check-in
```http
DELETE /api/v1/checkins/{checkinId}
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Check-in deleted successfully"
}
```

## Onboarding

### Get Onboarding Status
```http
GET /api/v1/onboarding/status
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "userId": "uuid",
  "currentStep": "profile_setup",
  "completedSteps": ["account_created", "email_verified"],
  "totalSteps": 5,
  "isComplete": false,
  "progress": 0.4
}
```

### Complete Onboarding Step
```http
POST /api/v1/onboarding/complete-step
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "step": "profile_setup",
  "data": {
    "bio": "Software engineer",
    "interests": ["technology", "music"]
  }
}
```

**Response (200):**
```json
{
  "step": "profile_setup",
  "completed": true,
  "nextStep": "friend_connections",
  "progress": 0.6
}
```

## Health & Monitoring

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy"
}
```

### Liveness Probe
```http
GET /health/live
```

**Response (200):**
```json
{
  "status": "alive"
}
```

### Readiness Probe
```http
GET /health/ready
```

**Response (200):**
```json
{
  "status": "ready"
}
```

### Metrics Endpoint
```http
GET /metrics
```

**Response (200):**
```
# Prometheus metrics format
user_service_requests_total{method="GET",endpoint="/profile"} 142
user_service_request_duration_seconds{method="GET",endpoint="/profile"} 0.025
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "validation error details"
  },
  "timestamp": "2024-01-01T15:00:00Z"
}
```

### Common Error Codes:
- `VALIDATION_ERROR` (400): Invalid request parameters
- `UNAUTHORIZED` (401): Invalid or expired token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Resource already exists
- `RATE_LIMIT_EXCEEDED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Server error

## Rate Limits

- **Authentication endpoints**: 10 requests/minute per IP
- **Profile endpoints**: 100 requests/minute per user
- **Friend operations**: 50 requests/minute per user
- **Contact invitations**: 10 requests/hour per user
- **Check-ins**: 60 requests/minute per user

Rate limit headers included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1640995200
```

## Security Features

- **JWT Authentication**: RS256 algorithm with key rotation
- **Data Encryption**: PII encrypted at rest using KMS
- **Input Validation**: Comprehensive validation and sanitization
- **Rate Limiting**: IP and user-based rate limiting
- **CORS**: Configured for frontend domains
- **Session Management**: Automatic cleanup of expired sessions

## Environment Variables

Required configuration:
```bash
PORT=8081
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://user:pass@host:port/dbname
REDIS_HOST=localhost
REDIS_PORT=6379
KMS_KEY_ID=your-kms-key-id
SENDGRID_API_KEY=your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

## Example Usage

### Complete Authentication Flow
```bash
# Register new user
curl -X POST http://localhost:8081/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123!",
    "username": "johndoe"
  }'

# Login
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123!"
  }'

# Get profile (using token from login)
curl -X GET http://localhost:8081/api/v1/profile \
  -H "Authorization: Bearer {access-token}"
```

### Friend Request Flow
```bash
# Send friend request
curl -X POST http://localhost:8081/api/v1/friends/request \
  -H "Authorization: Bearer {access-token}" \
  -H "Content-Type: application/json" \
  -d '{"friendId": "target-user-uuid"}'

# Accept friend request (as the target user)
curl -X POST http://localhost:8081/api/v1/friends/{friendshipId}/accept \
  -H "Authorization: Bearer {target-user-token}"
```

## Service Integration

The User Service integrates with:
- **API Gateway**: Authentication and routing
- **Discovery Service**: User availability data
- **Chat Service**: User profile data for messaging
- **Search Service**: Profile data for search indexing
- **Feature Service**: User segmentation for A/B testing
- **AI Service**: Profile data for conversation insights

All service-to-service communication uses mTLS via Linkerd service mesh.