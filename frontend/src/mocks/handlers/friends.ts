import { http } from 'msw';
import { extractUserId, now, parsePaginationParams } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createNotFoundError, createConflictError, createSuccessResponse } from '../utils/responseBuilders';
import { buildApiUrl, API_ENDPOINTS } from '../utils/config';

// Mock database for friendship requests and statuses
const mockFriendships: Map<string, {
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked';
  request_id?: string;
  created_at?: string;
  updated_at?: string;
}> = new Map();

const mockFriendRequests: Map<string, {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}> = new Map();

// Initialize some demo friendship data
mockFriendships.set('demo-user-1:demo-user-2', {
  status: 'pending_sent',
  request_id: 'req-demo-1-to-2',
  created_at: now(),
  updated_at: now(),
});

mockFriendships.set('demo-user-1:demo-user-3', {
  status: 'friends',
  created_at: now(),
  updated_at: now(),
});

export const handlers = [
  // GET /friends/status/:userId - Get friendship status
  http.get(buildApiUrl('/friends/status/:userId'), ({ request, params }) => {
    const { userId } = params;
    const currentUserId = extractUserId(request);
    
    if (!currentUserId) {
      return createAuthError();
    }

    const friendshipKey = `${currentUserId}:${userId}`;
    const reverseFriendshipKey = `${userId}:${currentUserId}`;
    
    // Check both directions
    const friendship = mockFriendships.get(friendshipKey) || 
                     mockFriendships.get(reverseFriendshipKey);
    
    if (!friendship) {
      return createSuccessResponse({
        user_id: userId as string,
        status: 'none',
      });
    }

    // Adjust status based on perspective
    let status = friendship.status;
    if (mockFriendships.get(reverseFriendshipKey)) {
      // This is the reverse friendship, adjust status
      if (status === 'pending_sent') {
        status = 'pending_received';
      } else if (status === 'pending_received') {
        status = 'pending_sent';
      }
    }

    return createSuccessResponse({
      user_id: userId as string,
      status,
      request_id: friendship.request_id,
      created_at: friendship.created_at,
      updated_at: friendship.updated_at,
    });
  }),

  // POST /friends/requests - Send friend request
  http.post(buildApiUrl(API_ENDPOINTS.FRIENDS.requests), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { user_id: string; message?: string };
      const toUserId = body.user_id;
      
      if (!toUserId) {
        return createValidationError('User ID is required');
      }

      const friendshipKey = `${userId}:${toUserId}`;
      const existingFriendship = mockFriendships.get(friendshipKey);
      
      if (existingFriendship) {
        return createConflictError('Friend request already exists or users are already friends');
      }

      const requestId = `req-${userId}-to-${toUserId}`;
      const friendRequest = {
        id: requestId,
        from_user_id: userId,
        to_user_id: toUserId,
        message: body.message,
        status: 'pending' as const,
        created_at: now(),
        updated_at: now(),
      };

      mockFriendRequests.set(requestId, friendRequest);
      mockFriendships.set(friendshipKey, {
        status: 'pending_sent',
        request_id: requestId,
        created_at: now(),
        updated_at: now(),
      });

      // Set reverse friendship for the receiver
      mockFriendships.set(`${toUserId}:${userId}`, {
        status: 'pending_received',
        request_id: requestId,
        created_at: now(),
        updated_at: now(),
      });

      return createSuccessResponse(friendRequest, 201);
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // POST /friends/requests/:requestId/respond - Respond to friend request
  http.post(buildApiUrl('/friends/requests/:requestId/respond'), async ({ request, params }) => {
    const { requestId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { accept: boolean };
      const friendRequest = mockFriendRequests.get(requestId as string);
      
      if (!friendRequest || friendRequest.to_user_id !== userId) {
        return createNotFoundError('Friend request not found');
      }

      const newStatus = body.accept ? 'accepted' : 'rejected';
      const updatedRequest = {
        ...friendRequest,
        status: newStatus as 'accepted' | 'rejected',
        updated_at: now(),
      };
      
      mockFriendRequests.set(requestId as string, updatedRequest);

      // Update friendship statuses
      const friendshipKey = `${friendRequest.from_user_id}:${friendRequest.to_user_id}`;
      const reverseFriendshipKey = `${friendRequest.to_user_id}:${friendRequest.from_user_id}`;
      
      if (body.accept) {
        // They are now friends
        mockFriendships.set(friendshipKey, {
          status: 'friends',
          created_at: now(),
          updated_at: now(),
        });
        mockFriendships.set(reverseFriendshipKey, {
          status: 'friends',
          created_at: now(),
          updated_at: now(),
        });
      } else {
        // Request rejected, remove friendships
        mockFriendships.delete(friendshipKey);
        mockFriendships.delete(reverseFriendshipKey);
      }

      return createSuccessResponse({
        id: requestId as string,
        status: newStatus,
        updated_at: now(),
      });
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // DELETE /friends/requests/:userId/cancel - Cancel friend request
  http.delete(buildApiUrl('/friends/requests/:userId/cancel'), ({ request, params }) => {
    const { userId: toUserId } = params;
    const fromUserId = extractUserId(request);
    
    if (!fromUserId) {
      return createAuthError();
    }

    const friendshipKey = `${fromUserId}:${toUserId}`;
    const reverseFriendshipKey = `${toUserId}:${fromUserId}`;
    
    const friendship = mockFriendships.get(friendshipKey);
    if (!friendship || friendship.status !== 'pending_sent') {
      return createNotFoundError('Friend request not found');
    }

    // Remove friend request and friendships
    if (friendship.request_id) {
      mockFriendRequests.delete(friendship.request_id);
    }
    mockFriendships.delete(friendshipKey);
    mockFriendships.delete(reverseFriendshipKey);

    return createSuccessResponse({}, 204);
  }),

  // DELETE /friends/:friendId - Remove friend
  http.delete('*/friends/:friendId', ({ request, params }) => {
    const { friendId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const friendshipKey = `${userId}:${friendId}`;
    const reverseFriendshipKey = `${friendId}:${userId}`;
    
    const friendship = mockFriendships.get(friendshipKey) || 
                     mockFriendships.get(reverseFriendshipKey);
    
    if (!friendship || friendship.status !== 'friends') {
      return createNotFoundError('Friendship not found');
    }

    // Remove friendship
    mockFriendships.delete(friendshipKey);
    mockFriendships.delete(reverseFriendshipKey);

    return createSuccessResponse({}, 204);
  }),

  // GET /friends/requests - Get friend requests
  http.get('*/friends/requests', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const { limit, offset } = parsePaginationParams(url);

    let filteredRequests = Array.from(mockFriendRequests.values());

    // Filter by type
    if (type === 'sent') {
      filteredRequests = filteredRequests.filter(req => req.from_user_id === userId);
    } else if (type === 'received') {
      filteredRequests = filteredRequests.filter(req => req.to_user_id === userId);
    } else {
      filteredRequests = filteredRequests.filter(req => 
        req.from_user_id === userId || req.to_user_id === userId
      );
    }

    // Filter by status
    if (status !== 'all') {
      filteredRequests = filteredRequests.filter(req => req.status === status);
    }

    const total = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice(offset, offset + limit);

    return createSuccessResponse({
      requests: paginatedRequests,
      total,
      has_more: offset + limit < total,
    });
  }),
];
