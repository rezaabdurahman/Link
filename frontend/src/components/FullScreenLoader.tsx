// FullScreenLoader - Global loading component for app initialization and auth bootstrap
// Displays a full-screen loading state with iOS-like design and animations

import React from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';

interface FullScreenLoaderProps {
  /** Loading message to display */
  message?: string;
  /** Whether to show a detailed loading state */
  showDetails?: boolean;
  /** Custom icon component to display */
  icon?: React.ComponentType<{ className?: string }>;
  /** Whether the loader should animate */
  animate?: boolean;
  /** Loading stage for different messages */
  stage?: 'initializing' | 'authenticating' | 'loading' | 'connecting' | 'error';
  /** Error message if stage is 'error' */
  errorMessage?: string;
  /** Retry function for error state */
  onRetry?: () => void;
}

/**
 * Get appropriate message and icon for loading stage
 */
const getStageContent = (stage: FullScreenLoaderProps['stage']): {
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
} => {
  switch (stage) {
    case 'initializing':
      return {
        message: 'Starting up...',
        icon: Loader2,
        description: 'Initializing application',
      };
    case 'authenticating':
      return {
        message: 'Signing you in...',
        icon: Loader2,
        description: 'Verifying your credentials',
      };
    case 'connecting':
      return {
        message: 'Connecting...',
        icon: Wifi,
        description: 'Establishing secure connection',
      };
    case 'error':
      return {
        message: 'Connection failed',
        icon: WifiOff,
        description: 'Unable to connect to our servers',
      };
    case 'loading':
    default:
      return {
        message: 'Loading...',
        icon: Loader2,
        description: 'Preparing your experience',
      };
  }
};

/**
 * Pulsing dots animation component
 */
const PulsingDots: React.FC = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-aqua rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
    <div className="w-2 h-2 bg-aqua rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
    <div className="w-2 h-2 bg-aqua rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
  </div>
);

/**
 * FullScreenLoader component for app-wide loading states
 */
const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  message,
  showDetails = false,
  icon: CustomIcon,
  animate = true,
  stage = 'loading',
  errorMessage,
  onRetry,
}) => {
  const stageContent = getStageContent(stage);
  const displayMessage = message || stageContent.message;
  const IconComponent = CustomIcon || stageContent.icon;
  const isError = stage === 'error';

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-white to-slate-50 flex items-center justify-center z-50">
      {/* Background pattern for visual interest */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-aqua/10 via-transparent to-accent-copper/10" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-aqua/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent-copper/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
        {/* App logo area - can be replaced with actual logo */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-aqua to-aqua-dark rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">L</span>
          </div>
          <div className="text-sm font-medium text-text-secondary">Link</div>
        </div>

        {/* Loading icon */}
        <div className="mb-6">
          <div className={`w-12 h-12 flex items-center justify-center rounded-full ${
            isError ? 'bg-red-100' : 'bg-aqua/10'
          }`}>
            <IconComponent 
              className={`w-6 h-6 ${
                isError ? 'text-red-500' : 'text-aqua'
              } ${
                animate && !isError ? 'animate-spin' : ''
              }`} 
            />
          </div>
        </div>

        {/* Loading message */}
        <div className="mb-4">
          <h2 className={`text-lg font-semibold mb-2 ${
            isError ? 'text-red-600' : 'text-text-primary'
          }`}>
            {displayMessage}
          </h2>
          
          {showDetails && !isError && (
            <p className="text-text-secondary text-sm">
              {stageContent.description}
            </p>
          )}

          {isError && errorMessage && (
            <p className="text-red-500 text-sm">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Loading animation */}
        {!isError && animate && (
          <div className="mb-6">
            <PulsingDots />
          </div>
        )}

        {/* Error state actions */}
        {isError && onRetry && (
          <div className="mt-6">
            <button 
              onClick={onRetry}
              className="ios-button px-6 py-2 text-sm"
              type="button"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Additional context for different stages */}
        {showDetails && !isError && (
          <div className="mt-6 space-y-2 text-xs text-text-secondary">
            {stage === 'initializing' && (
              <p>Setting up your personalized experience...</p>
            )}
            {stage === 'authenticating' && (
              <p>Securely logging you into your account...</p>
            )}
            {stage === 'connecting' && (
              <p>Establishing connection to our servers...</p>
            )}
            {stage === 'loading' && (
              <p>Loading your data and preferences...</p>
            )}
          </div>
        )}

        {/* Progress indicator */}
        {!isError && animate && (
          <div className="mt-8 w-full max-w-xs">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-aqua to-aqua-dark rounded-full animate-pulse" 
                   style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Accessibility: Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {displayMessage}
        {showDetails && !isError && ` - ${stageContent.description}`}
      </div>
    </div>
  );
};

export default FullScreenLoader;
