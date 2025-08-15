import { setupServer } from 'msw/node';
import { broadcastHandlers, availabilityHandlers, onboardingHandlers, authHandlers, chatHandlers, friendHandlers, userHandlers } from './handlers';
import { montageHandlers } from './montageHandlers';

// Setup the server for Node.js environment (testing)
export const server = setupServer(
  ...broadcastHandlers, 
  ...availabilityHandlers, 
  ...onboardingHandlers,
  ...authHandlers,
  ...chatHandlers,
  ...friendHandlers,
  ...userHandlers,
  ...montageHandlers
);

export default server;
