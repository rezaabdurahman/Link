// BioStep - Second step of onboarding flow
// Allows users to write a bio/description about themselves

import React, { useState, useEffect } from 'react';
import { ArrowRight, User, Lightbulb } from 'lucide-react';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Tell Us About Yourself
        </h2>
        <p className="text-gray-600">
          Write a short bio to help others get to know you. What makes you unique?
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

      {/* Bio Input */}
      <div className="space-y-4">
        <div className="relative">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="I'm passionate about... I love to... You can find me..."
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            maxLength={maxLength}
            disabled={isLoading || isSubmitting}
          />
          <div className={`absolute bottom-3 right-3 text-sm ${
            remainingChars < 20 ? 'text-red-500' : 'text-gray-400'
          }`}>
            {remainingChars} characters left
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 mb-1">Tips for a great bio:</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Share your hobbies and interests</li>
                <li>• Mention what you're looking for in connections</li>
                <li>• Keep it friendly and authentic</li>
                <li>• Add some personality with emojis if you'd like</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Need inspiration? Try one of these:
          </h3>
          <div className="grid gap-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleUseSuggestion(suggestion)}
                className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-gray-700"
                disabled={isLoading || isSubmitting}
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6">
        <button
          onClick={handleSkip}
          disabled={isLoading || isSubmitting}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          Skip this step
        </button>

        <button
          onClick={handleContinue}
          disabled={isLoading || isSubmitting}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
