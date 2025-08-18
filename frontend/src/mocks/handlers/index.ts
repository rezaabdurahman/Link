/**
 * Barrel file for MSW handlers
 * 
 * This file aggregates all feature-specific handlers into a single export
 * for use in MSW setup. Each handler file exports its handlers as a named
 * export called 'handlers'.
 */

import { handlers as auth } from './auth';
import { handlers as availability } from './availability';
import { handlers as broadcast } from './broadcast';

// Import other handler files as they are created
// import { handlers as chat } from './chat';
// import { handlers as friends } from './friends';
// import { handlers as ranking } from './ranking';

/**
 * Combined handlers array for MSW setup
 * 
 * Add new handler arrays here as you create them:
 * export const handlers = [
 *   ...auth,
 *   ...availability, 
 *   ...broadcast,
 *   ...chat,
 *   ...friends,
 *   ...ranking,
 * ];
 */
export const handlers = [
  ...auth,
  ...availability,
  ...broadcast,
];

/**
 * Export individual handler groups for selective use in tests
 * This allows you to test specific features in isolation
 */
export {
  auth as authHandlers,
  availability as availabilityHandlers,
  broadcast as broadcastHandlers,
};
