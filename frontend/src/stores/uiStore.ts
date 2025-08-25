import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ToastState {
  isVisible: boolean;
  message: string;
  type: 'success' | 'error';
}

export interface ModalState {
  isAddCuesModalOpen: boolean;
  isAddBroadcastModalOpen: boolean;
  isCheckInModalOpen: boolean;
  isProfileDetailModalOpen: boolean;
  selectedUserId: string | null;
  isAddMyContactModalOpen: boolean;
  conversationModalOpen: boolean;
}

interface UIStore {
  // Toast state
  toast: ToastState;
  showToast: (message: string, type?: ToastState['type']) => void;
  hideToast: () => void;

  // Modal state
  modals: ModalState;
  openModal: (modal: keyof ModalState, userId?: string) => void;
  closeModal: (modal: keyof ModalState) => void;
  closeAllModals: () => void;

  // View preferences
  isGridView: boolean;
  toggleGridView: () => void;
  setGridView: (isGrid: boolean) => void;

  // UI feedback
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Snackbar state
  showCheckInSnackbar: boolean;
  setShowCheckInSnackbar: (show: boolean) => void;

  // Animation states
  showFeedAnimation: boolean;
  setShowFeedAnimation: (show: boolean) => void;
}

const initialToastState: ToastState = {
  isVisible: false,
  message: '',
  type: 'success',
};

const initialModalState: ModalState = {
  isAddCuesModalOpen: false,
  isAddBroadcastModalOpen: false,
  isCheckInModalOpen: false,
  isProfileDetailModalOpen: false,
  selectedUserId: null,
  isAddMyContactModalOpen: false,
  conversationModalOpen: false,
};

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    // Toast state
    toast: initialToastState,
    
    showToast: (message: string, type: ToastState['type'] = 'success') => {
      set({ 
        toast: { 
          isVisible: true, 
          message, 
          type 
        } 
      });
      // Auto-hide toast after 4 seconds
      setTimeout(() => {
        const currentToast = get().toast;
        if (currentToast.isVisible && currentToast.message === message) {
          get().hideToast();
        }
      }, 4000);
    },

    hideToast: () => set({ 
      toast: initialToastState 
    }),

    // Modal state
    modals: initialModalState,

    openModal: (modal: keyof ModalState, userId?: string) => {
      set(state => ({
        modals: {
          ...state.modals,
          [modal]: true,
          ...(userId && { selectedUserId: userId })
        }
      }));
    },

    closeModal: (modal: keyof ModalState) => {
      set(state => ({
        modals: {
          ...state.modals,
          [modal]: false,
          // Clear selected user when closing profile modal
          ...(modal === 'isProfileDetailModalOpen' && { selectedUserId: null })
        }
      }));
    },

    closeAllModals: () => set({ 
      modals: initialModalState 
    }),

    // View preferences
    isGridView: true,
    
    toggleGridView: () => set(state => ({ 
      isGridView: !state.isGridView 
    })),
    
    setGridView: (isGrid: boolean) => set({ 
      isGridView: isGrid 
    }),

    // UI feedback
    isLoading: false,
    setLoading: (loading: boolean) => set({ 
      isLoading: loading 
    }),

    // Snackbar state
    showCheckInSnackbar: false,
    setShowCheckInSnackbar: (show: boolean) => set({ 
      showCheckInSnackbar: show 
    }),

    // Animation states
    showFeedAnimation: false,
    setShowFeedAnimation: (show: boolean) => set({ 
      showFeedAnimation: show 
    }),
  }))
);