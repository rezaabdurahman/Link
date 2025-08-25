import useSWR from 'swr';
import { me } from '../services/authClient';
import { useAuth } from '../contexts/AuthContext';
import { AuthUser } from '../types';

interface UseUserProfileOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useUserProfile(options: UseUserProfileOptions = {}) {
  const { token, updateUser } = useAuth();

  const shouldFetch = options.enabled !== false && !!token;

  const { 
    data, 
    error, 
    isLoading, 
    mutate: refresh 
  } = useSWR<AuthUser>(
    shouldFetch ? 'user-profile' : null,
    async () => {
      const userResponse = await me();
      
      // Convert MeResponse to AuthUser format
      const user: AuthUser = {
        id: userResponse.id,
        email: userResponse.email,
        username: userResponse.username,
        first_name: userResponse.first_name,
        last_name: userResponse.last_name,
        date_of_birth: userResponse.date_of_birth,
        profile_picture: userResponse.profile_picture,
        bio: userResponse.bio,
        location: userResponse.location,
        email_verified: userResponse.email_verified,
        created_at: userResponse.created_at,
        updated_at: userResponse.updated_at,
        interests: (userResponse as any).interests || [],
        social_links: (userResponse as any).social_links || [],
        additional_photos: (userResponse as any).additional_photos || [],
        privacy_settings: (userResponse as any).privacy_settings || {
          show_age: true,
          show_location: false,
          show_mutual_friends: true,
          show_name: true,
          show_social_media: true,
          show_montages: true,
          show_checkins: true
        }
      };

      // Update auth context with fresh data
      updateUser(user);
      
      return user;
    },
    {
      refreshInterval: options.refreshInterval || 0, // Don't auto-refresh by default
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 60000, // Dedupe requests within 1 minute
      errorRetryCount: 2,
      errorRetryInterval: 3000,
    }
  );

  return {
    user: data,
    isLoading,
    error,
    refresh,
  };
}

export function useUserProfileOptimisticUpdates() {
  const { mutate } = useSWR('user-profile');
  const { updateUser } = useAuth();

  const optimisticUpdateProfile = async (
    updates: Partial<AuthUser>,
    apiCall: () => Promise<AuthUser>
  ) => {
    // Optimistically update both SWR cache and auth context
    mutate(
      (currentUser: AuthUser | undefined) => 
        currentUser ? { ...currentUser, ...updates } : undefined,
      false // Don't revalidate immediately
    );
    updateUser(updates);
    
    try {
      const result = await apiCall();
      // Update with real data
      mutate(result);
      updateUser(result);
      return result;
    } catch (error) {
      // Revert optimistic update on error
      mutate();
      throw error;
    }
  };

  return {
    optimisticUpdateProfile,
  };
}