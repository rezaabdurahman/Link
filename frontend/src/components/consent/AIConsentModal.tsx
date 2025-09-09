import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  SparklesIcon, 
  ShieldCheckIcon, 
  ExclamationTriangleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { AIConsentModalProps, ConsentType } from '../../types/consent';
import { useConsentActions } from '../../stores/consentStore';
import ConsentToggle from './ConsentToggle';

export const AIConsentModal: React.FC<AIConsentModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  onDecline,
  loading = false,
  showDataAnonymization = true
}) => {
  const [aiProcessingConsent, setAIProcessingConsent] = useState(false);
  const [dataAnonymizationConsent, setDataAnonymizationConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { updateBatchConsents } = useConsentActions();

  const handleAccept = async () => {
    if (!aiProcessingConsent) {
      // User must explicitly consent to AI processing
      return;
    }

    setIsSubmitting(true);
    try {
      // Update consents via the store
      await updateBatchConsents([
        { type: ConsentType.AI_PROCESSING, granted: true },
        { type: ConsentType.DATA_ANONYMIZATION, granted: dataAnonymizationConsent }
      ], 'user_action');

      onAccept();
    } catch (error) {
      console.error('Failed to save consent preferences:', error);
      // Error is handled by the store, just continue
      onAccept();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    try {
      // Ensure AI processing is disabled
      await updateBatchConsents([
        { type: ConsentType.AI_PROCESSING, granted: false },
        { type: ConsentType.DATA_ANONYMIZATION, granted: dataAnonymizationConsent }
      ], 'user_action');

      onDecline();
    } catch (error) {
      console.error('Failed to save consent preferences:', error);
      // Still proceed with decline
      onDecline();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || loading) return;
    onClose();
  };

  const canAccept = aiProcessingConsent && !isSubmitting && !loading;
  const canDecline = !isSubmitting && !loading;

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      className="relative z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="relative w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl dark:bg-gray-800">
          
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isSubmitting || loading}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full dark:bg-blue-900">
                <SparklesIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI-Powered Features
                </Dialog.Title>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enhance your chat experience with AI
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                What AI features can do for you:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• Generate conversation summaries</li>
                <li>• Provide chat insights and highlights</li>
                <li>• Help organize your conversations</li>
                <li>• Suggest conversation topics</li>
              </ul>
            </div>
          </div>

          {/* Consent toggles */}
          <div className="px-6 pb-4 space-y-1 border-t border-gray-100 dark:border-gray-700 pt-4">
            <ConsentToggle
              consentType={ConsentType.AI_PROCESSING}
              label="Enable AI Processing"
              description="Allow AI to analyze your conversations for generating summaries and insights. Required to use AI features."
              required={true}
              value={aiProcessingConsent}
              onChange={setAIProcessingConsent}
              loading={loading}
            />

            {showDataAnonymization && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <ConsentToggle
                  consentType={ConsentType.DATA_ANONYMIZATION}
                  label="Data Anonymization"
                  description="Anonymize your data before AI processing for enhanced privacy protection. Highly recommended."
                  value={dataAnonymizationConsent}
                  onChange={setDataAnonymizationConsent}
                  loading={loading}
                />
              </div>
            )}
          </div>

          {/* Privacy notice */}
          <div className="px-6 pb-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <ShieldCheckIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Privacy Protection:</strong> Your data is processed securely and never shared with third parties. 
                    You can withdraw consent at any time in your privacy settings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning when AI consent is not granted */}
          {!aiProcessingConsent && (
            <div className="px-6 pb-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      AI features require your explicit consent. Without enabling AI processing, 
                      you won't be able to use conversation summaries and other AI-powered features.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-6 pb-6">
            <div className="flex space-x-3">
              <button
                onClick={handleAccept}
                disabled={!canAccept}
                className={`
                  flex-1 px-4 py-3 rounded-xl font-medium transition-all
                  ${canAccept
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  }
                  ${isSubmitting ? 'opacity-75' : ''}
                `}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Saving...
                  </div>
                ) : (
                  'Enable AI Features'
                )}
              </button>
              
              <button
                onClick={handleDecline}
                disabled={!canDecline}
                className={`
                  flex-1 px-4 py-3 rounded-xl font-medium transition-all
                  ${canDecline 
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  }
                  ${isSubmitting ? 'opacity-75' : ''}
                `}
              >
                {isSubmitting ? 'Saving...' : 'Not Now'}
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
              You can change these settings anytime in your privacy preferences.
            </p>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default AIConsentModal;