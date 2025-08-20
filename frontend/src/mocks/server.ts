import { setupServer } from 'msw/node';
import { broadcastHandlers, availabilityHandlers, onboardingHandlers, authHandlers, chatHandlers, friendsHandlers, usersHandlers, montageHandlers } from './handlers';

// Flatten all handler arrays and ensure they're in http format for MSW v2
const allHandlers = [
  ...broadcastHandlers,
  ...availabilityHandlers,
  ...onboardingHandlers,
  ...authHandlers,
  ...chatHandlers,
  ...friendsHandlers,
  ...usersHandlers,
  ...montageHandlers
];

// Setup the server for Node.js environment (testing)
export const server = setupServer(...allHandlers);

export default server;
