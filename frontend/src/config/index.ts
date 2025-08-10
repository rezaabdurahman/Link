// Configuration exports

// Demo and Preview Configuration
export const APP_CONFIG = {
  // Environment detection
  isDemo: import.meta.env.VITE_APP_MODE === 'demo',
  isPreview: import.meta.env.VITE_APP_MODE === 'preview',
  isProduction: import.meta.env.VITE_APP_MODE === 'production',
  
  // Authentication configuration
  auth: {
    requireAuth: import.meta.env.VITE_REQUIRE_AUTH !== 'false',
    autoLogin: import.meta.env.VITE_AUTO_LOGIN === 'true',
    mockUser: import.meta.env.VITE_MOCK_USER === 'true',
  },
  
  // Demo-specific settings
  demo: {
    showBanner: import.meta.env.VITE_SHOW_DEMO_BANNER === 'true',
    bannerText: import.meta.env.VITE_DEMO_BANNER_TEXT || '🚀 Demo Mode - This is a preview version for feedback',
    seedData: import.meta.env.VITE_SEED_DEMO_DATA === 'true',
  }
} as const;

// Helper functions
export const isAuthRequired = () => {
  return APP_CONFIG.auth.requireAuth && !APP_CONFIG.isDemo;
};

export const shouldShowDemoBanner = () => {
  return APP_CONFIG.isDemo && APP_CONFIG.demo.showBanner;
};
export { FeatureFlags, isFeatureEnabled } from './featureFlags';
export type { FeatureFlagKey } from './featureFlags';

// Note: APP_CONFIG is defined above, importing constants from appConstants
export type { AppConfigKey, MetaConfigKey, FeatureConfigKey } from './appConstants';
