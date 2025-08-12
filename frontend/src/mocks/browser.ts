import { setupWorker } from 'msw/browser';
import { broadcastHandlers } from './handlers';

// Setup the service worker with our handlers
export const worker = setupWorker(...broadcastHandlers);

// Start the worker in development/demo mode
export const startMockWorker = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  // SECURITY: Multiple layers of production protection
  const isDev = import.meta.env.DEV;
  const mode = import.meta.env.MODE;
  const nodeEnv = import.meta.env.NODE_ENV;
  const isDemo = import.meta.env.VITE_APP_MODE === 'demo';
  const enableMocks = import.meta.env.VITE_ENABLE_MOCKING === 'true';
  const hostname = window.location.hostname;
  
  // SECURITY: Strict production checks - NEVER run MSW in production
  const isProduction = (
    import.meta.env.PROD ||
    nodeEnv === 'production' ||
    mode === 'production' ||
    hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('dev') && !hostname.includes('staging')
  );
  
  if (isProduction) {
    console.warn('🚫 MSW: Blocked in production environment');
    return;
  }

  // Only start MSW in safe environments
  if (isDev || (isDemo && hostname === 'localhost') || enableMocks) {
    try {
      await worker.start({
        onUnhandledRequest: 'bypass',
        quiet: !isDev, // Only show logs in development
      });
      
      console.log('🔧 MSW: Mock Service Worker started');
      console.log('📡 MSW: Mocking broadcast API endpoints');
      console.log('🔒 MSW: Security checks passed - development environment confirmed');
    } catch (error) {
      console.error('❌ MSW: Failed to start Mock Service Worker:', error);
    }
  } else {
    console.log('ℹ️ MSW: Not starting - not in development/demo mode');
  }
};

export default worker;
