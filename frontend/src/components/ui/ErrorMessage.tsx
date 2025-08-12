// ErrorMessage - Standardized error feedback component
// Displays user-friendly error messages with retry option

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  error: string | Error | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  title?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  retryLabel = 'Retry',
  className = '',
  title = 'An Error Occurred',
}): JSX.Element => {
  if (!error) return <></>;

  // Extract error message
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div
      className={`bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className="flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          <p className="text-sm font-semibold mb-1">
            {title}
          </p>
          <p className="text-sm text-red-600">
            {message}
          </p>
        </div>

        {/* Retry Button */}
        {onRetry && (
          <div className="ml-4">
            <button
              onClick={onRetry}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium bg-red-100 text-red-700 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              aria-label={retryLabel}
            >
              <RefreshCw className="w-4 h-4" />
              <span>{retryLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
