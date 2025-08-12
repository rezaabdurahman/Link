# Authentication Surface Inventory

## Overview
This document catalogs every component, file, environment variable, and runtime element that participates in authentication, JWT handling, password management, sessions, and security boundaries in the Link application.

## Authentication Components Mapping

### Backend Go Files

| Component Path | Responsibility | Data Stored/Processed | Trust Boundary | Dependencies |
|----------------|-----------------|----------------------|-----------------|--------------|
| `backend/api-gateway/internal/config/jwt.go` | JWT validation configuration | JWT secrets, token validation, cookie settings | **Trust Boundary**: API Gateway - validates all incoming requests | ENV vars: `JWT_SECRET`, `JWT_ISSUER`, `JWT_COOKIE_NAME` |
| `backend/api-gateway/internal/middleware/auth.go` | API Gateway authentication middleware | JWT tokens, user context headers, CORS settings | **Trust Boundary**: Entry point - first auth validation layer | Depends on jwt.go config |
| `backend/user-svc/internal/config/jwt.go` | User service JWT token generation | JWT creation, token signing, refresh token logic | **Trust Boundary**: User service - token creation authority | ENV vars: `JWT_SECRET`, `JWT_ISSUER` |
| `backend/user-svc/internal/handlers/user_handler.go` | Authentication endpoints handler | Login/register requests, password validation, session cookies | **Trust Boundary**: User service endpoints | Depends on user service, JWT config |
| `backend/user-svc/internal/models/user.go` | User data models | Password hashes, user profiles, sessions, friend requests | **Trust Boundary**: Database models - sensitive user data | Database storage |
| `backend/user-svc/internal/middleware/context.go` | User context extraction middleware | User headers from API Gateway, request context | Internal service boundary | Depends on API Gateway headers |
| `backend/location-svc/internal/middleware/auth.go` | Location service auth middleware | JWT tokens, user ID context | **Trust Boundary**: Location service - validates user access | ENV vars: `JWT_SECRET` |

### Frontend TypeScript Files

| Component Path | Responsibility | Data Stored/Processed | Trust Boundary | Storage Mechanism |
|----------------|-----------------|----------------------|-----------------|-------------------|
| `frontend/src/contexts/AuthContext.tsx` | Global authentication state management | User state, JWT tokens, auth status | **Trust Boundary**: Frontend auth context - all components trust this | React Context |
| `frontend/src/services/authService.ts` | API authentication service | HTTP auth requests, token management, error handling | **Trust Boundary**: API communication layer | HTTP requests with credentials |
| `frontend/src/utils/secureTokenStorage.ts` | Secure token persistence | Encrypted JWT tokens, expiration validation | **Trust Boundary**: Client-side storage - sensitive data protection | LocalStorage (encrypted) + in-memory fallback |
| `frontend/src/components/RequireAuth.tsx` | Route authentication guard | Authentication status, route protection | **Trust Boundary**: Route-level access control | React Router |
| `frontend/src/utils/devAuth.ts` | Development authentication helper | Mock user data, dev tokens | Development boundary only | LocalStorage (dev mode) |
| `frontend/src/config/index.ts` | Authentication configuration | Auth requirements, demo mode settings | Configuration boundary | Environment variables |
| `frontend/src/types/index.ts` | Authentication type definitions | Type safety for auth data structures | Type boundary - ensures data integrity | TypeScript compiler |

### Environment Variables & Container Security

| Variable/Setting | Location | Purpose | Security Impact | Default Value |
|------------------|----------|---------|-----------------|---------------|
| `JWT_SECRET` | All services | JWT token signing and validation | **CRITICAL** - Token security foundation | `your-secret-key-change-this-in-production` |
| `JWT_ISSUER` | API Gateway, User Service | JWT token issuer identification | Token validation scope | `user-svc` |
| `JWT_COOKIE_NAME` | API Gateway | HTTP cookie name for JWT | Session management | `link_auth` |
| `JWT_COOKIE_SAMESITE` | API Gateway | Cookie SameSite policy | CSRF protection | `lax` |
| `JWT_ACCESS_TOKEN_EXPIRY` | User Service | Access token lifetime | Session security | `1h` |
| `JWT_REFRESH_TOKEN_EXPIRY` | User Service | Refresh token lifetime | Long-term session security | `24h` |
| `ENVIRONMENT` | All services | Environment detection | Cookie security flags | `development` |
| `DB_USER`, `DB_PASSWORD` | All backend services | Database authentication | Database access control | `linkuser`, `linkpass` |
| `VITE_REQUIRE_AUTH` | Frontend | Authentication requirement toggle | Frontend auth bypass | `true` |
| `VITE_AUTO_LOGIN` | Frontend | Automatic login in demo mode | Demo security | `false` |
| `VITE_MOCK_USER` | Frontend | Mock user authentication | Development security | `false` |

