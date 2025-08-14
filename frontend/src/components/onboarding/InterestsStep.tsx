// InterestsStep - Third step of onboarding flow
// Allows users to select their interests from predefined categories

import React, { useState, useEffect } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

const InterestsStep: React.FC = (): JSX.Element => {
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

  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    currentStepData.interests || []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined interest categories
  const interestCategories = {
    'Food & Drink': [
      'Cooking', 'Coffee', 'Wine Tasting', 'Craft Beer', 'Restaurants', 'Baking',
      'Food Photography', 'Street Food', 'Vegetarian', 'International Cuisine'
    ],
    'Sports & Fitness': [
      'Running', 'Yoga', 'Gym', 'Swimming', 'Cycling', 'Hiking',
      'Tennis', 'Basketball', 'Soccer', 'Rock Climbing', 'Martial Arts'
    ],
    'Arts & Culture': [
      'Photography', 'Painting', 'Music', 'Movies', 'Theater', 'Museums',
      'Dance', 'Writing', 'Reading', 'Concerts', 'Art Galleries'
    ],
    'Technology': [
      'Programming', 'Startups', 'AI/ML', 'Gaming', 'Tech News', 'Gadgets',
      'Web Development', 'Cryptocurrency', 'VR/AR', 'Robotics'
    ],
    'Travel & Adventure': [
      'Travel', 'Backpacking', 'Camping', 'Road Trips', 'Adventure Sports',
      'Scuba Diving', 'Skiing', 'Mountaineering', 'Cultural Exploration'
    ],
    'Social & Lifestyle': [
      'Networking', 'Volunteering', 'Fashion', 'Wellness', 'Mindfulness',
      'Personal Development', 'Sustainability', 'Politics', 'Philosophy'
    ],
    'Hobbies': [
      'Gardening', 'Board Games', 'Chess', 'Puzzles', 'Crafting',
      'Collecting', 'Astronomy', 'Language Learning', 'Podcasts'
    ]
  };

  // Flatten all interests for search
  const allInterests = Object.values(interestCategories).flat();

  // Filter interests based on search
  const filteredInterests = searchQuery
    ? allInterests.filter(interest =>
        interest.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Update step data when interests change
  useEffect(() => {
    setStepData({ interests: selectedInterests });
  }, [selectedInterests, setStepData]);

  // Toggle interest selection
  const toggleInterest = (interest: string): void => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  // Handle continue
  const handleContinue = async (): Promise<void> => {
    try {
      clearError();
      setIsSubmitting(true);

      // Update profile with interests
      if (selectedInterests.length > 0) {
        await updateUserProfile({
          interests: selectedInterests,
        });
      }

      // Proceed to next step
      await goToNextStep();
    } catch (error) {
      console.error('Failed to update interests:', error);
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
      console.error('Failed to skip interests step:', error);
    }
  };

  return (
    <div className="w-full space-y-8 fade-in">
      <OnboardingStepHeader
        stepNumber={3}
        totalSteps={7}
        title="What Are You Into?"
        subtitle="Select your interests to help us connect you with like-minded people. Choose as many as you like!"
      />

      {/* Error Message */}
      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      {/* Selected Count */}
      {selectedInterests.length > 0 && (
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-aqua/20 text-aqua">
            {selectedInterests.length} interest{selectedInterests.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search interests..."
          className="ios-text-field block w-full pl-10 pr-3 py-2"
        />
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Search Results:</h3>
          <div className="flex flex-wrap gap-2">
            {filteredInterests.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-colors hover-scale ${
                  selectedInterests.includes(interest)
                    ? 'bg-aqua text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isLoading || isSubmitting}
              >
                {interest}
                {selectedInterests.includes(interest) && ' ✓'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interest Categories */}
      {!searchQuery && (
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {Object.entries(interestCategories).map(([category, interests]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2 rounded-full text-sm font-medium transition-colors hover-scale ${
                      selectedInterests.includes(interest)
                        ? 'bg-aqua text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={isLoading || isSubmitting}
                  >
                    {interest}
                    {selectedInterests.includes(interest) && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Interests Summary */}
      {selectedInterests.length > 0 && (
        <OnboardingCard className="bg-aqua/10 border border-aqua/20">
          <h3 className="text-sm font-medium text-aqua mb-2">
            Your Selected Interests:
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedInterests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-aqua/20 text-aqua"
              >
                {interest}
                <button
                  onClick={() => toggleInterest(interest)}
                  className="ml-1 text-aqua hover:text-aqua-dark"
                  disabled={isLoading || isSubmitting}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </OnboardingCard>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6">
        <button
          onClick={handleSkip}
          disabled={isLoading || isSubmitting}
          className="ios-button-secondary px-4 py-2 disabled:opacity-50 hover-scale"
        >
          Skip this step
        </button>

        <button
          onClick={handleContinue}
          disabled={isLoading || isSubmitting}
          className="ios-button flex items-center space-x-2 px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover-glow hover-scale"
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

export default InterestsStep;
