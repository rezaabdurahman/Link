import { ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { 
  ErrorType, 
  ErrorSeverity, 
  ErrorMetadata, 
  RecoveryStrategy, 
  ErrorContextData, 
  NetworkErrorDetails,
  ChunkLoadingErrorDetails 
} from './errorTypes';

// Generate unique error ID
export const generateErrorId = (): string => {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create error fingerprint for deduplication
export const createErrorFingerprint = (error: Error): string => {
  const message = error.message || 'unknown';
  const stack = error.stack || '';
  
  const stackLines = stack.split('\n').slice(0, 5);
  const relevantStack = stackLines
    .filter(line => line.includes('at ') && !line.includes('node_modules'))
    .slice(0, 3)
    .join('|');
  
  const fingerprint = `${error.name}:${message}:${relevantStack}`;
  return btoa(fingerprint).substr(0, 16);
};

// Categorize error type based on error characteristics
export const categorizeError = (error: Error): ErrorType => {
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';
  const stack = error.stack?.toLowerCase() || '';

  // Chunk loading errors
  if (
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('chunk load failed') ||
    name.includes('chunkerror')
  ) {
    return ErrorType.CHUNK_LOADING;
  }

  // Network errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('cors') ||
    message.includes('timeout') ||
    name.includes('networkerror')
  ) {
    return ErrorType.NETWORK;
  }

  // Permission errors
  if (
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('access denied')
  ) {
    return ErrorType.PERMISSION;
  }

  // Authentication errors
  if (
    message.includes('authentication') ||
    message.includes('login') ||
    message.includes('token') ||
    message.includes('session')
  ) {
    return ErrorType.AUTHENTICATION;
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    name.includes('validationerror')
  ) {
    return ErrorType.VALIDATION;
  }

  // Async/Promise errors
  if (
    message.includes('promise') ||
    message.includes('async') ||
    name.includes('unhandledpromise')
  ) {
    return ErrorType.ASYNC;
  }

  // Route/Navigation errors
  if (
    message.includes('route') ||
    message.includes('navigation') ||
    message.includes('history') ||
    stack.includes('router')
  ) {
    return ErrorType.ROUTE;
  }

  // Component errors (React specific)
  if (
    stack.includes('react') ||
    stack.includes('component') ||
    message.includes('render')
  ) {
    return ErrorType.COMPONENT;
  }

  // Runtime errors (default for JavaScript errors)
  if (
    name.includes('error') ||
    name.includes('exception') ||
    name.includes('reference') ||
    name.includes('type')
  ) {
    return ErrorType.RUNTIME;
  }

  return ErrorType.UNKNOWN;
};

// Determine error severity
export const getErrorSeverity = (error: Error, errorType: ErrorType): ErrorSeverity => {
  const message = error.message?.toLowerCase() || '';

  // Critical errors that break the app
  if (
    errorType === ErrorType.GLOBAL ||
    message.includes('out of memory') ||
    message.includes('stack overflow') ||
    message.includes('quota exceeded')
  ) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors that significantly impact functionality
  if (
    errorType === ErrorType.AUTHENTICATION ||
    errorType === ErrorType.PERMISSION ||
    errorType === ErrorType.CHUNK_LOADING ||
    message.includes('cannot read property') ||
    message.includes('undefined is not a function')
  ) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity errors that partially impact functionality
  if (
    errorType === ErrorType.NETWORK ||
    errorType === ErrorType.ROUTE ||
    errorType === ErrorType.COMPONENT
  ) {
    return ErrorSeverity.MEDIUM;
  }

  // Low severity errors that minimally impact functionality
  return ErrorSeverity.LOW;
};

// Get retry configuration based on error type
export const getRetryConfig = (errorType: ErrorType): { maxRetries: number; delay: number } => {
  switch (errorType) {
    case ErrorType.NETWORK:
      return { maxRetries: 3, delay: 1000 };
    case ErrorType.CHUNK_LOADING:
      return { maxRetries: 2, delay: 500 };
    case ErrorType.ASYNC:
      return { maxRetries: 2, delay: 1000 };
    case ErrorType.COMPONENT:
      return { maxRetries: 2, delay: 100 };
    default:
      return { maxRetries: 1, delay: 0 };
  }
};

// Check if error is recoverable
export const isRecoverable = (errorType: ErrorType): boolean => {
  return [
    ErrorType.NETWORK,
    ErrorType.CHUNK_LOADING,
    ErrorType.COMPONENT,
    ErrorType.ROUTE,
    ErrorType.ASYNC
  ].includes(errorType);
};

// Generate recovery strategies based on error type
export const generateRecoveryStrategies = (
  errorType: ErrorType,
  metadata: Partial<ErrorMetadata>,
  context?: {
    navigate?: (path: string) => void;
    reload?: () => void;
    retry?: () => void;
  }
): RecoveryStrategy[] => {
  const strategies: RecoveryStrategy[] = [];

  // Retry strategy (for most recoverable errors)
  if (isRecoverable(errorType) && metadata.retryCount! < metadata.maxRetries!) {
    strategies.push({
      type: 'retry',
      label: 'Try Again',
      description: 'Attempt to recover from this error',
      action: context?.retry || (() => window.location.reload()),
      priority: 1,
      conditions: ['retries_available']
    });
  }

  // Refresh strategy (for chunk loading and severe errors)
  if ([ErrorType.CHUNK_LOADING, ErrorType.GLOBAL].includes(errorType)) {
    strategies.push({
      type: 'refresh',
      label: 'Refresh Page',
      description: 'Reload the page to clear any cached issues',
      action: context?.reload || (() => window.location.reload()),
      priority: 2
    });
  }

  // Navigation strategies
  if (errorType === ErrorType.ROUTE || errorType === ErrorType.COMPONENT) {
    if (context?.navigate) {
      strategies.push({
        type: 'navigate',
        label: 'Go Home',
        description: 'Return to the home page',
        action: () => context?.navigate?.('/'),
        priority: 3
      });

      strategies.push({
        type: 'navigate',
        label: 'Go Back',
        description: 'Return to the previous page',
        action: () => window.history.back(),
        priority: 4
      });
    }
  }

  // Report strategy (always available for non-trivial errors)
  if (metadata.severity !== ErrorSeverity.LOW) {
    strategies.push({
      type: 'report',
      label: 'Report Issue',
      description: 'Help us fix this by reporting the problem',
      action: async () => {
        await reportError({
          error: new Error(metadata.id!),
          metadata: metadata as ErrorMetadata,
          context: await collectErrorContext()
        });
      },
      priority: 5
    });
  }

  return strategies.sort((a, b) => a.priority - b.priority);
};

// Collect comprehensive error context
export const collectErrorContext = async (): Promise<ErrorContextData> => {
  const context: ErrorContextData = {
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };

  // Network connection info
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    context.connection = {
      type: conn.effectiveType || conn.type,
      downlink: conn.downlink,
      rtt: conn.rtt
    };
  }

  // Performance info
  if ('performance' in window) {
    context.performance = {
      memory: (performance as any).memory,
      timing: performance.timing
    };
  }

  // Additional context from current page
  context.route = window.location.pathname;
  
  return context;
};

