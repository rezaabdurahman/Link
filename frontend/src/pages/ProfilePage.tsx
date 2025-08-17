import React, { useState } from 'react';
import { Edit, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { currentUser } from '../data/mockData';
import ProfileDetailModal from '../components/ProfileDetailModal';

const ProfilePage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const handleSettingsClick = (): void => {
    navigate('/settings');
  };

  const handleEditProfile = (): void => {
    setIsEditing(true);
  };

  const handleCloseEdit = (): void => {
    setIsEditing(false);
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
