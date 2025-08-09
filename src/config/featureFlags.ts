// Feature flags configuration
export const FeatureFlags = {
  // Intelligent chat features
  CONVERSATION_CUE_CARDS: true, // Show conversation cue cards
  INTELLIGENT_MESSAGE_BOX: false, // Hide intelligent message search box
  
  // Future feature flags can be added here
  // ADVANCED_CHAT_ANALYTICS: false,
  // SMART_SUGGESTIONS: false,
} as const;

export type FeatureFlagKey = keyof typeof FeatureFlags;

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => {
  return FeatureFlags[flag];
};
