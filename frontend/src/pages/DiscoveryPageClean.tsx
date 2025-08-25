import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import ExpandableFAB from '../components/ExpandableFAB';
import DiscoveryHeader from '../components/Discovery/DiscoveryHeader';
import DiscoveryContent from '../components/Discovery/DiscoveryContent';
import DiscoveryModals from '../components/Discovery/DiscoveryModals';
import { isFeatureEnabled } from '../config/featureFlags';
import { createBroadcast } from '../services/broadcastClient';
import { useDiscoverySearch } from '../hooks/useDiscoverySearch';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { createCheckIn, convertCheckInDataToRequest } from '../services/checkinClient';
import { usePendingReceivedRequestsCount } from '../hooks/useFriendRequests';
import { useCue } from '../contexts/CueContext';
import { 
  addClickLikelihoodScores, 
  createGridChunks, 
  UserWithLikelihood 
} from '../services/clickLikelihoodClient';

// Import our new state management
import { useUIStore, useDiscoveryStore } from '../stores';

const DiscoveryPageClean: React.FC = (): JSX.Element => {
  const friendRequestsBadgeCount = usePendingReceivedRequestsCount();

  // User state management using custom hook
  const { isAvailable, isLoading, error } = useCurrentUser();
  
  // Debug the current state
  console.log('🐛 DiscoveryPageClean State:', { isAvailable, isLoading, error });

  // Cue context
  const { createCue, hasActiveCue } = useCue();

  // Zustand stores
  const {
    toast,
    showToast,
    hideToast,
    modals,
    openModal,
    closeModal,
    isGridView,
    toggleGridView,
    showFeedAnimation,
    setShowFeedAnimation,
  } = useUIStore();

  // Search functionality using custom hook
  const {
    searchQuery,
    searchResults,
    isSearching,
    hasSearched,
    searchError,
    activeFilters,
    baseDisplayUsers,
    performSearch,
    refreshDiscoveryData,
  } = useDiscoverySearch();

  const {
    isBroadcastSubmitting,
    setSearchQuery,
    setBroadcastSubmitting,
    setLastCheckInText,
  } = useDiscoveryStore();

  // Local state for check-in snackbar
  const [showCheckInSnackbar, setShowCheckInSnackbar] = useState<boolean>(false);


  // Handle initial animation state
  useEffect(() => {
    if (isAvailable && !showFeedAnimation) {
      setTimeout(() => {
        setShowFeedAnimation(true);
      }, 100);
    }
  }, [showFeedAnimation, setShowFeedAnimation, isAvailable]);

  // Auto-search when filters change
  useEffect(() => {
    if (hasSearched && (activeFilters.distance || activeFilters.interests.length > 0)) {
      const timeoutId = setTimeout(() => {
        performSearch(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [activeFilters.distance, activeFilters.interests, hasSearched, performSearch]);

  // Initial search when becoming available
  useEffect(() => {
    if (isAvailable && searchResults.length === 0 && !isSearching) {
      performSearch(false);
    }
  }, [searchResults.length, isSearching, isAvailable, performSearch]);

  const displayUsers = baseDisplayUsers;
  
  // Debug search and display state
  console.log('🐛 Search State:', { 
    searchResults: searchResults.length, 
    baseDisplayUsers: baseDisplayUsers.length, 
    displayUsers: displayUsers.length, 
    isSearching, 
    hasSearched, 
    searchError 
  });
  
  const usersWithLikelihood: UserWithLikelihood[] = isGridView 
    ? addClickLikelihoodScores(displayUsers)
    : [];
  const gridChunks = isGridView && usersWithLikelihood.length > 0 
    ? createGridChunks(usersWithLikelihood) 
    : [];

  // Event handlers
  const handleUserClick = useCallback((user: User) => {
    openModal('isProfileDetailModalOpen', user.id);
  }, [openModal]);

  const handleCheckIn = useCallback(async (checkInData: any) => {
    try {
      const checkInRequest = convertCheckInDataToRequest(checkInData);
      await createCheckIn(checkInRequest);
      
      closeModal('isCheckInModalOpen');
      setLastCheckInText(checkInData.text || 'Successfully checked in!');
      setShowCheckInSnackbar(true);
      
      // Refresh discovery data after check-in
      refreshDiscoveryData();
    } catch (error) {
      console.error('Failed to check in:', error);
      
      let errorMessage = 'Failed to check in. Please try again.';
      // Note: Type issue with error handling - keeping simple for now
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    }
  }, [closeModal, setLastCheckInText, setShowCheckInSnackbar, showToast, refreshDiscoveryData]);

  const handleBroadcastSubmit = useCallback(async (broadcastData: any) => {
    setBroadcastSubmitting(true);
    
    try {
      // For now, just create broadcast - update logic can be added later when broadcast property is available
      await createBroadcast({ message: broadcastData.message?.trim() || broadcastData.trim() });
      
      closeModal('isAddBroadcastModalOpen');
      showToast('Broadcast shared successfully!', 'success');
      
      // Refresh discovery data after broadcast
      refreshDiscoveryData();
    } catch (error) {
      console.error('Failed to save broadcast:', error);
      showToast('Failed to share broadcast. Please try again.', 'error');
    } finally {
      setBroadcastSubmitting(false);
    }
  }, [setBroadcastSubmitting, closeModal, showToast, refreshDiscoveryData]);

  const handleCueSubmit = useCallback(async (cueText: string) => {
    try {
      await createCue({ message: cueText });
      closeModal('isAddCuesModalOpen');
      showToast('Social cue created successfully!', 'success');
    } catch (error) {
      console.error('Error creating cue:', error);
      showToast('Failed to create social cue. Please try again.', 'error');
    }
  }, [createCue, closeModal, showToast]);

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <DiscoveryHeader
        searchQuery={searchQuery}
        isSearching={isSearching}
        friendRequestsBadgeCount={friendRequestsBadgeCount}
        isGridView={isGridView}
        onSearchQueryChange={setSearchQuery}
        onSearchEnter={() => performSearch(true)}
        onToggleViewMode={toggleGridView}
      />

      {/* Main Content */}
      <div className="pt-48 pb-4">
        <DiscoveryContent
          isSearching={isSearching}
          searchError={searchError}
          hasSearched={hasSearched}
          displayUsers={displayUsers}
          gridChunks={gridChunks}
          isGridView={isGridView}
          showFeedAnimation={showFeedAnimation}
          onUserClick={handleUserClick}
          onSearchRetry={() => performSearch(true)}
        />
      </div>

      {/* Floating Action Button */}
      {console.log('🐛 FAB Debug:', { isAvailable, hasActiveCue, isBroadcastActive: isFeatureEnabled('DISCOVERY_BROADCAST') })}
      <ExpandableFAB
        isVisible={isAvailable}
        onOpenCheckIn={() => {
          console.log('🐛 FAB CheckIn clicked');
          openModal('isCheckInModalOpen');
        }}
        onOpenAddBroadcast={() => {
          console.log('🐛 FAB Broadcast clicked');
          openModal('isAddBroadcastModalOpen');
        }}
        onOpenAddCues={() => {
          console.log('🐛 FAB Cues clicked');
          openModal('isAddCuesModalOpen');
        }}
        isCuesActive={hasActiveCue}
        isBroadcastActive={isFeatureEnabled('DISCOVERY_BROADCAST')}
      />

      {/* Modals */}
      <DiscoveryModals
        // Modal states
        isProfileDetailModalOpen={modals.isProfileDetailModalOpen}
        selectedUserId={modals.selectedUserId}
        isAddCuesModalOpen={modals.isAddCuesModalOpen}
        isAddBroadcastModalOpen={modals.isAddBroadcastModalOpen}
        isCheckInModalOpen={modals.isCheckInModalOpen}
        
        // UI states
        showCheckInSnackbar={showCheckInSnackbar}
        toast={toast}
        
        // Loading states
        isBroadcastSubmitting={isBroadcastSubmitting}
        
        // Handlers
        onCloseProfileModal={() => closeModal('isProfileDetailModalOpen')}
        onCloseCuesModal={() => closeModal('isAddCuesModalOpen')}
        onSubmitCue={handleCueSubmit}
        onCloseBroadcastModal={() => closeModal('isAddBroadcastModalOpen')}
        onSubmitBroadcast={handleBroadcastSubmit}
        onCloseCheckInModal={() => closeModal('isCheckInModalOpen')}
        onSubmitCheckIn={handleCheckIn}
        onCloseCheckInSnackbar={() => setShowCheckInSnackbar(false)}
        onCloseToast={hideToast}
      />
    </div>
  );
};

export default DiscoveryPageClean;