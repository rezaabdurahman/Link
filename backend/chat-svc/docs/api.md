# Chat Service API Documentation

## Overview

The Chat Service provides real-time messaging capabilities through both REST API and WebSocket connections.

## Base URL

```
http://localhost:8080
```

## Authentication

All endpoints (except health check) require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Health Check

### GET /health

Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "chat-svc"
}
```

## Chat Rooms

### POST /api/v1/chat/rooms

Create a new chat room.

**Request Body:**
```json
{
  "name": "General Discussion",
  "description": "A place for general chat",
  "is_private": false,
  "max_members": 100
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "General Discussion",
  "description": "A place for general chat",
  "created_by": "uuid",
  "is_private": false,
  "max_members": 100,
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

### GET /api/v1/chat/rooms

Get user's chat rooms with pagination.

**Query Parameters:**
- `limit` (optional): Number of rooms per page (default: 20, max: 100)
- `offset` (optional): Number of rooms to skip (default: 0)

**Response:**
```json
{
  "data": [...],
  "total": 10,
  "limit": 20,
  "offset": 0,
  "has_more": false
}
```

### GET /api/v1/chat/rooms/{room_id}

Get details of a specific chat room.

**Response:**
```json
{
  "id": "uuid",
  "name": "General Discussion",
  "description": "A place for general chat",
  "created_by": "uuid",
  "is_private": false,
  "max_members": 100,
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

### POST /api/v1/chat/rooms/{room_id}/join

Join a chat room.

**Response:**
```json
{
  "message": "Successfully joined room"
}
```

## Messages

### POST /api/v1/chat/rooms/{room_id}/messages

Send a message to a chat room.

**Request Body:**
```json
{
  "content": "Hello, world!",
  "message_type": "text",
  "parent_id": null
}
```

**Response:**
```json
{
  "id": "uuid",
  "room_id": "uuid",
  "user_id": "uuid",
  "content": "Hello, world!",
  "message_type": "text",
  "parent_id": null,
  "edited_at": null,
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

### GET /api/v1/chat/rooms/{room_id}/messages

Get messages from a chat room with pagination.

**Query Parameters:**
- `limit` (optional): Number of messages per page (default: 50, max: 100)
- `offset` (optional): Number of messages to skip (default: 0)
- `before` (optional): Get messages before this timestamp (ISO 8601 format)

**Response:**
```json
{
  "data": [...],
  "total": 100,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

## WebSocket API

### Connection

Connect to a chat room via WebSocket:

```
ws://localhost:8080/ws/chat/{room_id}
```

### Message Types

#### Send Message
```json
{
  "type": "message",
  "room_id": "uuid",
  "user_id": "uuid",
  "message": {
    "content": "Hello, world!",
    "message_type": "text",
    "parent_id": null
  }
}
```

#### Heartbeat
```json
{
  "type": "heartbeat",
  "room_id": "uuid",
  "user_id": "uuid"
}
```

#### Typing Indicators
```json
{
  "type": "typing",
  "room_id": "uuid",
  "user_id": "uuid"
}
```

```json
{
  "type": "stop_typing",
  "room_id": "uuid",
  "user_id": "uuid"
}
```

#### Error Messages
```json
{
  "type": "error",
  "error": "Error message"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": 400,
  "details": {
    "field": "Additional error details"
  }
}
```

## HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `500 Internal Server Error` - Server error

## Rate Limiting

API requests are rate-limited to 100 requests per minute per user. When exceeded, the API returns a `429 Too Many Requests` status code.
