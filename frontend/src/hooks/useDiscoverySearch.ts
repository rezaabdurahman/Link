import { useCallback } from 'react';
import { useDiscoveryStore } from '../stores';
import { 
  unifiedSearch, 
  isUnifiedSearchError, 
  getUnifiedSearchErrorMessage, 
  UnifiedSearchRequest 
} from '../services/unifiedSearchClient';

export const useDiscoverySearch = () => {
  const {
    searchQuery,
    searchResults,
    isSearching,
    hasSearched,
    searchError,
    activeFilters,
    setSearchResults,
    setSearching,
    setHasSearched,
    setSearchError,
    getFilteredResults,
  } = useDiscoveryStore();

  const performSearch = useCallback(async (isUserInitiated: boolean = true): Promise<void> => {
    console.log('🐛 performSearch called:', { isUserInitiated, isSearching });
    if (isSearching) return;

    setSearching(true);
    setSearchError(null);

    try {
      const searchRequest: UnifiedSearchRequest = {
        query: searchQuery.trim() || undefined,
        scope: 'discovery',
        filters: {
          distance: activeFilters.distance,
          interests: activeFilters.interests.length > 0 ? activeFilters.interests : undefined,
          available_only: true,
        },
        pagination: {
          limit: 50,
        },
      };

      const response = await unifiedSearch(searchRequest);
      console.log('🐛 Search response:', { users: response?.users?.length || 0, response });

      if (response?.users) {
        setSearchResults(response.users);
        setHasSearched(true);
        console.log('🐛 Set search results:', response.users.length);
      } else {
        setSearchResults([]);
        setHasSearched(true);
        console.log('🐛 No users in response, set empty array');
      }
    } catch (error) {
      console.error('Search failed:', error);
      
      let errorMessage = 'Search failed. Please try again.';
      if (isUnifiedSearchError(error)) {
        errorMessage = getUnifiedSearchErrorMessage(error);
      }
      
      setSearchError(errorMessage);
    } finally {
      setSearching(false);
    }
  }, [
    searchQuery, 
    activeFilters, 
    isSearching, 
    setSearching, 
    setSearchError, 
    setSearchResults, 
    setHasSearched
  ]);

  // Simplified refresh function - just triggers a new search
  const refreshDiscoveryData = useCallback(() => {
    performSearch(false);
  }, [performSearch]);

  // Get filtered and displayed users
  const filteredResults = getFilteredResults();
  const baseDisplayUsers = filteredResults
    .filter(user => {
      if (searchQuery === '') return true;
      
      // Import helper functions would be needed here
      // For now, using basic filtering
      const fullName = `${user.first_name} ${user.last_name || ''}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase()) ||
             user.interests.some(interest => 
               interest.toLowerCase().includes(searchQuery.toLowerCase())
             ) ||
             (user.bio || '').toLowerCase().includes(searchQuery.toLowerCase());
    });

  return {
    // State
    searchQuery,
    searchResults,
    isSearching,
    hasSearched,
    searchError,
    activeFilters,
    
    // Computed
    filteredResults,
    baseDisplayUsers,
    
    // Actions
    performSearch,
    refreshDiscoveryData,
  };
};