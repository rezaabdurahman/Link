# Unified API Contract Documentation

## Overview

This document serves as the single source of truth for API specifications, bridging backend gateway requirements with frontend implementation needs. It resolves conflicts identified in the documentation audit.

## Authentication & Authorization

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

### Authentication Flow
1. **Login/Register**: User authenticates and receives JWT token
2. **Token Validation**: All protected endpoints validate Bearer tokens
3. **Token Refresh**: Automatic refresh using refresh token
4. **User Profile Retrieval**: `/api/me` endpoint called after token operations

## Critical Endpoint Specifications

### 1. User Profile Endpoint (`/api/me`)

**Gateway Route**: `GET /users/profile`  
**Service Route**: `GET /api/v1/profile`  
**Frontend Reference**: `/api/me`

#### Authentication
- **Required**: JWT Bearer token
- **Validation**: Token signature and expiration checked
- **User Extraction**: User ID extracted from JWT claims

#### Request
```http
GET /users/profile
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

#### Response (Success - 200)
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "profilePicture": "string|null",
  "emailVerified": boolean,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

#### Error Responses
- **401 Unauthorized**: Invalid/expired token
- **404 Not Found**: User not found
- **500 Internal Server Error**: Service failure

## Rate Limiting Policy

### Standard Limits
- **Authentication endpoints**: 10 requests/minute per IP
- **User profile endpoints**: 100 requests/minute per user
- **Chat endpoints**: 500 requests/minute per user
- **Location updates**: 60 requests/minute per user

### Abuse Prevention
- **IP-based limiting**: Prevents brute force attacks
- **User-based limiting**: Prevents API abuse
- **Geographic limiting**: Location-based restrictions where applicable
- **Circuit breakers**: Automatic throttling during high load

### Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1640995200
```

## Security Standards

### Token Management
- **Algorithm**: RS256 with key rotation
- **Expiration**: Access tokens expire in 15 minutes
- **Refresh**: Refresh tokens expire in 30 days
- **Revocation**: Tokens can be revoked server-side

### Data Protection
- **Encryption**: All PII encrypted at rest
- **Validation**: Comprehensive input validation
- **CORS**: Properly configured for frontend domain
- **HTTPS**: All endpoints require TLS

### Privacy Controls
- **Profile Visibility**: Public/private settings respected
- **Location Sharing**: Granular permission controls
- **Data Retention**: Configurable retention policies

## Implementation Notes

### Backend (API Gateway)
- Routes `/users/profile` to User Service `/api/v1/profile`
- Extracts user_id from JWT for service calls
- Implements standard error response format
- Applies rate limiting and security headers

### Frontend Integration
- Calls endpoint on app initialization with stored token
- Handles token refresh scenarios automatically
- Implements proper error handling for auth failures
- Updates user state across application context

## Migration Notes

### Changes from Previous Documentation
1. **Endpoint Consistency**: Unified `/api/me` → `/users/profile` mapping
2. **Error Format**: Standardized error response structure
3. **Rate Limiting**: Centralized rate limiting specifications
4. **Authentication**: Clarified token validation flow

### Backward Compatibility
- Frontend can continue using `/api/me` reference (gateway handles routing)
- Error response format maintained for existing integrations
- Token structure unchanged

## Testing & Validation

### Integration Tests
```bash
# Valid token test
curl -H "Authorization: Bearer $VALID_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/users/profile

# Invalid token test  
curl -H "Authorization: Bearer invalid-token" \
     -H "Content-Type: application/json" \
     http://localhost:8080/users/profile
```

### Rate Limit Testing
```bash
# Test rate limiting
for i in {1..15}; do
  curl -H "Authorization: Bearer $TOKEN" \
       http://localhost:8080/users/profile
done
```

---

*This document resolves conflicts identified in the documentation audit and serves as the canonical reference for API implementation across backend and frontend teams.*
