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
import { handlers as chat } from './chat';
import { cueHandlers as cues } from './cues';
import { featureHandlers as features } from './features';
import { handlers as friends } from './friends';
import { handlers as users } from './users';
import { handlers as onboarding } from './onboarding';
import { handlers as montage } from './montage';
import { handlers as search } from './search';

/**
 * Combined handlers array for MSW setup
 */
export const handlers = [
  ...search,
  ...auth,
  ...availability,
  ...broadcast,
  ...chat,
  ...cues,
  ...features,
  ...friends,
  ...users,
  ...onboarding,
  ...montage,
];

/**
 * Export individual handler groups for selective use in tests
 * This allows you to test specific features in isolation
 */
export {
  search as searchHandlers,
  auth as authHandlers,
  availability as availabilityHandlers,
  broadcast as broadcastHandlers,
  chat as chatHandlers,
  cues as cueHandlers,
  features as featureHandlers,
  friends as friendsHandlers,
  users as usersHandlers,
  onboarding as onboardingHandlers,
  montage as montageHandlers,
};
