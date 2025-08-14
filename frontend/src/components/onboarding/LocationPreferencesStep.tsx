// LocationPreferencesStep - Location preferences step of onboarding flow
// Basic component for location settings

import React, { useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

const LocationPreferencesStep: React.FC = (): JSX.Element => {
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
      console.error('Failed to update location preferences:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to skip location preferences step:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-aqua/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-aqua" />
        </div>
      </div>
      
      <OnboardingStepHeader
        stepNumber={4}
        totalSteps={7}
        title="Location Settings"
        subtitle="Set your location preferences for connecting with nearby people."
      />

      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      <OnboardingCard className="text-center">
        <p className="text-text-secondary">Location preferences coming soon...</p>
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

export default LocationPreferencesStep;
