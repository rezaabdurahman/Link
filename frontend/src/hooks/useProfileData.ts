import useSWR from 'swr';
import { useProfileStore } from '../stores/profileStore';
import { useEffect } from 'react';
import { 
  getMyProfile,
  getUserProfile,
  updateProfile,
  isAuthError,
  getErrorMessage
} from '../services/userClient';
import { 
  setUserAvailability,
  getCurrentUserAvailability,
  isAvailabilityError,
  getAvailabilityErrorMessage
} from '../services/availabilityClient';
import { AuthUser } from '../types';

interface UseProfileDataOptions {
  userId?: string; // If provided, fetches another user's profile; otherwise fetches current user
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useProfileData(options: UseProfileDataOptions = {}) {
  const {
    currentUserProfile,
    viewingProfile,
    isAvailable,
    isAvailabilitySubmitting,
    isLoadingProfile,
    isSavingProfile,
    profileError,
    editData,
    setCurrentUserProfile,
    setViewingProfile,
    setAvailability,
    setAvailabilitySubmitting,
    setLoadingProfile,
    setSavingProfile,
    setProfileError,
    saveProfile: saveProfileStore,
  } = useProfileStore();

  const isViewingOtherUser = !!options.userId;

  // Fetch current user profile
  const { 
    data: currentUserData, 
    error: currentUserError, 
    isLoading: currentUserLoading,
    mutate: refreshCurrentUser 
  } = useSWR(
    !isViewingOtherUser && options.enabled !== false ? 'current-user' : null,
    getMyProfile,
    {
      refreshInterval: options.refreshInterval || 0,
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 10000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  // Fetch other user profile
  const { 
    data: otherUserData, 
    error: otherUserError, 
    isLoading: otherUserLoading,
    mutate: refreshOtherUser 
  } = useSWR(
    isViewingOtherUser && options.enabled !== false 
      ? ['user', options.userId] 
      : null,
    ([, userId]: [string, string]) => getUserProfile(userId),
    {
      refreshInterval: options.refreshInterval || 0,
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  // Fetch availability status for current user
  const { 
    data: availabilityData,
    mutate: refreshAvailability 
  } = useSWR(
    !isViewingOtherUser && options.enabled !== false ? 'user-availability' : null,
    getCurrentUserAvailability,
    {
      refreshInterval: 30000, // Check availability every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  // Sync data with store
  useEffect(() => {
    if (currentUserData) {
      setCurrentUserProfile(currentUserData as AuthUser);
    }
  }, [currentUserData, setCurrentUserProfile]);

  useEffect(() => {
    if (otherUserData) {
      setViewingProfile(otherUserData, options.userId);
    }
  }, [otherUserData, options.userId, setViewingProfile]);

  useEffect(() => {
    if (availabilityData !== undefined) {
      setAvailability(availabilityData.is_available);
    }
  }, [availabilityData, setAvailability]);

  // Handle loading states
  useEffect(() => {
    setLoadingProfile(currentUserLoading || otherUserLoading);
  }, [currentUserLoading, otherUserLoading, setLoadingProfile]);

  // Handle errors
  useEffect(() => {
    const error = currentUserError || otherUserError;
    if (error) {
      const errorMessage = isAuthError(error) 
        ? getErrorMessage(error.error)
        : 'Failed to load profile. Please try again.';
      setProfileError(errorMessage);
    } else {
      setProfileError(null);
    }
  }, [currentUserError, otherUserError, setProfileError]);

  // Profile actions
  const updateAvailability = async (newAvailability: boolean) => {
    if (isAvailabilitySubmitting) return;

    const previousAvailability = isAvailable;
    setAvailabilitySubmitting(true);
    
    // Optimistic update
    setAvailability(newAvailability);

    try {
      const result = await setUserAvailability(newAvailability);
      
      // Update availability in store directly
      setAvailability(result.is_available);
      
      // Refresh availability data
      refreshAvailability();
      
      return result;
    } catch (error) {
      // Revert optimistic update
      setAvailability(previousAvailability);
      
      const errorMessage = isAvailabilityError(error)
        ? getAvailabilityErrorMessage(error)
        : 'Failed to update availability. Please try again.';
      
      throw new Error(errorMessage);
    } finally {
      setAvailabilitySubmitting(false);
    }
  };

  const saveProfile = async () => {
    if (!currentUserProfile) return;

    setSavingProfile(true);
    setProfileError(null);

    try {
      // Make API call to update profile
      const updatedProfile = await updateProfile(editData);
      
      // Update store with new profile data
      setCurrentUserProfile(updatedProfile as AuthUser);
      
      // Call store's save method to handle UI state
      await saveProfileStore();
      
      // Refresh current user data
      refreshCurrentUser();
      
    } catch (error) {
      console.error('Failed to save profile:', error);
      const errorMessage = isAuthError(error)
        ? getErrorMessage(error.error)
        : 'Failed to save profile. Please try again.';
      setProfileError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSavingProfile(false);
    }
  };

  return {
    // Profile data
    profile: isViewingOtherUser ? viewingProfile : currentUserProfile,
    currentUserProfile,
    viewingProfile,
    isViewingOtherUser,
    
    // Availability
    isAvailable,
    isAvailabilitySubmitting,
    updateAvailability,
    
    // Loading states
    isLoading: isLoadingProfile,
    isSaving: isSavingProfile,
    
    // Error states
    error: profileError,
    
    // Actions
    saveProfile,
    refreshProfile: isViewingOtherUser ? refreshOtherUser : refreshCurrentUser,
    refreshAvailability,
    
    // Utilities
    isEmpty: !isLoadingProfile && !profileError && !currentUserProfile && !viewingProfile,
    hasProfile: !!(isViewingOtherUser ? viewingProfile : currentUserProfile),
  };
}