import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';

// Types for friend request data
export interface FriendRequest {
  id: string;
  user: User;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface FriendshipStatus {
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  canSendRequest: boolean;
}

interface UseFriendRequestsReturn {
  // Data
  pendingReceivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  friends: User[];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Actions
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  cancelSentRequest: (requestId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  getFriendshipStatus: (userId: string) => FriendshipStatus;
  
  // Utils
  refreshRequests: () => Promise<void>;
}

export const useFriendRequests = (): UseFriendRequestsReturn => {
  const [pendingReceivedRequests, setPendingReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock API calls - replace with actual API calls
  const mockApiCall = (delay = 500) => new Promise(resolve => setTimeout(resolve, delay));
  
  const refreshRequests = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await mockApiCall();
      
      // Mock data - replace with actual API calls
      const mockReceivedRequests: FriendRequest[] = [];
      const mockSentRequests: FriendRequest[] = [];
      const mockFriends: User[] = [];
      
      setPendingReceivedRequests(mockReceivedRequests);
      setSentRequests(mockSentRequests);
      setFriends(mockFriends);
    } catch (error) {
      console.error('Failed to refresh friend requests:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const sendFriendRequest = async (userId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await mockApiCall();
      // Mock API call to send friend request
      console.log(`Sending friend request to user ${userId}`);
      
      // Refresh data after action
      await refreshRequests();
    } catch (error) {
      console.error('Failed to send friend request:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const acceptFriendRequest = async (requestId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await mockApiCall();
      // Mock API call to accept friend request
      console.log(`Accepting friend request ${requestId}`);
      
      // Remove from pending requests locally
      setPendingReceivedRequests(prev => prev.filter(req => req.id !== requestId));
      
      // Refresh data after action
      await refreshRequests();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const declineFriendRequest = async (requestId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await mockApiCall();
      // Mock API call to decline friend request
      console.log(`Declining friend request ${requestId}`);
      
      // Remove from pending requests locally
      setPendingReceivedRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSentRequest = async (requestId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await mockApiCall();
      // Mock API call to cancel sent request
      console.log(`Canceling sent request ${requestId}`);
      
      // Remove from sent requests locally
      setSentRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Failed to cancel sent request:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeFriend = async (userId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await mockApiCall();
      // Mock API call to remove friend
      console.log(`Removing friend ${userId}`);
      
      // Remove from friends list locally
      setFriends(prev => prev.filter(friend => friend.id !== userId));
    } catch (error) {
      console.error('Failed to remove friend:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getFriendshipStatus = useCallback((userId: string): FriendshipStatus => {
    // Check if already friends
    const isFriend = friends.some(friend => friend.id === userId);
    if (isFriend) {
      return { status: 'friends', canSendRequest: false };
    }

    // Check if there's a pending received request
    const receivedRequest = pendingReceivedRequests.find(req => req.user.id === userId);
    if (receivedRequest) {
      return { status: 'pending_received', canSendRequest: false };
    }

    // Check if there's a pending sent request
    const sentRequest = sentRequests.find(req => req.user.id === userId);
    if (sentRequest) {
      return { status: 'pending_sent', canSendRequest: false };
    }

    // No relationship - can send request
    return { status: 'none', canSendRequest: true };
  }, [friends, pendingReceivedRequests, sentRequests]);

  // Initial load
  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  return {
    // Data
    pendingReceivedRequests,
    sentRequests,
    friends,
    
    // Loading states
    isLoading,
    isRefreshing,
    
    // Actions
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelSentRequest,
    removeFriend,
    getFriendshipStatus,
    
    // Utils
    refreshRequests
  };
};

// Helper hook to get just the count of pending received requests
export const usePendingReceivedRequestsCount = (): number => {
  const { pendingReceivedRequests } = useFriendRequests();
  return pendingReceivedRequests.length;
};
