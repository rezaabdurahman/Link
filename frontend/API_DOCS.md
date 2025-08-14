# Link Frontend API Documentation

This document describes the API endpoints used by the Link frontend application, with a focus on the friend search functionality.

## Authentication

All API requests require authentication using a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

## Friend Search Endpoints

### Search Friends

Search for friends and discoverable users based on a query string.

**Endpoint:** `GET /api/friends/search`

**Query Parameters:**
- `q` (string, required) - Search query for matching users
- `limit` (number, optional) - Maximum number of results to return (default: 20, max: 100)
- `page` (number, optional) - Page number for pagination (default: 1)
- `include_bio` (boolean, optional) - Include user bio in response (default: true)

**Example Request:**
```bash
GET /api/friends/search?q=alice&limit=10&include_bio=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "friends": [
    {
      "id": "user-123",
      "first_name": "Alice",
      "last_name": "Johnson",
      "email": "alice@example.com",
      "profile_picture": "https://example.com/avatars/alice.jpg",
      "bio": "Loves hiking and photography",
      "mutual_friends_count": 5,
      "is_friend": true,
      "friend_status": "accepted",
      "last_active": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "has_more": true
}
```

**Response Fields:**
- `friends` (array) - Array of user objects matching the search
- `total` (number) - Total number of matching users
- `page` (number) - Current page number
- `limit` (number) - Number of results per page
- `has_more` (boolean) - Whether more results are available

**User Object Fields:**
- `id` (string) - Unique user identifier
- `first_name` (string) - User's first name
- `last_name` (string) - User's last name
- `email` (string) - User's email address
- `profile_picture` (string, nullable) - URL to user's profile picture
- `bio` (string, nullable) - User's bio/description
- `mutual_friends_count` (number) - Number of mutual friends with current user
- `is_friend` (boolean) - Whether user is already a friend
- `friend_status` (string) - Status of friend relationship ("pending", "accepted", "none")
- `last_active` (string) - ISO 8601 timestamp of last activity

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Search query is required",
  "details": {
    "field": "q",
    "code": "MISSING_REQUIRED_FIELD"
  }
}
```

**401 Unauthorized:**
```json
{
  "error": "AUTHENTICATION_ERROR",
  "message": "Invalid or expired token"
}
```

**429 Too Many Requests:**
```json
{
  "error": "RATE_LIMIT_ERROR",
  "message": "Too many search requests. Please try again later.",
  "retry_after": 60
}
```

**500 Internal Server Error:**
```json
{
  "error": "SERVER_ERROR",
  "message": "Internal server error occurred"
}
```

## Conversation Endpoints

### Get Conversations

Retrieve user's conversations/chats.

**Endpoint:** `GET /api/conversations`

**Query Parameters:**
- `limit` (number, optional) - Maximum number of conversations (default: 50, max: 100)
- `page` (number, optional) - Page number for pagination (default: 1)
- `include_archived` (boolean, optional) - Include archived conversations (default: false)

**Example Request:**
```bash
GET /api/conversations?limit=20&include_archived=false
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": "conv-123",
      "type": "direct",
      "participants": [
        {
          "id": "user-456",
          "first_name": "Bob",
          "last_name": "Smith",
          "profile_picture": "https://example.com/avatars/bob.jpg"
        }
      ],
      "last_message": {
        "id": "msg-789",
        "content": "Hey, how are you?",
        "sender_id": "user-456",
        "created_at": "2024-01-15T14:20:00Z",
        "type": "text"
      },
      "unread_count": 2,
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-15T14:20:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "has_more": false
}
```

### Create Conversation

Create a new conversation with one or more users.

**Endpoint:** `POST /api/conversations`

**Request Body:**
```json
{
  "type": "direct",
  "participant_ids": ["user-456"],
  "initial_message": "Hi there!"
}
```

**Request Fields:**
- `type` (string, required) - Conversation type ("direct" or "group")
- `participant_ids` (array, required) - Array of user IDs to include
- `initial_message` (string, optional) - Optional first message to send

**Response:**
```json
{
  "id": "conv-789",
  "type": "direct",
  "participants": [
    {
      "id": "user-456",
      "first_name": "Bob",
      "last_name": "Smith",
      "profile_picture": "https://example.com/avatars/bob.jpg"
    }
  ],
  "last_message": {
    "id": "msg-101112",
    "content": "Hi there!",
    "sender_id": "current-user-id",
    "created_at": "2024-01-15T15:30:00Z",
    "type": "text"
  },
  "unread_count": 0,
  "created_at": "2024-01-15T15:30:00Z",
  "updated_at": "2024-01-15T15:30:00Z"
}
```

## Error Handling

The API uses consistent error response formats:

### Error Types

- `VALIDATION_ERROR` - Invalid input data
- `AUTHENTICATION_ERROR` - Authentication issues
- `AUTHORIZATION_ERROR` - Permission denied
- `NOT_FOUND_ERROR` - Resource not found
- `RATE_LIMIT_ERROR` - Too many requests
- `SERVER_ERROR` - Internal server issues

### Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Search endpoints**: 100 requests per minute per user
- **Conversation endpoints**: 1000 requests per minute per user
- **Message endpoints**: 500 requests per minute per user

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642780800
```

## WebSocket Events

Real-time updates are available via WebSocket connections.

### Connection

Connect to: `wss://api.example.com/ws/conversations/<conversation_id>`

Authentication: Include token in query parameter:
```
wss://api.example.com/ws/conversations/conv-123?token=<jwt_token>
```

### Events

**Message Received:**
```json
{
  "type": "message",
  "data": {
    "message": {
      "id": "msg-456",
      "content": "Hello!",
      "sender_id": "user-789",
      "created_at": "2024-01-15T16:00:00Z",
      "type": "text"
    },
    "conversation_id": "conv-123"
  }
}
```

**User Typing:**
```json
{
  "type": "typing",
  "data": {
    "user_id": "user-789",
    "conversation_id": "conv-123",
    "is_typing": true
  }
}
```

**User Stop Typing:**
```json
{
  "type": "stop_typing",
  "data": {
    "user_id": "user-789",
    "conversation_id": "conv-123"
  }
}
```

## Integration Examples

### Frontend Service Implementation

The frontend uses service layer architecture to interact with these APIs:

```typescript
// Friend search
import { searchFriends } from '../services/userClient';

const results = await searchFriends('alice', { 
  limit: 20,
  include_bio: true 
});

// Create conversation
import { createConversation } from '../services/chatClient';

const conversation = await createConversation({
  type: 'direct',
  participant_ids: ['user-456'],
  initial_message: 'Hi there!'
});
```

### Error Handling

```typescript
try {
  const results = await searchFriends(query);
  // Handle success
} catch (error) {
  switch (error.error) {
    case 'RATE_LIMIT_ERROR':
      // Show rate limit message
      break;
    case 'VALIDATION_ERROR':
      // Show validation error
      break;
    default:
      // Show generic error
  }
}
```
