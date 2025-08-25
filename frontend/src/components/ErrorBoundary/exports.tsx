// Error Boundary exports
export { default as GlobalErrorBoundary } from './GlobalErrorBoundary';
export { default as RouteErrorBoundary } from './RouteErrorBoundary'; 
export { default as AsyncErrorBoundary, useAsyncError } from './AsyncErrorBoundary';

// Higher-order component for automatic error boundary wrapping
import React from 'react';
import RouteErrorBoundary from './RouteErrorBoundary';

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode,
  routeName?: string
) => {
  const WrappedComponent = (props: P) => (
    <RouteErrorBoundary fallback={fallback} routeName={routeName}>
      <Component {...props} />
    </RouteErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};