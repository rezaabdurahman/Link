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
  console.log('🔧 OnboardingPage: Component rendering...');
  
  const { user, isAuthenticated } = useAuth();
  const onboardingData = useOnboarding();
  
  console.log('🔧 OnboardingPage: Auth state check:', {
    isAuthenticated,
    user: user?.id,
    userObj: user
  });
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
  } = onboardingData;

  // Debug ALL onboarding data at the start of each render
  console.log('🔧 OnboardingPage: Full onboarding data:', {
    status,
    isLoading,
    error,
    isInitialized,
    isCompleted,
    isSkipped,
    progress,
    user: user?.id,
    isAuthenticated
  });

  // Auto-start onboarding if user hasn't started yet
  useEffect(() => {
    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 OnboardingPage: State check:', {
        isInitialized,
        statusValue: status?.status,
        currentStep: status?.current_step,
        isLoading,
        isCompleted,
        isSkipped,
        progress: Math.round(progress)
      });
    }

    if (isInitialized && status?.status === 'not_started' && !isLoading) {
      console.log('🚀 OnboardingPage: Auto-starting onboarding flow...');
      
      // Add a small delay to prevent race conditions
      const timer = setTimeout(() => {
        startOnboardingFlow()
          .then(() => {
            console.log('✅ OnboardingPage: Successfully started onboarding flow');
          })
          .catch((error) => {
            console.error('❌ OnboardingPage: Failed to start onboarding flow:', error);
          });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialized, status?.status, isLoading, startOnboardingFlow, isCompleted, isSkipped]);

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Debug computed values BEFORE redirect check - with detailed breakdown
  console.log('🔍 OnboardingPage: RENDER CHECKPOINT - Detailed redirect check:', {
    timestamp: new Date().toISOString(),
    windowLocation: window.location.href,
    isInitialized,
    status: status,
    statusValue: status?.status,
    isCompleted: status?.status === 'completed',
    isSkipped: status?.status === 'skipped',
    computedIsCompleted: isCompleted,
    computedIsSkipped: isSkipped,
    willRedirect: isInitialized && (isCompleted || isSkipped),
    redirectCondition: {
      initialized: isInitialized,
      completed: isCompleted,
      skipped: isSkipped,
      logicalOr: isCompleted || isSkipped,
      finalResult: isInitialized && (isCompleted || isSkipped)
    }
  });

  // FIXED: Only redirect when we have a definitive status and it's truly complete/skipped
  // AND we're not in the middle of an auth state transition
  // IMPORTANT: Also check that we're actually on the onboarding page to prevent redirect loops
  const shouldRedirect = isAuthenticated &&  // Ensure we're fully authenticated
                          user !== null &&     // Ensure we have user data
                          isInitialized &&     // Ensure onboarding context is initialized  
                          status !== null &&   // Ensure we have status data
                          (status.status === 'completed' || status.status === 'skipped') && // Only if truly complete/skipped
                          !isLoading &&        // Don't redirect if still loading
                          window.location.pathname === '/onboarding'; // Only redirect if actually on onboarding page
  
  console.log('🔍 OnboardingPage: REDIRECT DECISION:', {
    shouldRedirect,
    reasons: {
      isAuthenticated: isAuthenticated,
      userNotNull: user !== null,
      isInitialized: isInitialized,
      statusNotNull: status !== null,
      statusCompleted: status?.status === 'completed',
      statusSkipped: status?.status === 'skipped',
      statusCombined: status?.status === 'completed' || status?.status === 'skipped',
      notLoading: !isLoading
    }
  });
  
  if (shouldRedirect) {
    console.log('🚨 OnboardingPage: REDIRECTING to discovery because:', {
      reason: status?.status === 'completed' ? 'status=completed' : 'status=skipped',
      status: status?.status,
      isCompleted,
      isSkipped,
      isInitialized,
      fullStatus: status
    });
    return <Navigate to="/discovery" replace />;
  }

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

  // Handle case where onboarding is in progress but no current step is set
  if (!status?.current_step) {
    const isInProgress = status?.status === 'in_progress';
    
    return (
      <OnboardingLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">
            {isInProgress ? 'Continue Your Setup' : 'Welcome to Link!'}
          </h2>
          <p className="text-text-secondary mb-8">
            {isInProgress 
              ? 'Let\'s continue setting up your profile.' 
              : 'Let\'s get you set up with a few quick questions.'
            }
          </p>
          <button
            onClick={() => {
              console.log('🔧 OnboardingPage: Manual start button clicked');
              startOnboardingFlow();
            }}
            disabled={isLoading}
            className="ios-button-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Starting...</span>
              </div>
            ) : (
              isInProgress ? 'Continue Setup' : 'Get Started'
            )}
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
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Bar */}
        <div className="w-full mb-4 sm:mb-6">
          <OnboardingProgressBar progress={progress} />
        </div>
        
        {/* Current Step Component */}
        <div className="ios-card p-6 sm:p-8 lg:p-10 min-h-[500px] sm:min-h-[600px]">
          {renderStepComponent(status.current_step)}
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingPage;
