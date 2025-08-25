import useSWR from 'swr';
import { unifiedSearch, UnifiedSearchRequest, UnifiedSearchResponse } from '../services/unifiedSearchClient';
import { useDiscoveryStore } from '../stores/discoveryStore';
import { useMemo } from 'react';

interface UseDiscoveryDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useDiscoveryData(options: UseDiscoveryDataOptions = {}) {
  const { 
    searchQuery, 
    activeFilters 
  } = useDiscoveryStore();

  const searchRequest: UnifiedSearchRequest = useMemo(() => ({
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
  }), [searchQuery, activeFilters]);

  const shouldFetch = options.enabled !== false;

  const { 
    data, 
    error, 
    isLoading, 
    mutate: refresh 
  } = useSWR<UnifiedSearchResponse>(
    shouldFetch ? ['discovery-search', JSON.stringify(searchRequest)] : null,
    async ([, requestStr]: [string, string]) => {
      const request = JSON.parse(requestStr);
      return unifiedSearch(request);
    },
    {
      refreshInterval: options.refreshInterval || 0,
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      errorRetryCount: 3,
      errorRetryInterval: 1000,
    }
  );

  return {
    users: data?.users || [],
    metadata: data?.metadata,
    isLoading,
    error,
    refresh,
    // Utility functions
    isEmpty: !isLoading && !error && (!data?.users?.length),
    hasResults: !!data?.users?.length,
  };
}