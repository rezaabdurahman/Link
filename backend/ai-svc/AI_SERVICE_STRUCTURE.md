# AI Service (ai-svc) Structure Overview

## 🏗️ High-Level Architecture

```
ai-svc/
├── 📁 cmd/                    # Application entry point
├── 📁 internal/               # Internal application code
│   ├── 🧠 ai/                 # AI service implementations
│   ├── 💾 cache/              # Caching layer (Redis/Memory)
│   ├── 🔗 client/             # External service clients
│   ├── ⚙️  config/            # Configuration management
│   ├── 🎯 handler/            # HTTP handlers/controllers
│   ├── 🛡️  middleware/        # HTTP middleware
│   ├── 📊 model/              # Data models/structs
│   ├── 🔒 privacy/            # Privacy & consent management
│   └── 🔧 service/            # Service interfaces
├── 📁 migrations/             # Database migrations
├── 📁 api/                    # OpenAPI specifications
├── 📁 docs/                   # Documentation
├── 📁 scripts/                # Deployment & utility scripts
└── 📁 monitoring/             # Monitoring configurations
```

## 🔧 Core Components

### 1. **Entry Point** (`cmd/main.go`)
- **Purpose**: Bootstrap the application
- **Key Features**:
  - Structured logging with zerolog
  - HTTP server with Chi router
  - Middleware setup (CORS, rate limiting, logging)
  - Graceful shutdown handling
  - Health check endpoints

### 2. **AI Module** (`internal/ai/`)
```
ai/
├── interfaces.go         # AI service interfaces
├── openai.go            # OpenAI implementation
├── factory.go           # Service factory pattern
├── openai_test.go       # Unit tests
└── README.md            # AI module documentation
```

**Key Features**:
- OpenAI GPT integration
- PII anonymization before API calls
- Exponential backoff retry logic
- Response caching with Redis
- Multiple AI model support

### 3. **Cache Layer** (`internal/cache/`)
```
cache/
├── cache.go             # Cache interface
├── redis.go             # Redis implementation
├── memory.go            # In-memory implementation
├── factory.go           # Cache factory
└── cache_test.go        # Unit tests
```

**Key Features**:
- Redis-backed caching with TTL
- Memory fallback for testing
- Summary caching by conversation + message hash
- Cache invalidation strategies

### 4. **External Clients** (`internal/client/chat/`)
```
client/chat/
├── client.go            # Chat service HTTP client
├── models.go            # Chat service models
├── retry.go             # Retry logic with backoff
├── circuit_breaker.go   # Circuit breaker pattern
└── client_test.go       # Unit tests
```

**Key Features**:
- Resilient HTTP client for chat service
- JWT authentication
- Circuit breaker for fault tolerance
- Exponential backoff retries

### 5. **Configuration** (`internal/config/`)
- **Environment Variables**: 40+ configurable parameters
- **Structured Config**: Organized by service (Database, Redis, AI, etc.)
- **Type Safety**: Helper functions for parsing env vars

### 6. **HTTP Handlers** (`internal/handler/`)
```
handler/
├── health_handler.go        # Health check endpoints
├── summarize_handler.go     # AI summarization endpoint
├── consent_handler.go       # Privacy consent endpoints
└── *_test.go               # Handler unit tests
```

**Key Features**:
- RESTful API endpoints
- Request validation
- Structured error responses
- JWT authentication integration

### 7. **Privacy & Compliance** (`internal/privacy/`)
```
privacy/
├── service.go           # Privacy service implementation
├── anonymizer.go        # PII anonymization
├── interfaces.go        # Privacy interfaces
└── *_test.go           # Privacy tests
```

**Key Features**:
- GDPR/CCPA compliance
- User consent management
- PII anonymization (emails, phones, names)
- Audit logging for compliance

### 8. **Middleware** (`internal/middleware/`)
- **JWT Authentication**: Token validation
- **Rate Limiting**: Per-user request limits
- **Request Logging**: Structured request/response logging
- **Panic Recovery**: Graceful error handling

### 9. **Data Models** (`internal/model/`)
- **AI Models**: Requests, responses, conversations
- **Privacy Models**: Consent, audit logs, anonymization
- **API Models**: Request/response payloads
- **Health Models**: Health check responses

## 🔄 Request Flow

### Summarization Endpoint Flow:
```
1. HTTP Request → Middleware (Auth, Rate Limit, Logging)
2. Handler → Privacy Service (Check Consent)
3. Handler → Cache Service (Check for cached summary)
4. Handler → Chat Service (Fetch recent messages)
5. Handler → Privacy Service (Anonymize messages)
6. Handler → AI Service (OpenAI summarization)
7. Handler → Cache Service (Store result)
8. Handler → Response (JSON summary)
```

## 🏗️ Design Patterns Used

### 1. **Factory Pattern**
- AI service factory (`internal/ai/factory.go`)
- Cache factory (`internal/cache/factory.go`)
- Chat client factory (`internal/client/chat/factory.go`)

### 2. **Interface Segregation**
- Separate interfaces for each service type
- Easy mocking for tests
- Clear separation of concerns

### 3. **Repository Pattern**
- Service interfaces abstract data operations
- Database operations are abstracted behind interfaces

### 4. **Circuit Breaker Pattern**
- Chat service client has circuit breaker
- Prevents cascading failures

### 5. **Retry Pattern**
- Exponential backoff for external APIs
- Configurable retry attempts and delays

## 🛡️ Security Features

### 1. **Authentication**
- JWT token validation
- User context extraction from requests

### 2. **Privacy Protection**
- PII anonymization before external API calls
- User consent checking before processing
- Audit logging for compliance

### 3. **Rate Limiting**
- Per-IP and per-user rate limits
- Separate limits for AI operations

### 4. **Input Validation**
- Request payload validation
- SQL injection prevention
- XSS protection through proper encoding

## 🔧 Configuration & Environment

### Environment Variables (40+ configurable):
```yaml
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8081

# Database
DB_HOST=localhost
DB_NAME=ai_db
DB_USER=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
SUMMARY_TTL=1h

# AI Service
AI_PROVIDER=openai
AI_API_KEY=your_key_here
AI_MODEL=gpt-4
AI_MAX_TOKENS=2048

# Privacy
ENABLE_PII_ANONYMIZATION=true
CONSENT_REQUIRED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

## 🚀 Deployment Features

### 1. **Docker Support**
- Multi-stage Dockerfile
- Security-focused (non-root user)
- Health check integration

### 2. **Database Migrations**
- Up/down migration scripts
- AI tables and privacy consent tables

### 3. **Health Checks**
- `/health` - Comprehensive health check
- `/health/readiness` - Kubernetes readiness probe
- `/health/liveness` - Kubernetes liveness probe

### 4. **Monitoring**
- Structured logging with zerolog
- Request/response logging
- Performance metrics collection

## 🧪 Testing Strategy

### 1. **Unit Tests**
- Individual component testing
- Mock implementations for external dependencies
- 60%+ code coverage target

### 2. **Integration Tests**
- End-to-end API testing
- Database integration tests
- External service integration tests

### 3. **Performance Tests**
- Benchmarking for critical paths
- Load testing capabilities

## 📈 Scalability Features

### 1. **Caching**
- Redis-backed summary caching
- Configurable TTL policies
- Cache invalidation strategies

### 2. **Connection Pooling**
- Database connection pooling
- Redis connection pooling

### 3. **Async Processing**
- Non-blocking AI requests where possible
- Timeout handling for external services

This architecture provides a robust, scalable, and compliant AI service that can handle conversation summarization while maintaining security, privacy, and performance standards.
