// Feature flag defaults for fallback when service is unavailable
export const FEATURE_DEFAULTS = {
  // Core application features - default to enabled for better UX
  dark_mode: true,
  enhanced_chat_ui: false,
  discovery_cues: true,
  discovery_broadcast: true,
  discovery_grid_view: true,
  
  // New/experimental features - default to disabled for safety
  new_discovery_algorithm: false,
  ai_conversation_summary: false,
  premium_features: false,
  beta_mobile_app: false,
  
  // Legacy feature mapping for backward compatibility
  conversation_cue_cards: true,
  intelligent_message_box: false,
} as const;

export const EXPERIMENT_DEFAULTS = {
  onboarding_flow_test: {
    in_experiment: false,
    variant: 'control',
    variant_id: undefined,
    payload: {},
  },
  profile_layout_test: {
    in_experiment: false,
    variant: 'control',
    variant_id: undefined,
    payload: {},
  },
  message_suggestions_test: {
    in_experiment: false,
    variant: 'control',
    variant_id: undefined,
    payload: {},
  },
} as const;

// Environment-specific overrides
export const ENVIRONMENT_OVERRIDES = {
  development: {
    // Enable more features in development for testing
    ai_conversation_summary: true,
    new_discovery_algorithm: true,
    beta_mobile_app: true,
  },
  staging: {
    // Conservative approach in staging
    premium_features: true,
  },
  production: {
    // Very conservative in production
    ai_conversation_summary: false,
    beta_mobile_app: false,
  },
} as const;

export type FeatureDefaultKey = keyof typeof FEATURE_DEFAULTS;
export type ExperimentDefaultKey = keyof typeof EXPERIMENT_DEFAULTS;