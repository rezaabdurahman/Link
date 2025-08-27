import React, { useState } from 'react';
import { Edit, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { currentUser as initialCurrentUser } from '../data/mockData';
import ProfileDetailModal from '../components/ProfileDetailModal';
import { setUserAvailability, isAvailabilityError, getAvailabilityErrorMessage } from '../services/availabilityClient';

const ProfilePage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const currentUser = initialCurrentUser;
  const [isAvailable, setIsAvailable] = useState<boolean>(initialCurrentUser.isAvailable);
  const [isAvailabilitySubmitting, setIsAvailabilitySubmitting] = useState<boolean>(false);

  const handleSettingsClick = (): void => {
    navigate('/settings');
  };

  const handleEditProfile = (): void => {
    setIsEditing(true);
  };

  const handleCloseEdit = (): void => {
    setIsEditing(false);
  };

  const toggleAvailability = async (): Promise<void> => {
    if (isAvailabilitySubmitting) return; // Prevent multiple submissions
    
    // Capture current state for potential rollback
    const prevAvailability = isAvailable;
    const nextAvailability = !isAvailable;
    
    setIsAvailabilitySubmitting(true);
    
    // Immediate UI update for responsiveness
    setIsAvailable(nextAvailability);
    
    try {
      // Make API call to persist the availability change
      await setUserAvailability(nextAvailability);
      
      // Success: API call completed successfully
      console.log('Availability updated successfully:', nextAvailability);
      
    } catch (error) {
      console.error('Failed to update availability:', error);
      
      // Revert UI state on failure
      setIsAvailable(prevAvailability);
      
      // Log error for debugging
      let errorMessage = 'Failed to update availability. Please try again.';
      if (isAvailabilityError(error)) {
        errorMessage = getAvailabilityErrorMessage(error);
      }
      
      console.error('Availability update error:', errorMessage);
    } finally {
      setIsAvailabilitySubmitting(false);
    }
  };

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
        userId={currentUser.id}
        onClose={() => {}} // No close needed for page view
        mode="own"
        isEmbedded={true} // New prop to indicate it's embedded in page, not a modal
        showMontageByDefault={true} // New prop to show montage on page load
        isEditing={isEditing}
      />

      {/* Edit mode overlay modal when editing */}
      {isEditing && (
        <ProfileDetailModal
          userId={currentUser.id}
          onClose={handleCloseEdit}
          mode="own"
          isEmbedded={false}
          isEditing={true}
        />
      )}
    </div>
  );
};

export default ProfilePage;
