import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile, updateProfile } from '../services/userClient';
import type { PrivacySettings, ProfileVisibility, UserProfileResponse } from '../services/userClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';

const PrivacySettingsPage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
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

  // Load current profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const profileData = await getMyProfile();
        setProfile(profileData);
        setProfileVisibility(profileData.profile_visibility);
        setGranularSettings(profileData.privacy_settings);
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load your privacy settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleBack = (): void => {
    navigate('/settings');
  };

  const handleSave = async (): Promise<void> => {
    try {
      setIsSaving(true);
      setError(null);

      await updateProfile({
        profile_visibility: profileVisibility,
        privacy_settings: granularSettings,
      });

      // Update local profile state
      if (profile) {
        setProfile({
          ...profile,
          profile_visibility: profileVisibility,
          privacy_settings: granularSettings,
        });
      }

      // Show success and navigate back
      navigate('/settings');
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
      setError('Failed to save your privacy settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGranularSettingChange = (setting: keyof PrivacySettings) => {
    setGranularSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const clearError = () => {
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="ios-safe-area flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '16px',
        marginBottom: '32px',
        paddingTop: '20px'
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'rgba(6, 182, 212, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#06b6d4'
          }}
          className="haptic-light"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#06b6d4' }}>
          Privacy & Location
        </h1>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ marginBottom: '24px' }}>
          <ErrorMessage
            error={error}
            onRetry={clearError}
            className="mb-4"
          />
        </div>
      )}

      {/* Privacy Settings */}
      <div className="ios-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Shield size={24} className="text-accent" />
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000' }}>
            Privacy Settings
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Profile Visibility Setting */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
              Profile Visibility
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={profileVisibility === 'public'}
                  onChange={() => setProfileVisibility('public')}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: '500', color: '#000000' }}>Public</div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>Anyone can see your full profile</div>
                </div>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={profileVisibility === 'private'}
                  onChange={() => setProfileVisibility('private')}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: '500', color: '#000000' }}>Private</div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>Only friends see your full profile, others see limited info</div>
                </div>
              </label>
            </div>
          </div>

          {/* Granular Settings - Only show for private profiles */}
          {profileVisibility === 'private' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
                What non-friends can see
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { key: 'show_name' as const, label: 'Name', description: 'Your first and last name' },
                  { key: 'show_age' as const, label: 'Age', description: 'Your age calculated from birth date' },
                  { key: 'show_location' as const, label: 'Location', description: 'Your current location' },
                  { key: 'show_social_media' as const, label: 'Social Media', description: 'Your social media links' },
                  { key: 'show_montages' as const, label: 'Montages', description: 'Your photo montages and bio' },
                  { key: 'show_checkins' as const, label: 'Check-ins', description: 'Your recent activity and check-ins' },
                  { key: 'show_mutual_friends' as const, label: 'Mutual Friends', description: 'Number of mutual friends' },
                ].map(({ key, label, description }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#000000' }}>{label}</div>
                      <div style={{ fontSize: '14px', color: '#64748b' }}>{description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={granularSettings[key]}
                      onChange={() => handleGranularSettingChange(key)}
                      style={{ width: '16px', height: '16px' }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="haptic-light"
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
          opacity: isSaving ? 0.7 : 1,
          color: 'white'
        }}
      >
        {isSaving ? (
          <>
            <LoadingSpinner size="sm" color="white" />
            <span style={{ fontSize: '16px', fontWeight: '500' }}>Saving...</span>
          </>
        ) : (
          <>
            <Save size={20} />
            <span style={{ fontSize: '16px', fontWeight: '500' }}>Save Settings</span>
          </>
        )}
      </button>
    </div>
  );
};

export default PrivacySettingsPage;