// OnboardingPage - Main onboarding flow component
// Renders the appropriate step component based on current onboarding status

import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { OnboardingStepType } from '../services/onboardingClient';

// Step Components
import ProfilePictureStep from '../components/onboarding/ProfilePictureStep';
import BioStep from '../components/onboarding/BioStep';
import InterestsStep from '../components/onboarding/InterestsStep';
import LocationPreferencesStep from '../components/onboarding/LocationPreferencesStep';
import PrivacySettingsStep from '../components/onboarding/PrivacySettingsStep';
import NotificationPreferencesStep from '../components/onboarding/NotificationPreferencesStep';
import WelcomeTutorialStep from '../components/onboarding/WelcomeTutorialStep';

// UI Components
import OnboardingLayout from '../components/onboarding/OnboardingLayout';
import OnboardingProgressBar from '../components/onboarding/OnboardingProgressBar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';

const OnboardingPage: React.FC = (): JSX.Element => {
  const { user, isAuthenticated } = useAuth();
  const { 
    status, 
    isLoading, 
    error, 
    isInitialized,
    startOnboardingFlow,
    clearError,
    isCompleted,
    isSkipped,
    progress
  } = useOnboarding();

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect if onboarding is completed or skipped
  if (isInitialized && (isCompleted || isSkipped)) {
    return <Navigate to="/discovery" replace />;
  }

  // Auto-start onboarding if user hasn't started yet
  useEffect(() => {
    if (isInitialized && status?.status === 'not_started') {
      startOnboardingFlow().catch(console.error);
    }
  }, [isInitialized, status?.status, startOnboardingFlow]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <OnboardingLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </OnboardingLayout>
    );
  }

  // Show error if something went wrong
  if (error) {
    return (
      <OnboardingLayout>
        <div className="max-w-md mx-auto">
          <ErrorMessage 
            error={error}
            onRetry={clearError}
            retryLabel="Try Again"
          />
        </div>
      </OnboardingLayout>
    );
  }

  // Show loading during operations
  if (isLoading) {
    return (
      <OnboardingLayout>
        <OnboardingProgressBar progress={progress} />
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </OnboardingLayout>
    );
  }

  // Show message if no current step
  if (!status?.current_step) {
    return (
      <OnboardingLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Welcome to Link!
          </h2>
          <p className="text-gray-600 mb-8">
            Let's get you set up with a few quick questions.
          </p>
          <button
            onClick={startOnboardingFlow}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </button>
        </div>
      </OnboardingLayout>
    );
  }

  // Render appropriate step component
  const renderStepComponent = (step: OnboardingStepType): JSX.Element => {
    switch (step) {
      case 'profile_picture':
        return <ProfilePictureStep />;
      case 'bio':
        return <BioStep />;
      case 'interests':
        return <InterestsStep />;
      case 'location_preferences':
        return <LocationPreferencesStep />;
      case 'privacy_settings':
        return <PrivacySettingsStep />;
      case 'notification_preferences':
        return <NotificationPreferencesStep />;
      case 'welcome_tutorial':
        return <WelcomeTutorialStep />;
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">
              Unknown step: {step}
            </p>
          </div>
        );
    }
  };

  return (
    <OnboardingLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-16">
        {/* Progress Bar */}
        <div className="w-full max-w-none">
          <OnboardingProgressBar progress={progress} />
        </div>
        
        {/* Current Step Component */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 sm:p-10 lg:p-12 min-h-[600px] mt-6 backdrop-blur-sm">
          {renderStepComponent(status.current_step)}
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingPage;