// Create comprehensive error metadata
export const createErrorMetadata = async (
  error: Error,
  errorInfo?: ErrorInfo,
  config?: { level?: string; routeName?: string; userId?: string }
): Promise<ErrorMetadata> => {
  const errorType = categorizeError(error);
  const severity = getErrorSeverity(error, errorType);
  const retryConfig = getRetryConfig(errorType);
  const context = await collectErrorContext();

  const metadata: ErrorMetadata = {
    id: generateErrorId(),
    type: errorType,
    severity,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: config?.userId,
    sessionId: generateSessionId(),
    buildVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
    fingerprint: createErrorFingerprint(error),
    context: { ...context, level: config?.level, routeName: config?.routeName },
    stackTrace: error.stack,
    componentStack: errorInfo?.componentStack || undefined,
    retryCount: 0,
    maxRetries: retryConfig.maxRetries,
    isRecoverable: isRecoverable(errorType),
    recoveryStrategies: [],
    tags: {
      errorType,
      severity,
      level: config?.level || 'unknown',
      buildVersion: import.meta.env.VITE_APP_VERSION || 'unknown'
    }
  };

  return metadata;
};

// Generate session ID (simple implementation)
const generateSessionId = (): string => {
  let sessionId = sessionStorage.getItem('error_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('error_session_id', sessionId);
  }
  return sessionId;
};

