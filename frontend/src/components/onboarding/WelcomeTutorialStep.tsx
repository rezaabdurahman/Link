// WelcomeTutorialStep - Final step of onboarding flow
// Welcomes user and completes onboarding

import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
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
    <div className="w-full space-y-10">
      {/* Step Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-2 rounded-full text-sm font-medium mb-4">
          <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold">7</span>
          <span>Step 7 of 7</span>
        </div>
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Welcome to Link, {user?.first_name}! 🎉
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            You're all set up and ready to start connecting with amazing people!
          </p>
        </div>
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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 space-y-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            Here's what you can do now:
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Discover people nearby who share your interests</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Start conversations and make meaningful connections</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Join local events and activities</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg text-gray-700">Customize your profile anytime in settings</span>
            </div>
          </div>
        </div>

        {/* Right Column - Tips */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 space-y-6">
          <h4 className="text-2xl font-bold text-yellow-800 mb-6">💡 Pro Tips:</h4>
          <ul className="text-lg text-yellow-700 space-y-3">
            <li>• Keep your profile updated to get better matches</li>
            <li>• Be genuine and authentic in your conversations</li>
            <li>• Don't hesitate to reach out to people who share your interests</li>
            <li>• Check out the opportunities section for local events</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center pt-8">
        <button
          onClick={handleComplete}
          disabled={isLoading || isCompleting}
          className="flex items-center space-x-3 bg-gradient-to-r from-green-500 to-blue-600 text-white px-10 py-5 rounded-2xl hover:from-green-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-xl hover:shadow-2xl font-bold text-xl"
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
