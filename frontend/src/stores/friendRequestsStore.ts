import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AuthUser } from '../types';

export interface FriendRequest {
  id: string;
  user: AuthUser;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

export interface FriendRequestsState {
  // Data
  receivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  
  // UI state
  activeTab: 'received' | 'sent';
  isLoading: boolean;
  error: string | null;
  
  // Individual request loading states
  processingRequestIds: Set<string>;
}

interface FriendRequestsStore extends FriendRequestsState {
  // Data actions
  setReceivedRequests: (requests: FriendRequest[]) => void;
  setSentRequests: (requests: FriendRequest[]) => void;
  addReceivedRequest: (request: FriendRequest) => void;
  updateRequestStatus: (requestId: string, status: FriendRequest['status']) => void;
  removeRequest: (requestId: string) => void;
  
  // UI actions
  setActiveTab: (tab: 'received' | 'sent') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Request processing actions
  setRequestProcessing: (requestId: string, processing: boolean) => void;
  
  // Optimistic updates
  optimisticAcceptRequest: (requestId: string) => void;
  optimisticDeclineRequest: (requestId: string) => void;
  optimisticCancelRequest: (requestId: string) => void;
  revertOptimisticUpdate: (requestId: string, originalStatus: FriendRequest['status']) => void;
  
  // Computed getters
  getPendingReceivedRequests: () => FriendRequest[];
  getPendingReceivedCount: () => number;
  getPendingSentRequests: () => FriendRequest[];
  isRequestProcessing: (requestId: string) => boolean;
}

const initialState: FriendRequestsState = {
  receivedRequests: [],
  sentRequests: [],
  activeTab: 'received',
  isLoading: false,
  error: null,
  processingRequestIds: new Set<string>(),
};

export const useFriendRequestsStore = create<FriendRequestsStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Data actions
    setReceivedRequests: (requests: FriendRequest[]) => set({ receivedRequests: requests }),
    
    setSentRequests: (requests: FriendRequest[]) => set({ sentRequests: requests }),
    
    addReceivedRequest: (request: FriendRequest) => {
      set(state => ({
        receivedRequests: [request, ...state.receivedRequests]
      }));
    },
    
    updateRequestStatus: (requestId: string, status: FriendRequest['status']) => {
      set(state => ({
        receivedRequests: state.receivedRequests.map(req =>
          req.id === requestId ? { ...req, status, updated_at: new Date().toISOString() } : req
        ),
        sentRequests: state.sentRequests.map(req =>
          req.id === requestId ? { ...req, status, updated_at: new Date().toISOString() } : req
        )
      }));
    },
    
    removeRequest: (requestId: string) => {
      set(state => ({
        receivedRequests: state.receivedRequests.filter(req => req.id !== requestId),
        sentRequests: state.sentRequests.filter(req => req.id !== requestId)
      }));
    },

    // UI actions
    setActiveTab: (tab: 'received' | 'sent') => set({ activeTab: tab }),
    setLoading: (loading: boolean) => set({ isLoading: loading }),
    setError: (error: string | null) => set({ error }),

    // Request processing actions
    setRequestProcessing: (requestId: string, processing: boolean) => {
      set(state => {
        const newProcessingIds = new Set(state.processingRequestIds);
        if (processing) {
          newProcessingIds.add(requestId);
        } else {
          newProcessingIds.delete(requestId);
        }
        return { processingRequestIds: newProcessingIds };
      });
    },

    // Optimistic updates
    optimisticAcceptRequest: (requestId: string) => {
      get().setRequestProcessing(requestId, true);
      get().updateRequestStatus(requestId, 'accepted');
    },
    
    optimisticDeclineRequest: (requestId: string) => {
      get().setRequestProcessing(requestId, true);
      get().updateRequestStatus(requestId, 'declined');
    },
    
    optimisticCancelRequest: (requestId: string) => {
      get().setRequestProcessing(requestId, true);
      get().updateRequestStatus(requestId, 'cancelled');
    },
    
    revertOptimisticUpdate: (requestId: string, originalStatus: FriendRequest['status']) => {
      get().setRequestProcessing(requestId, false);
      get().updateRequestStatus(requestId, originalStatus);
    },

    // Computed getters
    getPendingReceivedRequests: () => {
      const { receivedRequests } = get();
      return receivedRequests.filter(req => req.status === 'pending');
    },
    
    getPendingReceivedCount: () => {
      return get().getPendingReceivedRequests().length;
    },
    
    getPendingSentRequests: () => {
      const { sentRequests } = get();
      return sentRequests.filter(req => req.status === 'pending');
    },
    
    isRequestProcessing: (requestId: string) => {
      const { processingRequestIds } = get();
      return processingRequestIds.has(requestId);
    },
  }))
);