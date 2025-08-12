// BioStep - Second step of onboarding flow
// Allows users to write a bio/description about themselves

import React, { useState, useEffect } from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';

const BioStep: React.FC = (): JSX.Element => {
  const { user } = useAuth();
  const {
    goToNextStep,
    skipCurrentStep,
    updateUserProfile,
    currentStepData,
    setStepData,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [bio, setBio] = useState<string>(
    currentStepData.bio || user?.bio || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Character limit
  const maxLength = 300;
  const remainingChars = maxLength - bio.length;

  // Update step data when bio changes
  useEffect(() => {
    setStepData({ bio });
  }, [bio, setStepData]);

  // Sample bio suggestions
  const suggestions = [
    "Coffee lover ☕ Always up for new adventures and meeting interesting people!",
    "Tech enthusiast who enjoys hiking, reading, and discovering local food spots.",
    "Creative soul passionate about music, art, and meaningful conversations.",
    "Fitness enthusiast who loves trying new workouts and exploring the outdoors.",
    "Bookworm and travel lover always planning the next adventure.",
    "Foodie who enjoys cooking, trying new restaurants, and sharing good meals with friends.",
  ];

  // Handle continue
  const handleContinue = async (): Promise<void> => {
    try {
      clearError();
      setIsSubmitting(true);

      // Update profile with bio
      if (bio.trim()) {
        await updateUserProfile({
          bio: bio.trim(),
        });
      }

      // Proceed to next step
      await goToNextStep();
    } catch (error) {
      console.error('Failed to update bio:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip this step
  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to skip bio step:', error);
    }
  };

  // Use a suggestion
  const handleUseSuggestion = (suggestion: string): void => {
    setBio(suggestion);
  };

  return (
    <div className="w-full space-y-10">
      {/* Step Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-full text-sm font-medium mb-4">
          <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold">2</span>
          <span>Step 2 of 7</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Tell us about yourself</h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Write a short bio to help others get to know you. What makes you unique and interesting?
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      {/* Bio Input - Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
        {/* Left Column - Bio Input */}
        <div className="space-y-6">
          <div className="relative">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="I'm passionate about... I love to... You can find me..."
              className="w-full h-48 px-6 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-lg leading-relaxed transition-all duration-200 bg-white shadow-sm"
              maxLength={maxLength}
              disabled={isLoading || isSubmitting}
            />
            <div className={`absolute bottom-4 right-4 text-sm font-medium px-2 py-1 rounded-full ${
              remainingChars < 20 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'
            }`}>
              {remainingChars} left
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start space-x-4">
              <Lightbulb className="w-6 h-6 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-blue-800 mb-3">Tips for a great bio:</p>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• Share your hobbies and interests</li>
                  <li>• Mention what you're looking for in connections</li>
                  <li>• Keep it friendly and authentic</li>
                  <li>• Add some personality with emojis if you'd like</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Suggestions */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">
            Need inspiration? Try one of these:
          </h3>
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleUseSuggestion(suggestion)}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-base text-gray-700 hover:shadow-md"
                disabled={isLoading || isSubmitting}
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-8">
        <button
          onClick={handleSkip}
          disabled={isLoading || isSubmitting}
          className="px-6 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50 font-medium"
        >
          Skip this step
        </button>

        <button
          onClick={handleContinue}
          disabled={isLoading || isSubmitting}
          className="flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl font-semibold text-lg"
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

export default BioStep;
