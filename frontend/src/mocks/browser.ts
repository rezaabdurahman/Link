import { setupWorker } from 'msw/browser';
import { handlers } from './handlers/index';
import { logMSWConfig } from './utils/config';

// Setup the service worker with our handlers
export const worker = setupWorker(
  ...handlers
);

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
  
  // SECURITY: Strict production checks - NEVER run MSW in actual production
  // Allow MSW in demo builds even when PROD=true and on any hostname
  const isActualProduction = (
    (import.meta.env.PROD && !isDemo && !enableMocks) ||
    (nodeEnv === 'production' && !isDemo && !enableMocks) ||
    (mode === 'production' && !isDemo && !enableMocks)
  );
  
  // In demo mode, allow MSW to run on any hostname (including Vercel deployments)
  console.log('🔍 MSW: Environment check:', {
    isDev,
    isDemo, 
    enableMocks,
    hostname,
    mode,
    nodeEnv,
    PROD: import.meta.env.PROD,
    isActualProduction
  });
  
  if (isActualProduction) {
    console.warn('🚫 MSW: Blocked in production environment');
    return;
  }

  // Only start MSW in safe environments
  // Allow demo builds to run on localhost or when specifically enabled
  if (isDev || isDemo || enableMocks) {
    // Log MSW configuration for debugging
    logMSWConfig();
    
    try {
      await worker.start({
        onUnhandledRequest: (request) => {
          // Log unhandled requests to help debug
          console.warn('🚫 MSW: Unhandled request:', {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries())
          });
          // Still bypass, but with logging
        },
        quiet: false, // Always show logs in demo mode for debugging
      });
      
      console.log('🔧 MSW: Mock Service Worker started successfully');
      console.log('📡 MSW: Intercepting API calls for:', {
        'Auth': '/auth/login, /auth/register, /auth/me, /auth/refresh, /auth/logout',
        'Chat': '/api/v1/chat/conversations, /api/v1/chat/messages',
        'Users': '/users/profile/me, /users/profile/:id',
        'Friends': '/friends/status, /friends/requests',
        'Onboarding': '/onboarding/status, /onboarding/start, /onboarding/step',
        'Availability': '/availability',
        'Broadcasts': '/broadcasts',
        'Montage': '/users/:id/montage',
        'Search': '/search'
      });
      console.log('🔒 MSW: All backend calls will be mocked - no real server needed');
    } catch (error) {
      console.error('❌ MSW: Failed to start Mock Service Worker:', error);
    }
  } else {
    console.log('ℹ️ MSW: Not starting - not in development/demo mode');
  }
};

export default worker;
