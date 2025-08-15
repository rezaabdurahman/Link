// useMontage hook - SWR wrapper for fetching and managing user montages
// Provides cursor pagination, caching, and error handling

import { useCallback, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  MontageResponse,
  MontageItem,
  MontageOptions,
  createMontageKey,
  serializeMontageKey,
} from '../types/montage';
import {
  fetchMontage,
  regenerateMontage,
  deleteMontage,
  getMontageErrorMessage,
  isMontagePermissionError,
  AuthServiceError,
} from '../services/montageClient';

/**
 * Configuration options for the useMontage hook
 */
export interface UseMontageConfig {
  // SWR options
  refreshInterval?: number; // Auto-refresh interval in ms
  revalidateOnFocus?: boolean; // Revalidate when window gains focus
  revalidateOnReconnect?: boolean; // Revalidate on network reconnect
  
  // Pagination options
  initialPageSize?: number; // Initial page size for first load
  
  // Error handling options
  errorRetryCount?: number; // Number of retry attempts on error
  errorRetryInterval?: number; // Interval between retries in ms
}

/**
 * Return type for the useMontage hook
 */
export interface UseMontageReturn {
  // Data
  items: MontageItem[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  isPermissionError: boolean;
  
  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  regenerate: (interest?: string) => Promise<void>;
  remove: (interest?: string) => Promise<void>;
  
  // State
  isRegenerating: boolean;
  isDeleting: boolean;
}

/**
 * SWR fetcher function for montage data
 */
const montageFetcher = async (key: string): Promise<MontageResponse> => {
  // Parse the serialized key back to MontageKey
  const parts = key.split(':');
  if (parts.length < 2 || parts[0] !== 'montage') {
    throw new Error('Invalid montage key format');
  }
  
  const userId = parts[1];
  let options: Partial<MontageOptions> = {};
  
  // Parse additional key parts
  for (let i = 2; i < parts.length; i += 2) {
    const keyName = parts[i];
    const keyValue = parts[i + 1];
    
    if (keyName === 'interest') {
      options = { ...options, interest: keyValue };
    } else if (keyName === 'cursor') {
      options = { ...options, cursor: keyValue };
    }
  }
  
  return fetchMontage(userId, options);
};

/**
 * Custom hook for fetching and managing user montage data
 * 
 * @param userId - The ID of the user whose montage to fetch
 * @param interest - Optional interest filter for the montage
 * @param config - Optional configuration for the hook
 * @returns Object with montage data, loading states, and actions
 */
export function useMontage(
  userId: string,
  interest?: string,
  config: UseMontageConfig = {}
): UseMontageReturn {
  const {
    refreshInterval = 0, // No auto-refresh by default
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    initialPageSize = 20,
    errorRetryCount = 3,
    errorRetryInterval = 1000,
  } = config;

  // State for pagination and actions
  const [allItems, setAllItems] = useState<MontageItem[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // SWR configuration
  const { mutate: globalMutate } = useSWRConfig();

  // Create SWR key for the first page
  const baseKey = useMemo(() => 
    createMontageKey(userId, { interest }), 
    [userId, interest]
  );
  
  const serializedKey = useMemo(() => 
    serializeMontageKey(baseKey), 
    [baseKey]
  );

  // SWR hook for fetching data
  const {
    error: swrError,
    isLoading: isInitialLoading,
    mutate,
  } = useSWR<MontageResponse, AuthServiceError>(
    userId ? serializedKey : null,
    montageFetcher,
    {
      refreshInterval,
      revalidateOnFocus,
      revalidateOnReconnect,
      errorRetryCount,
      errorRetryInterval,
      onSuccess: (data) => {
        // Update local state when data is fetched
        setAllItems(data.items);
        setCurrentCursor(data.metadata.next_cursor);
        setHasMore(data.metadata.has_more);
      },
      onError: () => {
        // Reset state on error
        setAllItems([]);
        setCurrentCursor(undefined);
        setHasMore(false);
      },
    }
  );

  // Error handling
  const error = useMemo(() => {
    if (!swrError) return null;
    return getMontageErrorMessage(swrError.error, userId);
  }, [swrError, userId]);

  const isPermissionError = useMemo(() => 
    isMontagePermissionError(swrError), 
    [swrError]
  );

  // Load more items (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !currentCursor) {
      return;
    }

    setIsLoadingMore(true);
    
    try {
      const nextPageData = await fetchMontage(userId, {
        interest,
        cursor: currentCursor,
        limit: initialPageSize,
      });

      // Append new items to existing ones
      setAllItems(prev => [...prev, ...nextPageData.items]);
      setCurrentCursor(nextPageData.metadata.next_cursor);
      setHasMore(nextPageData.metadata.has_more);
      
    } catch (error) {
      console.error('Failed to load more montage items:', error);
      // Error will be handled by SWR if it's a network error
    } finally {
      setIsLoadingMore(false);
    }
  }, [userId, interest, currentCursor, hasMore, isLoadingMore, initialPageSize]);

  // Refresh data
  const refresh = useCallback(async () => {
    // Reset pagination state
    setCurrentCursor(undefined);
    setHasMore(true);
    setAllItems([]);
    
    // Trigger SWR revalidation
    await mutate();
  }, [mutate]);

  // Regenerate montage
  const regenerate = useCallback(async (targetInterest?: string) => {
    if (isRegenerating) return;
    
    setIsRegenerating(true);
    
    try {
      await regenerateMontage(userId, targetInterest || interest);
      
      // Refresh data after successful regeneration
      await refresh();
      
      // Also invalidate related cache entries
      const keyToInvalidate = createMontageKey(userId, { 
        interest: targetInterest || interest 
      });
      await globalMutate(serializeMontageKey(keyToInvalidate));
      
    } catch (error) {
      console.error('Failed to regenerate montage:', error);
      throw error; // Re-throw for component error handling
    } finally {
      setIsRegenerating(false);
    }
  }, [userId, interest, isRegenerating, refresh, globalMutate]);

  // Delete montage
  const remove = useCallback(async (targetInterest?: string) => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      await deleteMontage(userId, targetInterest || interest);
      
      // Clear local data
      setAllItems([]);
      setCurrentCursor(undefined);
      setHasMore(false);
      
      // Invalidate cache
      const keyToInvalidate = createMontageKey(userId, { 
        interest: targetInterest || interest 
      });
      await globalMutate(serializeMontageKey(keyToInvalidate));
      
    } catch (error) {
      console.error('Failed to delete montage:', error);
      throw error; // Re-throw for component error handling
    } finally {
      setIsDeleting(false);
    }
  }, [userId, interest, isDeleting, globalMutate]);

  return {
    // Data
    items: allItems,
    hasMore,
    isLoading: isInitialLoading,
    isLoadingMore,
    error,
    isPermissionError,
    
    // Actions
    loadMore,
    refresh,
    regenerate,
    remove,
    
    // State
    isRegenerating,
    isDeleting,
  };
}

/**
 * Simplified hook for getting montage data without pagination
 * Useful for components that only need to display a fixed number of items
 */
export function useMontagePreview(
  userId: string,
  interest?: string,
  limit = 5
): {
  items: MontageItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { items, isLoading, error, refresh } = useMontage(
    userId,
    interest,
    { 
      initialPageSize: limit,
      revalidateOnFocus: false, // Less aggressive for preview
    }
  );

  return {
    items: items.slice(0, limit), // Ensure we don't exceed the limit
    isLoading,
    error,
    refresh,
  };
}
