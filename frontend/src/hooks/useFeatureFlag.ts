import { useFeatures } from '../contexts/FeatureContext';

/**
 * Hook to check if a feature flag is enabled
 */
export const useFeatureFlag = (key: string): boolean => {
  const { isFeatureEnabled } = useFeatures();
  return isFeatureEnabled(key);
};

/**
 * Hook to get a feature flag value with optional default
 */
export const useFeatureValue = <T = any>(key: string, defaultValue?: T): T => {
  const { getFeatureValue } = useFeatures();
  return getFeatureValue(key, defaultValue);
};

/**
 * Hook to get a feature flag variant
 */
export const useFeatureVariant = (key: string): string | null => {
  const { getFeatureVariant } = useFeatures();
  return getFeatureVariant(key);
};

/**
 * Hook to get feature flag details
 */
export const useFeatureDetails = (key: string) => {
  const { flags } = useFeatures();
  return flags[key] || null;
};

/**
 * Hook for multiple feature flags at once
 */
export const useFeatureFlags = (keys: string[]) => {
  const { flags, isFeatureEnabled } = useFeatures();
  
  return {
    flags: keys.reduce((acc, key) => {
      acc[key] = flags[key] || { key, enabled: false, reason: 'not_found', timestamp: new Date().toISOString() };
      return acc;
    }, {} as Record<string, any>),
    enabled: keys.reduce((acc, key) => {
      acc[key] = isFeatureEnabled(key);
      return acc;
    }, {} as Record<string, boolean>),
  };
};