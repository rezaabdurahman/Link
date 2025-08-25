import React, { ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { ErrorType, ErrorSeverity } from '../../utils/errorTypes';
import { categorizeError, getErrorSeverity, shouldReportError, reportError, collectErrorContext } from '../../utils/errorUtils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, metadata: AsyncErrorMetadata) => void;
  enableReporting?: boolean;
  maxErrorsBeforeHiding?: number;
  autoHideDelay?: number;
}

interface AsyncErrorMetadata {
  id: string;
  error: Error;
  timestamp: number;
  source: 'unhandledPromiseRejection' | 'globalJavaScriptError' | 'manual';
  type: ErrorType;
  severity: ErrorSeverity;
  fingerprint: string;
  context?: any;
}

interface AsyncError {
  metadata: AsyncErrorMetadata;
  dismissed: boolean;
  reported: boolean;
}

// Enhanced custom hook for catching async errors
export const useAsyncError = () => {
  const [, setAsyncError] = useState<Error | null>(null);
  
  return useCallback((error: Error) => {
    // Add additional context to the error
    const enhancedError = new Error(error.message);
    enhancedError.name = error.name;
    enhancedError.stack = error.stack;
    (enhancedError as any).__asyncError = true;
    (enhancedError as any).__originalError = error;
    
    setAsyncError(() => {
      throw enhancedError; // This will trigger the error boundary
    });
  }, []);
};

