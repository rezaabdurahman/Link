# Services

This directory contains service layer modules that handle API interactions and business logic.

## Auth Service (`authClient.ts`)

The auth service provides a typed API layer for authentication operations including user registration, login, token refresh, and logout.

### Features

- **Cookie-based Authentication**: Primary authentication method using `credentials: 'include'`
- **Token Fallback**: Optional `Authorization` header support for token-based authentication
- **Robust Error Handling**: Discriminated union types for comprehensive error management
- **Environment Configuration**: Centralized base URL from `VITE_API_BASE_URL` or `VITE_API_URL`
- **TypeScript Support**: Fully typed with strict mode compliance

### Usage

```typescript
import { 
  register, 
  login, 
  refresh, 
  logout, 
  AuthServiceError,
  isAuthError,
  getErrorMessage 
} from '@/services/authClient';

// Register a new user
try {
  const response = await register({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securePassword123'
  });
  
  console.log('Registration successful:', response.user);
} catch (error) {
  if (error instanceof AuthServiceError) {
    const friendlyMessage = getErrorMessage(error.error);
    console.error('Registration failed:', friendlyMessage);
  }
}

// Login user
try {
  const response = await login({
    email: 'john@example.com',
    password: 'securePassword123'
  });
  
  console.log('Login successful:', response.user);
} catch (error) {
  if (isAuthError(error)) {
    console.error('Authentication failed');
  }
}

// Refresh authentication
try {
  const response = await refresh();
  console.log('Token refreshed, expires at:', response.expiresAt);
} catch (error) {
  console.error('Session expired, please login again');
}

// Logout user
try {
  await logout();
  console.log('Logged out successfully');
} catch (error) {
  console.error('Logout failed, but session is cleared locally');
}
```

### Error Types

The service maps backend errors to a discriminated union for type-safe error handling:

- `VALIDATION_ERROR`: Invalid input data (400)
- `AUTHENTICATION_ERROR`: Invalid credentials (401)
- `AUTHORIZATION_ERROR`: Access denied (403)
- `CONFLICT_ERROR`: Resource conflict like duplicate email (409)
- `RATE_LIMIT_ERROR`: Too many requests (429)
- `SERVER_ERROR`: Internal server errors (500+)
- `NETWORK_ERROR`: Connection or network issues

### Environment Variables

Configure the API base URL in your `.env` file:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
# or fallback to
VITE_API_URL=http://localhost:8080
```

### API Endpoints

The service expects the following backend endpoints:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `POST /api/auth/refresh` - Token/session refresh
- `DELETE /api/auth/logout` - User logout

### Authentication Flow

1. **Primary**: Cookie-based sessions with `credentials: 'include'`
2. **Fallback**: JWT tokens via `Authorization: Bearer <token>` header
3. **Automatic token management**: Tokens are stored and included in subsequent requests
4. **Error handling**: Failed refresh attempts clear stored tokens automatically
