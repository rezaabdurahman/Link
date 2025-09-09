import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  PublicUser, 
  FriendMemory,
  getFriends,
  getFriendMemories,
  updateMemoryNotes,
  deleteFriendMemory
} from '../services/userClient';
import { getDisplayName } from '../utils/nameHelpers';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface LoadingStates {
  friends: boolean;
  memories: boolean;
  updating: boolean;
  deleting: string | null; // Memory ID being deleted
}

interface SocialNotesState {
  // Data
  friends: PublicUser[];
  friendsCache: CacheEntry<PublicUser[]> | null;
  selectedFriend: PublicUser | null;
  memories: Map<string, FriendMemory[]>;
  memoryCaches: Map<string, CacheEntry<FriendMemory[]>>;
  memoryCursors: Map<string, string | null>;
  hasMoreMemories: Map<string, boolean>;
  
  // UI State
  loadingStates: LoadingStates;
  errors: {
    friends: string | null;
    memories: string | null;
    updating: string | null;
  };
  
  // Actions
  loadFriends: () => Promise<void>;
  selectFriend: (friend: PublicUser | null) => void;
  loadMemories: (friendId: string, loadMore?: boolean) => Promise<void>;
  updateMemoryNotes: (memoryId: string, notes: string) => Promise<void>;
  deleteMemory: (memoryId: string) => Promise<void>;
  clearErrors: () => void;
  reset: () => void;
}

const FRIENDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MEMORIES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const MEMORIES_PAGE_SIZE = 20;

const isExpired = (cacheEntry: CacheEntry<any> | null): boolean => {
  if (!cacheEntry) return true;
  return Date.now() - cacheEntry.timestamp > cacheEntry.ttl;
};

const initialState = {
  friends: [],
  friendsCache: null,
  selectedFriend: null,
  memories: new Map(),
  memoryCaches: new Map(),
  memoryCursors: new Map(),
  hasMoreMemories: new Map(),
  loadingStates: {
    friends: false,
    memories: false,
    updating: false,
    deleting: null,
  },
  errors: {
    friends: null,
    memories: null,
    updating: null,
  },
};

