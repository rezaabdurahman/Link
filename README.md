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

#### Backend (docker-compose.yml)
- JWT_SECRET - Should be changed in production
- Database credentials
- Service URLs and timeouts
- CORS origins

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
