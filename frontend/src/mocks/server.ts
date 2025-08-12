import { setupServer } from 'msw/node';
import { broadcastHandlers } from './handlers';

// Setup the server for Node.js environment (testing)
export const server = setupServer(...broadcastHandlers);

export default server;
