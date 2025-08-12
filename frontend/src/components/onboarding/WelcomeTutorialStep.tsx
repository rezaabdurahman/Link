// WelcomeTutorialStep - Final step of onboarding flow
// Welcomes user and completes onboarding

import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { getStepNumber, getStepDisplayName } from '../../services/onboardingClient';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';

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
    <div className="space-y-6">
      {/* Step Header */}
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500 mb-2">Step 7 of 7</p>
        <h1 className="text-2xl font-semibold text-gray-800">Welcome Tutorial</h1>
      </div>
      
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Welcome to Link, {user?.first_name}! 🎉
        </h2>
        <p className="text-lg text-gray-600">
          You're all set up and ready to start connecting!
        </p>
      </div>

      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      {/* Feature Highlights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Here's what you can do now:
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-700">Discover people nearby who share your interests</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-700">Start conversations and make meaningful connections</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-700">Join local events and activities</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-700">Customize your profile anytime in settings</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2">💡 Pro Tips:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Keep your profile updated to get better matches</li>
          <li>• Be genuine and authentic in your conversations</li>
          <li>• Don't hesitate to reach out to people who share your interests</li>
          <li>• Check out the opportunities section for local events</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center pt-6">
        <button
          onClick={handleComplete}
          disabled={isLoading || isCompleting}
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
