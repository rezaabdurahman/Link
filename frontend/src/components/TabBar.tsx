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
    <nav className="tab-bar" role="tablist" aria-label="Main navigation">
      <div className="flex justify-around items-center px-5 pt-3 h-15">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => handleTabClick(tab.path)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.path.slice(1)}`}
              className={`
                flex flex-col items-center gap-1 p-0 min-w-15 h-12
                bg-transparent border-none cursor-pointer
                transition-all duration-200 ease-in-out
                haptic-light hover-scale focus-ring
                ${
                  isActive 
                    ? 'text-aqua' 
                    : 'text-text-muted hover:text-text-secondary'
                }
              `}
            >
              <div className="flex-shrink-0">
                {tab.icon}
              </div>
              <span className="text-xs font-medium leading-none">
                {tab.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-aqua rounded-full" />
              )}
              {/* Screen reader context */}
              <span className="sr-only">
                {isActive ? '(current page)' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabBar;
