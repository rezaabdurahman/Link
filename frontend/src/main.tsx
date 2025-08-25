import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Validate environment variables before anything else
import { validateEnvironment, env } from './utils/env';

// Initialize environment validation
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed. App may not function correctly.');
  console.error(error);
}

// Initialize Sentry as early as possible
import { initSentry } from './utils/sentry';
import { initWebVitals } from './utils/webVitals';
import { setupMetricsEndpoint, metricsExporter } from './utils/metricsExporter';

initSentry();

// Initialize Web Vitals tracking
initWebVitals();

// Set up metrics collection and export
setupMetricsEndpoint();

// Send metrics to service worker periodically
if ('serviceWorker' in navigator) {
  setInterval(() => {
    const metricsData = metricsExporter.exportPrometheusFormat();
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage({
          type: 'METRICS_UPDATE',
          metrics: metricsData,
        });
      }
    });
  }, 10000); // Update every 10 seconds
}

// Conditionally start MSW for API mocking using standardized env utility
// Always enable MSW in development mode for demo functionality
const enableMocks = env.ENABLE_MOCKING || env.APP_MODE === 'development' || import.meta.env.DEV;

console.log('🔧 Main.tsx: Environment check:', {
  APP_MODE: env.APP_MODE,
  ENABLE_MOCKING: env.ENABLE_MOCKING,
  API_BASE_URL: env.API_BASE_URL,
  enableMocks,
  hostname: window.location.hostname
});

async function startApp() {
  if (enableMocks) {
    console.log('🚀 Main.tsx: Loading MSW...');
    try {
      const { startMockWorker } = await import('./mocks/browser');
      console.log('📦 Main.tsx: MSW module loaded, starting worker...');
      await startMockWorker();
      console.log('✅ Main.tsx: MSW started successfully, API calls will be mocked');
      
      // Auto-authenticate for development
      const { autoAuthenticateForDev } = await import('./utils/devAuth');
      await autoAuthenticateForDev();
      console.log('🔧 Main.tsx: Development auto-authentication completed');
    } catch (error) {
      console.error('❌ Main.tsx: Failed to load/start MSW:', error);
      console.error('⚠️ Main.tsx: App will continue but API calls may fail due to CORS');
      // Continue loading the app even if MSW fails
    }
  } else {
    console.log('🚫 Main.tsx: MSW not enabled, using real API endpoints');
  }

  // Render the app after MSW is initialized
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Start the app
startApp().catch((error) => {
  console.error('❌ Main.tsx: Fatal error starting app:', error);
});
