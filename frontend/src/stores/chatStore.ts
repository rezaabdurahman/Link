import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { Chat, Message } from '../types';
import { PublicUser } from '../services/userClient';

// Helper function to create a blank message
const createBlankMessage = (): Message => ({
  id: '',
  content: '',
  senderId: '',
  receiverId: '',
  timestamp: new Date(),
  type: 'text',
});

// Helper function to create a pseudo-chat from a friend
const createPseudoChat = (friend: PublicUser): Chat => ({
  id: '',
  participantId: friend.id,
  participantName: `${friend.first_name} ${friend.last_name}`,
  participantAvatar: friend.profile_picture || '/default-avatar.png',
  lastMessage: createBlankMessage(),
  unreadCount: 0,
  conversationSummary: '',
  priority: 999, // Lower priority for pseudo-chats
  isFriend: true
});

export type SortOption = 'priority' | 'time' | 'unread';

export interface MessageDraft {
  conversationId: string;
  content: string;
  timestamp: Date;
}

export interface ChatState {
  // Chat list state
  chats: Chat[];
  loading: boolean;
  error: string | null;

  // Search state for friends
  friendResults: PublicUser[];
  searchLoading: boolean;
  searchQuery: string;

  // Selected chat state
  selectedChat: Chat | null;
  initialMessage: string;

  // Sorting and filtering
  sortBy: SortOption;

  // Message drafts
  messageDrafts: Record<string, string>; // conversationId -> draft content

  // UI state
  conversationModalOpen: boolean;
  addMyContactModalOpen: boolean;
  profileModalUserId: string | null;
}

interface ChatStore extends ChatState {
  // Chat list actions
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setFriendResults: (results: PublicUser[]) => void;
  setSearchLoading: (loading: boolean) => void;
  clearSearch: () => void;

  // Selected chat actions
  setSelectedChat: (chat: Chat | null) => void;
  setInitialMessage: (message: string) => void;

  // Sorting actions
  setSortBy: (sortBy: SortOption) => void;
  getSortedChats: () => Chat[];

  // Message draft actions
  setMessageDraft: (conversationId: string, draft: string) => void;
  getMessageDraft: (conversationId: string) => string;
  clearMessageDraft: (conversationId: string) => void;
  clearAllDrafts: () => void;

  // UI actions
  setConversationModalOpen: (open: boolean) => void;
  setAddMyContactModalOpen: (open: boolean) => void;
  setProfileModalUserId: (userId: string | null) => void;

  // Computed getters
  getUnreadCount: () => number;
  getChatById: (chatId: string) => Chat | undefined;
  getCombinedList: () => Chat[];
}

const initialState: ChatState = {
  // Chat list state
  chats: [],
  loading: true,
  error: null,

  // Search state
  friendResults: [],
  searchLoading: false,
  searchQuery: '',

  // Selected chat state
  selectedChat: null,
  initialMessage: '',

  // Sorting
  sortBy: 'priority',

  // Message drafts
  messageDrafts: {},

  // UI state
  conversationModalOpen: false,
  addMyContactModalOpen: false,
  profileModalUserId: null,
};

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Chat list actions
        setChats: (chats: Chat[]) => set({ chats }),

        addChat: (chat: Chat) => {
          set(state => ({
            chats: [chat, ...state.chats]
          }));
        },

        updateChat: (chatId: string, updates: Partial<Chat>) => {
          set(state => ({
            chats: state.chats.map(chat =>
              chat.id === chatId ? { ...chat, ...updates } : chat
            )
          }));
        },

        removeChat: (chatId: string) => {
          set(state => ({
            chats: state.chats.filter(chat => chat.id !== chatId)
          }));
        },

        setLoading: (loading: boolean) => set({ loading }),
        setError: (error: string | null) => set({ error }),

        // Search actions
        setSearchQuery: (query: string) => set({ searchQuery: query }),
        setFriendResults: (results: PublicUser[]) => set({ friendResults: results }),
        setSearchLoading: (loading: boolean) => set({ searchLoading: loading }),

        clearSearch: () => set({
          searchQuery: '',
          friendResults: [],
        }),

        // Selected chat actions
        setSelectedChat: (chat: Chat | null) => set({ selectedChat: chat }),
        setInitialMessage: (message: string) => set({ initialMessage: message }),

        // Sorting actions
        setSortBy: (sortBy: SortOption) => set({ sortBy }),

        getSortedChats: () => {
          const { chats, sortBy } = get();
          
          return [...chats].sort((a, b) => {
            switch (sortBy) {
              case 'priority':
                // Sort by priority first, then by last message time
                if (a.priority !== b.priority) {
                  return a.priority - b.priority;
                }
                return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
              
              case 'time':
                return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
              
              case 'unread':
                // Unread chats first, then by time
                if (a.unreadCount !== b.unreadCount) {
                  return b.unreadCount - a.unreadCount;
                }
                return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
              
              default:
                return 0;
            }
          });
        },

        // Message draft actions
        setMessageDraft: (conversationId: string, draft: string) => {
          set(state => ({
            messageDrafts: {
              ...state.messageDrafts,
              [conversationId]: draft,
            }
          }));
        },

        getMessageDraft: (conversationId: string) => {
          const { messageDrafts } = get();
          return messageDrafts[conversationId] || '';
        },

        clearMessageDraft: (conversationId: string) => {
          set(state => {
            const { [conversationId]: removed, ...rest } = state.messageDrafts;
            return { messageDrafts: rest };
          });
        },

        clearAllDrafts: () => set({ messageDrafts: {} }),

        // UI actions
        setConversationModalOpen: (open: boolean) => set({ conversationModalOpen: open }),
        setAddMyContactModalOpen: (open: boolean) => set({ addMyContactModalOpen: open }),
        setProfileModalUserId: (userId: string | null) => set({ profileModalUserId: userId }),

        // Computed getters
        getUnreadCount: () => {
          const { chats } = get();
          return chats.reduce((total, chat) => total + chat.unreadCount, 0);
        },

        getChatById: (chatId: string) => {
          const { chats } = get();
          return chats.find(chat => chat.id === chatId);
        },

        getCombinedList: () => {
          const { chats, friendResults, searchQuery } = get();
          
          // Filter chats based on search query
          const filteredChats = chats.filter(chat => {
            const matchesSearch = chat.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              chat.conversationSummary.toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesSearch;
          });

          // If no search query, just return filtered chats
          if (!searchQuery.trim()) {
            return filteredChats;
          }

          // Combine existing chats with friend search results
          const combinedItems = [...filteredChats];
          
          // Add pseudo-chats for friends that don't have existing conversations
          friendResults.forEach(friend => {
            const existingChat = chats.find(chat => chat.participantId === friend.id);
            if (!existingChat) {
              combinedItems.push(createPseudoChat(friend));
            }
          });

          return combinedItems;
        },
      }),
      {
        name: 'chat-store',
        // Only persist certain parts of the state
        partialize: (state) => ({
          sortBy: state.sortBy,
          messageDrafts: state.messageDrafts,
        }),
      }
    )
  )
);