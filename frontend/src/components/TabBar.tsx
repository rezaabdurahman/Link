import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, MessageCircle, CheckCircle, Calendar, User } from 'lucide-react';

interface TabItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

const TabBar: React.FC = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs: TabItem[] = [
    {
      path: '/discovery',
      icon: <Users size={24} />,
      label: 'Discover'
    },
    {
      path: '/chat',
      icon: <MessageCircle size={24} />,
      label: 'Chats'
    },
    {
      path: '/checkin',
      icon: <CheckCircle size={24} />,
      label: 'Check-in'
    },
    {
      path: '/opportunities',
      icon: <Calendar size={24} />,
      label: 'Opportunities'
    },
    {
      path: '/profile',
      icon: <User size={24} />,
      label: 'Profile'
    }
  ];

  const handleTabClick = (path: string): void => {
    navigate(path);
  };

  return (
    <div className="tab-bar">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        padding: '12px 20px 0 20px',
        height: '60px'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => handleTabClick(tab.path)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '0',
              minWidth: '60px',
              color: location.pathname === tab.path ? '#06b6d4' : '#6b7280',
              transition: 'color 0.2s ease'
            }}
            className="haptic-light hover-scale"
          >
            {tab.icon}
            <span style={{ fontSize: '10px', fontWeight: '500' }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabBar;
