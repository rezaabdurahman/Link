// BioStep - Second step of onboarding flow
// Allows users to write a bio/description about themselves

import React, { useState, useEffect } from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

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
    <div className="w-full space-y-10 fade-in">
      <OnboardingStepHeader
        stepNumber={2}
        totalSteps={7}
        title="Tell us about yourself"
        subtitle="Write a short bio to help others get to know you. What makes you unique and interesting?"
      />

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
              className="ios-text-field w-full h-48 px-6 py-4 resize-none text-lg leading-relaxed focus:hover-glow"
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
          <OnboardingCard className="bg-aqua/10 border border-aqua/20">
            <div className="flex items-start space-x-4">
              <Lightbulb className="w-6 h-6 text-aqua mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-aqua mb-3">Tips for a great bio:</p>
                <ul className="text-sm text-aqua space-y-2">
                  <li>• Share your hobbies and interests</li>
                  <li>• Mention what you're looking for in connections</li>
                  <li>• Keep it friendly and authentic</li>
                  <li>• Add some personality with emojis if you'd like</li>
                </ul>
              </div>
            </div>
          </OnboardingCard>
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
                className="w-full text-left p-4 border-2 border-white/10 rounded-2xl hover:border-aqua/30 hover:bg-aqua/10 transition-all duration-200 text-base text-gray-700 hover:shadow-md hover-scale"
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
          className="ios-button-secondary px-6 py-3 font-medium disabled:opacity-50 hover-scale"
        >
          Skip this step
        </button>

        <button
          onClick={handleContinue}
          disabled={isLoading || isSubmitting}
          className="ios-button flex items-center space-x-3 px-8 py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover-glow hover-scale"
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
