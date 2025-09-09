import React, { useEffect, useState } from 'react';
import { Edit, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfileData } from '../hooks/useProfileData';
import { useProfileStore, useUIStore } from '../stores';
import ProfileDetailModal from '../components/ProfileDetailModal';
import Toast from '../components/Toast';

const ProfilePageRefactored: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const { 
    toast, 
    showToast, 
    hideToast 
  } = useUIStore();

  const {
    showMontage,
    setShowMontage,
  } = useProfileStore();
  
  // Local bio editing trigger state
  const [bioEditTrigger, setBioEditTrigger] = useState<number>(0);

  const { 
    currentUserProfile,
    isAvailable,
    isAvailabilitySubmitting,
    updateAvailability,
    isLoading,
    error
  } = useProfileData({ 
    enabled: true,
    revalidateOnFocus: true 
  });

  // Set showMontage to true by default for profile page
  useEffect(() => {
    if (!showMontage) {
      setShowMontage(true);
    }
  }, [showMontage, setShowMontage]);

  const handleSettingsClick = (): void => {
    navigate('/settings');
  };

  const handleEditProfile = (): void => {
    // Trigger bio editing in the embedded ProfileDetailModal
    setBioEditTrigger(prev => prev + 1);
  };

  const toggleAvailability = async (): Promise<void> => {
    if (isAvailabilitySubmitting) return;
    
    try {
      await updateAvailability(!isAvailable);
      showToast(`You are now ${!isAvailable ? 'available' : 'busy'}`, 'success');
    } catch (error) {
      console.error('Failed to update availability:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to update availability. Please try again.', 
        'error'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="ios-safe-area flex justify-center items-center min-h-screen" style={{ padding: '0 20px' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ios-safe-area flex flex-col justify-center items-center min-h-screen" style={{ padding: '0 20px' }}>
        <div className="text-red-500 text-center mb-4">{error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-aqua text-white rounded-lg hover:bg-aqua-dark transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentUserProfile) {
    return (
      <div className="ios-safe-area flex justify-center items-center min-h-screen" style={{ padding: '0 20px' }}>
        <div className="text-gray-500">No profile data available</div>
      </div>
    );
  }

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px',
        paddingTop: '20px'
      }}>
        <h1 className="text-gradient-aqua-copper" style={{ fontSize: '28px', fontWeight: '700' }}>
          Profile
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Availability Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '500', 
              color: isAvailable ? '#06b6d4' : '#6b7280',
              transition: 'color 200ms'
            }}>
              {isAvailable ? 'Available' : 'Busy'}
            </span>
            <button
              onClick={toggleAvailability}
              disabled={isAvailabilitySubmitting}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '20px',
                width: '36px',
                alignItems: 'center',
                borderRadius: '9999px',
                backgroundColor: isAvailabilitySubmitting
                  ? '#9ca3af'
                  : isAvailable 
                    ? '#06b6d4' 
                    : '#d1d5db',
                transition: 'background-color 200ms',
                border: 'none',
                cursor: isAvailabilitySubmitting ? 'not-allowed' : 'pointer',
                outline: 'none',
                flexShrink: 0
              }}
              className="focus:outline-none"
            >
              <span
                style={{
                  display: 'inline-block',
                  height: '12px',
                  width: '12px',
                  transform: isAvailable ? 'translateX(20px)' : 'translateX(4px)',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 200ms'
                }}
              />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleEditProfile}
              style={{
                background: 'transparent',
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
              className="haptic-light hover:bg-black/5 transition-colors"
            >
              <Edit size={18} />
            </button>
            <button
              onClick={handleSettingsClick}
              style={{
                background: 'transparent',
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
              className="haptic-light hover:bg-black/5 transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Use ProfileDetailModal directly without modal wrapper - shows montage by default */}
      <ProfileDetailModal
        userId={currentUserProfile.id}
        onClose={() => {}} // No close needed for page view
        mode="own"
        isEmbedded={true} // Embedded in page, not a modal
        showMontageByDefault={true} // Show montage on page load
        bioEditTrigger={bioEditTrigger} // Trigger bio editing
      />

      {/* Bio editing is now handled inline - no modal overlay needed */}

      {/* Toast Notification */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
        />
      )}
    </div>
  );
};

export default ProfilePageRefactored;