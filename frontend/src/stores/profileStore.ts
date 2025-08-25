import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { User, AuthUser } from '../types';
import { UserProfileResponse } from '../services/userClient';

export interface ProfileEditData {
  first_name?: string;
  last_name?: string;
  bio?: string;
  interests?: string[];
  location?: string;
  profile_picture?: string;
  additional_photos?: string[];
}

export interface ProfileState {
  // Current user profile data
  currentUserProfile: AuthUser | null;
  
  // Viewing profile data (when viewing other profiles)
  viewingProfile: User | UserProfileResponse | null;
  viewingUserId: string | null;
  
  // Edit state
  isEditing: boolean;
  editData: ProfileEditData;
  hasUnsavedChanges: boolean;
  
  // Availability state
  isAvailable: boolean;
  isAvailabilitySubmitting: boolean;
  
  // UI state
  showMontage: boolean;
  activePhotoIndex: number;
  
  // Loading states
  isLoadingProfile: boolean;
  isSavingProfile: boolean;
  profileError: string | null;
}

interface ProfileStore extends ProfileState {
  // Profile data actions
  setCurrentUserProfile: (profile: AuthUser) => void;
  setViewingProfile: (profile: User | UserProfileResponse | null, userId?: string | null) => void;
  updateCurrentUserProfile: (updates: Partial<AuthUser>) => void;
  
  // Edit actions
  setEditing: (editing: boolean) => void;
  setEditData: (data: ProfileEditData) => void;
  updateEditField: <K extends keyof ProfileEditData>(field: K, value: ProfileEditData[K]) => void;
  resetEditData: () => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Availability actions
  setAvailability: (available: boolean) => void;
  setAvailabilitySubmitting: (submitting: boolean) => void;
  
  // UI actions
  setShowMontage: (show: boolean) => void;
  setActivePhotoIndex: (index: number) => void;
  nextPhoto: () => void;
  prevPhoto: () => void;
  
  // Loading actions
  setLoadingProfile: (loading: boolean) => void;
  setSavingProfile: (saving: boolean) => void;
  setProfileError: (error: string | null) => void;
  
  // Computed getters
  getDisplayPhotos: () => string[];
  canNavigateNext: () => boolean;
  canNavigatePrev: () => boolean;
  getTotalPhotos: () => number;
  
  // Actions
  saveProfile: () => Promise<void>;
  discardChanges: () => void;
}

const initialEditData: ProfileEditData = {};

const initialState: ProfileState = {
  currentUserProfile: null,
  viewingProfile: null,
  viewingUserId: null,
  isEditing: false,
  editData: initialEditData,
  hasUnsavedChanges: false,
  isAvailable: true, // Default to true for demo mode
  isAvailabilitySubmitting: false,
  showMontage: false,
  activePhotoIndex: 0,
  isLoadingProfile: false,
  isSavingProfile: false,
  profileError: null,
};

export const useProfileStore = create<ProfileStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Profile data actions
        setCurrentUserProfile: (profile: AuthUser) => {
          set({ 
            currentUserProfile: profile,
            // Note: availability is managed separately via availability API - don't override
          });
        },

        setViewingProfile: (profile: User | UserProfileResponse | null, userId?: string | null) => {
          set({ 
            viewingProfile: profile,
            viewingUserId: userId || null,
            activePhotoIndex: 0 // Reset photo index when viewing new profile
          });
        },

        updateCurrentUserProfile: (updates: Partial<AuthUser>) => {
          set(state => ({
            currentUserProfile: state.currentUserProfile ? {
              ...state.currentUserProfile,
              ...updates
            } : null
          }));
        },

        // Edit actions
        setEditing: (editing: boolean) => {
          if (editing && get().currentUserProfile) {
            // Initialize edit data with current profile data
            const profile = get().currentUserProfile!;
            set({
              isEditing: editing,
              editData: {
                first_name: profile.first_name,
                last_name: profile.last_name || undefined,
                bio: profile.bio || undefined,
                interests: [...(profile.interests || [])],
                location: profile.location || undefined,
                profile_picture: profile.profile_picture || undefined,
                additional_photos: [...(profile.additional_photos || [])],
              }
            });
          } else {
            set({ isEditing: editing });
          }
        },

        setEditData: (data: ProfileEditData) => set({ editData: data }),

        updateEditField: <K extends keyof ProfileEditData>(field: K, value: ProfileEditData[K]) => {
          set(state => ({
            editData: { ...state.editData, [field]: value },
            hasUnsavedChanges: true
          }));
        },

        resetEditData: () => set({ 
          editData: initialEditData, 
          hasUnsavedChanges: false 
        }),

        setHasUnsavedChanges: (hasChanges: boolean) => set({ hasUnsavedChanges: hasChanges }),

        // Availability actions
        setAvailability: (available: boolean) => set({ isAvailable: available }),
        setAvailabilitySubmitting: (submitting: boolean) => set({ isAvailabilitySubmitting: submitting }),

        // UI actions
        setShowMontage: (show: boolean) => set({ showMontage: show }),
        setActivePhotoIndex: (index: number) => set({ activePhotoIndex: index }),

        nextPhoto: () => {
          const { activePhotoIndex } = get();
          const totalPhotos = get().getTotalPhotos();
          if (activePhotoIndex < totalPhotos - 1) {
            set({ activePhotoIndex: activePhotoIndex + 1 });
          }
        },

        prevPhoto: () => {
          const { activePhotoIndex } = get();
          if (activePhotoIndex > 0) {
            set({ activePhotoIndex: activePhotoIndex - 1 });
          }
        },

        // Loading actions
        setLoadingProfile: (loading: boolean) => set({ isLoadingProfile: loading }),
        setSavingProfile: (saving: boolean) => set({ isSavingProfile: saving }),
        setProfileError: (error: string | null) => set({ profileError: error }),

        // Computed getters
        getDisplayPhotos: () => {
          const { currentUserProfile, viewingProfile, viewingUserId } = get();
          
          // Determine which profile to use
          const profile = viewingUserId ? viewingProfile : currentUserProfile;
          if (!profile) return [];

          const photos = [];
          if ('profilePicture' in profile && profile.profilePicture) {
            photos.push(profile.profilePicture);
          } else if ('profile_picture' in profile && profile.profile_picture) {
            photos.push(profile.profile_picture);
          }
          // Check for additional_photos (only available on AuthUser type)
          if ('additional_photos' in profile && profile.additional_photos) {
            photos.push(...profile.additional_photos);
          }
          return photos;
        },

        canNavigateNext: () => {
          const { activePhotoIndex } = get();
          const totalPhotos = get().getTotalPhotos();
          return activePhotoIndex < totalPhotos - 1;
        },

        canNavigatePrev: () => {
          const { activePhotoIndex } = get();
          return activePhotoIndex > 0;
        },

        getTotalPhotos: () => {
          return get().getDisplayPhotos().length;
        },

        // Actions
        saveProfile: async () => {
          const { editData, currentUserProfile } = get();
          if (!currentUserProfile) return;

          set({ isSavingProfile: true, profileError: null });

          try {
            // Here you would make the API call to save the profile
            // For now, we'll just update the local state
            get().updateCurrentUserProfile(editData as Partial<AuthUser>);
            set({ 
              isEditing: false, 
              hasUnsavedChanges: false,
              editData: initialEditData
            });
          } catch (error) {
            console.error('Failed to save profile:', error);
            set({ profileError: 'Failed to save profile. Please try again.' });
          } finally {
            set({ isSavingProfile: false });
          }
        },

        discardChanges: () => {
          set({ 
            isEditing: false,
            editData: initialEditData,
            hasUnsavedChanges: false
          });
        },
      }),
      {
        name: 'profile-store',
        // Only persist certain parts of the state
        partialize: (state) => ({
          showMontage: state.showMontage,
          // Don't persist sensitive profile data - let it be fetched fresh
        }),
      }
    )
  )
);