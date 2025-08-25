import useSWR from 'swr';
import { useChatStore } from '../stores/chatStore';
import { useEffect, useMemo } from 'react';
import { 
  getConversations,
  conversationToChat,
  createConversation
} from '../services/chatClient';
import { isAuthError, getErrorMessage } from '../services/userClient';
import { 
  unifiedSearch, 
  UnifiedSearchRequest,
  isUnifiedSearchError,
  getUnifiedSearchErrorMessage
} from '../services/unifiedSearchClient';
import { searchFriends, PublicUser } from '../services/userClient';
import { generateUsernameFromEmail } from '../utils/nameHelpers';
import { Chat } from '../types';

interface UseChatDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useChatData(options: UseChatDataOptions = {}) {
  const {
    chats,
    friendResults,
    searchQuery,
    searchLoading,
    setChats,
    setFriendResults,
    setSearchLoading,
    setError,
    getSortedChats,
    getCombinedList,
  } = useChatStore();

  // Fetch conversations
  const { 
    data: conversationsData, 
    error: conversationsError, 
    isLoading: conversationsLoading, 
    mutate: refreshConversations 
  } = useSWR(
    options.enabled !== false ? 'conversations' : null,
    async () => {
      const response = await getConversations({ limit: 50 });
      return response.data.map((conversation, index) => ({
        ...conversationToChat(conversation),
        priority: index + 1, // Set priority based on API order
      }));
    },
    {
      refreshInterval: options.refreshInterval || 0, // Don't auto-refresh by default
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  // Friend search with debounced query
  const searchRequest: UnifiedSearchRequest | null = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    return {
      query: searchQuery.trim(),
      scope: 'friends',
      pagination: {
        limit: 20,
      },
    };
  }, [searchQuery]);

  const { 
    data: searchData, 
    error: searchError,
    isLoading: swrSearchLoading 
  } = useSWR(
    searchRequest ? ['friend-search', JSON.stringify(searchRequest)] : null,
    async ([, requestStr]: [string, string]) => {
      const request = JSON.parse(requestStr);
      
      try {
        // Try unified search first
        const response = await unifiedSearch(request);
        
        // Convert User[] to PublicUser[] for backward compatibility
        const friends: PublicUser[] = response.users.map(user => ({
          id: user.id,
          email: '',
          username: generateUsernameFromEmail(user.id + '@example.com'),
          first_name: user.first_name,
          last_name: user.last_name || '',
          profile_picture: user.profilePicture,
          bio: user.bio,
          interests: user.interests,
          social_links: [],
          additional_photos: [],
          privacy_settings: {
            show_age: true,
            show_location: true,
            show_mutual_friends: true,
            show_name: true,
            show_social_media: true,
            show_montages: true,
            show_checkins: true
          },
          is_friend: true,
          mutual_friends_count: user.mutualFriends?.length || 0,
          last_active: user.lastSeen?.toISOString() || new Date().toISOString(),
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        
        return friends;
        
      } catch (err) {
        // Fallback to legacy search on unified search failure
        if (isUnifiedSearchError(err)) {
          console.warn('Unified search failed, falling back to legacy search:', getUnifiedSearchErrorMessage(err));
          try {
            const response = await searchFriends(request.query, { limit: 20 });
            return response.friends;
          } catch (legacyErr) {
            console.error('Legacy search also failed:', legacyErr);
            throw err; // Re-throw original error
          }
        } else {
          throw err;
        }
      }
    },
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      dedupingInterval: 500,
      errorRetryCount: 2,
    }
  );

  // Sync SWR data with Zustand store
  useEffect(() => {
    if (conversationsData) {
      setChats(conversationsData);
    }
  }, [conversationsData, setChats]);

  useEffect(() => {
    if (searchData) {
      setFriendResults(searchData);
    } else if (!searchQuery.trim()) {
      setFriendResults([]);
    }
  }, [searchData, searchQuery, setFriendResults]);

  useEffect(() => {
    setSearchLoading(swrSearchLoading);
  }, [swrSearchLoading, setSearchLoading]);

  useEffect(() => {
    if (conversationsError || searchError) {
      const errorMessage = conversationsError
        ? (isAuthError(conversationsError) 
            ? getErrorMessage(conversationsError.error)
            : 'Failed to load conversations. Please try again.')
        : (isUnifiedSearchError(searchError)
            ? getUnifiedSearchErrorMessage(searchError)
            : 'Failed to search friends. Please try again.');
      
      setError(errorMessage);
    } else {
      setError(null);
    }
  }, [conversationsError, searchError, setError]);

  // Chat actions
  const createChatConversation = async (participantId: string) => {
    try {
      const conversation = await createConversation({ 
        type: 'direct', 
        participant_ids: [participantId] 
      });
      
      const newChat = conversationToChat(conversation);
      
      // Add to local state and refresh
      setChats([newChat, ...chats]);
      refreshConversations();
      
      return newChat;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      const errorMessage = isAuthError(error)
        ? getErrorMessage(error.error)
        : 'Failed to create conversation. Please try again.';
      throw new Error(errorMessage);
    }
  };

  return {
    // Data
    conversations: getSortedChats(),
    combinedChatList: getCombinedList(),
    friendSearchResults: friendResults,
    
    // Loading states
    isLoading: conversationsLoading,
    isSearching: searchLoading,
    
    // Error states
    error: conversationsError || searchError,
    
    // Actions
    refreshConversations,
    createChat: createChatConversation,
    
    // Utilities
    isEmpty: !conversationsLoading && !conversationsError && chats.length === 0,
    hasSearchResults: friendResults.length > 0,
    
    // Statistics
    totalUnreadCount: chats.reduce((sum: number, chat: Chat) => sum + chat.unreadCount, 0),
  };
}