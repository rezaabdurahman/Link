import { setupWorker } from 'msw/browser';
import { broadcastHandlers, availabilityHandlers, onboardingHandlers, authHandlers, chatHandlers, friendHandlers, userHandlers } from './handlers';

// Setup the service worker with our handlers
export const worker = setupWorker(
  ...broadcastHandlers, 
  ...availabilityHandlers, 
  ...onboardingHandlers,
  ...authHandlers,
  ...chatHandlers,
  ...friendHandlers,
  ...userHandlers
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
        'Broadcasts': '/broadcasts'
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
