import { http, HttpResponse } from 'msw';
import { FEATURE_DEFAULTS, EXPERIMENT_DEFAULTS } from '../../config/featureDefaults';
import { API_CONFIG } from '../../config/appConstants';
import type { FeatureFlag, Experiment } from '../../contexts/FeatureContext';

// Extended type for mock data that includes percentage rollout
interface MockFeatureFlag extends Partial<FeatureFlag> {
  percentage?: number;
}

// Simulate user assignment hash for consistent A/B test results
function hashUserId(userId: string, key: string): number {
  let hash = 0;
  const str = `${userId}:${key}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100; // Return 0-99
}

// Mock feature flag evaluations
const mockFeatureFlags = new Map<string, MockFeatureFlag>();

// Pre-populate with some dynamic behavior
mockFeatureFlags.set('new_discovery_algorithm', {
  enabled: true,
  value: true,
  reason: 'rollout_included'
});

mockFeatureFlags.set('dark_mode', {
  enabled: true,
  value: true,
  reason: 'default'
});

mockFeatureFlags.set('premium_features', {
  enabled: false,
  value: false,
  reason: 'not_in_rollout'
});

// Mock experiments with realistic assignment logic
const mockExperiments = new Map<string, any>();

mockExperiments.set('onboarding_flow_test', {
  status: 'running',
  traffic_allocation: 50,
  variants: [
    { key: 'control', weight: 50, payload: { flow_type: 'standard', steps: 4 } },
    { key: 'simplified', weight: 50, payload: { flow_type: 'simplified', steps: 2 } }
  ]
});

mockExperiments.set('profile_layout_test', {
  status: 'running', 
  traffic_allocation: 25,
  variants: [
    { key: 'control', weight: 50, payload: { layout: 'sidebar' } },
    { key: 'centered', weight: 30, payload: { layout: 'centered' } },
    { key: 'minimal', weight: 20, payload: { layout: 'minimal' } }
  ]
});

export const featureHandlers = [
  // Evaluate single feature flag
  http.get(`${API_CONFIG.BASE_URL}/features/flags/:key/evaluate`, ({ request, params }) => {
    const { key } = params;
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id') || 'anonymous';
    const environment = url.searchParams.get('environment') || 'development';
    
    // Get mock data or fall back to defaults
    const mockData = mockFeatureFlags.get(key as string);
    const defaultEnabled = FEATURE_DEFAULTS[key as keyof typeof FEATURE_DEFAULTS] ?? false;
    
    let enabled = mockData?.enabled ?? defaultEnabled;
    let reason = mockData?.reason ?? 'default';
    let value = mockData?.value ?? enabled;
    
    // Simulate percentage rollout for some flags
    if (key === 'new_discovery_algorithm' && userId !== 'anonymous') {
      const hash = hashUserId(userId, key as string);
      enabled = hash <= 25; // 25% rollout
      reason = enabled ? 'rollout_included' : 'rollout_excluded';
      value = enabled;
    }
    
    // Simulate environment-specific behavior
    if (environment === 'production') {
      // More conservative in production
      if (key === 'beta_mobile_app') {
        enabled = false;
        reason = 'disabled_in_production';
        value = false;
      }
    }

    const result: FeatureFlag = {
      key: key as string,
      enabled,
      value,
      reason,
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json(result);
  }),

  // Evaluate multiple flags
  http.post(`${API_CONFIG.BASE_URL}/features/flags/evaluate`, async ({ request }) => {
    const body = await request.json() as { flag_keys: string[] };
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id') || 'anonymous';
    const environment = url.searchParams.get('environment') || 'development';

    const flags: Record<string, FeatureFlag> = {};
    
    for (const key of body.flag_keys) {
      const mockData = mockFeatureFlags.get(key);
      const defaultEnabled = FEATURE_DEFAULTS[key as keyof typeof FEATURE_DEFAULTS] ?? false;
      
      let enabled = mockData?.enabled ?? defaultEnabled;
      let reason = mockData?.reason ?? 'default';
      
      // Simulate user-specific percentage rollout
      if (mockData?.percentage !== undefined) {
        const userHash = userId.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
        const userPercentage = (userHash % 100) + 1;
        enabled = userPercentage <= mockData.percentage;
        reason = enabled ? 'percentage_enabled' : 'percentage_disabled';
      }
      
      // Environment-specific overrides
      if (environment === 'development') {
        // In dev, enable all flags by default for testing
        enabled = mockData?.enabled ?? true;
      }
      
      // Apply rollout logic
      if (key === 'new_discovery_algorithm' && userId !== 'anonymous') {
        const hash = hashUserId(userId, key);
        enabled = hash <= 25;
        reason = enabled ? 'rollout_included' : 'rollout_excluded';
      }
      
      flags[key] = {
        key,
        enabled,
        value: enabled,
        reason,
        timestamp: new Date().toISOString(),
      };
    }

    return HttpResponse.json({ flags });
  }),

  // Get all flags
  http.get(`${API_CONFIG.BASE_URL}/features/flags`, ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id') || 'anonymous';
    const environment = url.searchParams.get('environment') || 'development';
    
    const flags: Record<string, FeatureFlag> = {};
    
    // Return all feature defaults plus any mocked overrides
    Object.entries(FEATURE_DEFAULTS).forEach(([key, defaultValue]) => {
      const mockData = mockFeatureFlags.get(key);
      let enabled = mockData?.enabled ?? defaultValue;
      let reason = mockData?.reason ?? 'default';
      
      // Simulate user-specific percentage rollout
      if (mockData?.percentage !== undefined) {
        const userHash = userId.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
        const userPercentage = (userHash % 100) + 1;
        enabled = userPercentage <= mockData.percentage;
        reason = enabled ? 'percentage_enabled' : 'percentage_disabled';
      }
      
      // Environment-specific overrides
      if (environment === 'development') {
        enabled = mockData?.enabled ?? true;
      }
      
      // Apply specific logic for certain flags
      if (key === 'new_discovery_algorithm' && userId !== 'anonymous') {
        const hash = hashUserId(userId, key);
        enabled = hash <= 25;
        reason = enabled ? 'rollout_included' : 'rollout_excluded';
      }
      
      flags[key] = {
        key,
        enabled,
        value: enabled,
        reason,
        timestamp: new Date().toISOString(),
      };
    });

    return HttpResponse.json({ flags });
  }),

  // POST version for all flags (with user attributes)
  http.post(`${API_CONFIG.BASE_URL}/features/flags`, async ({ request }) => {
    const url = new URL(request.url);
    url.searchParams.get('user_id') || 'anonymous';
    url.searchParams.get('environment') || 'development';
    
    const flags: Record<string, FeatureFlag> = {};
    
    Object.entries(FEATURE_DEFAULTS).forEach(([key, defaultValue]) => {
      const mockData = mockFeatureFlags.get(key);
      let enabled = mockData?.enabled ?? defaultValue;
      let reason = mockData?.reason ?? 'default';
      
      flags[key] = {
        key,
        enabled,
        value: enabled,
        reason,
        timestamp: new Date().toISOString(),
      };
    });

    return HttpResponse.json({ flags });
  }),

  // Evaluate experiment
  http.get(`${API_CONFIG.BASE_URL}/features/experiments/:key/evaluate`, ({ request, params }) => {
    const { key } = params;
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id') || 'anonymous';
    const environment = url.searchParams.get('environment') || 'development';
    
    const experiment = mockExperiments.get(key as string);
    
    // Store environment and userId for use in variant assignment later
    const isDevEnvironment = environment === 'development' && userId !== 'anonymous';
    
    if (!experiment) {
      const defaultExperiment = EXPERIMENT_DEFAULTS[key as keyof typeof EXPERIMENT_DEFAULTS];
      return HttpResponse.json({
        key,
        reason: 'experiment_not_found',
        timestamp: new Date().toISOString(),
        ...defaultExperiment,
      });
    }

    // Check if user is in experiment traffic
    const hash = hashUserId(userId, key as string);
    const inTraffic = hash <= experiment.traffic_allocation;
    
    if (!inTraffic) {
      return HttpResponse.json({
        key,
        in_experiment: false,
        variant: 'control',
        variant_id: null,
        payload: {},
        reason: 'traffic_excluded',
        timestamp: new Date().toISOString(),
      });
    }

    // Assign variant based on weights (with dev environment bias)
    let variantHash = hash % 100;
    
    // In development, bias towards treatment variants for testing
    if (isDevEnvironment && variantHash < 30) {
      variantHash = variantHash + 40; // Shift probability towards higher values
    }
    
    let cumulativeWeight = 0;
    let selectedVariant = experiment.variants[0]; // fallback to first variant
    
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      if (variantHash < cumulativeWeight) {
        selectedVariant = variant;
        break;
      }
    }

    const result: Experiment = {
      key: key as string,
      in_experiment: true,
      variant: selectedVariant.key,
      variant_id: `variant-${selectedVariant.key}`,
      payload: selectedVariant.payload,
      reason: 'assigned_to_variant',
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json(result);
  }),

  // Track event
  http.post(`${API_CONFIG.BASE_URL}/features/events`, async ({ request }) => {
    const event = await request.json();
    
    // Log the event for debugging
    console.log('🔍 Feature event tracked:', event);
    
    // Always return success for reliable demo experience
    return HttpResponse.json({ success: true });
  }),

  // Cache invalidation
  http.post(`${API_CONFIG.BASE_URL}/features/cache/invalidate`, async ({ request }) => {
    const body = await request.json() as { keys: string[] };
    console.log('🗑️  Feature cache invalidated:', body.keys);
    return HttpResponse.json({ success: true });
  }),
];

// Utility functions for tests to manipulate mock data
export const mockFeatureUtils = {
  setFeatureFlag: (key: string, enabled: boolean, reason = 'mock_override') => {
    mockFeatureFlags.set(key, { enabled, value: enabled, reason });
  },
  
  removeFeatureFlag: (key: string) => {
    mockFeatureFlags.delete(key);
  },
  
  setExperiment: (key: string, config: any) => {
    mockExperiments.set(key, config);
  },
  
  removeExperiment: (key: string) => {
    mockExperiments.delete(key);
  },
  
  reset: () => {
    mockFeatureFlags.clear();
    mockExperiments.clear();
    
    // Re-populate defaults
    mockFeatureFlags.set('new_discovery_algorithm', {
      enabled: true,
      value: true,
      reason: 'rollout_included'
    });
    
    mockFeatureFlags.set('dark_mode', {
      enabled: true,
      value: true,
      reason: 'default'
    });
  }
};