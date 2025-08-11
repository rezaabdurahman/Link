# `/api/me` Endpoint Implementation Guide

> **Note**: This document provides frontend-specific implementation guidance. For the complete API specification including authentication, security, and rate limiting, see the [Unified API Contract](../docs/api-contract.md).

## Overview
The `/api/me` endpoint returns the current authenticated user's profile data. This endpoint is called after token refresh to populate the user's authentication state.

**Gateway Mapping**: Frontend `/api/me` requests → Gateway `/users/profile` → User Service `/api/v1/profile`

## Endpoint Specification

### Request
```http
GET /api/me
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

### Response (Success - 200 OK)
```json
{
  "id": "user-12345",
  "name": "John Doe",
  "email": "john@example.com", 
  "profilePicture": "https://storage.example.com/profiles/john.jpg",
  "emailVerified": true,
  "createdAt": "2025-01-09T10:00:00Z",
  "updatedAt": "2025-01-09T15:30:00Z"
}
```

### Response (Unauthorized - 401)
```json
{
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token",
    "code": "TOKEN_EXPIRED"
  }
}
```

### Response (Not Found - 404) 
```json
{
  "error": {
    "type": "AUTHENTICATION_ERROR", 
    "message": "User not found",
    "code": "USER_NOT_FOUND"
  }
}
```

## Implementation Notes

### 1. Extract User ID from JWT
```go
// Extract user ID from JWT token in Authorization header
userID, err := extractUserIDFromToken(r.Header.Get("Authorization"))
if err != nil {
    http.Error(w, "Invalid token", 401)
    return
}
```

### 2. Fetch User from Database
```go
// Fetch user from your user service/database
user, err := userService.GetByID(ctx, userID)
if err != nil {
    if errors.Is(err, ErrUserNotFound) {
        http.Error(w, "User not found", 404)
        return
    }
    http.Error(w, "Internal server error", 500)
    return
}
```

### 3. Format Response
```go
// Convert internal user model to API response
response := MeResponse{
    ID:             user.ID,
    Name:           user.Name,
    Email:          user.Email,
    ProfilePicture: user.ProfilePicture,
    EmailVerified:  user.EmailVerified,
    CreatedAt:      user.CreatedAt.Format(time.RFC3339),
    UpdatedAt:      user.UpdatedAt.Format(time.RFC3339),
}

w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(response)
```

## Frontend Integration

The frontend automatically calls this endpoint:
1. **On app initialization** - When a stored token is found
2. **After token refresh** - To get updated user data
3. **After login/register** - To populate user state

## Security Considerations

1. **JWT Validation** - Verify token signature and expiration
2. **User Existence** - Ensure user still exists in database
3. **Rate Limiting** - Prevent abuse of this endpoint
4. **CORS** - Configure appropriate CORS headers

## Example Go Handler

```go
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
    // Extract user ID from JWT
    userID := getUserIDFromContext(r.Context())
    if userID == "" {
        writeErrorResponse(w, 401, "AUTHENTICATION_ERROR", "Invalid token")
        return
    }

    // Fetch user
    user, err := h.userService.GetByID(r.Context(), userID)
    if err != nil {
        if errors.Is(err, ErrUserNotFound) {
            writeErrorResponse(w, 404, "AUTHENTICATION_ERROR", "User not found")
            return
        }
        writeErrorResponse(w, 500, "SERVER_ERROR", "Internal server error")
        return
    }

    // Return user data
    response := MeResponse{
        ID:             user.ID,
        Name:           user.Name,
        Email:          user.Email,
        ProfilePicture: user.ProfilePicture,
        EmailVerified:  user.EmailVerified,
        CreatedAt:      user.CreatedAt.Format(time.RFC3339),
        UpdatedAt:      user.UpdatedAt.Format(time.RFC3339),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}
```

## Testing

Once implemented, you can test with:

```bash
# Test with valid token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/me

# Test with invalid token  
curl -H "Authorization: Bearer invalid-token" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/me
```

## Benefits

✅ **Real User Data** - No more temp/mock users  
✅ **Proper Session Restoration** - User data persists across browser refreshes  
✅ **Profile Updates** - Changes reflected immediately  
✅ **Security** - Token validation ensures data belongs to authenticated user