export const useSocialNotesStore = create<SocialNotesState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    loadFriends: async () => {
      const state = get();
      
      // Check cache first
      if (!isExpired(state.friendsCache)) {
        set({ friends: state.friendsCache!.data });
        return;
      }

      if (state.loadingStates.friends) return;

      set({
        loadingStates: { ...state.loadingStates, friends: true },
        errors: { ...state.errors, friends: null },
      });

      try {
        const response = await getFriends({ limit: 100 }); // Get first 100 friends
        const friends = response.data;
        
        set({
          friends,
          friendsCache: {
            data: friends,
            timestamp: Date.now(),
            ttl: FRIENDS_CACHE_TTL,
          },
          loadingStates: { ...state.loadingStates, friends: false },
        });
      } catch (error) {
        console.error('Failed to load friends:', error);
        set({
          loadingStates: { ...state.loadingStates, friends: false },
          errors: { ...state.errors, friends: 'Failed to load friends. Please try again.' },
        });
      }
    },

    selectFriend: (friend) => {
      const state = get();
      set({ 
        selectedFriend: friend,
        errors: { ...state.errors, memories: null },
      });
      
      // Load memories for the selected friend
      if (friend) {
        get().loadMemories(friend.id);
      }
    },

    loadMemories: async (friendId: string, loadMore = false) => {
      const state = get();
      
      // Check cache for initial load
      if (!loadMore) {
        const cached = state.memoryCaches.get(friendId);
        if (cached && !isExpired(cached)) {
          set({
            memories: new Map(state.memories.set(friendId, cached.data)),
          });
          return;
        }
      }

      if (state.loadingStates.memories) return;

      set({
        loadingStates: { ...state.loadingStates, memories: true },
        errors: { ...state.errors, memories: null },
      });

      try {
        const cursor = loadMore ? state.memoryCursors.get(friendId) : undefined;
        
        const response = await getFriendMemories(friendId, {
          limit: MEMORIES_PAGE_SIZE,
          cursor: cursor || undefined,
        });

        const existingMemories = loadMore ? (state.memories.get(friendId) || []) : [];
        const allMemories = [...existingMemories, ...response.memories];
        
        set({
          memories: new Map(state.memories.set(friendId, allMemories)),
          memoryCaches: new Map(state.memoryCaches.set(friendId, {
            data: allMemories,
            timestamp: Date.now(),
            ttl: MEMORIES_CACHE_TTL,
          })),
          memoryCursors: new Map(state.memoryCursors.set(friendId, response.next_cursor || null)),
          hasMoreMemories: new Map(state.hasMoreMemories.set(friendId, response.has_more)),
          loadingStates: { ...state.loadingStates, memories: false },
        });
      } catch (error) {
        console.error('Failed to load memories:', error);
        set({
          loadingStates: { ...state.loadingStates, memories: false },
          errors: { ...state.errors, memories: 'Failed to load memories. Please try again.' },
        });
      }
    },

    updateMemoryNotes: async (memoryId: string, notes: string) => {
      const state = get();
      if (state.loadingStates.updating) return;

      set({
        loadingStates: { ...state.loadingStates, updating: true },
        errors: { ...state.errors, updating: null },
      });

      try {
        const updatedMemory = await updateMemoryNotes(memoryId, { notes });
        
        // Update the memory in the store
        const updatedMemories = new Map(state.memories);
        for (const [friendId, friendMemories] of updatedMemories.entries()) {
          const updatedFriendMemories = friendMemories.map(memory =>
            memory.id === memoryId ? updatedMemory : memory
          );
          updatedMemories.set(friendId, updatedFriendMemories);
          
          // Update cache as well
          const updatedCaches = new Map(state.memoryCaches);
          const existingCache = updatedCaches.get(friendId);
          if (existingCache) {
            updatedCaches.set(friendId, {
              ...existingCache,
              data: updatedFriendMemories,
              timestamp: Date.now(),
            });
          }
          
          set({
            memories: updatedMemories,
            memoryCaches: updatedCaches,
          });
        }
        
        set({
          loadingStates: { ...state.loadingStates, updating: false },
        });
      } catch (error) {
        console.error('Failed to update memory notes:', error);
        set({
          loadingStates: { ...state.loadingStates, updating: false },
          errors: { ...state.errors, updating: 'Failed to update notes. Please try again.' },
        });
      }
    },

    deleteMemory: async (memoryId: string) => {
      const state = get();
      if (state.loadingStates.deleting) return;

      set({
        loadingStates: { ...state.loadingStates, deleting: memoryId },
        errors: { ...state.errors, updating: null },
      });

      try {
        await deleteFriendMemory(memoryId);
        
        // Remove the memory from the store
        const updatedMemories = new Map(state.memories);
        for (const [friendId, friendMemories] of updatedMemories.entries()) {
          const filteredMemories = friendMemories.filter(memory => memory.id !== memoryId);
          if (filteredMemories.length !== friendMemories.length) {
            updatedMemories.set(friendId, filteredMemories);
            
            // Update cache as well
            const updatedCaches = new Map(state.memoryCaches);
            const existingCache = updatedCaches.get(friendId);
            if (existingCache) {
              updatedCaches.set(friendId, {
                ...existingCache,
                data: filteredMemories,
                timestamp: Date.now(),
              });
            }
            
            set({
              memories: updatedMemories,
              memoryCaches: updatedCaches,
            });
            break;
          }
        }
        
        set({
          loadingStates: { ...state.loadingStates, deleting: null },
        });
      } catch (error) {
        console.error('Failed to delete memory:', error);
        set({
          loadingStates: { ...state.loadingStates, deleting: null },
          errors: { ...state.errors, updating: 'Failed to delete memory. Please try again.' },
        });
      }
    },

    clearErrors: () => {
      set({
        errors: {
          friends: null,
          memories: null,
          updating: null,
        },
      });
    },

    reset: () => {
      set(initialState);
    },
  }))
);

// Selectors for common use cases
export const selectFriendsForDropdown = (state: SocialNotesState) =>
  state.friends.map(friend => ({
    id: friend.id,
    name: getDisplayName(friend),
    avatar: friend.profile_picture,
    bio: friend.bio || '',
  }));

export const selectMemoriesForFriend = (friendId: string) => (state: SocialNotesState) =>
  state.memories.get(friendId) || [];

export const selectIsLoadingMemories = (state: SocialNotesState) =>
  state.loadingStates.memories;

export const selectHasMoreMemories = (friendId: string) => (state: SocialNotesState) =>
  state.hasMoreMemories.get(friendId) ?? false;