// ErrorBoundary - Global error boundary component to catch and display runtime errors
// Provides a fallback UI when JavaScript errors occur in component tree

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureError } from '../utils/sentry';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
}

/**
 * Default error fallback component with iOS-like design
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  errorInfo, 
  resetError 
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleReload = (): void => {
    window.location.reload();
  };

  const handleReportError = (): void => {
    if (error) {
      captureError(error, {
        errorInfo,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        reportedBy: 'user',
      });
      console.log('Error reported to Sentry');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-6">
      <div className="ios-card w-full max-w-md p-6 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Something went wrong
          </h2>
          
          <p className="text-text-secondary text-sm leading-relaxed">
            We encountered an unexpected error. This has been logged and we'll look into it.
          </p>
        </div>

        {/* Development mode: Show error details */}
        {isDevelopment && error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-ios text-left">
            <details className="text-xs">
              <summary className="font-medium text-red-700 cursor-pointer mb-2">
                Error Details (Development Mode)
              </summary>
              <div className="space-y-2">
                <div>
                  <strong className="text-red-600">Error:</strong>
                  <pre className="mt-1 text-red-800 whitespace-pre-wrap break-words">
                    {error.message}
                  </pre>
                </div>
                {error.stack && (
                  <div>
                    <strong className="text-red-600">Stack Trace:</strong>
                    <pre className="mt-1 text-red-800 text-xs whitespace-pre-wrap break-words overflow-x-auto">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <strong className="text-red-600">Component Stack:</strong>
                    <pre className="mt-1 text-red-800 text-xs whitespace-pre-wrap break-words">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <button 
            onClick={resetError}
            className="w-full ios-button flex items-center justify-center gap-2"
            type="button"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          <button 
            onClick={handleReload}
            className="w-full ios-button-secondary ios-button"
            type="button"
          >
            Reload Page
          </button>

          {isDevelopment && (
            <button 
              onClick={handleReportError}
              className="w-full text-text-secondary text-sm underline hover:text-text-primary transition-colors"
              type="button"
            >
              Report Error (Dev)
            </button>
          )}
        </div>

        {/* Additional help text */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-text-secondary">
            If this problem persists, please try refreshing the page or contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * ErrorBoundary class component to catch JavaScript errors anywhere in the child component tree
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method to update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called when an error is caught
   * Used for logging and additional error handling
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info for display
    this.setState({
      error,
      errorInfo,
    });

    // Send error to Sentry
    captureError(error, {
      errorInfo,
      tags: { boundary: 'global' },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Reset error state to allow user to try again
   */
  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): React.ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback: FallbackComponent = DefaultErrorFallback } = this.props;

    if (hasError) {
      return (
        <FallbackComponent 
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
        />
      );
    }

    return children;
  }
}

export default ErrorBoundary;
export type { ErrorFallbackProps };
