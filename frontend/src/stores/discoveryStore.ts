import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { User } from '../types';
import { UserWithLikelihood } from '../services/clickLikelihoodClient';

export interface SearchFilters {
  distance?: number;
  availableOnly?: boolean;
}

export interface DiscoveryState {
  // Search state
  searchQuery: string;
  searchResults: User[];
  isSearching: boolean;
  hasSearched: boolean;
  searchError: string | null;

  // Filter state
  activeFilters: SearchFilters;
  

  // User data with AI likelihood scores
  usersWithScores: UserWithLikelihood[];
  
  // Grid management
  gridChunks: UserWithLikelihood[][];
  currentChunkIndex: number;
  
  // Loading states for operations
  isBroadcastSubmitting: boolean;
  
  // Last check-in text for snackbar
  lastCheckInText: string;
}

interface DiscoveryStore extends DiscoveryState {
  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: User[]) => void;
  setSearching: (isSearching: boolean) => void;
  setHasSearched: (hasSearched: boolean) => void;
  setSearchError: (error: string | null) => void;
  clearSearch: () => void;

  // Filter actions
  setActiveFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  setDistanceFilter: (distance?: number) => void;


  // User scores actions
  setUsersWithScores: (users: UserWithLikelihood[]) => void;
  updateUserScore: (userId: string, score: number) => void;

  // Grid actions
  setGridChunks: (chunks: UserWithLikelihood[][]) => void;
  nextChunk: () => void;
  resetChunks: () => void;

  // Operation states
  setBroadcastSubmitting: (submitting: boolean) => void;
  setLastCheckInText: (text: string) => void;

  // Computed getters
  getFilteredResults: () => User[];
  hasActiveFilters: () => boolean;
}

const initialState: DiscoveryState = {
  // Search state
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  hasSearched: false,
  searchError: null,

  // Filter state  
  activeFilters: {
    availableOnly: true,
  },


  // User data
  usersWithScores: [],
  gridChunks: [],
  currentChunkIndex: 0,

  // Loading states
  isBroadcastSubmitting: false,

  // UI state
  lastCheckInText: '',
};

export const useDiscoveryStore = create<DiscoveryStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Search actions
        setSearchQuery: (query: string) => set({ searchQuery: query }),
        
        setSearchResults: (results: User[]) => {
          set({ searchResults: results });
        },

        setSearching: (isSearching: boolean) => set({ isSearching }),
        setHasSearched: (hasSearched: boolean) => set({ hasSearched }),
        setSearchError: (error: string | null) => set({ searchError: error }),

        clearSearch: () => set({
          searchQuery: '',
          searchResults: [],
          hasSearched: false,
          searchError: null,
        }),

        // Filter actions
        setActiveFilters: (filters: Partial<SearchFilters>) => {
          set(state => ({
            activeFilters: {
              ...state.activeFilters,
              ...filters,
            }
          }));
        },

        clearFilters: () => set({
          activeFilters: {
            availableOnly: true,
          }
        }),

        setDistanceFilter: (distance?: number) => {
          set(state => ({
            activeFilters: {
              ...state.activeFilters,
              distance,
            }
          }));
        },


        // User scores actions
        setUsersWithScores: (users: UserWithLikelihood[]) => {
          set({ usersWithScores: users });
        },

        updateUserScore: (userId: string, score: number) => {
          set(state => ({
            usersWithScores: state.usersWithScores.map(user =>
              user.id === userId ? { ...user, clickLikelihood: score } : user
            )
          }));
        },

        // Grid actions
        setGridChunks: (chunks: UserWithLikelihood[][]) => set({ 
          gridChunks: chunks,
          currentChunkIndex: 0,
        }),

        nextChunk: () => {
          set(state => ({
            currentChunkIndex: Math.min(
              state.currentChunkIndex + 1,
              state.gridChunks.length - 1
            )
          }));
        },

        resetChunks: () => set({ 
          gridChunks: [],
          currentChunkIndex: 0,
        }),

        // Operation states
        setBroadcastSubmitting: (submitting: boolean) => set({ isBroadcastSubmitting: submitting }),
        setLastCheckInText: (text: string) => set({ lastCheckInText: text }),

        // Computed getters
        getFilteredResults: () => {
          const { searchResults, activeFilters } = get();
          
          return searchResults.filter(user => {
            // Filter by availability
            if (activeFilters.availableOnly && !user.isAvailable) {
              return false;
            }

            return true;
          });
        },

        hasActiveFilters: () => {
          const { activeFilters } = get();
          return activeFilters.distance !== undefined ||
                 activeFilters.availableOnly === false;
        },
      }),
      {
        name: 'discovery-store',
        // Only persist certain parts of the state
        partialize: (state) => ({
          activeFilters: state.activeFilters,
        }),
      }
    )
  )
);