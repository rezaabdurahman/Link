// Debug MSW Handler URLs
// Run this in browser console to see what URLs the handlers expect

console.log('🔧 Debug: MSW Handler URL Resolution');

// Import config values similar to how MSW handlers do
const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || 
                     import.meta?.env?.VITE_API_URL || 
                     'http://localhost:8080';

console.log('📍 API_BASE_URL from environment:', API_BASE_URL);

// Simulate buildApiUrl function
const buildApiUrl = (endpoint) => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
};

// API endpoints from config
const API_ENDPOINTS = {
  ONBOARDING: {
    status: '/onboarding/status',
    start: '/onboarding/start',
    step: '/onboarding/step',
    complete: '/onboarding/complete',
  }
};

console.log('🎯 Handler URL Resolution:');
Object.entries(API_ENDPOINTS.ONBOARDING).forEach(([key, endpoint]) => {
  const fullUrl = buildApiUrl(endpoint);
  console.log(`  ${key}: ${endpoint} → ${fullUrl}`);
});

// Show what authClient would generate
console.log('🔗 AuthClient request URL generation:');
const authClientUrl = `${API_BASE_URL}/onboarding/status`;
console.log(`  Direct concatenation: ${authClientUrl}`);

// Test if they match
const handlerUrl = buildApiUrl(API_ENDPOINTS.ONBOARDING.status);
const clientUrl = authClientUrl;

console.log('✅ URL Match Check:', {
  handlerUrl,
  clientUrl,
  match: handlerUrl === clientUrl
});

// Check environment variables in detail
console.log('🌍 All Environment Variables:');
if (import.meta?.env) {
  Object.entries(import.meta.env).forEach(([key, value]) => {
    if (key.includes('API') || key.includes('URL')) {
      console.log(`  ${key}: ${value}`);
    }
  });
} else {
  console.log('  import.meta.env not available');
}