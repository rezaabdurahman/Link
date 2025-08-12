# Link - Social Discovery App

A modern social discovery app with location-based features, built with React frontend and Go microservices backend.

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for backend services)
- **Node.js 18+** (for frontend development)
- **Go 1.21+** (for backend development)

### 1. Start Backend Services

```bash
cd backend
docker-compose up -d
```

This will start:
- **API Gateway** on port 8080 (main entry point)
- **User Service** on port 8081 (direct access for debugging)
- **PostgreSQL** on port 5432
- **Redis** on port 6379

### 2. Start Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 🏗️ Architecture Overview

### Backend Services

The backend follows a microservices architecture with:

- **API Gateway** - Central entry point, handles JWT authentication, routes requests
- **User Service** - User management, authentication, friend system
- **Location Service** - Location tracking and proximity features (planned)
- **Chat Service** - Real-time messaging with WebSocket support ✅
- **Discovery Service** - Broadcasts and user discovery (planned)

### Frontend

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Hook Form** with Zod validation
- **JWT-based authentication** with secure token storage

## 🔐 Authentication Flow

1. **Registration/Login** → Frontend sends credentials to API Gateway
2. **API Gateway** → Validates request, forwards to User Service
3. **User Service** → Creates user/validates credentials, returns JWT
4. **API Gateway** → Sets secure HTTP-only cookie, returns user data
5. **Frontend** → Stores user data in context, makes authenticated requests
6. **API Gateway** → Validates JWT, sets user context headers for downstream services

## 📱 Features Implemented

