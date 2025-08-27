/**
 * User ID constants for development and testing
 * Maintains consistency across devAuth, mockData, and MSW handlers
 */

export const DEV_USER_IDS = {
  ALEX_THOMPSON: '1',      // Current user (Alex Thompson)
  JANE_SMITH: '17',        // Dev test user (Jane Smith)
} as const;

export type DevUserIds = typeof DEV_USER_IDS[keyof typeof DEV_USER_IDS];

/**
 * Development user profiles for testing
 */
export const DEV_USER_PROFILES = {
  [DEV_USER_IDS.ALEX_THOMPSON]: {
    first_name: 'Alex',
    last_name: 'Thompson',
    email: 'alex@example.com',
    username: 'alexthompson',
  },
  [DEV_USER_IDS.JANE_SMITH]: {
    first_name: 'Jane',
    last_name: 'Smith', 
    email: 'jane@example.com',
    username: 'janesmith',
  },
} as const;