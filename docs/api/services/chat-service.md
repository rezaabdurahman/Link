# Chat Service API Documentation

## Overview

The Chat Service provides real-time messaging capabilities for the Link platform, supporting both direct and group conversations. It offers REST API endpoints for conversation and message management, plus WebSocket connections for real-time chat functionality.

**Service Details:**
- **Base URL**: `http://localhost:8082/api/v1` (development)
- **Gateway Route**: `/chat/*` → `chat-svc/api/v1/*`
- **WebSocket URL**: `ws://localhost:8082/ws/chat/{conversationId}`
- **Authentication**: JWT Bearer tokens required for all endpoints
- **Database**: PostgreSQL + Redis for real-time features

## OpenAPI Specification

Full OpenAPI 3.0 specification available at: `backend/chat-svc/api/openapi.yaml`

## REST API Endpoints

### Conversation Management

#### Get User's Conversations
```http
GET /api/v1/chat/conversations
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `limit` (optional): Number of conversations per page (default: 20, max: 100)
- `offset` (optional): Number to skip for pagination (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "conv-uuid",
      "name": "Team Discussion",
      "description": "Daily team chat",
      "type": "group",
      "is_private": false,
      "max_members": 100,
      "created_by": "user-uuid",
      "participants": [
        {
          "user_id": "user-uuid-1",
          "role": "admin",
          "joined_at": "2024-01-01T10:00:00Z"
        },
        {
          "user_id": "user-uuid-2", 
          "role": "member",
          "joined_at": "2024-01-01T10:15:00Z"
        }
      ],
      "unread_count": 3,
      "last_message": {
        "id": "msg-uuid",
        "content": "Great meeting today!",
        "message_type": "text",
        "sender_id": "user-uuid-1",
        "created_at": "2024-01-01T16:30:00Z"
      },
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-01T16:30:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0,
  "has_more": false
}
```

#### Create New Conversation
```http
POST /api/v1/chat/conversations
Authorization: Bearer {jwt-token}
```

**Request Body (Group Conversation):**
```json
{
  "type": "group",
  "name": "Project Team",
  "description": "Project coordination chat",
  "is_private": false,
  "max_members": 50,
  "participant_ids": ["user-uuid-1", "user-uuid-2", "user-uuid-3"]
}
```

**Request Body (Direct Conversation):**
```json
{
  "type": "direct",
  "participant_ids": ["user-uuid-1"]
}
```

**Response (201):**
```json
{
  "id": "conv-uuid",
  "name": "Project Team",
  "description": "Project coordination chat",
  "type": "group",
  "is_private": false,
  "max_members": 50,
  "created_by": "current-user-uuid",
  "participants": [
    {
      "user_id": "current-user-uuid",
      "role": "admin",
      "joined_at": "2024-01-01T15:00:00Z"
    },
    {
      "user_id": "user-uuid-1",
      "role": "member",
      "joined_at": "2024-01-01T15:00:00Z"
    }
  ],
  "created_at": "2024-01-01T15:00:00Z",
  "updated_at": "2024-01-01T15:00:00Z"
}
```

