import React from 'react';
import { ArrowLeft, Bell, Shield, Users, Heart, Calendar, LogOut, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SettingsPage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const settingsItems = [
    { icon: Crown, label: 'Subscription', action: 'navigate' },
    { icon: Bell, label: 'Notifications', action: 'navigate' },
    { icon: Shield, label: 'Privacy & Location', action: 'navigate' },
    { icon: Users, label: 'Close Friends', action: 'navigate' },
    { icon: Heart, label: 'Connection Preferences', action: 'navigate' },
    { icon: Calendar, label: 'Availability Settings', action: 'navigate' },
  ];

  const handleSettingClick = (label: string): void => {
    switch (label) {
      case 'Subscription':
        navigate('/subscription');
        break;
      case 'Privacy & Location':
        navigate('/settings/privacy');
        break;
      default:
        console.log('Navigate to:', label);
        // Other settings pages to be implemented
        break;
    }
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

  const handleBack = (): void => {
    navigate('/profile');
  };

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
          Settings
        </h1>
      </div>

      {/* Settings */}
      <div className="ios-card" style={{ padding: '0', marginBottom: '32px' }}>
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
          marginBottom: '20px',
          paddingBottom: '4px',
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

export default SettingsPage;
