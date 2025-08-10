# Authentication System

This directory contains the authentication context and related utilities for the Link frontend application.

## Overview

The authentication system provides:

- **JWT token persistence** with automatic expiry validation
- **Automatic token refresh** 15 minutes before expiration
- **Global authentication state** management
- **Secure token storage** wrapper around localStorage
- **Comprehensive error handling** with user-friendly messages
- **TypeScript support** with strict type safety

## Architecture

### Components

1. **`AuthContext.tsx`** - Main authentication context provider
2. **`SecureTokenStorage.ts`** - JWT token persistence utility
3. **`index.ts`** - Clean exports for easy imports

### Dependencies

- Uses existing `authService.ts` for API calls
- Integrates with existing type definitions in `types/index.ts`
- Compatible with current backend authentication structure

## Usage

### 1. Setup AuthProvider

Wrap your main App component with the AuthProvider:

```tsx
import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithAuth;
```

### 2. Use Authentication Hook

In any component, use the `useAuth` hook to access authentication state and methods:

```tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { 
    user, 
    isLoading, 
    error, 
    isInitialized,
    login, 
    logout, 
    register, 
    refresh,
    updateUser,
    clearError 
  } = useAuth();

  // Use authentication state and methods
  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <LoginForm onLogin={login} />;
  }

  return <AuthenticatedApp user={user} onLogout={logout} />;
}
```

### 3. Authentication Methods

#### Login
```tsx
const handleLogin = async () => {
  try {
    await login({ email: 'user@example.com', password: 'password' });
    console.log('Login successful!');
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

#### Register
```tsx
const handleRegister = async () => {
  try {
    await register({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password',
      confirmPassword: 'password'
    });
    console.log('Registration successful!');
  } catch (error) {
    console.error('Registration failed:', error);
  }
};
```

#### Logout
```tsx
const handleLogout = async () => {
  try {
    await logout();
    console.log('Logout successful!');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

#### Manual Token Refresh
```tsx
const handleRefresh = async () => {
  try {
    await refresh();
    console.log('Token refreshed!');
  } catch (error) {
    console.error('Refresh failed:', error);
  }
};
```

#### Update User
```tsx
const handleUpdateUser = () => {
  updateUser({
    name: 'New Name',
    profilePicture: 'https://example.com/avatar.jpg'
  });
};
```

### 4. Authentication State

The hook provides the following state:

- **`user`**: Current authenticated user or `null`
- **`isLoading`**: Boolean indicating if an auth operation is in progress
- **`error`**: Error message string or `null`
- **`isInitialized`**: Boolean indicating if auth state has been initialized from storage
- **`token`**: Current JWT token or `null`

### 5. Protected Routes

Create a protected route component:

```tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, isInitialized, isLoading } = useAuth();

  if (!isInitialized || isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return fallback || <div>Please log in</div>;
  }

  return <>{children}</>;
}
```

## SecureTokenStorage

The `SecureTokenStorage` utility provides secure JWT token management:

### Methods

- **`setToken(token)`** - Store authentication token
- **`getToken()`** - Retrieve valid token (returns `null` if expired)
- **`hasValidToken()`** - Check if valid token exists
- **`clearToken()`** - Clear authentication token
- **`clearAll()`** - Clear all authentication data
- **`willExpireSoon(minutes)`** - Check if token expires within specified time
- **`getTimeUntilExpiry()`** - Get milliseconds until token expires

### Features

- **Automatic expiry validation** with 5-minute buffer
- **Structured error handling** with fallback behavior
- **Safe JSON parsing** with error recovery
- **Storage failure resilience**

## Token Refresh Strategy

The system implements automatic token refresh:

1. **Proactive refresh** - Tokens are refreshed 15 minutes before expiry
2. **Background refresh** - Happens automatically without user interaction
3. **Failure handling** - Failed refreshes clear stored tokens
4. **Storage sync** - All token updates are persisted immediately

## Error Handling

The system provides comprehensive error handling:

### Error Types

- **Validation errors** - Invalid input data
- **Authentication errors** - Invalid credentials
- **Authorization errors** - Insufficient permissions
- **Network errors** - Connection issues
- **Server errors** - Backend failures

### Error Messages

User-friendly error messages are provided through the `getErrorMessage` utility from the auth service.

## Migration Path

### Current State (JWT in localStorage)
- Tokens stored in `SecureTokenStorage`
- Automatic expiry validation
- Manual logout clears tokens

### Future State (HTTP-only cookies)
- Backend issues HTTP-only cookies
- No client-side token storage
- Session-based authentication

The current implementation is designed to be easily migrated to HTTP-only cookies when the backend is updated.

## Testing

### Unit Tests

Test authentication methods:

```tsx
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

const wrapper = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

test('should initialize with no user', () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  expect(result.current.user).toBeNull();
  expect(result.current.isLoading).toBe(false);
});
```

### Integration Tests

Test complete authentication flows:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../AuthContext';
import LoginForm from '../LoginForm';

test('should login successfully', async () => {
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );

  await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'password');
  await userEvent.click(screen.getByRole('button', { name: /login/i }));

  await waitFor(() => {
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });
});
```

## Security Considerations

1. **XSS Protection** - Tokens stored in localStorage are vulnerable to XSS attacks
2. **HTTPS Only** - Always use HTTPS in production
3. **Token Expiry** - Short-lived tokens reduce exposure window
4. **Automatic Refresh** - Minimizes token lifetime
5. **Migration Plan** - Move to HTTP-only cookies for better security

## Troubleshooting

### Common Issues

**Token not persisting**: Check localStorage availability and quota

**Infinite refresh loops**: Ensure refresh endpoint returns new tokens

**Type errors**: Verify all AuthUser fields match backend response

**Network errors**: Check API endpoint configuration

### Debugging

Enable debug logging:

```tsx
// In development, log auth state changes
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth state changed:', { user, isLoading, error, isInitialized });
  }
}, [user, isLoading, error, isInitialized]);
```

## Performance Considerations

1. **Lazy initialization** - Auth state loads only when needed
2. **Minimal re-renders** - State updates are optimized
3. **Background refresh** - No UI blocking during token refresh
4. **Error boundaries** - Auth errors don't crash the app
5. **Memory cleanup** - Timeouts cleared on unmount