#### Get Conversation Messages
```http
GET /api/v1/chat/conversations/{conversationId}/messages
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `limit` (optional): Messages per page (default: 50, max: 100)
- `offset` (optional): Number to skip for pagination (default: 0)
- `before` (optional): ISO 8601 timestamp for pagination (get messages before this time)

**Response (200):**
```json
{
  "data": [
    {
      "id": "msg-uuid-1",
      "conversation_id": "conv-uuid",
      "sender_id": "user-uuid-1",
      "content": "Hello everyone!",
      "message_type": "text",
      "parent_id": null,
      "created_at": "2024-01-01T15:30:00Z",
      "updated_at": "2024-01-01T15:30:00Z",
      "sender": {
        "id": "user-uuid-1",
        "name": "Alice Johnson",
        "username": "alice",
        "profile_picture": "https://example.com/avatar1.jpg"
      }
    },
    {
      "id": "msg-uuid-2",
      "conversation_id": "conv-uuid",
      "sender_id": "user-uuid-2",
      "content": "Hey Alice! How's the project going?",
      "message_type": "text",
      "parent_id": "msg-uuid-1",
      "created_at": "2024-01-01T15:32:00Z",
      "updated_at": "2024-01-01T15:32:00Z",
      "sender": {
        "id": "user-uuid-2",
        "name": "Bob Smith",
        "username": "bob",
        "profile_picture": "https://example.com/avatar2.jpg"
      }
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0,
  "has_more": false,
  "conversation": {
    "id": "conv-uuid",
    "name": "Project Team",
    "type": "group"
  }
}
```

### Message Management

#### Send Message
```http
POST /api/v1/chat/messages
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv-uuid",
  "content": "This is a new message",
  "message_type": "text",
  "parent_id": "msg-uuid-parent"
}
```

**Message Types:**
- `text`: Regular text message
- `image`: Image message with URL
- `file`: File attachment with URL
- `system`: System-generated message

**Response (201):**
```json
{
  "id": "msg-uuid",
  "conversation_id": "conv-uuid",
  "sender_id": "current-user-uuid",
  "content": "This is a new message",
  "message_type": "text",
  "parent_id": "msg-uuid-parent",
  "created_at": "2024-01-01T16:00:00Z",
  "updated_at": "2024-01-01T16:00:00Z",
  "sender": {
    "id": "current-user-uuid",
    "name": "Current User",
    "username": "currentuser",
    "profile_picture": "https://example.com/avatar.jpg"
  }
}
```

#### Update Message
```http
PUT /api/v1/chat/messages/{messageId}
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "content": "Updated message content"
}
```

**Response (200):**
```json
{
  "id": "msg-uuid",
  "conversation_id": "conv-uuid",
  "sender_id": "current-user-uuid",
  "content": "Updated message content",
  "message_type": "text",
  "parent_id": null,
  "created_at": "2024-01-01T16:00:00Z",
  "updated_at": "2024-01-01T16:05:00Z",
  "is_edited": true
}
```

#### Delete Message
```http
DELETE /api/v1/chat/messages/{messageId}
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Message deleted successfully"
}
```

### Conversation Participants

#### Add Participants
```http
POST /api/v1/chat/conversations/{conversationId}/participants
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "user_ids": ["user-uuid-3", "user-uuid-4"]
}
```

**Response (200):**
```json
{
  "added": [
    {
      "user_id": "user-uuid-3",
      "role": "member",
      "joined_at": "2024-01-01T17:00:00Z"
    },
    {
      "user_id": "user-uuid-4",
      "role": "member", 
      "joined_at": "2024-01-01T17:00:00Z"
    }
  ],
  "message": "Participants added successfully"
}
```

#### Remove Participant
```http
DELETE /api/v1/chat/conversations/{conversationId}/participants/{userId}
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Participant removed successfully"
}
```

#### Leave Conversation
```http
POST /api/v1/chat/conversations/{conversationId}/leave
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "Left conversation successfully"
}
```

## WebSocket API

### Connection Setup

Connect to the WebSocket endpoint with JWT authentication:

```javascript
const ws = new WebSocket(
  `ws://localhost:8082/ws/chat/${conversationId}?token=${jwtToken}`,
  ['jwt']
);
```

**Connection Requirements:**
- **URL**: `ws://localhost:8082/ws/chat/{conversationId}?token={jwt-token}`
- **Subprotocol**: `jwt` 
- **Query Parameter**: `token` with valid JWT
- **Permission**: User must be a member of the conversation

### Client → Server Messages

#### Send Message
```json
{
  "type": "message",
  "message": {
    "content": "Hello from WebSocket!",
    "message_type": "text",
    "parent_id": null
  }
}
```

#### Typing Indicators
```json
{
  "type": "typing"
}
```

```json
{
  "type": "stop_typing"
}
```

#### Heartbeat (Keep-Alive)
```json
{
  "type": "heartbeat"
}
```

#### Read Receipt
```json
{
  "type": "read_receipt",
  "message_id": "msg-uuid"
}
```

### Server → Client Events

#### New Message
```json
{
  "type": "message",
  "room_id": "conv-uuid",
  "user_id": "sender-uuid",
  "message": {
    "id": "msg-uuid",
    "content": "Hello everyone!",
    "message_type": "text",
    "parent_id": null,
    "created_at": "2024-01-01T16:00:00Z",
    "sender": {
      "id": "sender-uuid",
      "name": "Alice Johnson",
      "username": "alice",
      "profile_picture": "https://example.com/avatar.jpg"
    }
  }
}
```

