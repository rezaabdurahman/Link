import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { nearbyUsers, currentUser as initialCurrentUser } from '../data/mockData';
import { User } from '../types';
import UserCard from '../components/UserCard';
import ProfileDetailModal from '../components/ProfileDetailModal';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import AddCuesModal from '../components/AddCuesModal';
import AddBroadcastModal from '../components/AddBroadcastModal';
import Toast from '../components/Toast';
import { isFeatureEnabled } from '../config/featureFlags';
import { createBroadcast, updateBroadcast } from '../services/broadcastClient';
import { setUserAvailability, isAvailabilityError, getAvailabilityErrorMessage } from '../services/availabilityClient';
import { unifiedSearch, isUnifiedSearchError, getUnifiedSearchErrorMessage, UnifiedSearchRequest } from '../services/unifiedSearchClient';
// Legacy import - this will show deprecation warnings in console
import { isSearchError, getSearchErrorMessage } from '../services/searchClient';
import { SearchResultsSkeleton } from '../components/SkeletonShimmer';
import { usePendingReceivedRequestsCount } from '../hooks/useFriendRequests';
import ViewTransition from '../components/ViewTransition';
import SmartGrid from '../components/SmartGrid';
import { 
  addClickLikelihoodScores, 
  createGridChunks, 
  UserWithLikelihood 
} from '../services/clickLikelihoodClient';

