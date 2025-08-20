// Mock configuration for Jest tests
export const APP_CONFIG = {
  // Environment detection
  isDemo: false,
  isPreview: false,
  isProduction: false,
  
  // Authentication configuration
  auth: {
    requireAuth: true,
    autoLogin: false,
    mockUser: false,
  },
  
  // Demo-specific settings
  demo: {
    showBanner: false,
    bannerText: '🚀 Demo Mode - This is a preview version for feedback',
    seedData: false,
  }
} as const;

// Helper functions
export const isAuthRequired = (): boolean => {
  return APP_CONFIG.auth.requireAuth && !APP_CONFIG.isDemo;
};

export const shouldShowDemoBanner = (): boolean => {
  return APP_CONFIG.isDemo && APP_CONFIG.demo.showBanner;
};

// Mock feature flags
export const FeatureFlags = {
  SMART_GRID_ENABLED: true,
  ADVANCED_SEARCH: true,
  UNIFIED_SEARCH: true,
  CONVERSATIONAL_CUE_CARDS: true,
} as const;

export const isFeatureEnabled = (flag: string): boolean => {
  return (FeatureFlags as any)[flag] || false;
};

export type FeatureFlagKey = keyof typeof FeatureFlags;
export type AppConfigKey = string;
export type MetaConfigKey = string;
export type FeatureConfigKey = string;
