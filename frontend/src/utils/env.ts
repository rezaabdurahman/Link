// Environment variable utility that works in both browser and test environments

export const getEnvVar = (key: string, defaultValue?: string): string => {
  // In test environment, use process.env
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return process.env[key] || defaultValue || '';
  }
  
  // In Node.js/SSR environment, use process.env if available
  if (typeof process !== 'undefined' && typeof window === 'undefined') {
    return process.env[key] || defaultValue || '';
  }
  
  // In browser with Vite build (production), environment variables are compiled in
  // For development/build, we fall back to defaults since import.meta is not Jest compatible
  
  // Default values for common environment variables
  const defaults: Record<string, string> = {
    'VITE_API_BASE_URL': 'http://localhost:8080',
    'VITE_API_URL': 'http://localhost:8080',
    'VITE_APP_MODE': 'development',
    'VITE_REQUIRE_AUTH': 'true',
    'VITE_AUTO_LOGIN': 'false',
    'VITE_MOCK_USER': 'false',
    'VITE_SHOW_DEMO_BANNER': 'false',
    'VITE_DEMO_BANNER_TEXT': '🚀 Demo Mode - This is a preview version for feedback',
    'VITE_SEED_DEMO_DATA': 'false',
  };
  
  return defaults[key] || defaultValue || '';
};