const DiscoveryPage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const friendRequestsBadgeCount = usePendingReceivedRequestsCount();

  // User state management
  const [currentUser, setCurrentUser] = useState<User>(initialCurrentUser);
  const [isAvailable, setIsAvailable] = useState<boolean>(initialCurrentUser.isAvailable);
  
  // UI state management  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddCuesModalOpen, setIsAddCuesModalOpen] = useState<boolean>(false);
  const [isAddBroadcastModalOpen, setIsAddBroadcastModalOpen] = useState<boolean>(false);
  const [hiddenUserIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({ 
    isVisible: false, 
    message: '', 
    type: 'success' 
  });
  const [showFeedAnimation, setShowFeedAnimation] = useState<boolean>(false);
  const [isGridView, setIsGridView] = useState<boolean>(true);
  
  // Loading state for broadcast operations
  const [isBroadcastSubmitting, setIsBroadcastSubmitting] = useState<boolean>(false);
  
  // Loading state for availability operations
  const [isAvailabilitySubmitting, setIsAvailabilitySubmitting] = useState<boolean>(false);

  // Search and filter state
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    distance?: number;
    interests: string[];
  }>({ interests: [] });
  // Available interests for future filter functionality
  // const [availableInterests] = useState<string[]>([
  //   'Art', 'Music', 'Travel', 'Food', 'Fitness', 'Technology',
  //   'Books', 'Movies', 'Gaming', 'Photography', 'Nature', 'Business'
  // ]);

  // Search functionality - NEW unified search implementation  
  const performSearch = useCallback(async (): Promise<void> => {
    if (isSearching) return; // Prevent multiple concurrent searches

    setIsSearching(true);
    setSearchError(null);

    try {
      // Use the new unified search with 'discovery' scope
      const searchRequest: UnifiedSearchRequest = {
        query: searchQuery.trim() || undefined,
        scope: 'discovery', // Search for discoverable users
        filters: {
          distance: activeFilters.distance,
          interests: activeFilters.interests.length > 0 ? activeFilters.interests : undefined,
          available_only: true, // Only search available users in discovery
        },
        pagination: {
          limit: 50, // Reasonable limit for mobile UI
        },
      };

      const response = await unifiedSearch(searchRequest);
      
      // Filter out hidden users from search results
      const filteredResults = response.users.filter(user => !hiddenUserIds.has(user.id));
      
      setSearchResults(filteredResults);
      setHasSearched(true);

      // Show success message if query was provided
      if (searchQuery.trim()) {
        setToast({
          isVisible: true,
          message: `Found ${filteredResults.length} user${filteredResults.length !== 1 ? 's' : ''} • ${response.metadata?.searchTime || 0}ms`,
          type: 'success'
        });
      }
      
      // Log metadata for debugging
      if (response.metadata) {
        console.log('Search metadata:', response.metadata);
      }
      
    } catch (error) {
      console.error('Search failed:', error);
      
      let errorMessage = 'Search failed. Please try again.';
      if (isUnifiedSearchError(error)) {
        errorMessage = getUnifiedSearchErrorMessage(error);
      } else if (isSearchError(error)) {
        // Fallback to legacy error handling
        errorMessage = getSearchErrorMessage(error);
      }
      
      setSearchError(errorMessage);
      setToast({
        isVisible: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeFilters.distance, activeFilters.interests, hiddenUserIds, isSearching]);

  // Handle initial animation state if user is already available
  useEffect(() => {
    if (isAvailable && !showFeedAnimation) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setShowFeedAnimation(true);
      }, 100);
    }
  }, [isAvailable, showFeedAnimation]);

  // Auto-search when filters change (only if we've already searched once)
  useEffect(() => {
    if (hasSearched && (activeFilters.distance || activeFilters.interests.length > 0)) {
      // Debounce the search to avoid too many API calls
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [activeFilters.distance, activeFilters.interests, hasSearched, performSearch]);

  // Determine which users to display: search results if searched, otherwise nearby users with basic filtering

  const baseDisplayUsers = hasSearched ? searchResults : nearbyUsers
    .filter(user =>
      !hiddenUserIds.has(user.id) && // Exclude hidden users
      (searchQuery === '' || 
       user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       user.interests.some(interest => 
         interest.toLowerCase().includes(searchQuery.toLowerCase())
       ) ||
       user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      // Grid mode: sort by distance (closest first)
      // Feed mode: maintain original order (simulating AI similarity)
      if (isGridView) {
        return a.location.proximityMiles - b.location.proximityMiles;
      }
      return 0; // Maintain original order for feed mode
    });

  // For grid view: Add click likelihood scores and create chunks
  // For feed view: Use users as-is
  const displayUsers = baseDisplayUsers;
  const usersWithLikelihood: UserWithLikelihood[] = isGridView 
    ? addClickLikelihoodScores(baseDisplayUsers)
    : [];
  const gridChunks = isGridView && usersWithLikelihood.length > 0 
    ? createGridChunks(usersWithLikelihood) 
    : [];

  const toggleAvailability = async (): Promise<void> => {
    if (isAvailabilitySubmitting) return; // Prevent multiple submissions
    
    // Capture current state for potential rollback
    const prevAvailability = isAvailable;
    const nextAvailability = !isAvailable;
    
    setIsAvailabilitySubmitting(true);
    
    // Immediate UI update for responsiveness
    setIsAvailable(nextAvailability);
    
    // Handle animation smoothly without forcing resets
    if (nextAvailability && !showFeedAnimation) {
      // Only animate if we're going to available and not already animating
      setTimeout(() => {
        setShowFeedAnimation(true);
      }, 150); // Slightly longer delay for smoother feel
    } else if (!nextAvailability) {
      // Immediately hide animation when going to unavailable
      setShowFeedAnimation(false);
    }
    
    try {
      // Make API call to persist the availability change
      await setUserAvailability(nextAvailability);
      
      // Success: show toast only after successful API call
      const message = nextAvailability 
        ? "You're now discoverable by others nearby" 
        : "You've been removed from the discovery feed";
      
      setToast({
        isVisible: true,
        message,
        type: 'success'
      });
      
      console.log('Availability updated successfully:', nextAvailability);
      
    } catch (error) {
      console.error('Failed to update availability:', error);
      
      // Revert UI state on failure
      setIsAvailable(prevAvailability);
      
      // Revert animation state smoothly
      if (prevAvailability && !showFeedAnimation) {
        setTimeout(() => {
          setShowFeedAnimation(true);
        }, 150);
      } else if (!prevAvailability) {
        setShowFeedAnimation(false);
      }
      
      // Show error toast
      let errorMessage = 'Failed to update availability. Please try again.';
      if (isAvailabilityError(error)) {
        errorMessage = getAvailabilityErrorMessage(error);
      }
      
      setToast({
        isVisible: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsAvailabilitySubmitting(false);
    }
  };

  const toggleViewMode = (): void => {
    setIsGridView(!isGridView);
  };
  
  const handleCloseToast = (): void => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleUserClick = (user: User): void => {
    setSelectedUserId(user.id);
  };

  const handleCloseProfile = (): void => {
    setSelectedUserId(null);
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


  const handleSearchEnter = (): void => {
    performSearch();
  };

  // Filter management
  const handleDistanceFilterChange = (distance: number | undefined): void => {
    setActiveFilters(prev => ({ ...prev, distance }));
  };

  const handleInterestToggle = (interest: string): void => {
    setActiveFilters(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const clearFilters = (): void => {
    setActiveFilters({ interests: [] });
  };

  const clearSearch = (): void => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setSearchError(null);
    clearFilters();
  };

  return (
    <div className="min-h-screen">
      {/* Fixed Header Section */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-ios border-b border-gray-100 z-10">
        <div className="max-w-sm mx-auto px-4 pt-12">
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
              disabled={isAvailabilitySubmitting}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
                isAvailabilitySubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isAvailable 
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
                {/* Friend Requests Icon */}
                <button
                  onClick={() => navigate('/friend-requests')}
                  className="relative w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
                  title="Friend Requests"
                >
                  <Users size={16} />
                  {/* Badge */}
                  {friendRequestsBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1">
                      {friendRequestsBadgeCount > 99 ? '99+' : friendRequestsBadgeCount}
                    </span>
                  )}
                </button>
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
                onEnter={handleSearchEnter}
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
                loading={isSearching}
                aria-label="Search for people nearby with interests, appearance, or profession"
                aria-describedby="discovery-search-help"
              />
              
              {/* Filter Chips */}
              {(activeFilters.distance || activeFilters.interests.length > 0 || hasSearched) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* Distance filter */}
                  {activeFilters.distance && (
                    <button
                      onClick={() => handleDistanceFilterChange(undefined)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-aqua/10 text-aqua text-xs rounded-full border border-aqua/20 hover:bg-aqua/20 transition-colors"
                    >
                      <span>{activeFilters.distance} mi</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Interest filters */}
                  {activeFilters.interests.map(interest => (
                    <button
                      key={interest}
                      onClick={() => handleInterestToggle(interest)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-aqua/10 text-aqua text-xs rounded-full border border-aqua/20 hover:bg-aqua/20 transition-colors"
                    >
                      <span>{interest}</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                  
                  {/* Clear all filters */}
                  {(activeFilters.distance || activeFilters.interests.length > 0) && (
                    <button
                      onClick={clearFilters}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                  
                  {/* Clear search */}
                  {hasSearched && (
                    <button
                      onClick={clearSearch}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
              
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="pt-44 pb-4 overflow-y-auto">
        <div className="px-4">
          {/* View Mode Description */}
          {isAvailable && displayUsers.length > 0 && !isSearching && !searchError && (
            <div className={`${showFeedAnimation ? 'animate-fade-in' : 'opacity-0'} transition-opacity duration-300 mb-2 mt-1`}>
              <p className="text-xs text-gray-500 text-left ml-4" aria-live="polite">
                {isGridView
                  ? 'Grid mode: Showing users by distance (up to 2mi.)'
                  : 'Feed mode: Showing users by similarity (AI)'}
              </p>
            </div>
          )}
        {/* Users Display - Feed or Grid View */}
        {isAvailable ? (
          <div className={isGridView ? 'max-w-sm mx-auto px-4' : 'flex flex-col'}>
            {/* Loading State with Skeleton */}
            {isSearching && (
              <div className="mb-6" role="region" aria-label="User search results loading">
                {isGridView ? (
                  <div className="grid grid-cols-3 gap-0.5">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} className="aspect-square">
                        <div className="bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer w-full h-full rounded-sm" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <SearchResultsSkeleton count={5} />
                )}
              </div>
            )}
            
            {/* No Results State */}
            {!isSearching && hasSearched && displayUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 mb-6 px-5">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No users found</h3>
                <p className="text-sm text-gray-500 text-center">
                  Try adjusting your search query or filters
                </p>
                <button
                  onClick={clearSearch}
                  className="mt-3 px-4 py-2 bg-aqua text-white text-sm rounded-full hover:bg-aqua/90 transition-colors"
                >
                  Clear search
                </button>
              </div>
            )}
            
            {/* Error State */}
            {!isSearching && searchError && (
              <div className="flex flex-col items-center justify-center py-16 mb-6 px-5">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Search failed</h3>
                <p className="text-sm text-gray-500 text-center mb-3">
                  {searchError}
                </p>
                <button
                  onClick={performSearch}
                  className="px-4 py-2 bg-aqua text-white text-sm rounded-full hover:bg-aqua/90 transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
            {/* Users Grid/Feed */}
            {!isSearching && !searchError && displayUsers.length > 0 && (
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
                        onUserClick={handleUserClick}
                        showAnimation={showFeedAnimation}
                        className=""
                      />
                    ) : (
                      // Fallback: Simple grid if no chunks (shouldn't happen with proper data)
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
                                onClick={() => handleUserClick(user)}
                                className="relative w-full aspect-square overflow-hidden bg-gray-100 hover:scale-[1.02] transition-transform duration-200 block"
                              >
                                <img
                                  src={mediaSource}
                                  alt={user.name}
                                  className="w-full h-full object-cover"
                                />
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
                    )}
                  </div>
                ) : (
                  // Feed View - Vertical cards
                  <div className="flex flex-col mb-6">
                    {displayUsers.map((user, index) => {
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
              </ViewTransition>
            )}
          </div>
        ) : (
          <div className="max-w-sm mx-auto">
            <div className="flex flex-col items-center justify-center py-16 mb-6 px-5">
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
      </div>

      {/* Profile Detail Modal */}
      {selectedUserId && (
        <ProfileDetailModal
          userId={selectedUserId}
          onClose={handleCloseProfile}
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
