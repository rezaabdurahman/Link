import { User } from '../types';

/**
 * Mock click likelihood calculation client
 * This simulates ML-based prediction of user engagement probability
 * Future: Replace with actual ML model API calls
 */

export interface UserWithLikelihood extends User {
  clickLikelihood: number; // 0-1 probability score
}

/**
 * Calculate click likelihood score for a user
 * Mock implementation based on various engagement factors
 */
export const calculateClickLikelihood = (user: User): number => {
  let score = 0.5; // Base score
  
  // Factor 1: Profile completeness (0.1 weight)
  const hasVideo = user.profileMedia?.type === 'video';
  const hasBroadcast = Boolean(user.broadcast);
  const hasInterests = user.interests.length > 0;
  const completenessScore = (hasVideo ? 0.4 : 0.2) + (hasBroadcast ? 0.3 : 0) + (hasInterests ? 0.3 : 0);
  score += completenessScore * 0.1;
  
  // Factor 2: Mutual connections (0.25 weight) 
  const mutualFriendsScore = Math.min(user.mutualFriends.length * 0.2, 1.0);
  score += mutualFriendsScore * 0.25;
  
  // Factor 3: Distance proximity (0.2 weight)
  // Closer users get higher likelihood (inverse relationship)
  const maxDistance = 3.0; // miles
  const proximityScore = Math.max(0, (maxDistance - user.location.proximityMiles) / maxDistance);
  score += proximityScore * 0.2;
  
  // Factor 4: Connection priority (0.15 weight)
  const priorityScore = user.connectionPriority === 'want-closer' ? 0.8 : 
                       user.connectionPriority === 'regular' ? 0.5 : 0.2;
  score += priorityScore * 0.15;
  
  // Factor 5: Recent activity (0.15 weight)
  const hoursAgo = (Date.now() - user.lastSeen.getTime()) / (1000 * 60 * 60);
  const activityScore = Math.max(0, Math.min(1, (24 - hoursAgo) / 24)); // More recent = higher score
  score += activityScore * 0.15;
  
  // Factor 6: Profile type engagement (0.15 weight)
  const profileTypeScore = user.profileType === 'public' ? 0.7 : 0.4;
  score += profileTypeScore * 0.15;
  
  // Clamp between 0.1 and 0.95 for realistic range
  return Math.max(0.1, Math.min(0.95, score));
};

/**
 * Add click likelihood scores to user array
 */
export const addClickLikelihoodScores = (users: User[]): UserWithLikelihood[] => {
  return users.map(user => ({
    ...user,
    clickLikelihood: calculateClickLikelihood(user)
  }));
};

/**
 * Grid chunk structure for 3x3 layout with one 2x2 prominent user
 */
export interface GridChunk {
  prominentUser: UserWithLikelihood; // Takes 2x2 space
  regularUsers: UserWithLikelihood[]; // Up to 5 users in 1x1 spaces
  chunkIndex: number; // For alternating 2x2 position
  is2x2TopLeft: boolean; // true = top-left corner, false = top-right corner
}

/**
 * Split users into grid chunks of 6, with highest likelihood user as prominent
 */
export const createGridChunks = (users: UserWithLikelihood[]): GridChunk[] => {
  const chunks: GridChunk[] = [];
  
  // Process users in groups of 6
  for (let i = 0; i < users.length; i += 6) {
    const chunkUsers = users.slice(i, i + 6);
    
    if (chunkUsers.length === 0) continue;
    
    // Sort by click likelihood (highest first) to select prominent user
    const sortedByLikelihood = [...chunkUsers].sort((a, b) => b.clickLikelihood - a.clickLikelihood);
    
    const prominentUser = sortedByLikelihood[0];
    const regularUsers = sortedByLikelihood.slice(1); // Remaining users (up to 5)
    
    const chunkIndex = chunks.length;
    const is2x2TopLeft = chunkIndex % 2 === 0; // Alternate: even = top-left, odd = top-right
    
    chunks.push({
      prominentUser,
      regularUsers,
      chunkIndex,
      is2x2TopLeft
    });
  }
  
  return chunks;
};

/**
 * Get the CSS grid positions for a 3x3 layout
 * Grid positions are 1-indexed for CSS grid
 */
export const getGridPositions = (is2x2TopLeft: boolean) => {
  if (is2x2TopLeft) {
    // 2x2 takes top-left (grid positions 1-2, 4-5)
    // Remaining positions: 3, 6, 7, 8, 9
    return {
      prominentUser: { 
        gridColumn: '1 / 3', // span 2 columns
        gridRow: '1 / 3'     // span 2 rows
      },
      regularPositions: [
        { gridColumn: '3', gridRow: '1' }, // position 3
        { gridColumn: '3', gridRow: '2' }, // position 6  
        { gridColumn: '1', gridRow: '3' }, // position 7
        { gridColumn: '2', gridRow: '3' }, // position 8
        { gridColumn: '3', gridRow: '3' }, // position 9
      ]
    };
  } else {
    // 2x2 takes top-right (grid positions 2-3, 5-6)
    // Remaining positions: 1, 4, 7, 8, 9
    return {
      prominentUser: {
        gridColumn: '2 / 4', // span 2 columns (positions 2-3)
        gridRow: '1 / 3'     // span 2 rows
      },
      regularPositions: [
        { gridColumn: '1', gridRow: '1' }, // position 1
        { gridColumn: '1', gridRow: '2' }, // position 4
        { gridColumn: '1', gridRow: '3' }, // position 7
        { gridColumn: '2', gridRow: '3' }, // position 8
        { gridColumn: '3', gridRow: '3' }, // position 9
      ]
    };
  }
};

/**
 * Debug logging for grid chunks (development only)
 */
export const logGridChunks = (chunks: GridChunk[]): void => {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.log('🎯 Grid Chunks Analysis:');
  chunks.forEach((chunk, index) => {
    console.log(`\nChunk ${index + 1} (${chunk.is2x2TopLeft ? 'Top-Left' : 'Top-Right'} 2x2):`);
    console.log(`  🌟 Prominent (${chunk.prominentUser.clickLikelihood.toFixed(2)}): ${chunk.prominentUser.name}`);
    chunk.regularUsers.forEach((user, i) => {
      console.log(`  • Regular ${i + 1} (${user.clickLikelihood.toFixed(2)}): ${user.name}`);
    });
  });
};
