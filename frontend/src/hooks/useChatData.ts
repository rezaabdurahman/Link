import useSWR from 'swr';
import { useChatStore } from '../stores/chatStore';
import { useEffect, useMemo, useState } from 'react';
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
import { 
  getPriorityRankings,
  shouldUsePriorityService,
  recordUserAction,
  isPriorityServiceError,
  getPriorityServiceErrorMessage
} from '../services/priorityClient';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { Chat } from '../types';

interface UseChatDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

// Constants
const PRIORITY_CACHE_DURATION = 30000; // 30 seconds
const SEARCH_DEDUP_INTERVAL = 500; // 0.5 seconds
const CONVERSATION_DEDUP_INTERVAL = 5000; // 5 seconds
const PRIORITY_RETRY_COUNT = 1; // Minimal retries for quick fallback

export function useChatData(options: UseChatDataOptions = {}) {
  const {
    chats,
    friendResults,
    searchQuery,
    searchLoading,
    searchOffset,
    searchHasMore,
    searchTotalResults,
    setChats,
    setFriendResults,
    appendFriendResults,
    resetSearchPagination,
    setSearchLoading,
    setError,
    getSortedChats,
    getCombinedList,
  } = useChatStore();

  // Feature flag for priority service
  const isPriorityServiceFlagEnabled = useFeatureFlag('PRIORITY_SERVICE_ENABLED');

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
        priority: index + 1, // Default priority based on API order
      }));
    },
    {
      refreshInterval: options.refreshInterval || 0, // Don't auto-refresh by default
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: CONVERSATION_DEDUP_INTERVAL,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  // Get current sort option from store
  const { sortBy } = useChatStore();

  // Fetch priority rankings when priority service should be used
  const shouldUsePriority = (isPriorityServiceFlagEnabled || shouldUsePriorityService()) && 
                           sortBy === 'priority' && 
                           conversationsData && 
                           conversationsData.length > 0;
  
  const { 
    data: priorityData, 
    error: priorityError,
    isLoading: priorityLoading 
  } = useSWR(
    shouldUsePriority ? ['priority-rankings', conversationsData?.map(c => c.id).join(',')] : null,
    async () => {
      const conversationIds = conversationsData?.map(c => c.id).filter(Boolean) || [];
      if (conversationIds.length === 0) return null;
      
      try {
        const response = await getPriorityRankings({
          conversationIds,
          limit: 50,
          includeContext: true,
        });
        return response;
      } catch (err) {
        if (isPriorityServiceError(err)) {
          console.error('Priority service failed:', getPriorityServiceErrorMessage(err));
          // Fall back to default priority
          return null;
        }
        throw err;
      }
    },
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      dedupingInterval: PRIORITY_CACHE_DURATION,
      errorRetryCount: PRIORITY_RETRY_COUNT, // Don't retry too much, fall back quickly
    }
  );

  // Friend search with pagination support
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const searchRequest: UnifiedSearchRequest | null = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    return {
      query: searchQuery.trim(),
      scope: 'friends',
      pagination: {
        limit: 20,
        offset: 0, // Always start from 0 for initial search
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
        const response = await unifiedSearch(request);
        return response.users;
        
      } catch (err) {
        if (isUnifiedSearchError(err)) {
          console.error('Unified search failed:', getUnifiedSearchErrorMessage(err));
          throw err;
        } else {
          throw err;
        }
      }
    },
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      dedupingInterval: SEARCH_DEDUP_INTERVAL,
      errorRetryCount: 2,
    }
  );

  // Sync SWR data with Zustand store, merge with priority data
  useEffect(() => {
    if (conversationsData) {
      let finalChats = conversationsData;
      
      // If we have priority data and are using priority sorting, merge the scores
      if (priorityData && sortBy === 'priority' && shouldUsePriority) {
        const priorityMap = new Map(
          priorityData.conversations.map(pc => [pc.conversation_id, pc])
        );
        
        finalChats = conversationsData.map(chat => {
          const priorityConversation = priorityMap.get(chat.id);
          if (priorityConversation) {
            return {
              ...chat,
              priority: priorityConversation.priority,
              // Keep existing conversation summary for now
              conversationSummary: chat.conversationSummary,
            };
          }
          return chat;
        });
      }
      
      setChats(finalChats);
    }
  }, [conversationsData, priorityData, sortBy, shouldUsePriority, setChats]);

  useEffect(() => {
    if (searchData) {
      // Reset pagination when search query changes
      resetSearchPagination();
      setFriendResults(searchData);
    } else if (!searchQuery.trim()) {
      resetSearchPagination();
      setFriendResults([]);
    }
  }, [searchData, searchQuery, setFriendResults, resetSearchPagination]);

  useEffect(() => {
    setSearchLoading(swrSearchLoading);
  }, [swrSearchLoading, setSearchLoading]);

  useEffect(() => {
    if (conversationsError || searchError || priorityError) {
      const errorMessage = conversationsError
        ? (isAuthError(conversationsError) 
            ? getErrorMessage(conversationsError.error)
            : 'Failed to load conversations. Please try again.')
        : searchError
        ? (isUnifiedSearchError(searchError)
            ? getUnifiedSearchErrorMessage(searchError)
            : 'Failed to search friends. Please try again.')
        : priorityError
        ? (isPriorityServiceError(priorityError)
            ? `Priority service error: ${getPriorityServiceErrorMessage(priorityError)}`
            : 'Failed to load priority rankings. Using default sorting.')
        : null;
      
      // For priority errors, we don't set the main error since it falls back gracefully
      if (priorityError && !conversationsError && !searchError) {
        console.warn('Priority service unavailable, falling back to default sorting');
        setError(null);
      } else if (errorMessage) {
        setError(errorMessage);
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }, [conversationsError, searchError, priorityError, setError]);

  // Chat actions
  const createChatConversation = async (participantId: string) => {
    try {
      const conversation = await createConversation({ 
        type: 'direct', 
        participant_ids: [participantId] 
      });
      
      const newChat = conversationToChat(conversation);
      
      // Record user action for priority service learning
      try {
        await recordUserAction({
          actionType: 'conversation_opened',
          conversationId: newChat.id,
          metadata: {
            created_new: true,
            participant_id: participantId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (actionError) {
        // Don't fail the main action if recording fails
        console.warn('Failed to record user action:', actionError);
      }
      
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

  // Load more friends function
  const loadMoreFriends = async () => {
    if (!searchQuery.trim() || !searchHasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const request: UnifiedSearchRequest = {
        query: searchQuery.trim(),
        scope: 'friends',
        pagination: {
          limit: 20,
          offset: searchOffset,
        },
      };
      
      const response = await unifiedSearch(request);
      appendFriendResults(response.users, response.hasMore, response.total);
      
    } catch (error) {
      console.error('Failed to load more friends:', error);
      setError('Failed to load more friends. Please try again.');
    } finally {
      setIsLoadingMore(false);
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
    isLoadingMore,
    isPriorityLoading: priorityLoading,
    
    // Pagination states
    searchHasMore,
    searchTotalResults,
    searchOffset,
    
    // Error states
    error: conversationsError || searchError,
    priorityError,
    
    // Priority service states
    isPriorityServiceEnabled: isPriorityServiceFlagEnabled || shouldUsePriorityService(),
    isUsingPriorityService: shouldUsePriority,
    priorityServiceContext: priorityData?.debug_info,
    
    // Actions
    refreshConversations,
    createChat: createChatConversation,
    loadMoreFriends,
    
    // Utilities
    isEmpty: !conversationsLoading && !conversationsError && chats.length === 0,
    hasSearchResults: friendResults.length > 0,
    
    // Statistics
    totalUnreadCount: chats.reduce((sum: number, chat: Chat) => sum + chat.unreadCount, 0),
  };
}