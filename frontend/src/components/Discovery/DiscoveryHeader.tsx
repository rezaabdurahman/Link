import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isFeatureEnabled } from '../../config/featureFlags';
import AnimatedSearchInput from '../AnimatedSearchInput';
import FixedHeader from '../layout/FixedHeader';

interface DiscoveryHeaderProps {
  searchQuery: string;
  isSearching: boolean;
  friendRequestsBadgeCount: number;
  isGridView: boolean;
  onSearchQueryChange: (query: string) => void;
  onSearchEnter: () => void;
  onToggleViewMode: () => void;
}

const DiscoveryHeader: React.FC<DiscoveryHeaderProps> = ({
  searchQuery,
  isSearching,
  friendRequestsBadgeCount,
  isGridView,
  onSearchQueryChange,
  onSearchEnter,
  onToggleViewMode,
}) => {
  const navigate = useNavigate();

  return (
    <FixedHeader>
      {/* Header */}
      <div className="flex justify-between items-center py-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient-aqua-copper leading-tight">
            Discover
          </h1>
          <p className="text-secondary text-sm">
            Find people nearby to connect with
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Grid/Feed Toggle Button - Feature Flagged */}
          {isFeatureEnabled('DISCOVERY_GRID_VIEW') && (
            <button
              onClick={onToggleViewMode}
              className="w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
              title={isGridView ? "Switch to Feed View" : "Switch to Grid View"}
            >
              {isGridView ? (
                // Feed icon (when in grid view, show feed icon to switch back)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              ) : (
                // Grid icon (when in feed view, show grid icon to switch to grid)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              )}
            </button>
          )}
          {/* Friend Requests Icon */}
          <button
            onClick={() => navigate('/friend-requests')}
            className="relative w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
            title="Friend Requests"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            {/* Badge */}
            {friendRequestsBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-accent-copper text-white text-xs font-bold flex items-center justify-center px-1 border border-white/20">
                {friendRequestsBadgeCount > 99 ? '99+' : friendRequestsBadgeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="pb-2">
        <AnimatedSearchInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          onEnter={onSearchEnter}
          suggestions={[
            'who is into raving?',
            'Who is into volleyball?',
            "Who's going to Coachella next year?",
            "Who's gonna be in France this September?",
            'who loves indie films?',
            'who wants to grab coffee?',
            'who is into yoga?'
          ]}
          className=""
          loading={isSearching}
          aria-label="Search for friends and conversations"
          aria-describedby="search-help"
        />
      </div>
    </FixedHeader>
  );
};

export default DiscoveryHeader;