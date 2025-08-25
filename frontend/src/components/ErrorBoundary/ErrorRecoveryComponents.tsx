import React, { useState, useEffect } from 'react';
import { ErrorMetadata } from '../../utils/errorTypes';

export const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [, setLastOnlineTime] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(Date.now());
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      setLastOnlineTime(Date.now());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 shadow-lg">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-yellow-800">
              No internet connection
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Some features may not work properly while offline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ChunkLoadingRecoveryProps {
  onRetry: () => void;
  onReload: () => void;
  error?: Error;
}

export const ChunkLoadingRecovery: React.FC<ChunkLoadingRecoveryProps> = ({
  onRetry,
  onReload,
  error
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      onReload();
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClearCache = async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
        onReload();
      } catch (error) {
        console.error('Failed to clear cache:', error);
        onReload();
      }
    } else {
      onReload();
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Loading Error
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          Failed to load part of the application. This might be due to a poor connection or outdated cache.
        </p>
      </div>

      {process.env.NODE_ENV === 'development' && error && (
        <div className="p-3 bg-orange-50 rounded border border-orange-200 text-left text-xs">
          <p className="font-mono text-orange-700">{error.message}</p>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRetrying ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Retrying...
            </div>
          ) : retryCount >= maxRetries ? (
            'Reload Page'
          ) : (
            `Try Again (${maxRetries - retryCount} attempts left)`
          )}
        </button>

        <button
          onClick={handleClearCache}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
        >
          Clear Cache & Reload
        </button>
      </div>

      <div className="text-xs text-gray-500">
        <p>If this persists, try:</p>
        <ul className="mt-1 space-y-1 text-left">
          <li>• Check your internet connection</li>
          <li>• Refresh the page (Ctrl+F5 or Cmd+R)</li>
          <li>• Clear your browser cache</li>
          <li>• Try a different browser</li>
        </ul>
      </div>
    </div>
  );
};

interface ErrorRecoverySuggestionsProps {
  metadata: ErrorMetadata;
  onAction: (action: string) => void;
}

export const ErrorRecoverySuggestions: React.FC<ErrorRecoverySuggestionsProps> = ({
  metadata,
  onAction
}) => {
  const getSuggestions = () => {
    const suggestions = [];

    switch (metadata.type) {
      case 'network':
        suggestions.push(
          { id: 'check-connection', text: 'Check your internet connection', action: 'check-connection' },
          { id: 'retry-request', text: 'Retry the request', action: 'retry' },
          { id: 'work-offline', text: 'Continue working offline', action: 'offline-mode' }
        );
        break;

      case 'authentication':
        suggestions.push(
          { id: 'login-again', text: 'Log in again', action: 're-authenticate' },
          { id: 'clear-session', text: 'Clear session data', action: 'clear-session' },
          { id: 'contact-support', text: 'Contact support', action: 'contact-support' }
        );
        break;

      case 'permission':
        suggestions.push(
          { id: 'request-permission', text: 'Request necessary permissions', action: 'request-permission' },
          { id: 'contact-admin', text: 'Contact your administrator', action: 'contact-admin' },
          { id: 'use-different-account', text: 'Try a different account', action: 'switch-account' }
        );
        break;

      case 'validation':
        suggestions.push(
          { id: 'check-input', text: 'Check your input and try again', action: 'validate-input' },
          { id: 'reset-form', text: 'Reset the form', action: 'reset-form' },
          { id: 'see-examples', text: 'See valid examples', action: 'show-examples' }
        );
        break;

      default:
        suggestions.push(
          { id: 'refresh-page', text: 'Refresh the page', action: 'refresh' },
          { id: 'try-different-browser', text: 'Try a different browser', action: 'different-browser' },
          { id: 'clear-browser-data', text: 'Clear browser data', action: 'clear-data' }
        );
    }

    suggestions.push(
      { id: 'report-issue', text: 'Report this issue', action: 'report' }
    );

    return suggestions;
  };

  const suggestions = getSuggestions();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h4 className="font-medium text-blue-900 mb-2">Suggested solutions:</h4>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <button
              onClick={() => onAction(suggestion.action)}
              className="text-left text-sm text-blue-700 hover:text-blue-900 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              {suggestion.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface RecoveryProgressProps {
  isRecovering: boolean;
  progress?: number;
  message?: string;
}

export const RecoveryProgress: React.FC<RecoveryProgressProps> = ({
  isRecovering,
  progress = 0,
  message = 'Recovering...'
}) => {
  if (!isRecovering) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg className="animate-spin w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Recovering from Error
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            {message}
          </p>
          
          {progress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
          
          <p className="text-xs text-gray-500">
            Please wait while we attempt to recover...
          </p>
        </div>
      </div>
    </div>
  );
};

interface ErrorTrendIndicatorProps {
  errorCount: number;
  timeframe: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  onClearErrors?: () => void;
}

export const ErrorTrendIndicator: React.FC<ErrorTrendIndicatorProps> = ({
  errorCount,
  timeframe,
  severity,
  onClearErrors
}) => {
  if (errorCount <= 1) {
    return null;
  }

  const severityColors = {
    low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-400' },
    medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-400' },
    high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: 'text-orange-400' },
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-400' }
  };

  const colors = severityColors[severity];

  return (
    <div className={`p-3 ${colors.bg} ${colors.border} border rounded-lg mb-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <svg className={`w-5 h-5 ${colors.icon} mt-0.5 mr-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className={`text-sm font-medium ${colors.text}`}>
              Multiple errors detected
            </p>
            <p className={`text-xs ${colors.text.replace('800', '600')} mt-1`}>
              {errorCount} errors occurred in the {timeframe}
            </p>
          </div>
        </div>
        
        {onClearErrors && (
          <button
            onClick={onClearErrors}
            className={`text-xs ${colors.text} hover:${colors.text.replace('800', '900')} underline focus:outline-none`}
          >
            Clear
          </button>
        )}
      </div>
      
      <div className="mt-3 text-xs text-gray-600">
        <p>This might indicate a larger issue. Consider:</p>
        <ul className="mt-1 ml-4 space-y-1 list-disc">
          <li>Refreshing the page</li>
          <li>Checking your internet connection</li>
          <li>Clearing browser cache</li>
          <li>Contacting support if the issue persists</li>
        </ul>
      </div>
    </div>
  );
};