#### User Joined Conversation
```json
{
  "type": "user_joined",
  "room_id": "conv-uuid",
  "user_id": "new-user-uuid",
  "user": {
    "id": "new-user-uuid",
    "name": "New User",
    "username": "newuser",
    "profile_picture": "https://example.com/avatar.jpg"
  }
}
```

#### User Left Conversation
```json
{
  "type": "user_left",
  "room_id": "conv-uuid", 
  "user_id": "leaving-user-uuid"
}
```

#### Typing Indicator
```json
{
  "type": "typing",
  "room_id": "conv-uuid",
  "user_id": "typing-user-uuid",
  "user": {
    "name": "Alice Johnson",
    "username": "alice"
  }
}
```

```json
{
  "type": "stop_typing",
  "room_id": "conv-uuid",
  "user_id": "typing-user-uuid"
}
```

#### Connection Acknowledgment
```json
{
  "type": "connected",
  "room_id": "conv-uuid",
  "user_id": "your-user-uuid",
  "message": "Connected to conversation"
}
```

#### Error Events
```json
{
  "type": "error",
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

## File and Media Handling

### Upload Media for Chat
```http
POST /api/v1/chat/upload
Authorization: Bearer {jwt-token}
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Media file (image, document, etc.)
- `conversation_id`: Target conversation ID

**Response (200):**
```json
{
  "url": "https://example.com/uploads/chat/uuid-filename.jpg",
  "file_type": "image",
  "file_size": 1024576,
  "filename": "original-filename.jpg",
  "message": "File uploaded successfully"
}
```

### Send Media Message
```http
POST /api/v1/chat/messages
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv-uuid",
  "content": "https://example.com/uploads/chat/uuid-image.jpg",
  "message_type": "image",
  "metadata": {
    "filename": "photo.jpg",
    "file_size": 1024576,
    "dimensions": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

## Search and Filtering

### Search Messages
```http
GET /api/v1/chat/conversations/{conversationId}/search
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `q`: Search query string
- `limit`: Results per page (default: 20, max: 100)
- `offset`: Pagination offset
- `message_type`: Filter by message type
- `from_date`: ISO 8601 start date
- `to_date`: ISO 8601 end date

**Response (200):**
```json
{
  "results": [
    {
      "id": "msg-uuid",
      "conversation_id": "conv-uuid",
      "content": "This message contains the search term",
      "message_type": "text",
      "sender_id": "user-uuid",
      "created_at": "2024-01-01T15:30:00Z",
      "sender": {
        "name": "Alice Johnson",
        "username": "alice"
      },
      "highlights": ["search term"]
    }
  ],
  "total": 15,
  "query": "search term",
  "limit": 20,
  "offset": 0
}
```

### Filter Conversations
```http
GET /api/v1/chat/conversations
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `type`: Filter by conversation type (`direct`, `group`)
- `has_unread`: Boolean, only conversations with unread messages
- `participant_id`: Filter conversations containing specific user
- `search`: Search conversation names and descriptions

## Real-Time Features

### Presence Management

The WebSocket connection automatically manages user presence:

- **Online**: User has active WebSocket connection
- **Typing**: User is actively typing (auto-expires after 3 seconds)
- **Away**: Connection idle for >5 minutes
- **Offline**: No active connection

### Message Status

Messages have the following status indicators:
- **Sent**: Message delivered to server
- **Delivered**: Message delivered to all online participants
- **Read**: Message marked as read by recipient(s)

### Push Notifications

When users are offline, the service triggers push notifications for:
- New messages in conversations
- New conversation invitations
- Mentions in group conversations

## Health and Monitoring

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "service": "chat-svc",
  "timestamp": "2024-01-01T16:00:00Z",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy",
    "websocket": "healthy"
  }
}
```

### WebSocket Stats
```http
GET /api/v1/chat/stats/websockets
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "active_connections": 145,
  "active_rooms": 23,
  "messages_per_minute": 87,
  "avg_room_size": 6.3,
  "uptime_seconds": 86400
}
```

### Metrics Endpoint
```http
GET /metrics
```

