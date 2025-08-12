# Chat Service API - HTTP & WebSocket Handlers

This document describes the newly implemented HTTP and WebSocket handlers for the chat service, following the OpenAPI specification.

## Overview

The chat service now provides:
- **REST API endpoints** for conversation and message management
- **WebSocket connections** for real-time chat with JWT authentication
- **OpenAPI-compliant** request/response models
- **JWT middleware** for secure API access

## REST API Endpoints

### Conversations

#### GET /api/v1/chat/conversations
Get user's conversations with pagination.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional): Number of conversations per page (default: 20, max: 100)
- `offset` (optional): Number to skip (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Group Chat",
      "description": "A group conversation",
      "type": "group",
      "is_private": false,
      "max_members": 100,
      "created_by": "uuid",
      "participants": [],
      "unread_count": 5,
      "last_message": {
        "id": "uuid",
        "content": "Hello world",
        "message_type": "text",
        "created_at": "2023-01-01T00:00:00Z"
      },
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z"
    }
  ],
  "total": 10,
  "limit": 20,
  "offset": 0,
  "has_more": false
}
```

#### POST /api/v1/chat/conversations
Create a new conversation.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "type": "group",
  "name": "My Group Chat",
  "description": "A place to chat",
  "is_private": false,
  "max_members": 50,
  "participant_ids": ["uuid1", "uuid2"]
}
```

For direct conversations:
```json
{
  "type": "direct",
  "participant_ids": ["uuid1"]
}
```

#### GET /api/v1/chat/conversations/{id}/messages
Get messages from a conversation.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional): Messages per page (default: 50, max: 100)
- `offset` (optional): Number to skip (default: 0)
- `before` (optional): ISO 8601 timestamp for pagination

### Messages

#### POST /api/v1/chat/messages
Send a message to a conversation.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "conversation_id": "uuid",
  "content": "Hello, world!",
  "message_type": "text",
  "parent_id": null
}
```

## WebSocket API

### Connection

Connect to: `ws://localhost:8080/ws/chat/{conversation_id}?token={jwt_token}`

**Required:**
- WebSocket subprotocol: `jwt`
- Query parameter `token`: Valid JWT token
- User must be a member of the conversation

### WebSocket Message Types

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

#### Heartbeat
```json
{
  "type": "heartbeat"
}
```

### WebSocket Events (Server → Client)

#### New Message
```json
{
  "type": "message",
  "room_id": "uuid",
  "user_id": "uuid", 
  "message": {
    "id": "uuid",
    "content": "Hello!",
    "message_type": "text",
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

#### User Joined/Left
```json
{
  "type": "user_joined",
  "room_id": "uuid",
  "user_id": "uuid"
}
```

#### Typing Events
```json
{
  "type": "typing",
  "room_id": "uuid", 
  "user_id": "uuid"
}
```

## Authentication

All endpoints require JWT authentication:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

JWT must contain:
- `user_id`: UUID of the authenticated user
- `email`: User's email address

For WebSocket connections:
- Include JWT as `token` query parameter
- Use `jwt` WebSocket subprotocol

## Example Usage

### Create a Group Chat
```bash
curl -X POST http://localhost:8080/api/v1/chat/conversations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "group",
    "name": "Team Chat", 
    "description": "Our team discussion",
    "participant_ids": ["user1-uuid", "user2-uuid"]
  }'
```

### Send a Message
```bash
curl -X POST http://localhost:8080/api/v1/chat/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv-uuid",
    "content": "Hello everyone!",
    "message_type": "text"
  }'
```

### WebSocket Connection (JavaScript)
```javascript
const ws = new WebSocket(
  `ws://localhost:8080/ws/chat/${conversationId}?token=${jwtToken}`,
  ['jwt']
);

ws.onopen = () => {
  // Send a message
  ws.send(JSON.stringify({
    type: 'message',
    message: {
      content: 'Hello from WebSocket!',
      message_type: 'text'
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## OpenAPI Specification

The full OpenAPI 3.0 specification is available at `api/openapi.yaml`. Generated Go structs are in `internal/api/types.go`.

To regenerate types:
```bash
oapi-codegen -generate types -package api -o internal/api/types.go api/openapi.yaml
```

## Key Features

1. **JWT Authentication**: All REST endpoints and WebSocket connections require valid JWT tokens
2. **OpenAPI Compliance**: Request/response models follow OpenAPI specification 
3. **Real-time Communication**: WebSocket connections with JWT subprotocol support
4. **Conversation Management**: Support for both direct and group conversations
5. **Message Broadcasting**: Real-time message distribution to connected clients
6. **Presence & Typing**: User presence and typing indicator support
7. **Thread-Safe**: WebSocket connection management with proper concurrency handling
8. **Error Handling**: Comprehensive error responses with appropriate HTTP status codes

## Environment Configuration

Required environment variables:
- `JWT_SECRET`: Secret key for JWT token validation
- `DB_HOST`, `DB_PORT`, `DB_NAME`, etc.: Database configuration
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration for real-time features

See `.env.example` for full configuration options.
