import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize Sentry as early as possible
import { initSentry } from './utils/sentry';
initSentry();

// Conditionally start MSW for API mocking in development/demo
// Always enable in DEV mode unless explicitly disabled
const enableMocks = import.meta.env.DEV || 
                   import.meta.env.VITE_APP_MODE === 'demo' || 
                   import.meta.env.VITE_ENABLE_MOCKING === 'true';

console.log('🔧 Main.tsx: Environment check:', {
  DEV: import.meta.env.DEV,
  VITE_APP_MODE: import.meta.env.VITE_APP_MODE,
  VITE_ENABLE_MOCKING: import.meta.env.VITE_ENABLE_MOCKING,
  enableMocks,
  hostname: window.location.hostname
});

if (enableMocks) {
  console.log('🚀 Main.tsx: Loading MSW...');
  import('./mocks/browser').then(({ startMockWorker }) => {
    console.log('📦 Main.tsx: MSW module loaded, starting worker...');
    return startMockWorker();
  }).then(() => {
    console.log('✅ Main.tsx: MSW started successfully');
  }).catch(error => {
    console.error('❌ Main.tsx: Failed to load/start MSW:', error);
    // Continue loading the app even if MSW fails
  });
} else {
  console.log('🚫 Main.tsx: MSW not enabled');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
