// Configuration exports

// Environment variables helper - Jest compatible
const getEnv = (key: string, defaultValue?: string): string | undefined => {
  // In test environment, use our mock
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return process.env[key] || defaultValue;
  }
  // In browser/Vite environment - check for import.meta safely
  try {
    // This will be evaluated at runtime, so Jest won't parse import.meta
    const importMeta = eval('import.meta');
    if (importMeta && importMeta.env) {
      return importMeta.env[key] || defaultValue;
    }
  } catch {
    // Ignore errors in environments that don't support import.meta
  }
  // Fallback
  return defaultValue;
};

// Demo and Preview Configuration
export const APP_CONFIG = {
  // Environment detection
  isDemo: getEnv('VITE_APP_MODE') === 'demo',
  isPreview: getEnv('VITE_APP_MODE') === 'preview',
  isProduction: getEnv('VITE_APP_MODE') === 'production',
  
  // Authentication configuration
  auth: {
    requireAuth: getEnv('VITE_REQUIRE_AUTH') !== 'false',
    autoLogin: getEnv('VITE_AUTO_LOGIN') === 'true',
    mockUser: getEnv('VITE_MOCK_USER') === 'true',
  },
  
  // Demo-specific settings
  demo: {
    showBanner: getEnv('VITE_SHOW_DEMO_BANNER') === 'true',
    bannerText: getEnv('VITE_DEMO_BANNER_TEXT') || '🚀 Demo Mode - This is a preview version for feedback',
    seedData: getEnv('VITE_SEED_DEMO_DATA') === 'true',
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
