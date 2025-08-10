# ErrorBoundary & FullScreenLoader Components

This document explains how to use the `ErrorBoundary` and `FullScreenLoader` components for graceful error handling and loading states.

## ErrorBoundary

### Overview
The `ErrorBoundary` component catches JavaScript errors anywhere in the child component tree and displays a fallback UI instead of crashing the whole application.

### Features
- Catches runtime errors and displays user-friendly error messages
- Shows detailed error information in development mode
- Provides retry functionality
- Follows iOS-like design patterns
- Supports custom fallback components
- Logs errors for monitoring services

### Basic Usage

```tsx
import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';

// Wrap your entire app
function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
```

### Advanced Usage

```tsx
import React from 'react';
import ErrorBoundary, { ErrorFallbackProps } from './components/ErrorBoundary';

// Custom fallback component
const CustomErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
  <div className="custom-error-ui">
    <h2>Oops! Something went wrong</h2>
    <p>{error?.message}</p>
    <button onClick={resetError}>Try Again</button>
  </div>
);

// Use with custom fallback
function App() {
  return (
    <ErrorBoundary fallback={CustomErrorFallback}>
      <MainApplication />
    </ErrorBoundary>
  );
}
```

### Integration with App Root

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import FullScreenLoader from './components/FullScreenLoader';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import App from './App';

function AppWithAuth() {
  const { isInitialized } = useAuth();
  
  if (!isInitialized) {
    return <FullScreenLoader stage="initializing" showDetails />;
  }
  
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

## FullScreenLoader

### Overview
The `FullScreenLoader` component displays a full-screen loading state with various stages and animations, perfect for app initialization and authentication bootstrap.

### Features
- Multiple loading stages (initializing, authenticating, loading, connecting, error)
- Animated loading indicators
- Error state with retry functionality
- Progress indicators
- Accessibility support
- iOS-like design with app branding

### Basic Usage

```tsx
import React from 'react';
import FullScreenLoader from './components/FullScreenLoader';

function App() {
  const [isLoading, setIsLoading] = React.useState(true);
  
  if (isLoading) {
    return <FullScreenLoader message="Loading your data..." />;
  }
  
  return <MainContent />;
}
```

### Stage-based Loading

```tsx
import React from 'react';
import FullScreenLoader from './components/FullScreenLoader';

function AuthBootstrap() {
  const [stage, setStage] = React.useState<'initializing' | 'authenticating' | 'loading'>('initializing');
  const [error, setError] = React.useState<string | null>(null);
  
  // Show error state
  if (error) {
    return (
      <FullScreenLoader 
        stage="error" 
        errorMessage={error}
        onRetry={() => {
          setError(null);
          setStage('initializing');
        }}
      />
    );
  }
  
  return (
    <FullScreenLoader 
      stage={stage}
      showDetails
      animate
    />
  );
}
```

### Props Reference

#### ErrorBoundary Props
- `children: React.ReactNode` - Child components to wrap
- `fallback?: React.ComponentType<ErrorFallbackProps>` - Custom fallback component

#### FullScreenLoader Props
- `message?: string` - Custom loading message
- `showDetails?: boolean` - Show detailed loading descriptions
- `icon?: React.ComponentType<{ className?: string }>` - Custom icon component
- `animate?: boolean` - Enable/disable animations (default: true)
- `stage?: 'initializing' | 'authenticating' | 'loading' | 'connecting' | 'error'` - Loading stage
- `errorMessage?: string` - Error message when stage is 'error'
- `onRetry?: () => void` - Retry function for error state

## Real-world Integration

### With Authentication Context

```tsx
// src/App.tsx
import React from 'react';
import { useAuth } from './contexts/AuthContext';
import FullScreenLoader from './components/FullScreenLoader';
import MainLayout from './components/MainLayout';

function App() {
  const { user, isLoading, isInitialized, error } = useAuth();
  
  // Show initialization loader
  if (!isInitialized || isLoading) {
    const stage = !isInitialized ? 'initializing' : 'authenticating';
    return (
      <FullScreenLoader 
        stage={stage}
        showDetails
        errorMessage={error || undefined}
        onRetry={error ? () => window.location.reload() : undefined}
      />
    );
  }
  
  return <MainLayout />;
}
```

### Error Monitoring Integration

```tsx
// src/components/ErrorBoundary.tsx
// In the componentDidCatch method, you can integrate with error monitoring services:

componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
  // Log to console
  console.error('ErrorBoundary caught an error:', error, errorInfo);
  
  // Send to error monitoring service (example)
  if (process.env.NODE_ENV === 'production') {
    // Example with Sentry
    // Sentry.captureException(error, {
    //   extra: errorInfo,
    //   tags: { boundary: 'global' }
    // });
    
    // Example with custom service
    // errorService.report({
    //   error: error.message,
    //   stack: error.stack,
    //   componentStack: errorInfo.componentStack,
    //   url: window.location.href,
    //   userAgent: navigator.userAgent,
    //   timestamp: new Date().toISOString()
    // });
  }
}
```

## Best Practices

1. **Error Boundary Placement**: Place error boundaries at strategic points in your component tree, not just at the root
2. **Fallback UI**: Design fallback UIs that match your app's design system
3. **Error Reporting**: Integrate with error monitoring services in production
4. **Loading States**: Use appropriate stages for different loading phases
5. **Accessibility**: Both components include ARIA labels and screen reader support
6. **Testing**: Test error scenarios and loading states thoroughly

## Styling Notes

Both components use:
- Tailwind CSS classes with custom design tokens
- iOS-like design patterns from the project's design system
- Consistent color scheme (aqua, copper, charcoal)
- Responsive design for mobile-first approach
- Custom animations and transitions
