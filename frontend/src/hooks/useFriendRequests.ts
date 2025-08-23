import { useState, useEffect, useCallback } from 'react';
import { User, AuthUser } from '../types';
import * as userClient from '../services/userClient';

// Types for friend request data
export interface FriendRequest {
  id: string;
  user: AuthUser;
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
  
  const refreshRequests = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Fetch received requests (pending only)
      const receivedResponse = await userClient.getReceivedFriendRequests({ status: 'pending', limit: 50 });
      const receivedRequests = receivedResponse.data.map(req => ({
        id: req.id,
        user: req.user,
        createdAt: req.created_at,
        status: req.status as 'pending' | 'accepted' | 'declined'
      }));
      
      // Fetch sent requests (pending only)
      const sentResponse = await userClient.getSentFriendRequests({ status: 'pending', limit: 50 });
      const sentRequestsData = sentResponse.data.map(req => ({
        id: req.id,
        user: req.user,
        createdAt: req.created_at,
        status: req.status as 'pending' | 'accepted' | 'declined'
      }));
      
      // Fetch friends list
      const friendsResponse = await userClient.getFriends({ limit: 50 });
      const friendsData = friendsResponse.data.map(friend => ({
        id: friend.id,
        first_name: friend.first_name,
        last_name: friend.last_name,
        age: 0, // Age calculation would need to be done from date_of_birth
        profilePicture: friend.profile_picture || undefined,
        bio: friend.bio || '',
        interests: friend.interests,
        location: {
          lat: 0, // These would come from location service
          lng: 0,
          proximityMiles: friend.mutual_friends_count || 0
        },
        isAvailable: true, // Default availability
        mutualFriends: [], // Will be populated by backend later
        connectionPriority: 'regular' as const,
        lastSeen: new Date(friend.last_active || friend.created_at),
        profileType: friend.profile_visibility === 'private' ? 'private' : 'public'
      } as User));
      
      setPendingReceivedRequests(receivedRequests);
      setSentRequests(sentRequestsData);
      setFriends(friendsData);
    } catch (error) {
      console.error('Failed to refresh friend requests:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const sendFriendRequest = async (userId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await userClient.sendFriendRequest({ requestee_id: userId });
      
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
      await userClient.acceptFriendRequest(requestId);
      
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
      await userClient.declineFriendRequest(requestId);
      
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
      await userClient.cancelFriendRequest(requestId);
      
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
      await userClient.removeFriend(userId);
      
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
