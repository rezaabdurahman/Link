# Chat Service Client: Architecture & Interactions

## 🎯 **What is the Chat Service Client?**

The Chat Service Client (`internal/client/chat/`) is a **resilient HTTP client** that enables the AI Service to communicate with the separate Chat Service microservice. It's responsible for fetching conversation messages that need to be summarized by AI.

## 🏗️ **Architecture Overview**

```
AI Service (ai-svc)
├── Handler (summarize)
    └── Chat Service Client ──HTTP──► Chat Service (chat-svc)
        ├── Retry Logic
        ├── Circuit Breaker
        ├── JWT Authentication
        └── Request/Response Models
```

## 🔧 **Core Components**

### 1. **Client Structure** (`client.go`)
```go
type Client struct {
    baseURL        string           // Chat service base URL
    httpClient     *http.Client     // HTTP client with timeout
    retryer        *Retryer        // Retry mechanism
    circuitBreaker *CircuitBreaker // Fault tolerance
    logger         zerolog.Logger   // Structured logging
    jwtToken       string          // JWT authentication
}
```

### 2. **Service Interface** (`interface.go`)
```go
type Service interface {
    GetRecentMessages(ctx, conversationID, limit) (*GetMessagesResponse, error)
    UpdateJWTToken(token string)
    Health(ctx) error
    GetCircuitBreakerState() CircuitBreakerState
    ResetCircuitBreaker()
}
```

### 3. **Data Models** (`models.go`)
```go
type ChatMessage struct {
    ID             uuid.UUID
    ConversationID uuid.UUID
    UserID         uuid.UUID
    Content        string
    MessageType    string    // user, assistant, system
    Metadata       *Metadata
    CreatedAt      time.Time
    // ... other fields
}

type GetMessagesResponse struct {
    Messages   []ChatMessage
    TotalCount int64
    HasMore    bool
    NextCursor *string
}
```

## 🔄 **Request Flow & Interactions**

### **Complete Interaction Chain:**
```
1. Summarize Handler Request
   ↓
2. Chat Service Client.GetRecentMessages()
   ↓
3. Resilience Patterns Applied
   ├── Circuit Breaker Check
   ├── Retry with Backoff
   └── JWT Authentication
   ↓
4. HTTP Request to Chat Service
   GET /api/v1/chat/conversations/{id}/messages?limit={n}
   ↓
5. Chat Service Response
   ↓
6. Message Processing & Anonymization
   ↓
7. AI Service Summarization
```

### **Detailed Step-by-Step Flow:**

#### **Step 1: Handler Invocation**
```go
// In summarize_handler.go
messages, err := h.fetchMessages(ctx, conversationID, limit)
```

#### **Step 2: Client Method Call**
```go
// Internal call to chat client
response, err := chatService.GetRecentMessages(ctx, conversationID, limit)
```

#### **Step 3: Resilience Patterns**
```go
// Circuit breaker + retry logic
if c.circuitBreaker != nil {
    err = c.circuitBreaker.Execute(ctx, func() error {
        return c.retryer.Execute(ctx, executeFunc)
    })
}
```

#### **Step 4: HTTP Request Construction**
```go
// Build URL: /api/v1/chat/conversations/{id}/messages?limit={n}
url := fmt.Sprintf("%s/api/v1/chat/conversations/%s/messages", 
    c.baseURL, conversationID.String())

// Add JWT authentication
req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.jwtToken))
```

## 🛡️ **Resilience Patterns**

### 1. **Circuit Breaker Pattern** (`circuit_breaker.go`)

**Purpose**: Prevent cascading failures by "opening" when chat service is unhealthy

```go
// Three States:
- CLOSED:    Normal operation, requests pass through
- OPEN:      Service unhealthy, requests fail fast
- HALF_OPEN: Testing if service recovered
```

**Configuration:**
```go
CircuitBreakerConfig{
    MaxFailures:   5,              // Failures before opening
    Timeout:       30*time.Second, // Time before retry
    OnStateChange: logStateChange, // Callback for monitoring
}
```

**State Transitions:**
```
CLOSED ──(5 failures)──► OPEN ──(30s timeout)──► HALF_OPEN ──(1 success)──► CLOSED
   ▲                                                │
   └──────────────────(1 failure)──────────────────┘
```

### 2. **Retry with Exponential Backoff** (`retry.go`)

**Purpose**: Automatically retry failed requests with increasing delays

```go
RetryConfig{
    MaxRetries:        3,           // Maximum retry attempts
    InitialDelay:      100ms,       // First retry delay
    BackoffMultiplier: 2.0,         // Exponential factor
    Jitter:           true,         // Add randomness
}
```

**Retry Delays:**
```
Attempt 1: 100ms  (+ jitter)
Attempt 2: 200ms  (+ jitter)  
Attempt 3: 400ms  (+ jitter)
```

### 3. **JWT Authentication**

**Purpose**: Secure communication with chat service

```go
// Token management
client.UpdateJWTToken(newToken)

// Automatic header injection
req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.jwtToken))
```

## 🔗 **Component Interactions**

### **1. With Summarize Handler**
```go
// Handler uses client to fetch messages
type SummarizeHandler struct {
    chatService service.ChatService  // Interface to chat client
    // ... other services
}

// Usage in handler
messages, err := h.chatService.GetRecentMessages(ctx, conversationID, limit)
```

