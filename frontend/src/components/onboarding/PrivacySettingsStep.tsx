// PrivacySettingsStep - Privacy settings step of onboarding flow
// Basic component for privacy preferences

import React, { useState } from 'react';
import { ArrowRight, Shield } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { updateProfile } from '../../services/userClient';
import type { PrivacySettings, ProfileVisibility } from '../../services/userClient';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

const PrivacySettingsStep: React.FC = (): JSX.Element => {
  const {
    goToNextStep,
    skipCurrentStep,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('public');
  const [granularSettings, setGranularSettings] = useState<PrivacySettings>({
    show_age: true,
    show_location: true,
    show_mutual_friends: true,
    show_name: true,
    show_social_media: true,
    show_montages: true,
    show_checkins: true,
  });

  const handleContinue = async (): Promise<void> => {
    try {
      clearError();
      setIsSubmitting(true);

      // Update profile with privacy settings
      await updateProfile({
        profile_visibility: profileVisibility,
        privacy_settings: granularSettings,
      });

      await goToNextStep();
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to skip privacy settings step:', error);
    }
  };

  const handleGranularSettingChange = (setting: keyof PrivacySettings) => {
    setGranularSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-accent-pink/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-accent-pink" />
        </div>
      </div>
      
      <OnboardingStepHeader
        stepNumber={6}
        totalSteps={7}
        title="Privacy Settings"
        subtitle="Control who can see your profile and activity on Link."
      />

      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      <OnboardingCard>
        <div className="space-y-6">
          {/* Profile Visibility Setting */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Profile Visibility</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={profileVisibility === 'public'}
                  onChange={() => setProfileVisibility('public')}
                  className="w-4 h-4 text-accent-pink"
                />
                <div>
                  <div className="font-medium text-gray-800">Public</div>
                  <div className="text-sm text-gray-600">Anyone can see your full profile</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={profileVisibility === 'private'}
                  onChange={() => setProfileVisibility('private')}
                  className="w-4 h-4 text-accent-pink"
                />
                <div>
                  <div className="font-medium text-gray-800">Private</div>
                  <div className="text-sm text-gray-600">Only friends see your full profile, others see limited info</div>
                </div>
              </label>
            </div>
          </div>

          {/* Granular Settings - Only show for private profiles */}
          {profileVisibility === 'private' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">What non-friends can see</h3>
              <div className="space-y-3">
                {[
                  { key: 'show_name' as const, label: 'Name', description: 'Your first and last name' },
                  { key: 'show_age' as const, label: 'Age', description: 'Your age calculated from birth date' },
                  { key: 'show_location' as const, label: 'Location', description: 'Your current location' },
                  { key: 'show_social_media' as const, label: 'Social Media', description: 'Your social media links' },
                  { key: 'show_montages' as const, label: 'Montages', description: 'Your photo montages and bio' },
                  { key: 'show_checkins' as const, label: 'Check-ins', description: 'Your recent activity and check-ins' },
                  { key: 'show_mutual_friends' as const, label: 'Mutual Friends', description: 'Number of mutual friends' },
                ].map(({ key, label, description }) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-800">{label}</div>
                      <div className="text-sm text-gray-600">{description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={granularSettings[key]}
                      onChange={() => handleGranularSettingChange(key)}
                      className="w-4 h-4 text-accent-pink"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
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

export default PrivacySettingsStep;