### Discovery Page
- **Grid-based user discovery** (inspired by Grindr's layout)
- **Proximity-based ranking** with mutual friends and interests
- **Availability toggle** - Show when you're open for connections
- **Smart search** by name and interests
- **Real-time status indicators**

### Chat Page
- **WhatsApp-like chat interface** with multiple sorting options
- **AI-powered search suggestions** ("Who plays volleyball?")
- **Stories integration** at the top of chats
- **Conversation summaries** for quick context
- **Priority-based chat ordering**

### Opportunities Page
- **AI-suggested connection activities**
- **Friendship reminders** based on interaction patterns
- **Seasonal and contextual suggestions**
- **Smart filtering** by opportunity type

### Profile Page
- **Editable bio and interests**
- **Connection statistics dashboard**
- **Comprehensive settings** for privacy and preferences
- **iOS-style interface elements**

## 🛠 Tech Stack

- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Icons:** Lucide React
- **Styling:** CSS-in-JS with iOS Design System
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint with TypeScript rules
- **Type Safety:** TypeScript in strict mode

## 📁 Project Structure

```
Link/
├── backend/
│   ├── api-gateway/          # API Gateway service
│   ├── user-svc/             # User management service
│   ├── location-svc/         # Location service (planned)
│   ├── chat-svc/             # Chat service (planned)
│   ├── discovery-svc/        # Discovery service (partial)
│   └── docker-compose.yml    # Backend services orchestration
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts (Auth, etc.)
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service layer
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions
│   ├── .env.local            # Local development configuration
│   └── package.json
└── README.md
```

## 🎨 Design System

The app follows iOS Human Interface Guidelines with:
- **Dark theme** with proper contrast ratios
- **iOS-style cards** with backdrop blur effects
- **Haptic feedback** simulation with scale transforms
- **Safe area** handling for iOS devices
- **Smooth animations** with CSS transitions

## 📱 iOS-Specific Features

- **375px container width** for iPhone viewport
- **Safe area insets** for status bar and home indicator
- **iOS color palette** (System Blue, Green, Orange, etc.)
- **Native-like interactions** with proper touch targets
- **Blur effects** and translucent backgrounds

## 🧪 Testing the Authentication

1. **Start the backend**: `cd backend && docker-compose up -d`
2. **Start the frontend**: `cd frontend && npm run dev`
3. **Open** `http://localhost:5173`
4. **Sign up** with a new account:
   - Username, first name, last name, email, password
   - Form validates input in real-time
5. **Automatic login** after successful registration
6. **Try logout** and login again with the same credentials

## 📊 API Endpoints

All requests go through the API Gateway at `http://localhost:8080`:

### Authentication (Public)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh

### User Management (Protected)
- `GET /users/profile` - Get current user profile
- `PUT /users/profile` - Update user profile
- `DELETE /auth/logout` - User logout
- `GET /users/search` - Search users

### Health Check
- `GET /health` - Service health status

## 💬 Chat Service

The Chat Service provides real-time messaging capabilities with WebSocket support.

### Setup Chat Service

1. **Navigate to chat service directory**:
   ```bash
   cd backend/chat-svc
   ```

2. **Set up environment**:
   ```bash
   make dev-setup
   # or manually:
   cp .env.example .env
   ```

3. **Configure environment variables**:
   Edit `.env` with your configuration (see Environment Variables section below)

4. **Install dependencies**:
   ```bash
   make deps
   ```

5. **Run database migrations**:
   ```bash
   make migrate-up
   ```

6. **Start the service**:
   ```bash
   # Development mode with hot reload
   make dev
   
   # Or regular run
   make run
   
   # Or build and run binary
   make build
   ./bin/chat-svc
   ```

### Chat API Endpoints

All chat endpoints require JWT authentication via `Authorization: Bearer <token>` header.

#### Conversations
- `GET /api/v1/chat/conversations` - Get user conversations
  - Query params: `limit` (1-100, default 20), `offset` (default 0)
- `POST /api/v1/chat/conversations` - Create new conversation
  ```json
  {
    "type": "direct|group",
    "name": "Group Chat Name", // required for group
    "description": "Optional description",
    "is_private": false,
    "max_members": 50, // for group chats
    "participant_ids": ["user-uuid-1", "user-uuid-2"]
  }
  ```

#### Messages
- `GET /api/v1/chat/conversations/{id}/messages` - Get conversation messages
  - Query params: `limit` (1-100, default 50), `offset`, `before` (timestamp)
- `POST /api/v1/chat/messages` - Send message
  ```json
  {
    "conversation_id": "conversation-uuid",
    "content": "Message content",
    "message_type": "text|image|file|video|audio",
    "parent_id": "parent-message-uuid" // for replies
  }
  ```

#### WebSocket Connection
- `WS /ws/chat/{room_id}` - Connect to chat room for real-time messaging

### WebSocket Messages

WebSocket messages follow this format:
```json
{
  "type": "message|typing|stop_typing|user_joined|user_left|presence_update|message_read|heartbeat|error",
  "conversation_id": "conversation-uuid",
  "user_id": "user-uuid",
  "message": { /* Message object */ },
  "presence": { /* UserPresence object */ },
  "data": { /* Additional data */ },
  "error": "Error message if type is error",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Migration Commands

```bash
# Run all migrations up
make migrate-up

# Rollback migrations
make migrate-down

# Create new migration
make migrate-create name=add_user_settings

# Alternative migration command
make migrate
```

### Development Commands

```bash
make help                 # Show all available commands
make build               # Build the application
make run                 # Run the application locally
make dev                 # Start with hot reload (requires air)
make test                # Run all tests
make test-coverage       # Run tests with coverage report
make lint                # Run golangci-lint
make format              # Format Go code
make clean               # Clean build artifacts
make docker-build        # Build Docker image
make docker-run          # Run Docker container
make docs                # Generate API documentation
make security-scan       # Run security scan with gosec
```

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:8080
```

#### Backend (docker-compose.yml)
- JWT_SECRET - Should be changed in production
- Database credentials
- Service URLs and timeouts
- CORS origins

#### Chat Service (.env)

**Server Configuration**
```bash
SERVER_PORT=8080                    # Server port
SERVER_HOST=0.0.0.0                # Server host
```

**Database Configuration**
```bash
DB_HOST=localhost                   # Database host
DB_PORT=5432                       # Database port
DB_NAME=chat_db                    # Database name
DB_USER=postgres                   # Database user
DB_PASSWORD=your_password          # Database password
DB_SSL_MODE=disable                # SSL mode for development
DB_MAX_OPEN_CONNS=25               # Max open connections
DB_MAX_IDLE_CONNS=25               # Max idle connections
DB_CONN_MAX_LIFETIME=300s          # Connection max lifetime
```

**Redis Configuration**
```bash
REDIS_HOST=localhost               # Redis host for WebSocket scaling
REDIS_PORT=6379                    # Redis port
REDIS_PASSWORD=                    # Redis password (optional)
REDIS_DB=0                         # Redis database number
```

**JWT Configuration**
```bash
JWT_SECRET=your_jwt_secret_key_here # JWT secret key (MUST match API Gateway)
JWT_EXPIRES_IN=24h                 # Token expiration time
```

**WebSocket Configuration**
```bash
WS_READ_BUFFER_SIZE=1024           # WebSocket read buffer size
WS_WRITE_BUFFER_SIZE=1024          # WebSocket write buffer size
WS_MAX_MESSAGE_SIZE=512            # Max WebSocket message size
```

**CORS & Security**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000  # Allowed CORS origins
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Accept,Authorization,Content-Type,X-CSRF-Token,X-User-ID,X-User-Email,X-User-Name
RATE_LIMIT_ENABLED=true            # Enable rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100 # Rate limit per minute
```

**Logging & Environment**
```bash
LOG_LEVEL=info                     # Logging level (debug, info, warn, error)
LOG_FORMAT=json                    # Log format (json, text)
ENVIRONMENT=development            # Environment (development, staging, production)
HEALTH_CHECK_INTERVAL=30s          # Health check interval
```

## 🐛 Troubleshooting

### Backend Issues

1. **Services not starting**: Check Docker logs
   ```bash
   docker-compose logs api-gateway
   docker-compose logs user-svc
   ```

2. **Database connection issues**: Ensure PostgreSQL is healthy
   ```bash
   docker-compose ps postgres
   ```

3. **JWT errors**: Ensure JWT_SECRET is the same across API Gateway and User Service

### Frontend Issues

1. **CORS errors**: API Gateway handles CORS, check if backend is running
2. **Authentication errors**: Check browser dev tools for detailed error messages
3. **Network errors**: Ensure API Gateway is accessible at `http://localhost:8080`

## 🗺️ Roadmap

- [ ] **Location Service** - GPS tracking and proximity features
- [x] **Chat Service** - Real-time messaging with WebSocket support ✅
- [ ] **Discovery Service** - User discovery and broadcast features
- [ ] **AI Service** - Intelligent matching and recommendations
- [ ] **Stories Service** - Social stories and media sharing
- [ ] **Mobile App** - React Native implementation
- [ ] **Push Notifications** - Real-time notifications
- [ ] **Advanced Security** - Rate limiting, security headers, etc.

## 🔒 Privacy & Security

Following the established rules:
- **No secrets in code** - Environment variables for sensitive data
- **Privacy-first approach** - Location sharing is opt-in with proximity controls
- **Secure data handling** - All user data properly typed and validated

## 🚀 Deployment

The app is configured for local development but can be deployed to:
- **Docker containers** for consistent environments
- **Static hosting** services (Vercel, Netlify)
- **CDN deployment** for global distribution

## 🤝 Contributing

This is a mockup project demonstrating the Link concept. The codebase follows:
- **Conventional commits** (feat:, fix:, docs:, etc.)
- **TypeScript strict mode** with proper type annotations
- **ESLint rules** for consistent code quality
- **Component-based architecture** for maintainability

## 📄 License

This project is a demonstration mockup for the Link social app concept.

---

**Built with ❤️ using TypeScript, React, and modern web technologies.**