### **2. With Privacy Service**
```go
// After fetching messages, they're anonymized
messages, err := h.fetchMessages(ctx, conversationID, limit)
if err != nil {
    return err
}

// Anonymize PII before sending to AI
anonymizedMessages := h.privacyService.AnonymizeMessages(messages)
```

### **3. With AI Service**
```go
// Anonymized messages sent to AI for summarization
summary, err := h.aiService.SummarizeMessages(ctx, ai.SummarizeRequest{
    Messages: anonymizedMessages,
    Model:    "gpt-4",
    // ... other params
})
```

### **4. With Cache Service**
```go
// Results cached for future requests
cacheKey := h.buildCacheKey(conversationID, userID, limit)
err = h.cacheService.SetSummary(ctx, cacheKey, summary, ttl)
```

## 📊 **Configuration & Environment**

### **Environment Variables:**
```yaml
# Chat Service Connection
CHAT_SERVICE_URL=http://localhost:8080
CHAT_SERVICE_TIMEOUT=10s

# Retry Configuration  
CHAT_SERVICE_MAX_RETRIES=3
CHAT_SERVICE_RETRY_DELAY=100ms
CHAT_SERVICE_RETRY_BACKOFF=2.0

# Circuit Breaker
CHAT_SERVICE_CIRCUIT_BREAKER_ENABLED=true
CHAT_SERVICE_CIRCUIT_BREAKER_TIMEOUT=30s
CHAT_SERVICE_CIRCUIT_BREAKER_MAX_FAILS=5
```

### **Factory Pattern:**
```go
// Clean instantiation
chatService := chat.NewChatService(config.ChatService, logger, jwtToken)
```

## 🚨 **Error Handling & Monitoring**

### **Error Categories:**
```go
// 1. Network Errors (retriable)
- Connection timeouts
- DNS resolution failures  
- Temporary network issues

// 2. HTTP Errors (selective retry)
- 500, 502, 503, 504: Retriable
- 400, 401, 403, 404: Non-retriable

// 3. Circuit Breaker Errors (non-retriable)
- ErrCircuitBreakerOpen

// 4. Context Errors (non-retriable)
- context.Canceled
- context.DeadlineExceeded
```

### **Logging & Monitoring:**
```go
// Structured logging with zerolog
c.logger.Info().
    Str("conversation_id", conversationID.String()).
    Int("limit", limit).
    Int("messages_count", len(response.Messages)).
    Msg("Successfully retrieved recent messages")

// Circuit breaker state changes
OnStateChange: func(from, to CircuitBreakerState) {
    logger.Info().
        Str("from", from.String()).
        Str("to", to.String()).
        Msg("Circuit breaker state changed")
}
```

## 🎯 **Key Benefits**

### **1. Fault Tolerance**
- **Circuit Breaker**: Prevents cascade failures
- **Retry Logic**: Handles transient failures
- **Timeouts**: Prevents hanging requests

### **2. Security**
- **JWT Authentication**: Secure service-to-service communication
- **Request Validation**: Proper input sanitization

### **3. Observability**
- **Structured Logging**: Detailed request/response logging
- **Health Checks**: Service availability monitoring
- **Metrics**: Circuit breaker states, retry attempts

### **4. Maintainability**
- **Interface-Based**: Easy mocking for tests
- **Factory Pattern**: Clean dependency injection
- **Configuration-Driven**: Flexible deployment options

## 🔄 **Data Flow Example**

### **Successful Request:**
```
1. POST /api/v1/ai/summarize
   └── conversationID: "abc-123", limit: 15

2. Chat Client → Circuit Breaker (CLOSED) → Allow
   
3. HTTP GET /api/v1/chat/conversations/abc-123/messages?limit=15
   └── Authorization: Bearer {jwt_token}

4. Chat Service Response:
   {
     "messages": [
       {"content": "Hello world", "message_type": "user"},
       {"content": "Hi there!", "message_type": "assistant"}
     ],
     "total_count": 2
   }

5. Privacy Anonymization:
   "Hello world" → "Hello world" (no PII)
   
6. AI Service Summarization:
   → "User greeted assistant, assistant responded friendly"

7. Cache Storage + Response
```

### **Failure Scenario:**
```
1. Chat Service Down → HTTP Error 503

2. Circuit Breaker (CLOSED) → Record Failure (1/5)

3. Retry #1 → HTTP Error 503 → Record Failure (2/5)

4. Retry #2 → HTTP Error 503 → Record Failure (3/5)  

5. Retry #3 → HTTP Error 503 → Record Failure (4/5)

6. Final Retry → HTTP Error 503 → Record Failure (5/5)
   └── Circuit Breaker Opens

7. Return Error to Handler → 500 Internal Server Error
```

## 🧪 **Testing Strategy**

### **Unit Tests:** (`client_test.go`)
- Mock HTTP server responses
- Test retry logic with different error types
- Circuit breaker state transitions
- JWT token management

### **Integration Tests:**
- Real chat service integration
- End-to-end message fetching
- Error handling scenarios
- Performance benchmarks

The Chat Service Client is a **production-ready, enterprise-grade** HTTP client that ensures reliable communication between microservices with comprehensive fault tolerance, security, and observability features!
