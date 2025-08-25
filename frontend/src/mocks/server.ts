import { setupServer } from 'msw/node';
import { searchHandlers, broadcastHandlers, availabilityHandlers, onboardingHandlers, authHandlers, chatHandlers, friendHandlers, userHandlers } from './handlers';

// Flatten all handler arrays and ensure they're in http format for MSW v2
const allHandlers = [
  ...searchHandlers,
  ...broadcastHandlers,
  ...availabilityHandlers,
  ...onboardingHandlers,
  ...authHandlers,
  ...chatHandlers,
  ...friendHandlers,
  ...userHandlers
];

// Setup the server for Node.js environment (testing)
export const server = setupServer(...allHandlers);

export default server;
