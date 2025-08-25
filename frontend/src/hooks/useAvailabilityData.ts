import useSWR from 'swr';
import { getCurrentUserAvailability, setUserAvailability, AvailabilityResponse } from '../services/availabilityClient';
import { useAuth } from '../contexts/AuthContext';

// Use the actual API response type instead of a custom interface
type AvailabilityData = AvailabilityResponse;

interface UseAvailabilityOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useAvailabilityData(options: UseAvailabilityOptions = {}) {
  const { token } = useAuth();

  const shouldFetch = options.enabled !== false && !!token;

  const { 
    data, 
    error, 
    isLoading, 
    mutate: refresh 
  } = useSWR<AvailabilityData>(
    shouldFetch ? 'user-availability' : null,
    async () => {
      return getCurrentUserAvailability();
    },
    {
      refreshInterval: options.refreshInterval || 60000, // Refresh every minute
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
      errorRetryCount: 2,
      errorRetryInterval: 5000,
    }
  );

  return {
    availability: data,
    isAvailable: data?.is_available || false,
    lastAvailableAt: data?.last_available_at,
    userId: data?.user_id,
    createdAt: data?.created_at,
    updatedAt: data?.updated_at,
    isLoading,
    error,
    refresh,
  };
}

export function useAvailabilityOptimisticUpdates() {
  const { mutate } = useSWR('user-availability');

  const optimisticUpdateAvailability = async (newAvailability: boolean) => {
    // Get current data to create optimistic update
    const currentData = mutate() as Promise<AvailabilityData | undefined>;
    const current = await currentData;
    
    const optimisticData: AvailabilityData = {
      id: current?.id || '',
      user_id: current?.user_id || '',
      is_available: newAvailability,
      last_available_at: newAvailability ? new Date().toISOString() : current?.last_available_at,
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically update
    mutate(optimisticData, false);
    
    try {
      // Use the real API method
      const result = await setUserAvailability(newAvailability);
      // Update with real data from API
      mutate(result);
      return result;
    } catch (error) {
      // Revert optimistic update on error
      mutate();
      throw error;
    }
  };

  return {
    optimisticUpdateAvailability,
  };
}