// Enhanced error reporting
export const reportError = async (reportData: {
  error: Error;
  metadata: ErrorMetadata;
  context: ErrorContextData;
  userDescription?: string;
  reproductionSteps?: string[];
}): Promise<void> => {
  try {
    // Report to Sentry
    Sentry.withScope(scope => {
      scope.setTag('error_id', reportData.metadata.id);
      scope.setTag('error_type', reportData.metadata.type);
      scope.setTag('error_severity', reportData.metadata.severity);
      scope.setLevel(getSentryLevel(reportData.metadata.severity));
      
      scope.setContext('errorMetadata', reportData.metadata as any);
      scope.setContext('errorContext', reportData.context as any);
      
      if (reportData.userDescription) {
        scope.setContext('userReport', {
          description: reportData.userDescription,
          timestamp: Date.now()
        });
      }

      Sentry.captureException(reportData.error);
    });

    // Could also report to custom endpoint
    // await fetch('/api/errors/report', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(reportData)
    // });

    console.log('Error reported successfully:', reportData.metadata.id);
  } catch (reportingError) {
    console.error('Failed to report error:', reportingError);
  }
};

// Convert our severity to Sentry level
const getSentryLevel = (severity: ErrorSeverity): Sentry.SeverityLevel => {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 'fatal';
    case ErrorSeverity.HIGH:
      return 'error';
    case ErrorSeverity.MEDIUM:
      return 'warning';
    case ErrorSeverity.LOW:
      return 'info';
    default:
      return 'error';
  }
};

// Network-specific error detection
export const analyzeNetworkError = (error: Error): NetworkErrorDetails | null => {
  const message = error.message?.toLowerCase() || '';
  
  if (!message.includes('fetch') && !message.includes('network')) {
    return null;
  }

  return {
    url: window.location.href,
    offline: !navigator.onLine,
    timeout: message.includes('timeout'),
    cors: message.includes('cors')
  };
};

// Chunk loading error detection
export const analyzeChunkLoadingError = (error: Error): ChunkLoadingErrorDetails | null => {
  const message = error.message?.toLowerCase() || '';
  
  if (!message.includes('chunk') && !message.includes('loading')) {
    return null;
  }

  return {
    chunkName: extractChunkName(error.message),
    networkStatus: navigator.onLine ? 'online' : 'offline',
    publicPath: (window as any).__webpack_public_path__ || '/'
  };
};

// Extract chunk name from error message
const extractChunkName = (message: string): string | undefined => {
  const chunkMatch = message.match(/chunk\s+(\w+)/i);
  return chunkMatch?.[1];
};

// Debounced error reporting to prevent spam
const errorReportCache = new Map<string, number>();
const ERROR_REPORT_DEBOUNCE = 5000; // 5 seconds

export const shouldReportError = (fingerprint: string): boolean => {
  const lastReported = errorReportCache.get(fingerprint);
  const now = Date.now();
  
  if (!lastReported || now - lastReported > ERROR_REPORT_DEBOUNCE) {
    errorReportCache.set(fingerprint, now);
    return true;
  }
  
  return false;
};

// Error recovery analytics
export const trackErrorRecovery = (metadata: ErrorMetadata, strategy: RecoveryStrategy): void => {
  Sentry.addBreadcrumb({
    category: 'error-recovery',
    message: `Recovery attempted: ${strategy.type}`,
    level: 'info',
    data: {
      errorId: metadata.id,
      errorType: metadata.type,
      strategyType: strategy.type,
      retryCount: metadata.retryCount
    }
  });
};