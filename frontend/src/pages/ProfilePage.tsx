import React, { useState } from 'react';
import { Edit, MapPin, Users, Heart, Calendar, Bell, Shield, LogOut } from 'lucide-react';
import { currentUser } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage: React.FC = (): JSX.Element => {
  const { logout } = useAuth();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedBio, setEditedBio] = useState<string>(currentUser.bio);

  const handleSaveBio = (): void => {
    // Here you would save the bio to the backend
    console.log('Saving bio:', editedBio);
    setIsEditing(false);
  };

  const handleCancelEdit = (): void => {
    setEditedBio(currentUser.bio);
    setIsEditing(false);
  };

  const settingsItems = [
    { icon: Bell, label: 'Notifications', action: 'navigate' },
    { icon: Shield, label: 'Privacy & Location', action: 'navigate' },
    { icon: Users, label: 'Close Friends', action: 'navigate' },
    { icon: Heart, label: 'Connection Preferences', action: 'navigate' },
    { icon: Calendar, label: 'Availability Settings', action: 'navigate' },
  ];

  const handleSettingClick = (label: string): void => {
    console.log('Navigate to:', label);
    // Here you would navigate to the specific settings page
  };

  const handleLogout = async (): Promise<void> => {
    try {
      console.log('Logging out...');
      await logout();
      // User will be redirected to login page automatically by AuthContext
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, the auth state will be cleared
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
        <h1 style={{ fontSize: '28px', fontWeight: '700' }}>
          Profile
        </h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
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
          <Edit size={18} />
        </button>
      </div>

      {/* Profile Card */}
      <div className="ios-card" style={{ padding: '24px', marginBottom: '32px' }}>
        {/* Profile Picture and Basic Info */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ position: 'relative' }}>
            <img
              src={currentUser.profilePicture}
              alt={currentUser.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
            <div className="online-indicator" />
          </div>
          
          <div style={{ flex: 1 }}>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '600', 
              marginBottom: '4px'
            }}>
              {currentUser.name}
            </h2>
            <p style={{ fontSize: '16px', marginBottom: '8px', color: '#000000' }}>
              {currentUser.age} years old
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={14} style={{ color: '#64748b' }} />
              <span style={{ fontSize: '14px', color: '#64748b' }}>
                San Francisco, CA
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
            Bio
          </h3>
          {isEditing ? (
            <div>
              <textarea
                value={editedBio}
                onChange={(e) => setEditedBio(e.target.value)}
                className="ios-text-field"
                style={{ 
                  width: '100%', 
                  minHeight: '80px',
                  resize: 'vertical',
                  marginBottom: '12px'
                }}
                placeholder="Tell people about yourself..."
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: '#64748b',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  className="haptic-light"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBio}
                  className="ios-button"
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    padding: '8px 16px'
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '14px', lineHeight: '1.4', color: '#000000' }}>
              {currentUser.bio}
            </p>
          )}
        </div>

        {/* Interests */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#000000' }}>
            Interests
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {currentUser.interests.map((interest, index) => (
            <span
              key={index}
              style={{
                background: 'rgba(6, 182, 212, 0.2)',
                color: '#06b6d4',
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              {interest}
            </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="ios-card" style={{ padding: '20px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#000000' }}>
          Your Connections
        </h3>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#06b6d4',
              marginBottom: '4px'
            }}>
              12
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Active Chats
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#06b6d4',
              marginBottom: '4px'
            }}>
              3
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Close Friends
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#06b6d4',
              marginBottom: '4px'
            }}>
              8
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              This Month
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="ios-card" style={{ padding: '0', marginBottom: '32px' }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          padding: '20px 20px 0 20px',
          marginBottom: '16px',
          color: '#000000'
        }}>
          Settings
        </h3>
        <div>
          {settingsItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => handleSettingClick(item.label)}
                className="haptic-light"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  borderBottom: index < settingsItems.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                }}
              >
                <Icon size={20} className="text-accent" />
                <span style={{ 
                  flex: 1, 
                  textAlign: 'left',
                  fontSize: '16px',
                  color: '#000000'
                }}>
                  {item.label}
                </span>
                <span style={{ color: '#64748b' }}>
                  ›
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="haptic-light"
        style={{
          width: '100%',
          background: 'rgba(255, 59, 48, 0.1)',
          border: '1px solid rgba(255, 59, 48, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          cursor: 'pointer',
          marginBottom: '100px',
          color: '#FF3B30'
        }}
      >
        <LogOut size={20} />
        <span style={{ fontSize: '16px', fontWeight: '500' }}>
          Log Out
        </span>
      </button>
    </div>
  );
};

export default ProfilePage;
