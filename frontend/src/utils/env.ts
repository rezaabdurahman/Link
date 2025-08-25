// Environment variable utility that works in both browser and test environments

// Required environment variables for the application
const REQUIRED_ENV_VARS = [
  'VITE_API_BASE_URL',
  'VITE_APP_MODE',
  'VITE_REQUIRE_AUTH'
] as const;

// Optional environment variables with defaults
const ENV_DEFAULTS: Record<string, string> = {
  'VITE_API_BASE_URL': 'http://localhost:8080',
  'VITE_APP_MODE': 'development',
  'VITE_REQUIRE_AUTH': 'true',
  'VITE_AUTO_LOGIN': 'false',
  'VITE_MOCK_USER': 'false',
  'VITE_SHOW_DEMO_BANNER': 'false',
  'VITE_DEMO_BANNER_TEXT': '🚀 Demo Mode - This is a preview version for feedback',
  'VITE_SEED_DEMO_DATA': 'false',
  'VITE_ENABLE_MOCKING': 'false',
  'VITE_SENTRY_ENVIRONMENT': 'development',
  'VITE_APP_VERSION': '1.0.0-dev',
  'VITE_ENABLE_PERFORMANCE_TRACKING': 'false',
  'VITE_ENABLE_ERROR_TRACKING': 'false',
  'VITE_ENABLE_USER_JOURNEY_TRACKING': 'false',
  'VITE_DEBUG_MODE': 'false'
};

export const getEnvVar = (key: string, defaultValue?: string): string => {
  let value: string | undefined;

  // In test environment, use process.env
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    value = process.env[key];
  }
  // In Node.js/SSR environment, use process.env if available
  else if (typeof process !== 'undefined' && typeof window === 'undefined') {
    value = process.env[key];
  }
  // In browser, try import.meta.env (Vite runtime)
  else if (typeof window !== 'undefined' && import.meta?.env) {
    value = (import.meta.env as any)[key];
  }
  
  // Return value or fall back to defaults
  return value || ENV_DEFAULTS[key] || defaultValue || '';
};

export const getBooleanEnvVar = (key: string, _defaultValue = false): boolean => {  // TODO: defaultValue used for fallback boolean values
  const value = getEnvVar(key).toLowerCase();
  return value === 'true' || value === '1';
};

export const getNumberEnvVar = (key: string, defaultValue = 0): number => {
  const value = getEnvVar(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Validate required environment variables at startup
export const validateEnvironment = (): void => {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  REQUIRED_ENV_VARS.forEach((envVar) => {
    const value = getEnvVar(envVar);
    if (!value || value === ENV_DEFAULTS[envVar]) {
      warnings.push(`${envVar} is using default value: ${value}`);
    }
  });

  // Validate API URL format
  const apiUrl = getEnvVar('VITE_API_BASE_URL');
  try {
    new URL(apiUrl);
  } catch {
    missingVars.push('VITE_API_BASE_URL must be a valid URL');
  }

  // Validate app mode
  const appMode = getEnvVar('VITE_APP_MODE');
  if (!['development', 'staging', 'production', 'demo'].includes(appMode)) {
    warnings.push(`VITE_APP_MODE should be 'development', 'staging', 'production', or 'demo', got: ${appMode}`);
  }

  if (missingVars.length > 0) {
    console.error('❌ Environment validation failed:');
    missingVars.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Missing or invalid required environment variables: ${missingVars.join(', ')}`);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log('✅ Environment validation passed');
};

// Environment configuration object for easy access
export const env = {
  API_BASE_URL: getEnvVar('VITE_API_BASE_URL'),
  APP_MODE: getEnvVar('VITE_APP_MODE') as 'development' | 'staging' | 'production' | 'demo',
  REQUIRE_AUTH: getBooleanEnvVar('VITE_REQUIRE_AUTH', true),
  AUTO_LOGIN: getBooleanEnvVar('VITE_AUTO_LOGIN'),
  MOCK_USER: getBooleanEnvVar('VITE_MOCK_USER'),
  SHOW_DEMO_BANNER: getBooleanEnvVar('VITE_SHOW_DEMO_BANNER'),
  SEED_DEMO_DATA: getBooleanEnvVar('VITE_SEED_DEMO_DATA'),
  ENABLE_MOCKING: getBooleanEnvVar('VITE_ENABLE_MOCKING'),
  SENTRY_DSN: getEnvVar('VITE_SENTRY_DSN'),
  SENTRY_ENVIRONMENT: getEnvVar('VITE_SENTRY_ENVIRONMENT'),
  APP_VERSION: getEnvVar('VITE_APP_VERSION'),
  PERFORMANCE_TRACKING: getBooleanEnvVar('VITE_ENABLE_PERFORMANCE_TRACKING'),
  ERROR_TRACKING: getBooleanEnvVar('VITE_ENABLE_ERROR_TRACKING'),
  USER_JOURNEY_TRACKING: getBooleanEnvVar('VITE_ENABLE_USER_JOURNEY_TRACKING'),
  DEBUG_MODE: getBooleanEnvVar('VITE_DEBUG_MODE'),
  MOCK_DELAY_MS: getNumberEnvVar('VITE_MOCK_DELAY_MS', 1000)
} as const;
