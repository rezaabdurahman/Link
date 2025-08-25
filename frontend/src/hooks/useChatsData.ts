import useSWR from 'swr';
import { getConversations, conversationToChat } from '../services/chatClient';
import { Chat } from '../types';
import { useChatStore } from '../stores/chatStore';
import { useAuth } from '../contexts/AuthContext';

interface UseChatsDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
}

export function useChatsData(options: UseChatsDataOptions = {}) {
  const { token } = useAuth();
  const { setChats, setError } = useChatStore();

  const shouldFetch = options.enabled !== false && !!token;

  const { 
    data, 
    error, 
    isLoading, 
    mutate: refresh 
  } = useSWR<Chat[]>(
    shouldFetch ? 'user-conversations' : null,
    async () => {
      const conversations = await getConversations();
      const chats = conversations.data.map(conversationToChat);
      
      // Update store with fresh data
      setChats(chats);
      
      return chats;
    },
    {
      refreshInterval: options.refreshInterval || 30000, // Refresh every 30 seconds
      revalidateOnFocus: options.revalidateOnFocus !== false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      onError: (error) => {
        console.error('Failed to fetch conversations:', error);
        setError('Failed to load conversations');
      },
      onSuccess: () => {
        setError(null);
      },
    }
  );

  return {
    chats: data || [],
    isLoading,
    error,
    refresh,
    // Utility functions
    isEmpty: !isLoading && !error && (!data?.length),
    hasChats: !!data?.length,
  };
}

export function useChatOptimisticUpdates() {
  const { mutate } = useSWR('user-conversations');
  const { addChat, updateChat } = useChatStore();

  const optimisticAddChat = async (chat: Chat, apiCall: () => Promise<Chat>) => {
    // Optimistically add the chat
    addChat(chat);
    
    try {
      const result = await apiCall();
      // Update with real data
      updateChat(chat.id, result);
      // Refresh the cache
      mutate();
      return result;
    } catch (error) {
      // Revert optimistic update on error
      mutate();
      throw error;
    }
  };

  const optimisticUpdateChat = async (
    chatId: string, 
    updates: Partial<Chat>, 
    apiCall: () => Promise<Chat>
  ) => {
    // Optimistically update
    updateChat(chatId, updates);
    
    try {
      const result = await apiCall();
      // Update with real data
      updateChat(chatId, result);
      return result;
    } catch (error) {
      // Revert optimistic update on error
      mutate();
      throw error;
    }
  };

  return {
    optimisticAddChat,
    optimisticUpdateChat,
  };
}