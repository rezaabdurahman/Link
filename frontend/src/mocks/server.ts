import { setupServer } from 'msw/node';
import { broadcastHandlers, availabilityHandlers, onboardingHandlers, authHandlers, chatHandlers, friendsHandlers, usersHandlers, montageHandlers } from './handlers';

// Setup the server for Node.js environment (testing)
export const server = setupServer(
  ...broadcastHandlers, 
  ...availabilityHandlers, 
  ...onboardingHandlers,
  ...authHandlers,
  ...chatHandlers,
  ...friendsHandlers,
  ...usersHandlers,
  ...montageHandlers
);

export default server;
