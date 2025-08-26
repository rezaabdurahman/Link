/**
 * MSW Configuration Utilities
 * 
 * Provides environment-aware configuration for MSW handlers to match
 * the same API base URL logic used in production authClient.ts.
 * 
 * This ensures MSW handlers work consistently across different environments:
 * - Local development (localhost:8080)
 * - Demo/staging deployments (Vercel, etc.)
 * - Any custom API base URL via environment variables
 */

/**
 * API Base URL configuration that matches authClient.ts
 * 
 * Priority order (same as authClient.ts):
 * 1. VITE_API_BASE_URL (primary)
 * 2. VITE_API_URL (fallback)
 * 3. http://localhost:8080 (default for local development)
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
                           import.meta.env.VITE_API_URL || 
                           'http://localhost:8080';

/**
 * Helper function to build full API endpoint URLs
 * @param endpoint - The endpoint path (e.g., '/auth/login')
 * @returns Full URL (e.g., 'http://localhost:8080/auth/login')
 */
export const buildApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with '/'
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
};

/**
 * Common API endpoints used across handlers
 * These match the structure in authClient.ts
 */
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    register: '/auth/register',
    login: '/auth/login', 
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  
  // User endpoints
  USERS: {
    profile: '/users/profile',
    me: '/users/profile/me',
    byId: (id: string) => `/users/profile/${id}`,
  },
  
  // Chat endpoints
  CHAT: {
    conversations: '/chat/conversations',
    messages: '/chat/messages',
    sendMessage: '/chat/send',
  },
  
  // Friends endpoints
  FRIENDS: {
    status: '/friends/status',
    requests: '/friends/requests',
    send: '/friends/send',
    accept: '/friends/accept',
    reject: '/friends/reject',
    remove: '/friends/remove',
  },
  
  // Onboarding endpoints
  ONBOARDING: {
    status: '/onboarding/status',
    start: '/onboarding/start',
    step: '/onboarding/step',
    complete: '/onboarding/complete',
  },
  
  // Availability endpoints
  AVAILABILITY: {
    status: '/availability',
    update: '/availability',
  },
  
  // Broadcast endpoints
  BROADCASTS: {
    list: '/broadcasts',
    create: '/broadcasts',
    join: '/broadcasts/join',
    leave: '/broadcasts/leave',
  },
  
  // Montage endpoints
  MONTAGE: {
    byUserId: (id: string) => `/users/${id}/montage`,
  },
  
  // Search endpoints
  SEARCH: {
    unified: '/search',
  },
} as const;

/**
 * Environment detection utilities for MSW handlers
 */
export const ENV_CONFIG = {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  nodeEnv: import.meta.env.NODE_ENV,
  isDemo: import.meta.env.VITE_APP_MODE === 'demo',
  enableMocks: import.meta.env.VITE_ENABLE_MOCKING === 'true',
  apiBaseUrl: API_BASE_URL,
} as const;

/**
 * Debug logging for MSW configuration
 */
export const logMSWConfig = () => {
  console.log('🔧 MSW Config:', {
    apiBaseUrl: API_BASE_URL,
    environment: ENV_CONFIG,
    availableEnvVars: {
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'not set',
      VITE_API_URL: import.meta.env.VITE_API_URL || 'not set',
    }
  });
};