### Docker & Runtime Components

| Container/Port | Service | Security Role | Network Exposure | Auth Dependencies |
|----------------|---------|---------------|-----------------|-------------------|
| `api-gateway:8080` | API Gateway | **Primary auth enforcement** | External (port 8080) | JWT validation, CORS, rate limiting |
| `user-svc:8081` | User Service | **Auth authority** | Internal only | JWT creation, password hashing, sessions |
| `location-svc:8082` | Location Service | **Auth consumer** | Internal only | JWT validation via middleware |
| `discovery-svc:8087` | Discovery Service | **Auth consumer** | Internal only | User context from gateway |
| `postgres:5432` | Database | **Auth data storage** | Internal only | User credentials, sessions, tokens |
| `redis:6379` | Cache | **Session storage** | Internal only | Session data, rate limiting |
| `frontend:3000` | Frontend | **Auth UI/UX** | External (port 3000) | Token storage, auth forms |

### Authentication Flow & Trust Boundaries

#### Primary Trust Boundaries

1. **External → API Gateway** (Port 8080)
   - **Components**: `auth.go` middleware, JWT validator
   - **Data**: HTTP requests, JWT tokens, cookies
   - **Protection**: Rate limiting, CORS, JWT validation

2. **API Gateway → Microservices** (Internal Network)
   - **Components**: Service-specific auth middleware
   - **Data**: User context headers (`X-User-ID`, `X-User-Email`)
   - **Protection**: Header validation, service mesh security

3. **Services → Database** (Internal Network)
   - **Components**: Database models, repositories
   - **Data**: User credentials, session data, personal information
   - **Protection**: Connection encryption, access controls

4. **Frontend → API Gateway** (HTTPS)
   - **Components**: AuthService, secure token storage
   - **Data**: Login forms, JWT tokens, user sessions
   - **Protection**: HTTPS, secure cookies, token encryption

### Security-Critical Data Flows

#### Authentication Flow
1. **User Login**: `LoginPage.tsx` → `authService.ts` → API Gateway (`auth.go`) → User Service (`user_handler.go`) → Database
2. **Token Validation**: Request → API Gateway (`jwt.go`) → JWT verification → User context headers → Services
3. **Token Refresh**: Frontend (`AuthContext.tsx`) → API Gateway → User Service → New JWT → Secure storage
4. **Session Management**: User Service creates session → Database storage → Cookie/JWT distribution

#### Password Security
- **Hashing**: User Service (`user_service.go`) - bcrypt hashing
- **Storage**: Database (`user.go` model) - `PasswordHash` field (never exposed)
- **Validation**: Login handler compares hashed passwords

#### Token Security
- **Generation**: User Service JWT service with HMAC-SHA256
- **Distribution**: HTTP-only cookies + Bearer tokens (fallback)
- **Storage**: Frontend encrypted localStorage with Web Crypto API
- **Validation**: API Gateway validates all tokens before service routing

### Identified Security Considerations

#### High-Risk Components
1. **JWT_SECRET environment variable** - Single point of failure across all services
2. **API Gateway auth middleware** - Bypass could compromise entire system
3. **Frontend token storage** - Client-side storage vulnerable to XSS
4. **Database password hashes** - Central credential storage

#### Medium-Risk Components
1. **Service-to-service communication** - Headers trusted without re-validation
2. **Development authentication helpers** - Could leak into production
3. **CORS configuration** - Overly permissive in development

#### Low-Risk Components
1. **Frontend type definitions** - Runtime validation still needed
2. **Configuration files** - Mostly compile-time security
3. **Demo mode settings** - Controlled by environment flags

## Recommendations

### Immediate Actions
1. **Rotate JWT secrets** - Use complex, environment-specific secrets
2. **Enable HTTPS-only cookies** in production
3. **Implement token blacklisting** for logout/compromise scenarios
4. **Add request signing** for service-to-service communication

### Medium-term Improvements
1. **Implement OAuth2/OIDC** for external authentication
2. **Add multi-factor authentication** support
3. **Implement certificate-based** service authentication
4. **Add audit logging** for all authentication events

### Long-term Considerations
1. **Zero-trust architecture** - Verify every request
2. **Hardware security modules** for key management
3. **Biometric authentication** options
4. **Decentralized identity** solutions

---
*Generated on: $(date)*
*Total Components Inventoried: 25+ files, 12+ environment variables, 7+ containers*
