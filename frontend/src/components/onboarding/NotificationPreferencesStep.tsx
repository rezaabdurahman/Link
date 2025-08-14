// NotificationPreferencesStep - Notification preferences step of onboarding flow
// Basic component for notification settings

import React, { useState } from 'react';
import { ArrowRight, Bell } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

const NotificationPreferencesStep: React.FC = (): JSX.Element => {
  const {
    goToNextStep,
    skipCurrentStep,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async (): Promise<void> => {
    try {
      clearError();
      setIsSubmitting(true);
      await goToNextStep();
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to skip notification preferences step:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-accent-copper/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-accent-copper" />
        </div>
      </div>
      
      <OnboardingStepHeader
        stepNumber={5}
        totalSteps={7}
        title="Notification Settings"
        subtitle="Choose how you want to stay connected and receive updates."
      />

      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      <OnboardingCard className="text-center">
        <p className="text-text-secondary">Notification preferences coming soon...</p>
      </OnboardingCard>

      <div className="flex justify-between items-center pt-6">
        <button
          onClick={handleSkip}
          disabled={isLoading || isSubmitting}
          className="ios-button-secondary px-4 py-2 disabled:opacity-50"
        >
          Skip this step
        </button>

        <button
          onClick={handleContinue}
          disabled={isLoading || isSubmitting}
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
  );
};

export default NotificationPreferencesStep;
