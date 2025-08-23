import {
  calculateClickLikelihood,
  addClickLikelihoodScores,
  createGridChunks,
  getGridPositions,
  UserWithLikelihood,
  GridChunk
} from '../clickLikelihoodClient';
import { User } from '../../types';

describe('clickLikelihoodClient', () => {
  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: '1',
    first_name: 'John',
    last_name: 'Doe',
    age: 25,
    profilePicture: 'https://example.com/photo.jpg',
    bio: 'Test bio',
    interests: [],
    location: {
      lat: 40.7128,
      lng: -74.0060,
      proximityMiles: 2.0
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    profileType: 'private',
    ...overrides
  });

  describe('calculateClickLikelihood', () => {
    it('should calculate base score correctly', () => {
      const user = createMockUser();
      const score = calculateClickLikelihood(user);
      
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(0.95);
    });

    it('should increase score for video profile media', () => {
      const userWithoutVideo = createMockUser();
      const userWithVideo = createMockUser({
        profileMedia: {
          type: 'video',
          url: 'video.mp4',
          thumbnail: 'thumb.jpg'
        }
      });

      const scoreWithoutVideo = calculateClickLikelihood(userWithoutVideo);
      const scoreWithVideo = calculateClickLikelihood(userWithVideo);

      expect(scoreWithVideo).toBeGreaterThan(scoreWithoutVideo);
    });

    it('should increase score for users with broadcast', () => {
      const userWithoutBroadcast = createMockUser();
      const userWithBroadcast = createMockUser({
        broadcast: 'Looking for coffee!'
      });

      const scoreWithoutBroadcast = calculateClickLikelihood(userWithoutBroadcast);
      const scoreWithBroadcast = calculateClickLikelihood(userWithBroadcast);

      expect(scoreWithBroadcast).toBeGreaterThan(scoreWithoutBroadcast);
    });

    it('should increase score for users with more interests', () => {
      const userFewInterests = createMockUser({ interests: [] });
      const userManyInterests = createMockUser({ 
        interests: ['tech', 'music', 'sports'] 
      });

      const scoreFew = calculateClickLikelihood(userFewInterests);
      const scoreMany = calculateClickLikelihood(userManyInterests);

      expect(scoreMany).toBeGreaterThan(scoreFew);
    });

    it('should increase score for users with more mutual friends', () => {
      const userFewFriends = createMockUser({ mutualFriends: [] });
      const userManyFriends = createMockUser({ 
        mutualFriends: ['Friend1', 'Friend2', 'Friend3'] 
      });

      const scoreFew = calculateClickLikelihood(userFewFriends);
      const scoreMany = calculateClickLikelihood(userManyFriends);

      expect(scoreMany).toBeGreaterThan(scoreFew);
    });

    it('should decrease score for users farther away', () => {
      const userNearby = createMockUser({ 
        location: { lat: 40.7128, lng: -74.0060, proximityMiles: 0.5 } 
      });
      const userFaraway = createMockUser({ 
        location: { lat: 40.7128, lng: -74.0060, proximityMiles: 2.5 } 
      });

      const scoreNearby = calculateClickLikelihood(userNearby);
      const scoreFaraway = calculateClickLikelihood(userFaraway);

      expect(scoreNearby).toBeGreaterThan(scoreFaraway);
    });

    it('should score "want-closer" priority higher than "regular"', () => {
      const userRegular = createMockUser({ connectionPriority: 'regular' });
      const userWantCloser = createMockUser({ connectionPriority: 'want-closer' });

      const scoreRegular = calculateClickLikelihood(userRegular);
      const scoreWantCloser = calculateClickLikelihood(userWantCloser);

      expect(scoreWantCloser).toBeGreaterThan(scoreRegular);
    });

    it('should increase score for more recently active users', () => {
      const userRecentlyActive = createMockUser({ 
        lastSeen: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      });
      const userLongInactive = createMockUser({ 
        lastSeen: new Date(Date.now() - 20 * 60 * 60 * 1000) // 20 hours ago
      });

      const scoreRecent = calculateClickLikelihood(userRecentlyActive);
      const scoreLong = calculateClickLikelihood(userLongInactive);

      expect(scoreRecent).toBeGreaterThan(scoreLong);
    });

    it('should handle invalid lastSeen dates gracefully', () => {
      const userInvalidDate = createMockUser({ 
        lastSeen: undefined as any
      });

      const score = calculateClickLikelihood(userInvalidDate);
      
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(0.95);
      expect(Number.isNaN(score)).toBe(false);
    });

    it('should score public profiles higher than private', () => {
      const userPrivate = createMockUser({ profileType: 'private' });
      const userPublic = createMockUser({ profileType: 'public' });

      const scorePrivate = calculateClickLikelihood(userPrivate);
      const scorePublic = calculateClickLikelihood(userPublic);

      expect(scorePublic).toBeGreaterThan(scorePrivate);
    });

    it('should clamp score between 0.1 and 0.95', () => {
      // Test with minimal factors (should not go below 0.1)
      const minimalUser = createMockUser({
        interests: [],
        mutualFriends: [],
        connectionPriority: 'no-contact',
        profileType: 'private',
        location: { lat: 40.7128, lng: -74.0060, proximityMiles: 5.0 },
        lastSeen: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
      });

      const minScore = calculateClickLikelihood(minimalUser);
      expect(minScore).toBeGreaterThanOrEqual(0.1);

      // Test with maximal factors (should not go above 0.95)
      const maximalUser = createMockUser({
        profileMedia: { type: 'video', url: 'video.mp4', thumbnail: 'thumb.jpg' },
        broadcast: 'Looking for friends!',
        interests: ['tech', 'music', 'sports', 'travel'],
        mutualFriends: Array(10).fill('friend'),
        connectionPriority: 'want-closer',
        profileType: 'public',
        location: { lat: 40.7128, lng: -74.0060, proximityMiles: 0.1 },
        lastSeen: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      });

      const maxScore = calculateClickLikelihood(maximalUser);
      expect(maxScore).toBeLessThanOrEqual(0.95);
    });
  });

  describe('addClickLikelihoodScores', () => {
    it('should add click likelihood scores to all users', () => {
      const users = [
        createMockUser({ id: '1' }),
        createMockUser({ id: '2' }),
        createMockUser({ id: '3' })
      ];

      const usersWithScores = addClickLikelihoodScores(users);

      expect(usersWithScores).toHaveLength(3);
      usersWithScores.forEach(user => {
        expect(user).toHaveProperty('clickLikelihood');
        expect(user.clickLikelihood).toBeGreaterThanOrEqual(0.1);
        expect(user.clickLikelihood).toBeLessThanOrEqual(0.95);
      });
    });

    it('should preserve all original user properties', () => {
      const users = [createMockUser()];
      const usersWithScores = addClickLikelihoodScores(users);

      expect(usersWithScores[0]).toMatchObject(users[0]);
      expect(usersWithScores[0]).toHaveProperty('clickLikelihood');
    });
  });

  describe('createGridChunks', () => {
    const createUsersWithScores = (count: number): UserWithLikelihood[] => {
      return Array.from({ length: count }, (_, i) => ({
        ...createMockUser({ id: String(i + 1) }),
        clickLikelihood: Math.random() * 0.85 + 0.1 // Random score between 0.1-0.95
      }));
    };

    it('should create chunks of 6 users each', () => {
      const users = createUsersWithScores(12);
      const chunks = createGridChunks(users);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].regularUsers).toHaveLength(5); // 6 - 1 prominent = 5 regular
      expect(chunks[1].regularUsers).toHaveLength(5);
    });

    it('should handle incomplete chunks', () => {
      const users = createUsersWithScores(8);
      const chunks = createGridChunks(users);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].regularUsers).toHaveLength(5);
      expect(chunks[1].regularUsers).toHaveLength(1); // 2 users in second chunk - 1 prominent = 1 regular
    });

    it('should select highest likelihood user as prominent', () => {
      const users: UserWithLikelihood[] = [
        { ...createMockUser({ id: '1' }), clickLikelihood: 0.3 },
        { ...createMockUser({ id: '2' }), clickLikelihood: 0.8 }, // Should be prominent
        { ...createMockUser({ id: '3' }), clickLikelihood: 0.5 },
        { ...createMockUser({ id: '4' }), clickLikelihood: 0.2 },
        { ...createMockUser({ id: '5' }), clickLikelihood: 0.6 },
        { ...createMockUser({ id: '6' }), clickLikelihood: 0.4 }
      ];

      const chunks = createGridChunks(users);

      expect(chunks[0].prominentUser.id).toBe('2');
      expect(chunks[0].prominentUser.clickLikelihood).toBe(0.8);
    });

    it('should alternate 2x2 position between chunks', () => {
      const users = createUsersWithScores(12);
      const chunks = createGridChunks(users);

      expect(chunks[0].is2x2TopLeft).toBe(true);
      expect(chunks[1].is2x2TopLeft).toBe(false);
    });

    it('should assign correct chunk indices', () => {
      const users = createUsersWithScores(12);
      const chunks = createGridChunks(users);

      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[1].chunkIndex).toBe(1);
    });

    it('should handle empty user array', () => {
      const chunks = createGridChunks([]);
      expect(chunks).toHaveLength(0);
    });

    it('should handle single user', () => {
      const users = createUsersWithScores(1);
      const chunks = createGridChunks(users);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].prominentUser).toBeDefined();
      expect(chunks[0].regularUsers).toHaveLength(0);
    });
  });

  describe('getGridPositions', () => {
    it('should return correct positions for top-left 2x2', () => {
      const positions = getGridPositions(true);

      expect(positions.prominentUser).toEqual({
        gridColumn: '1 / 3',
        gridRow: '1 / 3'
      });

      expect(positions.regularPositions).toHaveLength(5);
      expect(positions.regularPositions[0]).toEqual({
        gridColumn: '3',
        gridRow: '1'
      });
    });

    it('should return correct positions for top-right 2x2', () => {
      const positions = getGridPositions(false);

      expect(positions.prominentUser).toEqual({
        gridColumn: '2 / 4',
        gridRow: '1 / 3'
      });

      expect(positions.regularPositions).toHaveLength(5);
      expect(positions.regularPositions[0]).toEqual({
        gridColumn: '1',
        gridRow: '1'
      });
    });

    it('should provide all 5 regular positions for both layouts', () => {
      const topLeftPositions = getGridPositions(true);
      const topRightPositions = getGridPositions(false);

      expect(topLeftPositions.regularPositions).toHaveLength(5);
      expect(topRightPositions.regularPositions).toHaveLength(5);
    });

    it('should have unique grid positions for all elements', () => {
      const positions = getGridPositions(true);
      const allPositions = [
        positions.prominentUser,
        ...positions.regularPositions
      ];

      // Convert to strings for comparison
      const positionStrings = allPositions.map(pos => 
        `${pos.gridColumn}-${pos.gridRow}`
      );

      // Check that prominent position doesn't overlap with regular positions
      const prominentString = `${positions.prominentUser.gridColumn}-${positions.prominentUser.gridRow}`;
      const regularStrings = positions.regularPositions.map(pos => 
        `${pos.gridColumn}-${pos.gridRow}`
      );

      regularStrings.forEach(regPos => {
        expect(regPos).not.toBe(prominentString);
      });
    });
  });
});