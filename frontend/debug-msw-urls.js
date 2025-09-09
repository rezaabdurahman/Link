// MSW URL Debug Script
// Run this in browser console to check MSW URL matching

console.log('🔧 MSW URL Debug Script');

// Check environment variables
console.log('🌍 Environment Variables:', {
  VITE_API_BASE_URL: import.meta?.env?.VITE_API_BASE_URL,
  VITE_API_URL: import.meta?.env?.VITE_API_URL,
  VITE_ENABLE_MOCKING: import.meta?.env?.VITE_ENABLE_MOCKING,
  VITE_APP_MODE: import.meta?.env?.VITE_APP_MODE
});

// Check computed API base URL
const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || 
                     import.meta?.env?.VITE_API_URL || 
                     'http://localhost:8080';

console.log('📡 Computed API_BASE_URL:', API_BASE_URL);

// Check expected MSW URLs
const mswUrls = {
  onboardingStatus: `${API_BASE_URL}/onboarding/status`,
  onboardingStart: `${API_BASE_URL}/onboarding/start`,
  onboardingStep: `${API_BASE_URL}/onboarding/step`,
  onboardingComplete: `${API_BASE_URL}/onboarding/complete`
};

console.log('🎯 Expected MSW Handler URLs:', mswUrls);

// Test a sample request
console.log('📡 Testing onboarding status endpoint...');

// Show current auth token if available
if (typeof devAuth !== 'undefined') {
  devAuth.status();
} else {
  console.log('❌ devAuth not available');
}

// Try to fetch the onboarding status to see what happens
fetch(mswUrls.onboardingStatus, {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer dev-token-user-alex-thompson',
    'Content-Type': 'application/json'
  }
}).then(response => {
  console.log('✅ Response received:', {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });
  return response.json();
}).then(data => {
  console.log('📦 Response data:', data);
}).catch(error => {
  console.error('❌ Request failed:', error);
  console.log('💡 This suggests MSW is not intercepting the request properly');
});

// Check if MSW is actually running
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('🔧 Service Worker Registrations:', registrations.length);
    registrations.forEach((reg, index) => {
      console.log(`  ${index + 1}. Scope: ${reg.scope}, Active: ${!!reg.active}`);
    });
  });
} else {
  console.log('❌ Service Worker not supported');
}