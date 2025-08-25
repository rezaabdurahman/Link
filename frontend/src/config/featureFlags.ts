// Legacy feature flags configuration - migrating to dynamic feature flags
// @deprecated Use useFeatureFlag hook or FeatureGate component instead
export const FeatureFlags = {
  // Intelligent chat features
  CONVERSATION_CUE_CARDS: true, // Show conversation cue cards - migrate to 'conversation_cue_cards'
  INTELLIGENT_MESSAGE_BOX: false, // Hide intelligent message search box - migrate to 'intelligent_message_box'
  AI_CONVERSATION_SUMMARIES: true, // Enable AI-powered conversation summaries - migrate to 'ai_conversation_summary'
  
  // Discovery page features
  DISCOVERY_CUES: true, // Enable social cues functionality - migrate to 'discovery_cues'
  DISCOVERY_BROADCAST: true, // Enable broadcast functionality - migrate to 'discovery_broadcast'
  DISCOVERY_GRID_VIEW: true, // Enable grid/feed view toggle - migrate to 'discovery_grid_view'
  
  // Future feature flags can be added here
  // ADVANCED_CHAT_ANALYTICS: false,
  // SMART_SUGGESTIONS: false,
} as const;

export type FeatureFlagKey = keyof typeof FeatureFlags;

// @deprecated Helper function - use useFeatureFlag hook instead
export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => {
  return FeatureFlags[flag];
};

// Migration mapping from legacy flags to new feature flag keys
export const FEATURE_FLAG_MIGRATION = {
  CONVERSATION_CUE_CARDS: 'conversation_cue_cards',
  INTELLIGENT_MESSAGE_BOX: 'intelligent_message_box',
  AI_CONVERSATION_SUMMARIES: 'ai_conversation_summary',
  DISCOVERY_CUES: 'discovery_cues', 
  DISCOVERY_BROADCAST: 'discovery_broadcast',
  DISCOVERY_GRID_VIEW: 'discovery_grid_view',
} as const;
