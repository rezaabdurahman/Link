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
- **Chat Service** - Real-time messaging (planned)
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

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:8080
```

#### Backend Environment Variables

**Required for all services:**
```bash
# Database Configuration
DB_HOST=postgres                    # Database host
DB_PORT=5432                       # Database port
DB_USER=link_user                  # Database username
DB_PASSWORD=link_pass              # Database password
DB_NAME=link_app                   # Database name
DB_SSLMODE=disable                 # SSL mode for development

# JWT Configuration (must match across API Gateway and User Service)
JWT_SECRET=your-secret-key-change-this-in-production-make-it-very-long-and-complex
JWT_ISSUER=user-svc
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_REFRESH_TOKEN_EXPIRY=24h

# Server Configuration
PORT=8080                          # Service port
ENVIRONMENT=development            # Environment (development/staging/production)
```

**Search Service specific:**
```bash
# Embedding Configuration
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Service Authentication
SERVICE_AUTH_TOKEN=search-service-token-change-in-production
```

**API Gateway specific:**
```bash
# Service URLs (used by API Gateway to route requests)
USER_SVC_URL=http://user-svc:8080
DISCOVERY_SVC_URL=http://discovery-svc:8080
SEARCH_SVC_URL=http://search-svc:8080
LOCATION_SVC_URL=http://location-svc:8080

# Service timeouts
USER_SVC_TIMEOUT=30
DISCOVERY_SVC_TIMEOUT=30
SEARCH_SVC_TIMEOUT=30
```

**Redis Configuration:**
```bash
REDIS_URL=redis://redis:6379       # Redis connection URL
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
- [ ] **Chat Service** - Real-time messaging with WebSocket support
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

## 🧪 Testing & Quality Assurance

### Smoke Tests

Quick health checks to verify the system is working:

```bash
# Backend smoke tests
cd backend

# 1. Start all services
docker-compose up -d

# 2. Wait for services to be healthy (30 seconds)
sleep 30

# 3. Test health endpoints
curl -f http://localhost:8080/health || echo "❌ API Gateway health check failed"
curl -f http://localhost:8081/health || echo "❌ User service health check failed"
curl -f http://localhost:8082/health || echo "❌ Discovery service health check failed"
curl -f http://localhost:8083/health || echo "❌ Search service health check failed"

# 4. Test user registration
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "smoketest",
    "email": "smoke@test.com",
    "password": "SmokeTest123!",
    "first_name": "Smoke",
    "last_name": "Test"
  }' || echo "❌ User registration failed"

# 5. Test login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "smoke@test.com",
    "password": "SmokeTest123!"
  }' || echo "❌ Login failed"

echo "✅ Smoke tests completed"
```

### Unit Testing

**Backend Unit Tests (≥60% coverage required):**
```bash
# Run tests for all services
cd backend

# Discovery service tests
cd discovery-svc
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Search service tests
cd ../search-svc
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Location service tests
cd ../location-svc
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Check coverage meets requirement
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print substr($3, 1, length($3)-1)}')
if (( $(echo "$COVERAGE >= 60" | bc -l) )); then
  echo "✅ Coverage requirement met: $COVERAGE%"
else
  echo "❌ Coverage below 60%: $COVERAGE%"
fi
```

**Frontend Unit Tests:**
```bash
cd frontend

# Run tests with coverage
npm test -- --coverage --watchAll=false

# Run specific test files
npm test LoginPage.test.tsx
npm test authClient.test.ts

# Run tests in watch mode
npm test
```

### Integration Testing

**Automated Integration Tests:**
```bash
cd backend

# Run comprehensive integration test suite
./integration-tests.sh

# Manual step-by-step integration testing:

# 1. Build and start all services
docker-compose up -d --build

# 2. Run individual test scenarios
# Test authentication flow
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPassword123!",
    "first_name": "Test",
    "last_name": "User"
  }')

# Extract and test with JWT token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.jwt')
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/users/profile

# Test search functionality
curl -X POST http://localhost:8080/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "software engineer", "limit": 10}'

# Test ranking endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/discovery/ranking/weights
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/discovery/ranking/info
```

**Performance Testing:**
```bash
# Load test with curl (basic)
for i in {1..100}; do
  curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/users/profile &
done
wait

# Load test with Apache Bench (if installed)
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" http://localhost:8080/users/profile
```

### Development Commands

**Backend Development:**
```bash
# Start individual services for development
cd backend/user-svc
go run main.go  # Runs on :8080

# Hot reload with air (if installed)
air

# Generate mocks for testing
go generate ./...

# Run linting
golint ./...
go vet ./...

# Format code
go fmt ./...

# Build for production
go build -o user-svc main.go
```

**Frontend Development:**
```bash
cd frontend

# Development server with hot reload
npm run dev

# Build for different environments
npm run build:demo      # Demo environment
npm run build:preview   # Preview/staging
npm run build:production # Production

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Preview production build
npm run preview
```

**Database Operations:**
```bash
# Connect to PostgreSQL
docker exec -it backend_postgres_1 psql -U link_user -d link_app

# Run migrations (if available)
cd backend/discovery-svc
go run cmd/migrate/main.go up

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

**Monitoring & Debugging:**
```bash
# View service logs
docker-compose logs -f api-gateway
docker-compose logs -f user-svc
docker-compose logs -f discovery-svc
docker-compose logs -f search-svc

# Monitor resource usage
docker stats

# Debug network issues
docker network ls
docker network inspect backend_default
```

### CI/CD Pipeline

The project includes a comprehensive CI/CD pipeline that runs:

1. **Backend Unit Tests** - Go tests with ≥60% coverage requirement
2. **Frontend Tests** - React/TypeScript tests with coverage
3. **Integration Tests** - Full docker-compose test suite
4. **Security Audits** - Dependency vulnerability scanning
5. **Build Verification** - Multi-environment builds
6. **Deployment** - Automated staging and production deployment

**Triggering CI locally:**
```bash
# Run the same tests as CI
npm run test:coverage  # Frontend tests
cd backend && ./integration-tests.sh  # Integration tests
```

## 🚀 Deployment

The app is configured for local development but can be deployed to:
- **Docker containers** for consistent environments
- **Static hosting** services (Vercel, Netlify)
- **CDN deployment** for global distribution

**Production Deployment:**
```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.production.yml build

# Deploy with production configuration
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d

# Health check production deployment
curl -f https://your-domain.com/health
```

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
