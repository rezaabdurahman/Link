// WelcomeTutorialStep - Final step of onboarding flow
// Welcomes user and completes onboarding

import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

const WelcomeTutorialStep: React.FC = (): JSX.Element => {
  const { user } = useAuth();
  const {
    completeOnboardingFlow,
    skipCurrentStep,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async (): Promise<void> => {
    try {
      clearError();
      setIsCompleting(true);
      await completeOnboardingFlow();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to skip welcome tutorial step:', error);
    }
  };

  return (
    <div className="w-full space-y-10">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-r from-aqua to-aqua-dark rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <OnboardingStepHeader
          stepNumber={7}
          totalSteps={7}
          title={`Welcome to Link, ${user?.first_name}! 🎉`}
          subtitle="You're all set up and ready to start connecting with amazing people!"
        />
      </div>

      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
        {/* Left Column - Features */}
        <OnboardingCard className="bg-gradient-to-r from-aqua/10 to-aqua/20">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            Here's what you can do now:
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-aqua rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Discover people nearby who share your interests</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-aqua rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Start conversations and make meaningful connections</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-aqua rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Join local events and activities</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-aqua rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Customize your profile anytime in settings</span>
            </div>
          </div>
        </OnboardingCard>

        {/* Right Column - Tips */}
        <OnboardingCard className="bg-accent-copper/10 border-2 border-accent-copper/20">
          <h4 className="text-2xl font-bold text-accent-copper mb-6">💡 Pro Tips:</h4>
          <ul className="text-lg text-accent-copper space-y-3">
            <li>• Keep your profile updated to get better matches</li>
            <li>• Be genuine and authentic in your conversations</li>
            <li>• Don't hesitate to reach out to people who share your interests</li>
            <li>• Check out the opportunities section for local events</li>
          </ul>
        </OnboardingCard>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center pt-8">
        <button
          onClick={handleComplete}
          disabled={isLoading || isCompleting}
          className="ios-button flex items-center space-x-3 px-10 py-5 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl"
        >
          {isCompleting ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Completing setup...</span>
            </>
          ) : (
            <>
              <span>Start Exploring Link!</span>
              <Sparkles className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {/* Skip Option */}
      <div className="text-center">
        <button
          onClick={handleSkip}
          disabled={isLoading || isCompleting}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          Skip tutorial and continue
        </button>
      </div>
    </div>
  );
};

export default WelcomeTutorialStep;
