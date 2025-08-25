import { forwardRef, useState, useEffect } from 'react';
import { ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug, Wifi, WifiOff, Activity, Clock } from 'lucide-react';
import { ErrorMetadata, RecoveryStrategy, ErrorType, ErrorSeverity } from '../../utils/errorTypes';

interface Props {
  error?: Error | null;
  errorInfo?: ErrorInfo | null;
  metadata?: ErrorMetadata | null;
  level: 'global' | 'route' | 'component';
  isRecovering?: boolean;
  onRecoveryStrategy?: (strategy: RecoveryStrategy) => void;
  onReload?: () => void;
  enableReporting?: boolean;
}

const ErrorFallbackUI = forwardRef<HTMLDivElement, Props>(({
  error,
  errorInfo,
  metadata,
  level,
  isRecovering = false,
  onRecoveryStrategy
}, ref) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getErrorIcon = () => {
    if (!metadata) return <AlertTriangle className="w-12 h-12 text-red-500" />;
    
    switch (metadata.type) {
      case ErrorType.NETWORK:
        return isOnline ? 
          <Wifi className="w-12 h-12 text-orange-500" /> : 
          <WifiOff className="w-12 h-12 text-red-500" />;
      case ErrorType.CHUNK_LOADING:
        return <RefreshCw className="w-12 h-12 text-blue-500" />;
      case ErrorType.PERFORMANCE:
        return <Activity className="w-12 h-12 text-yellow-500" />;
      case ErrorType.TIMEOUT:
        return <Clock className="w-12 h-12 text-orange-500" />;
      default:
        return <AlertTriangle className="w-12 h-12 text-red-500" />;
    }
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'text-red-600 bg-red-50 border-red-200';
      case ErrorSeverity.HIGH:
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case ErrorSeverity.MEDIUM:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case ErrorSeverity.LOW:
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getErrorTitle = () => {
    if (!metadata) return 'Something went wrong';
    
    switch (metadata.type) {
      case ErrorType.NETWORK:
        return isOnline ? 'Network Error' : 'You\'re Offline';
      case ErrorType.CHUNK_LOADING:
        return 'Loading Error';
      case ErrorType.AUTHENTICATION:
        return 'Authentication Error';
      case ErrorType.PERMISSION:
        return 'Permission Denied';
      case ErrorType.VALIDATION:
        return 'Validation Error';
      case ErrorType.NOT_FOUND:
        return 'Not Found';
      case ErrorType.PERFORMANCE:
        return 'Performance Issue';
      case ErrorType.TIMEOUT:
        return 'Request Timeout';
      default:
        return 'Unexpected Error';
    }
  };

  const getErrorDescription = () => {
    if (!metadata) return 'An unexpected error occurred. Please try again.';
    
    switch (metadata.type) {
      case ErrorType.NETWORK:
        return isOnline 
          ? 'There was a problem connecting to our servers. Please check your connection and try again.'
          : 'You appear to be offline. Please check your internet connection.';
      case ErrorType.CHUNK_LOADING:
        return 'Some parts of the application failed to load. This usually happens after an update.';
      case ErrorType.AUTHENTICATION:
        return 'Your session may have expired. Please sign in again.';
      case ErrorType.PERMISSION:
        return 'You don\'t have permission to access this resource.';
      case ErrorType.VALIDATION:
        return 'The information provided doesn\'t meet the requirements.';
      case ErrorType.NOT_FOUND:
        return 'The requested resource could not be found.';
      case ErrorType.PERFORMANCE:
        return 'The application is running slowly. This might be due to high memory usage.';
      case ErrorType.TIMEOUT:
        return 'The request took too long to complete. Please try again.';
      default:
        return metadata.message || error?.message || 'An unexpected error occurred.';
    }
  };

  const getPrimaryRecoveryStrategy = () => {
    if (!metadata?.recoveryStrategies?.length) return null;
    return metadata.recoveryStrategies.find(s => s.priority === 0) || metadata.recoveryStrategies[0];
  };

  const getSecondaryRecoveryStrategies = () => {
    if (!metadata?.recoveryStrategies?.length) return [];
    return metadata.recoveryStrategies.filter(s => s.priority !== 0).slice(0, 2);
  };

  const getStrategyIcon = (type: string) => {
    switch (type) {
      case 'retry':
        return <RefreshCw className="w-4 h-4" />;
      case 'navigate':
        return <Home className="w-4 h-4" />;
      case 'back':
        return <ArrowLeft className="w-4 h-4" />;
      case 'refresh':
        return <RefreshCw className="w-4 h-4" />;
      case 'report':
        return <Bug className="w-4 h-4" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  const handleStrategyClick = (strategy: RecoveryStrategy) => {
    if (onRecoveryStrategy) {
      onRecoveryStrategy(strategy);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div
      ref={ref}
      className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center"
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          {getErrorIcon()}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">
            {getErrorTitle()}
          </h2>
          
          {metadata?.severity && (
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(metadata.severity)}`}>
              {metadata.severity.toUpperCase()}
            </div>
          )}
        </div>

        <p className="text-gray-600 leading-relaxed">
          {getErrorDescription()}
        </p>

        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                You're currently offline. Some features may not work.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {getPrimaryRecoveryStrategy() && (
            <button
              onClick={() => handleStrategyClick(getPrimaryRecoveryStrategy()!)}
              disabled={isRecovering}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              {isRecovering ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                getStrategyIcon(getPrimaryRecoveryStrategy()!.type)
              )}
              <span>
                {isRecovering ? 'Recovering...' : getPrimaryRecoveryStrategy()!.label}
              </span>
            </button>
          )}

          {getSecondaryRecoveryStrategies().length > 0 && (
            <div className="flex space-x-2">
              {getSecondaryRecoveryStrategies().map((strategy, index) => (
                <button
                  key={index}
                  onClick={() => handleStrategyClick(strategy)}
                  disabled={isRecovering}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  {getStrategyIcon(strategy.type)}
                  <span className="text-sm">{strategy.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {(error || metadata) && (
          <div className="space-y-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>

            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
                {metadata && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">
                      <strong>Error ID:</strong> {metadata.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Type:</strong> {metadata.type}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Time:</strong> {formatTimestamp(metadata.timestamp)}
                    </div>
                    {metadata.context?.route && (
                      <div className="text-xs text-gray-500">
                        <strong>Route:</strong> {metadata.context.route}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700">Error Message:</div>
                    <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded border overflow-auto max-h-20">
                      {error.message}
                    </div>
                  </div>
                )}

                {process.env.NODE_ENV === 'development' && error?.stack && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700">Stack Trace:</div>
                    <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded border overflow-auto max-h-32">
                      {error.stack}
                    </div>
                  </div>
                )}

                {process.env.NODE_ENV === 'development' && errorInfo?.componentStack && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700">Component Stack:</div>
                    <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded border overflow-auto max-h-32">
                      {errorInfo.componentStack}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {metadata?.context && (
          <div className="text-xs text-gray-400">
            Error occurred at {level} level
            {metadata.context.routeName && ` in ${metadata.context.routeName}`}
          </div>
        )}
      </div>
    </div>
  );
});

ErrorFallbackUI.displayName = 'ErrorFallbackUI';

export { ErrorFallbackUI };