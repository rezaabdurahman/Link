import React from 'react';
import { User } from '../../types';
import UserCard from '../UserCard';
import ViewTransition from '../ViewTransition';
import SmartGrid from '../SmartGrid';
import { SearchResultsSkeleton } from '../SkeletonShimmer';
import { getDisplayName } from '../../utils/nameHelpers';

interface DiscoveryContentProps {
  isSearching: boolean;
  searchError: string | null;
  hasSearched: boolean;
  displayUsers: User[];
  gridChunks: any[];
  isGridView: boolean;
  showFeedAnimation: boolean;
  onUserClick: (user: User) => void;
  onSearchRetry: () => void;
}

const DiscoveryContent: React.FC<DiscoveryContentProps> = ({
  isSearching,
  searchError,
  hasSearched,
  displayUsers,
  gridChunks,
  isGridView,
  showFeedAnimation,
  onUserClick,
  onSearchRetry,
}) => {
  const renderContent = () => {
    if (isSearching) {
      return <SearchResultsSkeleton count={6} />;
    }

    if (searchError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
          <div className="text-red-500 text-lg font-medium mb-2">Search Error</div>
          <div className="text-gray-600 mb-4">{searchError}</div>
          <button
            onClick={onSearchRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (!hasSearched) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
          <div className="text-lg font-medium mb-2">Discover People Nearby</div>
          <div className="text-gray-600 mb-4">Search to find people who share your interests</div>
        </div>
      );
    }

    if (displayUsers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
          <div className="text-lg font-medium mb-2">No users found</div>
          <div className="text-gray-600 mb-4">Try adjusting your search or filters</div>
        </div>
      );
    }

    // Display users using either Smart Grid or feed view
    return (
      <div className={isGridView ? 'max-w-sm mx-auto px-4' : 'flex flex-col'}>
        <ViewTransition 
          viewKey={isGridView ? 'grid' : 'feed'}
          className="transition-opacity duration-200"
        >
          {isGridView ? (
            // Smart Grid View - ML-optimized layout with 2x2 prominent users
            <div className="mb-6">
              {gridChunks.length > 0 ? (
                <SmartGrid
                  chunks={gridChunks}
                  onUserClick={onUserClick}
                  showAnimation={showFeedAnimation}
                  className=""
                />
              ) : (
                // Fallback: Simple grid if no chunks
                <div className="grid grid-cols-3 gap-0.5">
                  {displayUsers.map((user, index) => {
                    const baseDelay = 100;
                    const staggerDelay = index * 50;
                    const totalDelay = baseDelay + staggerDelay;
                    
                    const hasVideo = user.profileMedia?.type === 'video';
                    const mediaSource = hasVideo ? user.profileMedia?.thumbnail : user.profilePicture;
                    
                    return (
                      <div
                        key={user.id}
                        className={`opacity-0 ${showFeedAnimation ? 'animate-card-entrance' : ''}`}
                        style={{
                          animationDelay: showFeedAnimation ? `${totalDelay}ms` : '0ms',
                          animationFillMode: 'forwards'
                        }}
                      >
                        <button
                          onClick={() => onUserClick(user)}
                          className="relative w-full aspect-square overflow-hidden bg-gray-100 hover:scale-[1.02] transition-transform duration-200 block"
                        >
                          <img
                            src={mediaSource}
                            alt={getDisplayName(user)}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/default-avatar.png';
                            }}
                          />
                          {hasVideo && (
                            <div className="absolute top-2 right-2">
                              <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Feed View
            <div className="space-y-4 pb-8">
              {displayUsers.map((user, index) => {
                const baseDelay = 100;
                const staggerDelay = index * 50;
                const totalDelay = baseDelay + staggerDelay;
                
                return (
                  <div
                    key={user.id}
                    className={`opacity-0 ${showFeedAnimation ? 'animate-card-entrance' : ''}`}
                    style={{
                      animationDelay: showFeedAnimation ? `${totalDelay}ms` : '0ms',
                      animationFillMode: 'forwards'
                    }}
                  >
                    <UserCard
                      user={user}
                      onClick={() => onUserClick(user)}
                      isVerticalLayout={false}
                      showFriendButton={true}
                      showBroadcast={true}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </ViewTransition>
      </div>
    );
  };

  return (
    <ViewTransition viewKey="discovery-content" className="min-h-screen">
      {renderContent()}
    </ViewTransition>
  );
};

export default DiscoveryContent;