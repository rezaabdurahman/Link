import React, { useState, useEffect } from 'react';
import { nearbyUsers, currentUser as initialCurrentUser } from '../data/mockData';
import { User } from '../types';
import UserCard from '../components/UserCard';
import ProfileDetailModal from '../components/ProfileDetailModal';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import AddCuesModal from '../components/AddCuesModal';
import AddBroadcastModal from '../components/AddBroadcastModal';
import Toast from '../components/Toast';
import { isFeatureEnabled } from '../config/featureFlags';
import { createBroadcast, updateBroadcast, deleteBroadcast, getBroadcastErrorMessage, isBroadcastError } from '../services/broadcastClient';

const DiscoveryPage: React.FC = (): JSX.Element => {
  // User state management
  const [currentUser, setCurrentUser] = useState<User>(initialCurrentUser);
  const [isAvailable, setIsAvailable] = useState<boolean>(initialCurrentUser.isAvailable);
  
  // UI state management  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddCuesModalOpen, setIsAddCuesModalOpen] = useState<boolean>(false);
  const [isAddBroadcastModalOpen, setIsAddBroadcastModalOpen] = useState<boolean>(false);
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({ 
    isVisible: false, 
    message: '', 
    type: 'success' 
  });
  const [showFeedAnimation, setShowFeedAnimation] = useState<boolean>(false);
  const [isGridView, setIsGridView] = useState<boolean>(true);
  
  // Loading state for broadcast operations
  const [isBroadcastSubmitting, setIsBroadcastSubmitting] = useState<boolean>(false);

  // Handle initial animation state if user is already available
  useEffect(() => {
    if (isAvailable && !showFeedAnimation) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setShowFeedAnimation(true);
      }, 100);
    }
  }, [isAvailable, showFeedAnimation]);

  const filteredUsers = nearbyUsers.filter(user =>
    !hiddenUserIds.has(user.id) && // Exclude hidden users
    (user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.interests.some(interest => 
      interest.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleAvailability = (): void => {
    const newAvailability = !isAvailable;
    
    if (newAvailability) {
      // Reset animation state first
      setShowFeedAnimation(false);
      setIsAvailable(newAvailability);
      
      // Trigger animation with slightly longer delay for smoother transition
      setTimeout(() => {
        setShowFeedAnimation(true);
      }, 100);
    } else {
      setIsAvailable(newAvailability);
      setShowFeedAnimation(false);
    }
    
    // Show toast notification
    const message = newAvailability 
      ? "You're now discoverable by others nearby" 
      : "You've been removed from the discovery feed";
    
    setToast({
      isVisible: true,
      message,
      type: 'success'
    });
  };

  const toggleViewMode = (): void => {
    setIsGridView(!isGridView);
  };
  
  const handleCloseToast = (): void => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleUserClick = (user: User): void => {
    setSelectedUser(user);
  };

  const handleCloseProfile = (): void => {
    setSelectedUser(null);
  };

  const handleOpenAddCues = (): void => {
    setIsAddCuesModalOpen(true);
  };

  const handleCloseAddCues = (): void => {
    setIsAddCuesModalOpen(false);
  };

  const handleSubmitCue = (cue: string): void => {
    // Here you would typically save the cue to your backend/state
    console.log('New social cue:', cue);
    // For now, just close the modal
  };

  const handleOpenAddBroadcast = (): void => {
    setIsAddBroadcastModalOpen(true);
  };

  const handleCloseAddBroadcast = (): void => {
    setIsAddBroadcastModalOpen(false);
  };

  const handleSubmitBroadcast = async (broadcast: string): Promise<void> => {
    if (isBroadcastSubmitting) return; // Prevent multiple submissions
    
    setIsBroadcastSubmitting(true);
    
    // Store original broadcast for rollback on failure
    const originalBroadcast = currentUser.broadcast;
    
    // Optimistic UI update: immediately update currentUser.broadcast
    setCurrentUser(prevUser => ({
      ...prevUser,
      broadcast: broadcast.trim()
    }));
    
    // Show optimistic success toast
    setToast({
      isVisible: true,
      message: 'Broadcast updated successfully!',
      type: 'success'
    });
    
    // Close modal immediately for better UX
    setIsAddBroadcastModalOpen(false);
    
    try {
      // Determine whether to create or update broadcast
      if (originalBroadcast) {
        await updateBroadcast({ message: broadcast.trim() });
      } else {
        await createBroadcast({ message: broadcast.trim() });
      }
      
      // Success: broadcast is already updated optimistically
      console.log('Broadcast saved successfully:', broadcast);
      
    } catch (error) {
      console.error('Failed to save broadcast:', error);
      
      // Revert optimistic update on failure
      setCurrentUser(prevUser => ({
        ...prevUser,
        broadcast: originalBroadcast
      }));
      
      // Show error toast
      const errorMessage = 'Failed to update broadcast. Please try again.';
      
      setToast({
        isVisible: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsBroadcastSubmitting(false);
    }
  };

  const handleHideUser = (userId: string): void => {
    setHiddenUserIds(prev => new Set([...prev, userId]));
    // Here you would typically save the hidden user to your backend
    console.log('User hidden:', userId);
  };

  return (
    <div className="min-h-screen">
      {/* Fixed Header Section */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur-ios border-b border-gray-100">
        <div className="max-w-sm mx-auto px-4" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        {/* Header */}
        <div className="flex justify-between items-center py-3">
          <div>
            <h1 className="text-2xl font-bold text-gradient-aqua leading-tight">
              Discover
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Switch for Availability */}
            <span className={`text-xs font-medium transition-colors duration-200 ${
              isAvailable ? 'text-aqua' : 'text-gray-500'
            }`}>
              {isAvailable ? 'Available' : 'Busy'}
            </span>
            <button
              onClick={toggleAvailability}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
                isAvailable 
                  ? 'bg-aqua' 
                  : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  isAvailable ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            {/* Action buttons - only show when available */}
            {isAvailable && (
              <div className="flex gap-1">
                {/* Grid/Feed Toggle Button - Feature Flagged */}
                {isFeatureEnabled('DISCOVERY_GRID_VIEW') && (
                  <button
                    onClick={toggleViewMode}
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    )}
                  </button>
                )}
                {/* Cues Icon - Feature Flagged */}
                {isFeatureEnabled('DISCOVERY_CUES') && (
                  <button
                    onClick={handleOpenAddCues}
                    className="w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
                    title="Add Social Cues"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </button>
                )}
                {/* Broadcast Icon - Feature Flagged */}
                {isFeatureEnabled('DISCOVERY_BROADCAST') && (
                  <button
                    onClick={handleOpenAddBroadcast}
                    className="w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
                    title="Create Broadcast"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

          {/* Search */}
          {isAvailable && (
            <div className={`${showFeedAnimation ? 'animate-search-slide-down' : 'opacity-0'} transition-opacity duration-500 pb-2`}>
              <AnimatedSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                suggestions={[
                  'find me a blond guy above 6 ft',
                  'find me another solo traveler',
                  'find me a VC I can pitch to',
                  'find me someone who loves art',
                  'find me a fitness enthusiast',
                  'find me a foodie',
                  'find me a book lover'
                ]}
                className=""
              />
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div style={{ paddingTop: isAvailable ? '90px' : '80px', paddingBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Users Display - Feed or Grid View */}
        {isAvailable ? (
          <div className={isGridView ? 'max-w-sm mx-auto px-4' : 'flex flex-col'}>
            {isGridView ? (
              // Grid View - Instagram Discover-like layout with even gaps
              <div className="grid grid-cols-3 gap-1 mb-24">
                {filteredUsers.map((user, index) => {
                  const baseDelay = 100;
                  const staggerDelay = index * 50; // Faster for grid
                  const totalDelay = baseDelay + staggerDelay;
                  
                  // Determine if user has video or image
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
                        onClick={() => handleUserClick(user)}
                        className="relative w-full aspect-square overflow-hidden bg-gray-100 hover:scale-[1.02] transition-transform duration-200"
                      >
                        <img
                          src={mediaSource}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Video indicator for profiles with video */}
                        {hasVideo && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Feed View - Vertical cards
              <div className="flex flex-col mb-24">
                {filteredUsers.map((user, index) => {
                  // Staggered animation timing
                  const baseDelay = 100;
                  const staggerDelay = index * 80; // Slightly longer for vertical stack
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
                        onClick={() => handleUserClick(user)}
                        isVerticalLayout={true}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-sm mx-auto">
            <div className="flex flex-col items-center justify-center py-16 mb-24 px-5">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">You're not discoverable</h3>
              <p className="text-sm text-gray-500 text-center px-6">
                Switch to "Available" to see and be discovered by people nearby
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Detail Modal */}
      {selectedUser && (
        <ProfileDetailModal
          user={selectedUser}
          onClose={handleCloseProfile}
          onHide={handleHideUser}
        />
      )}

      {/* Add Cues Modal - Feature Flagged */}
      {isFeatureEnabled('DISCOVERY_CUES') && (
        <AddCuesModal
          isOpen={isAddCuesModalOpen}
          onClose={handleCloseAddCues}
          onSubmit={handleSubmitCue}
        />
      )}

      {/* Add Broadcast Modal - Feature Flagged */}
      {isFeatureEnabled('DISCOVERY_BROADCAST') && (
        <AddBroadcastModal
          isOpen={isAddBroadcastModalOpen}
          onClose={handleCloseAddBroadcast}
          onSubmit={handleSubmitBroadcast}
          isSubmitting={isBroadcastSubmitting}
          currentBroadcast={currentUser.broadcast}
        />
      )}
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={handleCloseToast}
      />
    </div>
  );
};

export default DiscoveryPage;