Prometheus metrics including:
- `chat_active_websocket_connections`
- `chat_messages_sent_total`
- `chat_conversations_created_total`
- `chat_websocket_duration_seconds`

## Error Handling

### WebSocket Errors

WebSocket connections handle errors gracefully:

```json
{
  "type": "error",
  "error": "CONVERSATION_NOT_FOUND",
  "message": "Conversation does not exist or user lacks access",
  "code": 404
}
```

### Common Error Codes:
- `UNAUTHORIZED`: Invalid or expired JWT token
- `FORBIDDEN`: User not authorized for conversation
- `CONVERSATION_NOT_FOUND`: Conversation doesn't exist
- `MESSAGE_TOO_LONG`: Message exceeds length limit
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `CONNECTION_LIMIT_EXCEEDED`: Too many connections per user

### REST API Errors

Standard HTTP error responses:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid conversation type",
  "details": {
    "field": "type",
    "value": "invalid_type",
    "expected": ["direct", "group"]
  },
  "timestamp": "2024-01-01T16:00:00Z"
}
```

## Rate Limits

- **REST API**: 500 requests/minute per user
- **WebSocket Messages**: 60 messages/minute per user per conversation
- **File Uploads**: 10 uploads/minute per user
- **Conversation Creation**: 5 conversations/hour per user

Rate limit headers:
```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 387
X-RateLimit-Reset: 1640995200
X-RateLimit-Type: user
```

## Security Features

- **JWT Authentication**: Required for all endpoints and WebSocket connections
- **Authorization**: Users can only access conversations they're members of
- **Input Validation**: Message content sanitization and validation
- **Rate Limiting**: Per-user and per-conversation rate limits
- **File Security**: Virus scanning and file type restrictions for uploads
- **Content Moderation**: Optional content filtering and moderation
- **Encryption**: Messages encrypted in transit and at rest

## Example Usage

### JavaScript WebSocket Client
```javascript
class ChatClient {
  constructor(conversationId, token) {
    this.conversationId = conversationId;
    this.token = token;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(
      `ws://localhost:8082/ws/chat/${this.conversationId}?token=${this.token}`,
      ['jwt']
    );

    this.ws.onopen = () => {
      console.log('Connected to chat');
      this.sendHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from chat');
      // Implement reconnection logic
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  sendMessage(content) {
    const message = {
      type: 'message',
      message: {
        content: content,
        message_type: 'text'
      }
    };
    this.ws.send(JSON.stringify(message));
  }

  sendTyping() {
    this.ws.send(JSON.stringify({ type: 'typing' }));
  }

  sendStopTyping() {
    this.ws.send(JSON.stringify({ type: 'stop_typing' }));
  }

  sendHeartbeat() {
    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Every 30 seconds
  }

  handleMessage(data) {
    switch (data.type) {
      case 'message':
        this.displayMessage(data);
        break;
      case 'typing':
        this.showTypingIndicator(data.user_id);
        break;
      case 'stop_typing':
        this.hideTypingIndicator(data.user_id);
        break;
      case 'user_joined':
        this.showUserJoined(data.user);
        break;
      case 'user_left':
        this.showUserLeft(data.user_id);
        break;
      case 'error':
        this.handleError(data);
        break;
    }
  }
}

// Usage
const chat = new ChatClient('conv-uuid', 'jwt-token');
chat.connect();
```

### REST API Usage Examples

```bash
# Create a group conversation
curl -X POST http://localhost:8082/api/v1/chat/conversations \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "group",
    "name": "Project Discussion",
    "participant_ids": ["user-1", "user-2", "user-3"]
  }'

# Send a message
curl -X POST http://localhost:8082/api/v1/chat/messages \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv-uuid",
    "content": "Hello team!",
    "message_type": "text"
  }'

# Get conversation messages
curl -X GET "http://localhost:8082/api/v1/chat/conversations/conv-uuid/messages?limit=20" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Service Integration

The Chat Service integrates with:
- **User Service**: Profile data for message senders
- **Discovery Service**: Location-based chat features
- **AI Service**: Message summarization and insights
- **Feature Service**: A/B testing for chat features
- **API Gateway**: Authentication and rate limiting

All service-to-service communication uses mTLS via Linkerd service mesh.