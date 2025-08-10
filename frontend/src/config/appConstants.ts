// Centralized app configuration constants
export const APP_CONFIG = {
  appName: "Link",
  tagline: "connect with people around you",
  description: "AI-powered real-life connections",
  fullTagline: "connect with people around you. AI-powered connections, in real life.",
  version: "0.1.0",
  
  // Meta information
  meta: {
    title: "Link - connect with people around you",
    description: "Link - AI-powered real-life connections app that helps you connect with people around you",
    themeColor: "#000000",
  },

  // Feature descriptions
  features: {
    discovery: "Grid-based user discovery with proximity-based ranking",
    chat: "WhatsApp-like chat interface with AI-powered suggestions", 
    opportunities: "AI-suggested connection activities and friendship reminders",
    profile: "Editable bio, interests, and comprehensive privacy settings"
  }
} as const;

// Type exports for better TypeScript support
export type AppConfigKey = keyof typeof APP_CONFIG;
export type MetaConfigKey = keyof typeof APP_CONFIG.meta;
export type FeatureConfigKey = keyof typeof APP_CONFIG.features;
