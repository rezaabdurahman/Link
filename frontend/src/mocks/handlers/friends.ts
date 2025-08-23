import { http } from 'msw';
import { extractUserId, now, parsePaginationParams } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createNotFoundError, createConflictError, createSuccessResponse } from '../utils/responseBuilders';
import { buildApiUrl } from '../utils/config';

// Mock user data for responses
const mockUsers = new Map([
  ['demo-user-1', {
    id: 'demo-user-1',
    username: 'alice_demo',
    first_name: 'Alice',
    last_name: 'Johnson',
    profile_picture: 'https://images.unsplash.com/photo-1494790108755-2616b612b524?w=150&h=150&fit=crop&crop=face',
    bio: 'Software engineer who loves hiking',
    location: { proximityMiles: 2.5 },
    interests: ['hiking', 'photography', 'coding'],
    mutualFriends: [],
    email: 'alice@example.com',
    created_at: '2024-01-01T00:00:00Z',
  }],
  ['demo-user-2', {
    id: 'demo-user-2', 
    username: 'bob_demo',
    first_name: 'Bob',
    last_name: 'Smith',
    profile_picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'Designer and coffee enthusiast',
    location: { proximityMiles: 1.2 },
    interests: ['design', 'coffee', 'travel'],
    mutualFriends: [],
    email: 'bob@example.com',
    created_at: '2024-01-01T00:00:00Z',
  }],
  ['demo-user-3', {
    id: 'demo-user-3',
    username: 'charlie_demo', 
    first_name: 'Charlie',
    last_name: 'Brown',
    profile_picture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    bio: 'Marketing professional and foodie',
    location: { proximityMiles: 3.1 },
    interests: ['marketing', 'food', 'music'],
    mutualFriends: [],
    email: 'charlie@example.com',
    created_at: '2024-01-01T00:00:00Z',
  }],
]);

// Mock database for friend requests
const mockFriendRequests: Map<string, {
  id: string;
  requester_id: string;
  requestee_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}> = new Map();

// Mock database for friendships
const mockFriendships: Map<string, {
  user1_id: string;
  user2_id: string;
  created_at: string;
}> = new Map();

