import useSWR from 'swr';
import { useFriendRequestsStore } from '../stores/friendRequestsStore';
import { useEffect } from 'react';
import { 
  getReceivedFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest as acceptFriendRequestAPI,
  declineFriendRequest as declineFriendRequestAPI,
  cancelFriendRequest as cancelSentRequestAPI,
  isAuthError,
  getErrorMessage
} from '../services/userClient';

interface UseFriendRequestsDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useFriendRequestsData(options: UseFriendRequestsDataOptions = {}) {
  const {
    receivedRequests,
    sentRequests,
    setReceivedRequests,
    setSentRequests,
    setLoading,
    setError,
    optimisticAcceptRequest,
    optimisticDeclineRequest,
    optimisticCancelRequest,
    revertOptimisticUpdate,
    getPendingReceivedRequests,
    getPendingReceivedCount,
    getPendingSentRequests,
    isRequestProcessing,
  } = useFriendRequestsStore();

  // Fetch friend requests data
  const { 
    data, 
    error, 
    isLoading, 
    mutate: refresh 
  } = useSWR(
    options.enabled !== false ? 'friend-requests' : null,
    async () => {
      const [receivedResponse, sentResponse] = await Promise.all([
        getReceivedFriendRequests(),
        getSentFriendRequests()
      ]);
      return {
        received: receivedResponse.data.map(req => ({
          id: req.id,
          user: req.user,
          status: req.status as 'pending' | 'accepted' | 'declined' | 'cancelled',
          created_at: req.created_at,
          updated_at: req.created_at
        })),
        sent: sentResponse.data.map(req => ({
          id: req.id,
          user: req.user,
          status: req.status as 'pending' | 'accepted' | 'declined' | 'cancelled',
          created_at: req.created_at,
          updated_at: req.created_at
        }))
      };
    },
    {
      refreshInterval: options.refreshInterval || 30000, // Default 30s polling for new requests
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  // Sync SWR data with Zustand store
  useEffect(() => {
    if (data) {
      setReceivedRequests(data.received);
      setSentRequests(data.sent);
    }
  }, [data, setReceivedRequests, setSentRequests]);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (error) {
      const errorMessage = isAuthError(error) 
        ? getErrorMessage(error.error)
        : 'Failed to load friend requests. Please try again.';
      setError(errorMessage);
    } else {
      setError(null);
    }
  }, [error, setError]);

  // Action handlers with optimistic updates
  const acceptRequest = async (requestId: string) => {
    const originalRequest = receivedRequests.find(req => req.id === requestId);
    if (!originalRequest) return;

    // Optimistic update
    optimisticAcceptRequest(requestId);

    try {
      await acceptFriendRequestAPI(requestId);
      
      // Refresh data to get updated state
      refresh();
      
    } catch (error) {
      // Revert optimistic update on error
      revertOptimisticUpdate(requestId, originalRequest.status);
      
      const errorMessage = isAuthError(error)
        ? getErrorMessage(error.error)
        : 'Failed to accept friend request. Please try again.';
      
      throw new Error(errorMessage);
    }
  };

  const declineRequest = async (requestId: string) => {
    const originalRequest = receivedRequests.find(req => req.id === requestId);
    if (!originalRequest) return;

    // Optimistic update
    optimisticDeclineRequest(requestId);

    try {
      await declineFriendRequestAPI(requestId);
      
      // Refresh data to get updated state
      refresh();
      
    } catch (error) {
      // Revert optimistic update on error
      revertOptimisticUpdate(requestId, originalRequest.status);
      
      const errorMessage = isAuthError(error)
        ? getErrorMessage(error.error)
        : 'Failed to decline friend request. Please try again.';
      
      throw new Error(errorMessage);
    }
  };

  const cancelRequest = async (requestId: string) => {
    const originalRequest = sentRequests.find(req => req.id === requestId);
    if (!originalRequest) return;

    // Optimistic update
    optimisticCancelRequest(requestId);

    try {
      await cancelSentRequestAPI(requestId);
      
      // Refresh data to get updated state
      refresh();
      
    } catch (error) {
      // Revert optimistic update on error
      revertOptimisticUpdate(requestId, originalRequest.status);
      
      const errorMessage = isAuthError(error)
        ? getErrorMessage(error.error)
        : 'Failed to cancel friend request. Please try again.';
      
      throw new Error(errorMessage);
    }
  };

  return {
    // Data
    receivedRequests: getPendingReceivedRequests(),
    sentRequests: getPendingSentRequests(),
    pendingReceivedCount: getPendingReceivedCount(),
    
    // States
    isLoading,
    error,
    
    // Actions
    acceptRequest,
    declineRequest,
    cancelRequest,
    refresh,
    
    // Utilities
    isRequestProcessing,
    
    // Computed
    hasReceivedRequests: getPendingReceivedRequests().length > 0,
    hasSentRequests: getPendingSentRequests().length > 0,
    totalRequests: getPendingReceivedRequests().length + getPendingSentRequests().length,
  };
}