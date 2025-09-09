// Onboarding Debug Script
// Run this in the browser console at localhost:3000/onboarding to diagnose issues

console.log('🔧 Starting Onboarding Diagnosis...');

// 1. Check if we're on the right page
console.log('📍 Current URL:', window.location.href);
console.log('📍 Expected URL:', 'http://localhost:3000/onboarding');

// 2. Check if MSW is running
console.log('🤖 MSW Status:', {
  isWorkerRegistered: 'serviceWorker' in navigator,
  mswGlobal: typeof window.msw !== 'undefined',
  workerReady: navigator.serviceWorker?.controller !== null
});

// 3. Check authentication status
if (typeof devAuth !== 'undefined') {
  console.log('🔐 DevAuth available - checking status...');
  devAuth.status();
} else {
  console.log('❌ DevAuth not available - may indicate script loading issue');
}

// 4. Check React app mounting
const reactRoot = document.getElementById('root');
if (reactRoot) {
  console.log('⚛️ React root element:', {
    exists: true,
    hasChildren: reactRoot.children.length > 0,
    innerHTML: reactRoot.innerHTML.length > 100 ? 'Content present' : 'Minimal content'
  });
} else {
  console.log('❌ React root element not found');
}

// 5. Check for React DevTools
console.log('🛠️ React DevTools:', {
  available: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined'
});

// 6. Check environment variables
console.log('🌍 Environment Check:', {
  isDev: import.meta?.env?.DEV,
  mode: import.meta?.env?.MODE,
  enableMocking: import.meta?.env?.VITE_ENABLE_MOCKING,
  appMode: import.meta?.env?.VITE_APP_MODE,
  apiBaseUrl: import.meta?.env?.VITE_API_BASE_URL
});

// 7. Test API endpoint directly
console.log('📡 Testing onboarding API endpoint...');
fetch('/api/onboarding/status', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer dev-token-test',
    'Content-Type': 'application/json'
  }
}).then(response => {
  console.log('📡 API Response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });
  return response.json();
}).then(data => {
  console.log('📦 API Data:', data);
}).catch(error => {
  console.error('❌ API Error:', error);
});

// 8. Check for common errors
const errors = [];
if (!document.getElementById('root')) errors.push('Missing React root element');
if (typeof devAuth === 'undefined') errors.push('DevAuth not loaded');

if (errors.length > 0) {
  console.error('🚨 Issues Found:', errors);
} else {
  console.log('✅ Basic setup looks good');
}

// 9. Provide next steps
console.log(`
🎯 Next Steps:
1. If you see a blank page, check the React root element content
2. If authentication failed, try: devAuth.loginAsNewUser()
3. If API calls fail, check MSW initialization in Network tab
4. If components fail to render, check for JavaScript errors
5. Use React DevTools to inspect component state

💡 Common fixes:
- Hard refresh (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache and localStorage
- Reset onboarding: devAuth.resetOnboarding()
- Create fresh user: devAuth.loginAsNewUser()
`);

console.log('🔧 Diagnosis Complete. Check output above for issues.');