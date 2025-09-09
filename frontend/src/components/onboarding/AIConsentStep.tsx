import React, { useState, useEffect } from 'react';
import { ArrowRight, SparklesIcon, ShieldCheckIcon, ExclamationTriangleIcon } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useConsentActions, useConsentSelectors } from '../../stores/consentStore';
import { ConsentType } from '../../types/consent';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';
import ConsentToggle from '../consent/ConsentToggle';

const AIConsentStep: React.FC = (): JSX.Element => {
  const {
    goToNextStep,
    skipCurrentStep,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiProcessingConsent, setAIProcessingConsent] = useState(false);
  const [dataAnonymizationConsent, setDataAnonymizationConsent] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { updateBatchConsents, initializeDefaultConsents } = useConsentActions();
  const { isInitialized, hasAIProcessingConsent, hasDataAnonymizationConsent } = useConsentSelectors();

  // Initialize consent state on component mount
  useEffect(() => {
    if (!hasInitialized) {
      initializeConsentsIfNeeded();
    }
  }, []);

  // Sync local state with store state
  useEffect(() => {
    if (isInitialized) {
      setAIProcessingConsent(hasAIProcessingConsent);
      setDataAnonymizationConsent(hasDataAnonymizationConsent);
      setHasInitialized(true);
    }
  }, [isInitialized, hasAIProcessingConsent, hasDataAnonymizationConsent]);

  const initializeConsentsIfNeeded = async () => {
    if (!isInitialized) {
      try {
        await initializeDefaultConsents();
      } catch (error) {
        console.warn('Failed to initialize default consents:', error);
        // Continue with local state
        setHasInitialized(true);
      }
    } else {
      setHasInitialized(true);
    }
  };

  const handleContinue = async (): Promise<void> => {
    try {
      clearError();
      setIsSubmitting(true);

      // Save consent preferences
      await updateBatchConsents([
        { type: ConsentType.AI_PROCESSING, granted: aiProcessingConsent },
        { type: ConsentType.DATA_ANONYMIZATION, granted: dataAnonymizationConsent }
      ], 'onboarding');

      console.log('AI consent preferences saved:', {
        aiProcessing: aiProcessingConsent,
        dataAnonymization: dataAnonymizationConsent
      });

      await goToNextStep();
    } catch (error) {
      console.error('Failed to save AI consent preferences:', error);
      // Continue with onboarding even if consent saving fails
      // The user can update preferences later in settings
      await goToNextStep();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      setIsSubmitting(true);

      // Set default preferences (AI disabled, anonymization enabled)
      await updateBatchConsents([
        { type: ConsentType.AI_PROCESSING, granted: false },
        { type: ConsentType.DATA_ANONYMIZATION, granted: true }
      ], 'onboarding');

      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to set default AI consent preferences:', error);
      // Continue with skip even if consent saving fails
      await skipCurrentStep();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAIProcessingToggle = (granted: boolean) => {
    setAIProcessingConsent(granted);
    
    // If enabling AI processing, ensure data anonymization is also enabled for privacy
    if (granted && !dataAnonymizationConsent) {
      setDataAnonymizationConsent(true);
    }
  };

  const handleDataAnonymizationToggle = (granted: boolean) => {
    setDataAnonymizationConsent(granted);
    
    // If disabling data anonymization, also disable AI processing for safety
    if (!granted && aiProcessingConsent) {
      setAIProcessingConsent(false);
    }
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <OnboardingStepHeader
          stepNumber={5}
          totalSteps={7}
          title="AI Features & Privacy"
          subtitle="Choose how you'd like AI to enhance your Link experience while protecting your privacy."
        />

        {error && (
          <ErrorMessage
            error={error}
            onRetry={() => clearError()}
            className="mb-4"
          />
        )}

        <OnboardingCard>
          <div className="space-y-6">
            {/* AI Features Overview */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-3">
                AI-Powered Features Available:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                <li className="flex items-center space-x-2">
                  <SparklesIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Conversation summaries to quickly catch up on chats</span>
                </li>
                <li className="flex items-center space-x-2">
                  <SparklesIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Chat insights and highlights for meaningful moments</span>
                </li>
                <li className="flex items-center space-x-2">
                  <SparklesIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Smart suggestions for conversation topics</span>
                </li>
                <li className="flex items-center space-x-2">
                  <SparklesIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Improved search and organization of your conversations</span>
                </li>
              </ul>
            </div>

            {/* Consent Toggles */}
            <div className="space-y-1 border-t border-gray-100 dark:border-gray-700 pt-4">
              <ConsentToggle
                consentType={ConsentType.AI_PROCESSING}
                label="Enable AI Processing"
                description="Allow AI to analyze your conversations for generating summaries, insights, and suggestions. Required to use AI features."
                value={aiProcessingConsent}
                onChange={handleAIProcessingToggle}
                loading={isSubmitting}
              />

              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <ConsentToggle
                  consentType={ConsentType.DATA_ANONYMIZATION}
                  label="Data Anonymization"
                  description="Anonymize your data before AI processing by removing names, personal details, and identifying information. Highly recommended for privacy."
                  value={dataAnonymizationConsent}
                  onChange={handleDataAnonymizationToggle}
                  loading={isSubmitting}
                />
              </div>
            </div>

            {/* Privacy Protection Notice */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ShieldCheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                    Your Privacy is Protected
                  </h4>
                  <ul className="text-sm text-green-800 dark:text-green-300 space-y-1">
                    <li>• All data is processed securely and never shared with third parties</li>
                    <li>• You can change these preferences anytime in your privacy settings</li>
                    <li>• Data anonymization removes personal information before AI processing</li>
                    <li>• You have full control over what AI features you use</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Warning when AI consent is not granted */}
            {!aiProcessingConsent && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                      Limited AI Features
                    </h4>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Without enabling AI processing, you won't be able to use conversation summaries, 
                      chat insights, or other AI-powered features. You can enable these anytime later in your settings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Success message when both consents are properly configured */}
            {aiProcessingConsent && dataAnonymizationConsent && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Perfect! AI Features Enabled
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      You'll have access to all AI features with maximum privacy protection through data anonymization. 
                      Start enjoying smarter conversation summaries and insights!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </OnboardingCard>

        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleSkip}
            disabled={isLoading || isSubmitting}
            className="ios-button-secondary px-4 py-2 disabled:opacity-50"
          >
            Skip for now
          </button>

          <button
            onClick={handleContinue}
            disabled={isLoading || isSubmitting || !hasInitialized}
            className="ios-button flex items-center space-x-2 px-6 py-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConsentStep;