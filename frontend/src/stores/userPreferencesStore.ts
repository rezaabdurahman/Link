import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

export interface UserPreferences {
  // UI Preferences
  theme: 'light' | 'dark' | 'system';
  reducedMotion: boolean;
  soundEnabled: boolean;
  
  // Discovery Preferences
  defaultGridView: boolean;
  autoRefreshResults: boolean;
  showClickLikelihoods: boolean;
  maxSearchDistance: number;
  
  // Chat Preferences  
  defaultChatSort: 'priority' | 'time' | 'unread';
  showTypingIndicators: boolean;
  markReadOnView: boolean;
  
  // Notification Preferences
  pushNotifications: boolean;
  emailNotifications: boolean;
  friendRequestNotifications: boolean;
  messageNotifications: boolean;
  discoveryNotifications: boolean;
  
  // Privacy Preferences
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowLocationSharing: boolean;
  indexableProfile: boolean;
  
  // Content Preferences
  filterExplicitContent: boolean;
  showMutualFriendsCount: boolean;
  
  // Performance Preferences
  imageQuality: 'low' | 'medium' | 'high';
  autoLoadImages: boolean;
  prefetchContent: boolean;
  
  // Accessibility Preferences
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  screenReaderOptimized: boolean;
}

export interface DeveloperPreferences {
  // Debug settings
  showDebugInfo: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableMockData: boolean;
  apiEndpointOverride?: string;
  
  // Feature flags override
  featureFlagOverrides: Record<string, boolean>;
  
  // Performance monitoring
  trackPerformance: boolean;
  recordUserInteractions: boolean;
}

interface UserPreferencesStore {
  preferences: UserPreferences;
  developerPreferences: DeveloperPreferences;
  
  // Preference actions
  setPreference: <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => void;
  
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  
  // Developer preference actions
  setDeveloperPreference: <K extends keyof DeveloperPreferences>(
    key: K,
    value: DeveloperPreferences[K]
  ) => void;
  
  toggleFeatureFlag: (flagName: string) => void;
  clearFeatureFlagOverrides: () => void;
  
  // Computed preferences
  getEffectiveTheme: () => 'light' | 'dark';
  shouldReduceMotion: () => boolean;
  getImageQuality: () => 'low' | 'medium' | 'high';
  
  // Import/Export
  exportPreferences: () => string;
  importPreferences: (data: string) => boolean;
}

const defaultUserPreferences: UserPreferences = {
  // UI Preferences
  theme: 'system',
  reducedMotion: false,
  soundEnabled: true,
  
  // Discovery Preferences
  defaultGridView: true,
  autoRefreshResults: true,
  showClickLikelihoods: false,
  maxSearchDistance: 50, // km
  
  // Chat Preferences
  defaultChatSort: 'priority',
  showTypingIndicators: true,
  markReadOnView: true,
  
  // Notification Preferences
  pushNotifications: true,
  emailNotifications: true,
  friendRequestNotifications: true,
  messageNotifications: true,
  discoveryNotifications: false,
  
  // Privacy Preferences
  showOnlineStatus: true,
  showLastSeen: true,
  allowLocationSharing: true,
  indexableProfile: true,
  
  // Content Preferences
  filterExplicitContent: true,
  showMutualFriendsCount: true,
  
  // Performance Preferences
  imageQuality: 'medium',
  autoLoadImages: true,
  prefetchContent: true,
  
  // Accessibility Preferences
  fontSize: 'medium',
  highContrast: false,
  screenReaderOptimized: false,
};

const defaultDeveloperPreferences: DeveloperPreferences = {
  showDebugInfo: false,
  logLevel: 'warn',
  enableMockData: false,
  featureFlagOverrides: {},
  trackPerformance: true,
  recordUserInteractions: false,
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        preferences: defaultUserPreferences,
        developerPreferences: defaultDeveloperPreferences,

        // Preference actions
        setPreference: <K extends keyof UserPreferences>(
          key: K, 
          value: UserPreferences[K]
        ) => {
          set(state => ({
            preferences: {
              ...state.preferences,
              [key]: value,
            }
          }));
        },

        setPreferences: (newPreferences: Partial<UserPreferences>) => {
          set(state => ({
            preferences: {
              ...state.preferences,
              ...newPreferences,
            }
          }));
        },

        resetPreferences: () => {
          set({ preferences: defaultUserPreferences });
        },

        // Developer preference actions
        setDeveloperPreference: <K extends keyof DeveloperPreferences>(
          key: K,
          value: DeveloperPreferences[K]
        ) => {
          set(state => ({
            developerPreferences: {
              ...state.developerPreferences,
              [key]: value,
            }
          }));
        },

        toggleFeatureFlag: (flagName: string) => {
          set(state => {
            const currentOverrides = state.developerPreferences.featureFlagOverrides;
            const newOverrides = { ...currentOverrides };
            
            if (flagName in newOverrides) {
              newOverrides[flagName] = !newOverrides[flagName];
            } else {
              newOverrides[flagName] = true;
            }

            return {
              developerPreferences: {
                ...state.developerPreferences,
                featureFlagOverrides: newOverrides,
              }
            };
          });
        },

        clearFeatureFlagOverrides: () => {
          set(state => ({
            developerPreferences: {
              ...state.developerPreferences,
              featureFlagOverrides: {},
            }
          }));
        },

        // Computed preferences
        getEffectiveTheme: () => {
          const { preferences } = get();
          
          if (preferences.theme !== 'system') {
            return preferences.theme;
          }
          
          // Check system preference
          if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches 
              ? 'dark' 
              : 'light';
          }
          
          return 'light';
        },

        shouldReduceMotion: () => {
          const { preferences } = get();
          
          if (preferences.reducedMotion) {
            return true;
          }
          
          // Check system preference
          if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          }
          
          return false;
        },

        getImageQuality: () => {
          const { preferences } = get();
          
          // Auto-adjust based on connection if needed
          if (typeof navigator !== 'undefined' && 'connection' in navigator) {
            const connection = (navigator as any).connection;
            if (connection && connection.effectiveType === 'slow-2g') {
              return 'low';
            }
          }
          
          return preferences.imageQuality;
        },

        // Import/Export
        exportPreferences: () => {
          const { preferences, developerPreferences } = get();
          return JSON.stringify({
            preferences,
            developerPreferences,
            exportedAt: new Date().toISOString(),
            version: '1.0',
          }, null, 2);
        },

        importPreferences: (data: string) => {
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.preferences) {
              set(() => ({
                preferences: {
                  ...defaultUserPreferences,
                  ...parsed.preferences,
                }
              }));
            }
            
            if (parsed.developerPreferences) {
              set(() => ({
                developerPreferences: {
                  ...defaultDeveloperPreferences,
                  ...parsed.developerPreferences,
                }
              }));
            }
            
            return true;
          } catch (error) {
            console.error('Failed to import preferences:', error);
            return false;
          }
        },
      }),
      {
        name: 'user-preferences',
        // Persist everything for user preferences
        version: 1,
        migrate: (persistedState: any, version: number) => {
          // Handle migration between versions
          if (version === 0) {
            // Migrate from v0 to v1
            return {
              ...persistedState,
              preferences: {
                ...defaultUserPreferences,
                ...persistedState.preferences,
              },
              developerPreferences: {
                ...defaultDeveloperPreferences,
                ...persistedState.developerPreferences,
              },
            };
          }
          return persistedState;
        },
      }
    )
  )
);