// Hook for manually reporting async errors without triggering boundaries
export const useErrorReporter = () => {
  return useCallback(async (error: Error, context?: any) => {
    const errorType = categorizeError(error);
    const severity = getErrorSeverity(error, errorType);
    const fingerprint = `async_${error.name}_${error.message.substring(0, 50)}`;
    
    if (shouldReportError(fingerprint)) {
      const fullContext = await collectErrorContext();
      await reportError({
        error,
        metadata: {
          id: `async_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: errorType,
          severity,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          fingerprint,
          context: { ...fullContext, ...context },
          stackTrace: error.stack,
          retryCount: 0,
          maxRetries: 0,
          isRecoverable: false,
          recoveryStrategies: [],
          tags: { errorType, severity, source: 'manual' }
        } as any,
        context: fullContext
      });
    }
  }, []);
};

const AsyncErrorBoundary: React.FC<Props> = ({ 
  children, 
  fallback, 
  onError,
  enableReporting = true,
  maxErrorsBeforeHiding = 3,
  autoHideDelay = 10000 // 10 seconds
}) => {
  const [asyncErrors, setAsyncErrors] = useState<AsyncError[]>([]);
  const dismissTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const errorCountRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      
      const errorType = categorizeError(error);
      const severity = getErrorSeverity(error, errorType);
      const fingerprint = `promise_${error.name}_${error.message.substring(0, 50)}`;
      
      // Track error frequency
      const currentCount = errorCountRef.current.get(fingerprint) || 0;
      errorCountRef.current.set(fingerprint, currentCount + 1);
      
      // Create enhanced error metadata
      const metadata: AsyncErrorMetadata = {
        id: `async_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        error,
        timestamp: Date.now(),
        source: 'unhandledPromiseRejection',
        type: errorType,
        severity,
        fingerprint
      };

      // Add context from the promise rejection
      try {
        metadata.context = {
          promise: event.promise,
          reason: event.reason,
          stack: error.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        };
      } catch (contextError) {
        console.warn('Failed to capture async error context:', contextError);
      }
      
      // Log to Sentry with enhanced context
      Sentry.withScope(scope => {
        scope.setTag('errorBoundary.type', 'async');
        scope.setTag('errorBoundary.source', 'unhandledPromiseRejection');
        scope.setTag('error.type', errorType);
        scope.setTag('error.severity', severity);
        scope.setTag('error.fingerprint', fingerprint);
        scope.setContext('asyncErrorMetadata', metadata as any);
        scope.setLevel(severity === 'critical' ? 'fatal' : 'error');
        Sentry.captureException(error);
      });

      // Add to local state for display
      const asyncError: AsyncError = {
        metadata,
        dismissed: false,
        reported: false
      };
      
      setAsyncErrors(prev => [...prev, asyncError]);

      // Report error if enabled and not spam
      if (enableReporting && shouldReportError(fingerprint)) {
        try {
          const context = await collectErrorContext();
          await reportError({
            error,
            metadata: metadata as any,
            context
          });
          
          // Mark as reported
          asyncError.reported = true;
        } catch (reportError) {
          console.warn('Failed to report async error:', reportError);
        }
      }

      // Call custom error handler
      if (onError) {
        onError(error, metadata);
      }

      // Auto-dismiss after delay
      const dismissTimeout = setTimeout(() => {
        setAsyncErrors(prev => 
          prev.map(e => 
            e.metadata.id === metadata.id 
              ? { ...e, dismissed: true }
              : e
          )
        );
      }, autoHideDelay);
      
      dismissTimeoutsRef.current.set(metadata.id, dismissTimeout);

      // Prevent the default browser behavior
      event.preventDefault();
      
      console.error('Enhanced Unhandled Promise Rejection:', {
        error,
        type: errorType,
        severity,
        metadata
      });
    };

    // Handle global JavaScript errors
    const handleGlobalError = async (event: ErrorEvent) => {
      const error = event.error || new Error(event.message);
      
      // Skip errors that are already handled by React error boundaries
      if ((error as any).__reactErrorBoundary) {
        return;
      }
      
      const errorType = categorizeError(error);
      const severity = getErrorSeverity(error, errorType);
      const fingerprint = `global_${error.name}_${event.filename}_${event.lineno}`;
      
      // Track error frequency
      const currentCount = errorCountRef.current.get(fingerprint) || 0;
      errorCountRef.current.set(fingerprint, currentCount + 1);
      
      // Create enhanced error metadata
      const metadata: AsyncErrorMetadata = {
        id: `global_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        error,
        timestamp: Date.now(),
        source: 'globalJavaScriptError',
        type: errorType,
        severity,
        fingerprint,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          message: event.message,
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      };
      
      // Log to Sentry with enhanced context
      Sentry.withScope(scope => {
        scope.setTag('errorBoundary.type', 'async');
        scope.setTag('errorBoundary.source', 'globalJavaScriptError');
        scope.setTag('error.type', errorType);
        scope.setTag('error.severity', severity);
        scope.setTag('error.fingerprint', fingerprint);
        scope.setContext('globalErrorEvent', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          message: event.message
        });
        scope.setLevel(severity === 'critical' ? 'fatal' : 'error');
        Sentry.captureException(error);
      });

      // Add to local state for display
      const asyncError: AsyncError = {
        metadata,
        dismissed: false,
        reported: false
      };
      
      setAsyncErrors(prev => [...prev, asyncError]);

      // Report error if enabled and not spam
      if (enableReporting && shouldReportError(fingerprint)) {
        try {
          const context = await collectErrorContext();
          await reportError({
            error,
            metadata: metadata as any,
            context
          });
          
          // Mark as reported
          asyncError.reported = true;
        } catch (reportError) {
          console.warn('Failed to report global error:', reportError);
        }
      }

      // Call custom error handler
      if (onError) {
        onError(error, metadata);
      }

      // Auto-dismiss after delay
      const dismissTimeout = setTimeout(() => {
        setAsyncErrors(prev => 
          prev.map(e => 
            e.metadata.id === metadata.id 
              ? { ...e, dismissed: true }
              : e
          )
        );
      }, autoHideDelay);
      
      dismissTimeoutsRef.current.set(metadata.id, dismissTimeout);

      console.error('Enhanced Global JavaScript Error:', {
        error,
        type: errorType,
        severity,
        metadata
      });
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
      
      // Clear all pending timeouts
      dismissTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      dismissTimeoutsRef.current.clear();
    };
  }, [onError, enableReporting, autoHideDelay]);

  // Auto-clear old errors and manage cleanup
  useEffect(() => {
    if (asyncErrors.length > 0) {
      const cleanupTimer = setTimeout(() => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        setAsyncErrors(prev => {
          const filtered = prev.filter(asyncError => 
            asyncError.metadata.timestamp > fiveMinutesAgo && !asyncError.dismissed
          );
          
          // Clear timeouts for removed errors
          prev.forEach(error => {
            if (error.metadata.timestamp <= fiveMinutesAgo || error.dismissed) {
              const timeout = dismissTimeoutsRef.current.get(error.metadata.id);
              if (timeout) {
                clearTimeout(timeout);
                dismissTimeoutsRef.current.delete(error.metadata.id);
              }
            }
          });
          
          return filtered;
        });
      }, 30000); // Check every 30 seconds

      return () => clearTimeout(cleanupTimer);
    }
    return undefined;
  }, [asyncErrors]);

  // Handle manual error dismissal
  const dismissError = useCallback((errorId: string) => {
    setAsyncErrors(prev => 
      prev.map(error => 
        error.metadata.id === errorId 
          ? { ...error, dismissed: true }
          : error
      )
    );
    
    // Clear the auto-dismiss timeout
    const timeout = dismissTimeoutsRef.current.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      dismissTimeoutsRef.current.delete(errorId);
    }
  }, []);

  // Handle dismissing all errors
  const dismissAllErrors = useCallback(() => {
    setAsyncErrors([]);
    
    // Clear all timeouts
    dismissTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    dismissTimeoutsRef.current.clear();
  }, []);

  // Filter errors for display
  const displayErrors = asyncErrors.filter(asyncError => 
    !asyncError.dismissed && 
    Date.now() - asyncError.metadata.timestamp < 60000 // Less than 1 minute old
  );

  // Check if we should hide errors due to spam
  const errorsByFingerprint = displayErrors.reduce((acc, error) => {
    const fingerprint = error.metadata.fingerprint;
    acc[fingerprint] = (acc[fingerprint] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const shouldHideErrors = Object.values(errorsByFingerprint).some(count => 
    count >= maxErrorsBeforeHiding
  );

  // Show critical errors as full fallback
  const criticalErrors = displayErrors.filter(error => 
    error.metadata.severity === 'critical'
  );

  if (criticalErrors.length > 0 && fallback) {
    return <>{fallback}</>;
  }

  // Note: Could calculate the most severe error for display if needed

  // Render error notifications
  const renderErrorNotifications = () => {
    if (shouldHideErrors) {
      return (
        <div className="fixed bottom-4 right-4 max-w-sm bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Multiple Errors Detected
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Multiple errors occurred recently. This might indicate a larger issue.</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium hover:bg-yellow-200 transition-colors"
                >
                  Reload Page
                </button>
                <button
                  onClick={dismissAllErrors}
                  className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  Dismiss All
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (displayErrors.length === 0) {
      return null;
    }

    // Show individual error notifications
    return (
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {displayErrors.slice(0, 3).map((asyncError) => { // Show max 3 errors
          const { metadata } = asyncError;
          const severityColors = {
            low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-400' },
            medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-400' },
            high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: 'text-orange-400' },
            critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-400' }
          };
          
          const colors = severityColors[metadata.severity];
          
          return (
            <div key={metadata.id} className={`max-w-sm ${colors.bg} ${colors.border} border rounded-lg p-4 shadow-lg`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-sm font-medium ${colors.text}`}>
                    {metadata.type === 'network' ? 'Network Error' :
                     metadata.type === 'chunk_loading' ? 'Loading Error' :
                     metadata.source === 'unhandledPromiseRejection' ? 'Promise Error' :
                     'Application Error'}
                  </h3>
                  <div className={`mt-2 text-sm ${colors.text.replace('800', '700')}`}>
                    <p>
                      {metadata.type === 'network' ? 'A network request failed. Check your connection.' :
                       metadata.type === 'chunk_loading' ? 'Failed to load part of the application.' :
                       'An unexpected error occurred in the background.'}
                    </p>
                    
                    {process.env.NODE_ENV === 'development' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium">Technical Details</summary>
                        <pre className="text-xs mt-1 whitespace-pre-wrap break-all">
                          {metadata.error.message}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {metadata.type === 'network' && (
                      <button
                        onClick={() => window.location.reload()}
                        className={`${colors.bg.replace('50', '100')} ${colors.text} px-2 py-1 rounded text-xs font-medium hover:${colors.bg.replace('50', '200')} transition-colors`}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => dismissError(metadata.id)}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      Dismiss
                    </button>
                    {asyncError.reported && (
                      <span className="text-xs text-gray-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Reported
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {displayErrors.length > 3 && (
          <div className="text-center">
            <button
              onClick={dismissAllErrors}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Dismiss all ({displayErrors.length} errors)
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {children}
      {renderErrorNotifications()}
    </>
  );
};

export default AsyncErrorBoundary;