# Repository Layer Implementation

This package implements a repository layer for the chat service using pgx and PostgreSQL, providing clean CRUD operations with pagination support.

## Features

- **pgx Connection Pool**: Uses pgx/v5 for efficient PostgreSQL connections
- **Context Support**: All operations accept context for cancellation and tracing
- **Pagination**: Built-in pagination support for listing operations
- **Clean Interfaces**: Well-defined repository interfaces for testability
- **Test Coverage**: Comprehensive unit tests using testcontainers-go
- **Message Read Tracking**: Full support for read receipts and unread counts

## Architecture

```
internal/db/
├── db.go                      # Database connection and health checks
├── interfaces.go              # Repository interface definitions
├── conversation_repository.go # Conversation CRUD operations
├── message_repository.go      # Message CRUD operations
├── room_member_repository.go  # Room membership operations
├── repository.go              # Repository factory
├── repository_test.go         # Integration tests with testcontainers
├── interfaces_test.go         # Unit tests with mocks
└── example_usage.go           # Usage examples
```

## Core Interfaces

### ConversationRepository
```go
type ConversationRepository interface {
    ListConversations(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ChatRoom, int, error)
    CreateConversation(ctx context.Context, room *model.ChatRoom) error
    GetConversationByID(ctx context.Context, roomID uuid.UUID) (*model.ChatRoom, error)
    UpdateConversation(ctx context.Context, room *model.ChatRoom) error
    DeleteConversation(ctx context.Context, roomID uuid.UUID) error
    GetConversationsByUserID(ctx context.Context, userID uuid.UUID) ([]*model.ChatRoom, error)
}
```

### MessageRepository
```go
type MessageRepository interface {
    ListMessages(ctx context.Context, convoID, userID uuid.UUID, page, size int) ([]*model.Message, int, error)
    CreateMessage(ctx context.Context, message *model.Message) error
    GetMessageByID(ctx context.Context, messageID uuid.UUID) (*model.Message, error)
    UpdateMessage(ctx context.Context, message *model.Message) error
    DeleteMessage(ctx context.Context, messageID uuid.UUID) error
    MarkMessagesAsRead(ctx context.Context, userID uuid.UUID, messageIDs []uuid.UUID) error
    GetUnreadCount(ctx context.Context, userID, convoID uuid.UUID) (int, error)
}
```

### RoomMemberRepository
```go
type RoomMemberRepository interface {
    AddMember(ctx context.Context, member *model.RoomMember) error
    RemoveMember(ctx context.Context, roomID, userID uuid.UUID) error
    GetRoomMembers(ctx context.Context, roomID uuid.UUID) ([]*model.RoomMember, error)
    IsUserMember(ctx context.Context, roomID, userID uuid.UUID) (bool, error)
    UpdateMemberRole(ctx context.Context, roomID, userID uuid.UUID, role model.MemberRole) error
}
```

## Usage

### Basic Setup
```go
import (
    "context"
    "github.com/link-app/chat-svc/internal/config"
    "github.com/link-app/chat-svc/internal/db"
)

// Initialize database connection
cfg := config.DatabaseConfig{
    Host:            "localhost",
    Port:            "5432",
    Name:            "chat_db",
    User:            "postgres",
    Password:        "postgres",
    SSLMode:         "disable",
    MaxOpenConns:    25,
    MaxIdleConns:    25,
    ConnMaxLifetime: 300 * time.Second,
}

database, err := db.Connect(cfg)
if err != nil {
    log.Fatal(err)
}
defer database.Close()

// Create repository
repo := db.NewRepository(database.Pool)
```

### Pagination Examples

#### List Conversations
```go
ctx := context.Background()
userID := uuid.New()

// Get first page with 10 conversations per page
conversations, total, err := repo.Conversations.ListConversations(ctx, userID, 1, 10)
if err != nil {
    log.Printf("Error: %v", err)
    return
}

fmt.Printf("Showing %d of %d total conversations\n", len(conversations), total)
```

#### List Messages
```go
ctx := context.Background()
roomID := uuid.New()
userID := uuid.New()

// Get first page with 20 messages per page
messages, total, err := repo.Messages.ListMessages(ctx, roomID, userID, 1, 20)
if err != nil {
    log.Printf("Error: %v", err)
    return
}

fmt.Printf("Showing %d of %d total messages\n", len(messages), total)
```

### Message Read Tracking

#### Mark Messages as Read
```go
ctx := context.Background()
userID := uuid.New()
messageIDs := []uuid.UUID{msg1.ID, msg2.ID, msg3.ID}

err := repo.Messages.MarkMessagesAsRead(ctx, userID, messageIDs)
if err != nil {
    log.Printf("Error marking messages as read: %v", err)
}
```

#### Get Unread Count
```go
ctx := context.Background()
userID := uuid.New()
roomID := uuid.New()

count, err := repo.Messages.GetUnreadCount(ctx, userID, roomID)
if err != nil {
    log.Printf("Error getting unread count: %v", err)
    return
}

fmt.Printf("User has %d unread messages\n", count)
```

## Database Schema

### Required Tables
The repository layer expects the following database tables:

1. **chat_rooms** - Store conversation information
2. **messages** - Store chat messages
3. **room_members** - Track room membership
4. **message_reads** - Track message read status

### Migrations
Apply the following migrations in order:
1. `001_create_chat_tables.up.sql` - Creates core chat tables
2. `002_create_message_reads.up.sql` - Creates message read tracking table

## Testing

### Unit Tests (No Docker Required)
```bash
go test ./internal/db -v -run "Test.*Validation|TestPaginationLogic|TestRepositoryInterfaces"
```

### Integration Tests (Requires Docker)
```bash
go test ./internal/db -v -timeout 10m
```

The integration tests use testcontainers-go to spin up a real PostgreSQL instance for testing.

## Performance Considerations

1. **Connection Pooling**: Uses pgx connection pooling for optimal performance
2. **Pagination**: All list operations support pagination to avoid loading large datasets
3. **Indexes**: Proper database indexes on foreign keys and commonly queried fields
4. **Context Support**: All operations accept context for timeouts and cancellation
5. **Prepared Statements**: pgx automatically prepares and caches statements

## Error Handling

The repository layer uses structured error handling:
- Returns `fmt.Errorf()` with context for debugging
- Checks for `pgx.ErrNoRows` to return appropriate "not found" errors
- Validates row affected counts for update/delete operations
- Uses transactions where appropriate (e.g., marking multiple messages as read)

## Extension Points

The repository interfaces can be easily extended for additional functionality:
- Message attachments and media handling
- Message reactions and emojis
- Room settings and permissions
- Message search and indexing
- Real-time notifications
- Message threading and replies

## Dependencies

- `github.com/jackc/pgx/v5` - PostgreSQL driver and connection pooling
- `github.com/google/uuid` - UUID generation and handling
- `github.com/stretchr/testify` - Testing framework and assertions
- `github.com/testcontainers/testcontainers-go` - Integration testing with real databases
