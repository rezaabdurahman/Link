/**
 * Test Environment Polyfill for import.meta.env
 * 
 * This module provides a polyfill for import.meta.env in test environments
 * where Vite's built-in environment variables are not available.
 * 
 * IMPORTANT: This polyfill should only run in test environments and is
 * automatically excluded from production builds.
 */

// TypeScript declaration for import.meta.env structure
type ImportMetaEnvVars = {
  NODE_ENV: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  VITE_API_BASE_URL: string;
  VITE_API_URL: string;
  VITE_APP_MODE: string;
  VITE_ENABLE_MOCKING: string;
  [key: string]: any;
};

// Extend the global scope to include our polyfilled import.meta
declare global {
  interface GlobalThis {
    import?: {
      meta: {
        env: ImportMetaEnvVars;
      };
    };
  }
}

/**
 * Initializes the import.meta.env polyfill for test environments.
 * This function should be called early in the test setup process.
 * 
 * The polyfill will only be applied if we're not in a production build
 * and if import.meta is not already available.
 */
export function initializeTestEnvironment(): void {
  // Safety check: Only run in test environments, never in production
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return;
  }

  // Additional safety check: Don't override if import.meta already exists
  if (typeof (globalThis as any).import !== 'undefined' && (globalThis as any).import.meta?.env) {
    return;
  }

  // Set up the polyfill for import.meta.env using real environment variables
  // These values are loaded from .env.test via dotenv in jest.config.js
  const envVars: ImportMetaEnvVars = {
    NODE_ENV: process.env.NODE_ENV || 'test',
    MODE: process.env.NODE_ENV || 'test',
    DEV: false,
    PROD: false,
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
    VITE_API_URL: process.env.VITE_API_URL || 'http://localhost:8080',
    VITE_APP_MODE: process.env.VITE_APP_MODE || 'test',
    VITE_ENABLE_MOCKING: process.env.VITE_ENABLE_MOCKING || 'true',
    VITE_REQUIRE_AUTH: process.env.VITE_REQUIRE_AUTH || 'false',
    VITE_AUTO_LOGIN: process.env.VITE_AUTO_LOGIN || 'false',
    VITE_MOCK_USER: process.env.VITE_MOCK_USER || 'true',
    VITE_SHOW_DEMO_BANNER: process.env.VITE_SHOW_DEMO_BANNER || 'false',
    VITE_DEMO_BANNER_TEXT: process.env.VITE_DEMO_BANNER_TEXT || '',
    VITE_SEED_DEMO_DATA: process.env.VITE_SEED_DEMO_DATA || 'false'
  };

  (globalThis as any).import = {
    meta: {
      env: envVars
    }
  };
}

/**
 * Helper function to check if we're in a test environment
 */
export function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || 
     process.env?.JEST_WORKER_ID !== undefined ||
     process.env?.VITEST !== undefined)
  );
}

/**
 * Auto-initialize the polyfill if we're in a test environment
 * This ensures the polyfill is applied as soon as this module is imported
 */
if (isTestEnvironment()) {
  initializeTestEnvironment();
}

// Export the type for convenience
export type ImportMetaEnv = ImportMetaEnvVars;
