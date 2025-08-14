// Browser setup (for development and demo)
export { worker, startMockWorker } from './browser';

// Node setup (for testing)
export { server } from './server';

// Handlers (for custom usage)
export { broadcastHandlers, availabilityHandlers, onboardingHandlers, authHandlers, chatHandlers } from './handlers';
