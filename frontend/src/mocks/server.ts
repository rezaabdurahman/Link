import { setupServer } from 'msw/node';
import { broadcastHandlers, availabilityHandlers } from './handlers';

// Setup the server for Node.js environment (testing)
export const server = setupServer(...broadcastHandlers, ...availabilityHandlers);

export default server;
