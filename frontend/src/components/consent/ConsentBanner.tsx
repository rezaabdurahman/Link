import React, { useState } from 'react';
import { XMarkIcon, ShieldCheckIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { ConsentType } from '../../types/consent';
import { useConsentActions, useConsentSelectors } from '../../stores/consentStore';

interface ConsentBannerProps {
  onCustomize?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({
  onCustomize,
  onDismiss,
  className = ''
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const { isInitialized, hasAnyConsent } = useConsentSelectors();
  const { initializeDefaultConsents, enableAllOptional, disableAllOptional } = useConsentActions();

  // Don't show banner if user already has consents set up or is already dismissed
  if (!isInitialized || hasAnyConsent || isDismissed) {
    return null;
  }

  const handleAcceptAll = async () => {
    setIsSubmitting(true);
    try {
      await initializeDefaultConsents();
      await enableAllOptional();
      handleDismiss();
    } catch (error) {
      console.error('Failed to accept all consents:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectAll = async () => {
    setIsSubmitting(true);
    try {
      await initializeDefaultConsents();
      await disableAllOptional();
      handleDismiss();
    } catch (error) {
      console.error('Failed to reject optional consents:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomize = () => {
    if (onCustomize) {
      onCustomize();
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg
      ${className}
    `}>
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-start space-x-4">
          {/* Icon */}
          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
            <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Privacy & Cookie Preferences
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              We use cookies and similar technologies to enhance your experience, provide personalized content, 
              and analyze usage. You can customize your preferences or accept all to continue.
            </p>
            
            {/* Essential notice */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Essential cookies are always enabled to ensure the app functions properly.
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleAcceptAll}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Accept All'}
              </button>
              
              <button
                onClick={handleRejectAll}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Reject Optional'}
              </button>
              
              <button
                onClick={handleCustomize}
                disabled={isSubmitting}
                className="flex items-center space-x-1 px-3 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors disabled:opacity-75"
              >
                <Cog6ToothIcon className="h-4 w-4" />
                <span>Customize</span>
              </button>
              
              <button
                onClick={handleDismiss}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 text-sm underline transition-colors disabled:opacity-75"
              >
                Dismiss
              </button>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={handleDismiss}
            disabled={isSubmitting}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-75"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;