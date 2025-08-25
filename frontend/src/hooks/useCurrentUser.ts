import { useEffect, useState } from 'react';
import { useProfileStore } from '../stores';
import { getMyProfile } from '../services/userClient';
import { getCurrentUserAvailability } from '../services/availabilityClient';
import { APP_CONFIG } from '../config';

export const useCurrentUser = () => {
  const { 
    currentUserProfile, 
    isAvailable, 
    setCurrentUserProfile, 
    setAvailability 
  } = useProfileStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!currentUserProfile && isLoading) {
        try {
          setError(null);
          
          // In demo mode, set availability to true immediately for better UX
          if (APP_CONFIG.isDemo) {
            setAvailability(true);
          }
          
          // Load user profile
          const profile = await getMyProfile();
          setCurrentUserProfile(profile);
          
          // In production, load availability from API
          // In demo mode, we already set it to true above
          if (!APP_CONFIG.isDemo) {
            const availabilityStatus = await getCurrentUserAvailability();
            setAvailability(availabilityStatus.is_available);
          }
          
        } catch (err) {
          console.error('Failed to load current user profile:', err);
          setError(err instanceof Error ? err.message : 'Failed to load user profile');
        } finally {
          setIsLoading(false);
        }
      } else if (currentUserProfile) {
        setIsLoading(false);
      }
    };

    loadCurrentUser();
  }, [currentUserProfile, isLoading, setCurrentUserProfile, setAvailability]);

  return {
    currentUserProfile,
    isAvailable,
    isLoading,
    error,
    // Actions
    setCurrentUserProfile,
    setAvailability
  };
};