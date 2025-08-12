# Chat Service

A real-time chat service built with Go, providing WebSocket-based messaging capabilities for the Link-chat application.

## Features

- 🚀 Real-time messaging with WebSocket support
- 🔐 JWT-based authentication
- 📦 Containerized with Docker
- 🗄️ PostgreSQL database integration
- 🔄 Redis for WebSocket scaling and caching
- 📊 Health checks and monitoring
- 🛡️ Security best practices
- 📝 Comprehensive logging
- 🎯 Rate limiting
- 📋 Database migrations

## Architecture

```
chat-svc/
├── cmd/                    # Application entrypoints
├── internal/              # Private application code
│   ├── config/           # Configuration management
│   ├── db/               # Database connection and queries
│   ├── handler/          # HTTP and WebSocket handlers
│   ├── service/          # Business logic
│   └── model/            # Data models
├── migrations/           # Database migrations
├── docs/                 # API documentation
├── Dockerfile           # Container definition
├── Makefile            # Build and development tasks
├── .env.example        # Environment variables template
└── README.md           # This file
```

## Prerequisites

- Go 1.21 or later
- PostgreSQL 13+
- Redis 6+ (optional, for scaling)
- Docker (optional)

## Quick Start

### 1. Clone and Setup

```bash
# Navigate to the chat-svc directory
cd backend/chat-svc

# Copy environment configuration
make dev-setup
# or manually:
cp .env.example .env
```

### 2. Configure Environment

Edit the `.env` file with your database and other service configurations:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
```

### 3. Install Dependencies

```bash
make deps
```

### 4. Run Database Migrations

```bash
make migrate-up
```

### 5. Start the Service

```bash
# Development mode
make run

# Or with hot reload (requires air)
make dev

# Build and run binary
make build
./bin/chat-svc
```

## Development

### Available Make Targets

```bash
make help                 # Show all available targets
make build               # Build the application
make run                 # Run the application locally
make test                # Run all tests
make test-coverage       # Run tests with coverage report
make clean               # Clean build artifacts
make deps                # Download dependencies
make lint                # Run golangci-lint
make format              # Format Go code
make docker-build        # Build Docker image
make docker-run          # Run Docker container
make migrate-up          # Run database migrations up
make migrate-down        # Run database migrations down
make migrate-create      # Create new migration
make dev-setup           # Set up development environment
make dev                 # Start development server with hot reload
make docs                # Generate API documentation
make security-scan       # Run security scan
```

### Creating Migrations

```bash
make migrate-create name=create_messages_table
```

### Running Tests

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage
```

## Docker Deployment

### Build Docker Image

```bash
make docker-build
```

### Run with Docker

```bash
# Using make (loads .env file)
make docker-run

# Or directly with docker
docker run --rm -p 8080:8080 \
  -e DB_HOST=your_db_host \
  -e DB_USER=your_db_user \
  -e DB_PASSWORD=your_db_password \
  chat-svc:latest
```

### Docker Compose

Add to your docker-compose.yml:

```yaml
services:
  chat-svc:
    build: ./backend/chat-svc
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=chat_db
      - REDIS_HOST=redis
      - JWT_SECRET=your_jwt_secret
    depends_on:
      - postgres
      - redis
```

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check endpoint
- `POST /api/v1/chat/rooms` - Create chat room
- `GET /api/v1/chat/rooms` - List chat rooms
- `GET /api/v1/chat/rooms/:id` - Get room details
- `POST /api/v1/chat/rooms/:id/join` - Join chat room
- `POST /api/v1/chat/rooms/:id/messages` - Send message
- `GET /api/v1/chat/rooms/:id/messages` - Get room messages

### WebSocket Endpoints

- `WS /ws/chat/:room_id` - Connect to chat room

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Server port | `8080` |
| `SERVER_HOST` | Server host | `0.0.0.0` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `chat_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT secret key | - |
| `LOG_LEVEL` | Logging level | `info` |

## Dependencies

### Core Libraries

- **[Chi](https://github.com/go-chi/chi)** - HTTP router and middleware
- **[pgx](https://github.com/jackc/pgx)** / **[pq](https://github.com/lib/pq)** - PostgreSQL drivers
- **[JWT-Go](https://github.com/golang-jwt/jwt)** - JSON Web Token implementation
- **[Gorilla WebSocket](https://github.com/gorilla/websocket)** - WebSocket support
- **[Logrus](https://github.com/sirupsen/logrus)** / **[Zerolog](https://github.com/rs/zerolog)** - Structured logging

### Development Tools

- **[Air](https://github.com/cosmtrek/air)** - Live reload for development
- **[golangci-lint](https://golangci-lint.run/)** - Go linters runner
- **[Swag](https://github.com/swaggo/swag)** - API documentation generator
- **[gosec](https://github.com/securecodewarrior/gosec)** - Security scanner

## Security

- JWT-based authentication
- CORS protection
- Rate limiting
- Input validation and sanitization
- SQL injection prevention with prepared statements
- Secure WebSocket connections
- Non-root Docker user

## Monitoring

- Health check endpoint at `/health`
- Structured logging with configurable levels
- Request/response logging middleware
- Database connection monitoring

## Contributing

1. Follow conventional commit format (`feat:`, `fix:`, `docs:`, etc.)
2. Ensure all tests pass: `make test`
3. Run linting: `make lint`
4. Format code: `make format`
5. Update documentation as needed

## License

This project is part of the Link-chat application.