// Initialize some demo data
const demoRequest1 = {
  id: 'req-demo-1',
  requester_id: 'demo-user-2',
  requestee_id: 'current-user-id', // This will be the logged-in user
  message: 'Hey! Would love to connect!',
  status: 'pending' as const,
  created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

const demoRequest2 = {
  id: 'req-demo-2',
  requester_id: 'current-user-id',
  requestee_id: 'demo-user-3',
  message: 'Hi there!',
  status: 'pending' as const,
  created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
  updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
};

mockFriendRequests.set(demoRequest1.id, demoRequest1);
mockFriendRequests.set(demoRequest2.id, demoRequest2);

// Demo friendship - current user is friends with demo-user-1
mockFriendships.set('friendship-demo-1', {
  user1_id: 'current-user-id',
  user2_id: 'demo-user-1',
  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
});

// Helper functions
const getUserFromId = (userId: string) => {
  return mockUsers.get(userId) || {
    id: userId,
    username: `user_${userId.slice(0, 8)}`,
    first_name: 'User',
    last_name: userId.slice(0, 8),
    profile_picture: null,
    bio: null,
    location: { proximityMiles: 0 },
    interests: [],
    mutualFriends: [],
    email: `${userId}@example.com`,
    created_at: now(),
  };
};

const areFriends = (userId1: string, userId2: string): boolean => {
  return Array.from(mockFriendships.values()).some(friendship => 
    (friendship.user1_id === userId1 && friendship.user2_id === userId2) ||
    (friendship.user1_id === userId2 && friendship.user2_id === userId1)
  );
};

const hasPendingRequest = (requesterId: string, requesteeId: string): boolean => {
  return Array.from(mockFriendRequests.values()).some(request =>
    request.requester_id === requesterId && 
    request.requestee_id === requesteeId && 
    request.status === 'pending'
  );
};

export const handlers = [
  // POST /users/friends/requests - Send friend request
  http.post(buildApiUrl('/users/friends/requests'), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { requestee_id: string; message?: string };
      const requesteeId = body.requestee_id;
      
      if (!requesteeId) {
        return createValidationError('Requestee ID is required');
      }

      if (userId === requesteeId) {
        return createValidationError('Cannot send friend request to yourself');
      }

      // Check if already friends
      if (areFriends(userId, requesteeId)) {
        return createConflictError('Users are already friends');
      }

      // Check if pending request already exists
      if (hasPendingRequest(userId, requesteeId) || hasPendingRequest(requesteeId, userId)) {
        return createConflictError('Friend request already pending');
      }

      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const friendRequest = {
        id: requestId,
        requester_id: userId,
        requestee_id: requesteeId,
        message: body.message,
        status: 'pending' as const,
        created_at: now(),
        updated_at: now(),
      };

      mockFriendRequests.set(requestId, friendRequest);

      return createSuccessResponse({
        message: 'Friend request sent successfully',
        data: {
          id: requestId,
          requestee_id: requesteeId,
          status: 'pending',
          created_at: friendRequest.created_at,
        }
      }, 201);
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // GET /users/friends/requests/received - Get received friend requests
  http.get(buildApiUrl('/users/friends/requests/received'), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const { limit, offset } = parsePaginationParams(url);

    let filteredRequests = Array.from(mockFriendRequests.values()).filter(req => 
      req.requestee_id === userId
    );

    // Filter by status
    if (status !== 'all') {
      filteredRequests = filteredRequests.filter(req => req.status === status);
    }

    const paginatedRequests = filteredRequests.slice(offset, offset + limit);

    // Transform to expected format with user data
    const responseData = paginatedRequests.map(req => ({
      id: req.id,
      user: getUserFromId(req.requester_id),
      message: req.message,
      status: req.status,
      created_at: req.created_at,
    }));

    return createSuccessResponse({
      data: responseData,
      count: responseData.length,
      limit,
      offset,
    });
  }),

  // GET /users/friends/requests/sent - Get sent friend requests
  http.get(buildApiUrl('/users/friends/requests/sent'), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const { limit, offset } = parsePaginationParams(url);

    let filteredRequests = Array.from(mockFriendRequests.values()).filter(req => 
      req.requester_id === userId
    );

    // Filter by status
    if (status !== 'all') {
      filteredRequests = filteredRequests.filter(req => req.status === status);
    }

    const paginatedRequests = filteredRequests.slice(offset, offset + limit);

    // Transform to expected format with user data
    const responseData = paginatedRequests.map(req => ({
      id: req.id,
      user: getUserFromId(req.requestee_id),
      message: req.message,
      status: req.status,
      created_at: req.created_at,
    }));

    return createSuccessResponse({
      data: responseData,
      count: responseData.length,
      limit,
      offset,
    });
  }),

  // PUT /users/friends/requests/:id/accept - Accept friend request
  http.put(buildApiUrl('/users/friends/requests/:id/accept'), ({ request, params }) => {
    const { id: requestId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const friendRequest = mockFriendRequests.get(requestId as string);
    
    if (!friendRequest) {
      return createNotFoundError('Friend request not found');
    }

    if (friendRequest.requestee_id !== userId) {
      return createConflictError('Unauthorized to accept this friend request');
    }

    if (friendRequest.status !== 'pending') {
      return createConflictError('Friend request is no longer pending');
    }

    // Update request status
    const updatedRequest = {
      ...friendRequest,
      status: 'accepted' as const,
      updated_at: now(),
    };
    mockFriendRequests.set(requestId as string, updatedRequest);

    // Create friendship
    const friendshipId = `friendship-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    mockFriendships.set(friendshipId, {
      user1_id: friendRequest.requester_id,
      user2_id: friendRequest.requestee_id,
      created_at: now(),
    });

    return createSuccessResponse({
      message: 'Friend request accepted successfully',
    });
  }),

  // PUT /users/friends/requests/:id/decline - Decline friend request
  http.put(buildApiUrl('/users/friends/requests/:id/decline'), ({ request, params }) => {
    const { id: requestId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const friendRequest = mockFriendRequests.get(requestId as string);
    
    if (!friendRequest) {
      return createNotFoundError('Friend request not found');
    }

    if (friendRequest.requestee_id !== userId) {
      return createConflictError('Unauthorized to decline this friend request');
    }

    if (friendRequest.status !== 'pending') {
      return createConflictError('Friend request is no longer pending');
    }

    // Update request status
    const updatedRequest = {
      ...friendRequest,
      status: 'declined' as const,
      updated_at: now(),
    };
    mockFriendRequests.set(requestId as string, updatedRequest);

    return createSuccessResponse({
      message: 'Friend request declined successfully',
    });
  }),

  // DELETE /users/friends/requests/:id - Cancel sent friend request
  http.delete(buildApiUrl('/users/friends/requests/:id'), ({ request, params }) => {
    const { id: requestId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const friendRequest = mockFriendRequests.get(requestId as string);
    
    if (!friendRequest) {
      return createNotFoundError('Friend request not found');
    }

    if (friendRequest.requester_id !== userId) {
      return createConflictError('Unauthorized to cancel this friend request');
    }

    if (friendRequest.status !== 'pending') {
      return createConflictError('Friend request is no longer pending');
    }

    // Update request status to declined (cancelled)
    const updatedRequest = {
      ...friendRequest,
      status: 'declined' as const,
      updated_at: now(),
    };
    mockFriendRequests.set(requestId as string, updatedRequest);

    return createSuccessResponse({
      message: 'Friend request cancelled successfully',
    });
  }),

  // GET /users/friends - Get friends list
  http.get(buildApiUrl('/users/friends'), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const { limit, offset } = parsePaginationParams(url);

    // Get all friendships for this user
    let friends = Array.from(mockFriendships.values())
      .filter(friendship => 
        friendship.user1_id === userId || friendship.user2_id === userId
      )
      .map(friendship => {
        const friendId = friendship.user1_id === userId ? friendship.user2_id : friendship.user1_id;
        return getUserFromId(friendId);
      });

    const paginatedFriends = friends.slice(offset, offset + limit);

    return createSuccessResponse({
      data: paginatedFriends,
      count: paginatedFriends.length,
      limit,
      offset,
    });
  }),

  // DELETE /users/friends/:userId - Remove friend
  http.delete(buildApiUrl('/users/friends/:userId'), ({ request, params }) => {
    const { userId: friendId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    // Find the friendship
    const friendshipEntry = Array.from(mockFriendships.entries()).find(([, friendship]) => 
      (friendship.user1_id === userId && friendship.user2_id === friendId) ||
      (friendship.user1_id === friendId && friendship.user2_id === userId)
    );
    
    if (!friendshipEntry) {
      return createConflictError('Users are not friends');
    }

    // Remove the friendship
    mockFriendships.delete(friendshipEntry[0]);

    return createSuccessResponse({
      message: 'Friend removed successfully',
    });
  }),

  // GET /users/friends/status/:userId - Get friendship status
  http.get(buildApiUrl('/users/friends/status/:userId'), ({ request, params }) => {
    const { userId: otherUserId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    if (userId === otherUserId) {
      return createSuccessResponse({
        data: {
          status: 'self',
          can_send_request: false,
        }
      });
    }

    // Check if already friends
    if (areFriends(userId, otherUserId as string)) {
      return createSuccessResponse({
        data: {
          status: 'friends',
          can_send_request: false,
        }
      });
    }

    // Check for pending sent request
    if (hasPendingRequest(userId, otherUserId as string)) {
      return createSuccessResponse({
        data: {
          status: 'pending_sent',
          can_send_request: false,
        }
      });
    }

    // Check for pending received request
    if (hasPendingRequest(otherUserId as string, userId)) {
      return createSuccessResponse({
        data: {
          status: 'pending_received',
          can_send_request: false,
        }
      });
    }

    // No relationship - can send request
    return createSuccessResponse({
      data: {
        status: 'none',
        can_send_request: true,
      }
    });
  }),
];
