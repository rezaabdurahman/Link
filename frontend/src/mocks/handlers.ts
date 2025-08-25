import { http, HttpResponse } from 'msw';
import { BroadcastResponse } from '../services/broadcastClient';
import { AvailabilityResponse, PublicAvailabilityResponse, AvailableUsersResponse, HeartbeatResponse } from '../services/availabilityClient';
import {
  OnboardingStatusResponse,
  StartOnboardingResponse,
  UpdateStepResponse,
  CompleteOnboardingResponse,
  SkipOnboardingResponse,
  SkipStepResponse,
  ProfileUpdateResponse,
  OnboardingStepType,
  OnboardingStatusType
} from '../services/onboardingClient';
import {
  ConversationsResponse,
  Conversation,
  ConversationParticipant,
  ConversationMessage,
  MessagesResponse,
  CreateConversationRequest
} from '../services/chatClient';
import { currentUser, nearbyUsers, chats } from '../data/mockData';
import { UnifiedSearchRequest, UnifiedSearchResponse } from '../services/unifiedSearchClient';

// Helper to generate UUID
const generateId = () => crypto.randomUUID();

// Helper to get current timestamp
const now = () => new Date().toISOString();

// Mock database for broadcasts
const mockBroadcasts: Map<string, BroadcastResponse> = new Map();

// Mock database for availability
const mockAvailability: Map<string, AvailabilityResponse> = new Map();

// Initialize some demo availability data
mockAvailability.set('demo-user-1', {
  id: generateId(),
  user_id: 'demo-user-1',
  is_available: false,
  created_at: now(),
  updated_at: now(),
});

mockAvailability.set('demo-user-2', {
  id: generateId(),
  user_id: 'demo-user-2', 
  is_available: true,
  last_available_at: now(),
  created_at: now(),
  updated_at: now(),
});

mockAvailability.set('demo-user-3', {
  id: generateId(),
  user_id: 'demo-user-3',
  is_available: true,
  last_available_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
  created_at: now(),
  updated_at: now(),
});

// Helper to calculate expiration time
const getExpirationTime = (hours: number = 24) => {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration.toISOString();
};

// SECURITY: Helper to safely extract and validate user ID  
const extractUserId = (req: any): string | null => {
  const authHeader = req.headers.get('Authorization');
  const userIdHeader = req.headers.get('X-User-ID');
  
  // SECURITY: Strict authentication validation
  if (!authHeader && !userIdHeader) {
    return null;
  }
  
  // SECURITY: In development, validate dev token format
  if (authHeader && authHeader.includes('dev-token-')) {
    const token = authHeader.replace('Bearer ', '');
    if (token.startsWith('dev-token-') && token.length > 10) {
      return token.replace('dev-token-', '');
    }
  }
  
  // SECURITY: Fallback to X-User-ID only in development/demo
  if (userIdHeader && userIdHeader.match(/^[a-zA-Z0-9-]+$/)) {
    return userIdHeader;
  }
  
  // SECURITY: Default demo user for MSW testing
  return 'demo-user-1';
};

// Search handlers
export const searchHandlers = [
  // POST /search - Unified search endpoint (specific URL)
  http.post('http://localhost:8080/search', async ({ request }) => {
    console.log('🔍 MSW: Handler matched for localhost:8080/search');
    try {
      const searchRequest: UnifiedSearchRequest = await request.json();
      console.log('🔍 MSW: Received search request:', searchRequest);
      
      // Filter nearbyUsers based on search criteria
      let filteredUsers = [...nearbyUsers];
      
      // Apply availability filter
      if (searchRequest.filters?.available_only) {
        filteredUsers = filteredUsers.filter(user => user.isAvailable);
      }
      
      // Apply interest filter
      if (searchRequest.filters?.interests && searchRequest.filters.interests.length > 0) {
        filteredUsers = filteredUsers.filter(user => 
          user.interests.some(interest => 
            searchRequest.filters!.interests!.some(filterInterest => 
              interest.toLowerCase().includes(filterInterest.toLowerCase())
            )
          )
        );
      }
      
      // Apply text query filter (search in name, bio, interests)
      if (searchRequest.query && searchRequest.query.trim()) {
        const query = searchRequest.query.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          `${user.first_name} ${user.last_name}`.toLowerCase().includes(query) ||
          user.bio.toLowerCase().includes(query) ||
          user.interests.some(interest => interest.toLowerCase().includes(query))
        );
      }
      
      // Apply pagination
      const limit = searchRequest.pagination?.limit || 50;
      const offset = searchRequest.pagination?.offset || 0;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);
      
      console.log(`🔍 MSW: Returning ${paginatedUsers.length} users out of ${filteredUsers.length} total matches`);
      
      const response: UnifiedSearchResponse = {
        users: paginatedUsers,
        metadata: {
          total: filteredUsers.length,
          count: paginatedUsers.length,
          limit: limit,
          offset: offset,
          searchTime: Math.floor(Math.random() * 50) + 10, // Mock search time 10-60ms
          query: searchRequest.query,
          scope: searchRequest.scope,
        }
      };
      
      return HttpResponse.json(response);
    } catch (error) {
      console.error('🔍 MSW: Search error:', error);
      return HttpResponse.json(
        {
          message: 'Search failed',
          code: 'SEARCH_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }),
  
  // POST /search - Unified search endpoint (wildcard fallback)
  http.post('*/search', async ({ request }) => {
    console.log('🔍 MSW: Handler matched for */search fallback');
    try {
      const searchRequest: UnifiedSearchRequest = await request.json();
      console.log('🔍 MSW: Received search request:', searchRequest);
      
      // Filter nearbyUsers based on search criteria
      let filteredUsers = [...nearbyUsers];
      
      // Apply availability filter
      if (searchRequest.filters?.available_only) {
        filteredUsers = filteredUsers.filter(user => user.isAvailable);
      }
      
      // Apply interest filter
      if (searchRequest.filters?.interests && searchRequest.filters.interests.length > 0) {
        filteredUsers = filteredUsers.filter(user => 
          user.interests.some(interest => 
            searchRequest.filters!.interests!.some(filterInterest => 
              interest.toLowerCase().includes(filterInterest.toLowerCase())
            )
          )
        );
      }
      
      // Apply text query filter (search in name, bio, interests)
      if (searchRequest.query && searchRequest.query.trim()) {
        const query = searchRequest.query.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          `${user.first_name} ${user.last_name}`.toLowerCase().includes(query) ||
          user.bio.toLowerCase().includes(query) ||
          user.interests.some(interest => interest.toLowerCase().includes(query))
        );
      }
      
      // Apply pagination
      const limit = searchRequest.pagination?.limit || 50;
      const offset = searchRequest.pagination?.offset || 0;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);
      
      console.log(`🔍 MSW: Returning ${paginatedUsers.length} users out of ${filteredUsers.length} total matches`);
      
      const response: UnifiedSearchResponse = {
        users: paginatedUsers,
        metadata: {
          total: filteredUsers.length,
          count: paginatedUsers.length,
          limit: limit,
          offset: offset,
          searchTime: Math.floor(Math.random() * 50) + 10, // Mock search time 10-60ms
          query: searchRequest.query,
          scope: searchRequest.scope,
        }
      };
      
      return HttpResponse.json(response);
    } catch (error) {
      console.error('🔍 MSW: Search error:', error);
      return HttpResponse.json(
        {
          message: 'Search failed',
          code: 'SEARCH_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }),
];

export const broadcastHandlers = [
  // GET /broadcasts - Get current user's broadcast
  http.get('*/broadcasts', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'unauthorized',
          message: 'User not authenticated',
          code: 401,
          timestamp: now(),
        },
        { status: 401 }
      );
    }

    const broadcast = mockBroadcasts.get(userId);

    if (!broadcast) {
      return HttpResponse.json(
        {
          error: 'not_found',
          message: 'No active broadcast found',
          code: 404,
          timestamp: now(),
        },
        { status: 404 }
      );
    }

    // Check if broadcast is expired
    if (broadcast.expires_at && new Date(broadcast.expires_at) < new Date()) {
      mockBroadcasts.delete(userId);
      return HttpResponse.json(
        {
          error: 'not_found',
          message: 'No active broadcast found',
          code: 404,
          timestamp: now(),
        },
        { status: 404 }
      );
    }

    return HttpResponse.json(broadcast, { status: 200 });
  }),

  // POST /broadcasts - Create new broadcast
  http.post('*/broadcasts', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    const userIdHeader = request.headers.get('X-User-ID');
    
    if (!authHeader && !userIdHeader) {
      return HttpResponse.json(
        {
          error: 'unauthorized',
          message: 'User not authenticated',
          code: 401,
          timestamp: now(),
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { message: string; expires_in_hours?: number };
      
      // Validation
      if (!body.message || body.message.trim().length === 0) {
        return HttpResponse.json(
          {
            error: 'validation_error',
            message: 'Broadcast message cannot be empty',
            code: 400,
            timestamp: now(),
          },
          { status: 400 }
        );
      }

      if (body.message.length > 200) {
        return HttpResponse.json(
          {
            error: 'validation_error',
            message: 'Broadcast message must be 200 characters or less',
            code: 400,
            timestamp: now(),
          },
          { status: 400 }
        );
      }

      const userId = userIdHeader || 'demo-user-1';
      
      // Check if user already has a broadcast
      if (mockBroadcasts.has(userId)) {
        return HttpResponse.json(
          {
            error: 'conflict_error',
            message: 'You already have an active broadcast. Please update or delete it first.',
            code: 409,
            timestamp: now(),
          },
          { status: 409 }
        );
      }

      // Create new broadcast
      const broadcast: BroadcastResponse = {
        id: generateId(),
        user_id: userId,
        message: body.message.trim(),
        is_active: true,
        expires_at: getExpirationTime(body.expires_in_hours),
        created_at: now(),
        updated_at: now(),
      };

      mockBroadcasts.set(userId, broadcast);
      
      // Simulate network delay (reduced for testing)
      await new Promise(resolve => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 10 : 300));

      return HttpResponse.json(broadcast, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid request data',
          code: 400,
          timestamp: now(),
        },
        { status: 400 }
      );
    }
  }),
];

// Helper function to convert UI Chat to API Conversation
const convertChatToConversation = (chat: typeof chats[0]): Conversation => {
  // Find the participant user from nearbyUsers
  const participant = nearbyUsers.find(user => user.id === chat.participantId);
  
  const conversationParticipant: ConversationParticipant = {
    id: chat.participantId,
    name: chat.participantName,
    avatar: chat.participantAvatar,
  };

  return {
    id: chat.id,
    type: 'direct',
    is_private: false,
    created_by: '1', // Current user
    participants: [conversationParticipant],
    unread_count: chat.unreadCount,
    last_message: {
      id: chat.lastMessage.id,
      content: chat.lastMessage.content,
      message_type: chat.lastMessage.type as 'text',
      sender_id: chat.lastMessage.senderId,
      created_at: chat.lastMessage.timestamp.toISOString(),
    },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    updated_at: chat.lastMessage.timestamp.toISOString(),
  };
};

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

// Chat handlers
export const chatHandlers = [
  // GET /api/v1/chat/conversations - Get user's conversations
  http.get('*/api/v1/chat/conversations', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to view conversations',
          code: 401,
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

    // Convert mock chats to API conversations
    const conversations = chats.map(convertChatToConversation);
    
    const totalCount = conversations.length;
    const paginatedConversations = conversations.slice(offset, offset + limit);

    const response: ConversationsResponse = {
      data: paginatedConversations,
      total: totalCount,
      limit,
      offset,
      has_more: offset + limit < totalCount,
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  // POST /api/v1/chat/conversations - Create new conversation
  http.post('*/api/v1/chat/conversations', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to create conversations',
          code: 401,
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as CreateConversationRequest;
      
      // Create new conversation
      const conversationId = generateId();
      const participantId = body.participant_ids[0];
      const participant = nearbyUsers.find(user => user.id === participantId);
      
      const conversation: Conversation = {
        id: conversationId,
        type: body.type,
        name: body.name,
        description: body.description,
        is_private: body.is_private || false,
        max_members: body.max_members,
        created_by: userId,
        participants: [{
          id: participantId,
          name: participant?.name || 'Unknown User',
          avatar: participant?.profilePicture,
        }],
        unread_count: 0,
        created_at: now(),
        updated_at: now(),
      };

      return HttpResponse.json(conversation, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'Invalid request body',
          message: 'Failed to parse conversation creation request',
          code: 400,
        },
        { status: 400 }
      );
    }
  }),

  // GET /api/v1/chat/conversations/:conversationId/messages - Get conversation messages
  http.get('*/api/v1/chat/conversations/:conversationId/messages', ({ params, request }) => {
    const userId = extractUserId(request);
    const { conversationId } = params;
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to view messages',
          code: 401,
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

    // Mock messages for the conversation
    const mockMessages: ConversationMessage[] = [
      {
        id: 'msg-1',
        content: 'Hey there! How are you doing?',
        message_type: 'text',
        sender_id: conversationId === 'chat1' ? '2' : '4',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        content: 'I\'m doing great! Thanks for asking. What about you?',
        message_type: 'text',
        sender_id: '1', // Current user
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-3',
        content: 'Fantastic! Looking forward to hanging out soon.',
        message_type: 'text',
        sender_id: conversationId === 'chat1' ? '2' : '4',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ];
    
    const totalCount = mockMessages.length;
    const paginatedMessages = mockMessages.slice(offset, offset + limit);

    const response: MessagesResponse = {
      data: paginatedMessages,
      total: totalCount,
      limit,
      offset,
      has_more: offset + limit < totalCount,
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  // POST /api/v1/chat/messages - Send a message
  http.post('*/api/v1/chat/messages', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to send messages',
          code: 401,
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as {
        conversation_id: string;
        content: string;
        message_type: 'text';
        parent_id?: string;
      };
      
      const message: ConversationMessage = {
        id: generateId(),
        content: body.content,
        message_type: body.message_type,
        sender_id: userId,
        created_at: now(),
        parent_id: body.parent_id || null,
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));

      return HttpResponse.json(message, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'Invalid request body',
          message: 'Failed to parse message send request',
          code: 400,
        },
        { status: 400 }
      );
    }
  }),
];

// Friend handlers
export const friendHandlers = [
  // GET /friends/status/:userId - Get friendship status
  http.get('*/friends/status/:userId', ({ request, params }) => {
    const { userId } = params;
    const currentUserId = extractUserId(request);
    
    if (!currentUserId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    const friendshipKey = `${currentUserId}:${userId}`;
    const reverseFriendshipKey = `${userId}:${currentUserId}`;
    
    // Check both directions
    const friendship = mockFriendships.get(friendshipKey) || 
                     mockFriendships.get(reverseFriendshipKey);
    
    if (!friendship) {
      return HttpResponse.json({
        user_id: userId as string,
        status: 'none',
      }, { status: 200 });
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

    return HttpResponse.json({
      user_id: userId as string,
      status,
      request_id: friendship.request_id,
      created_at: friendship.created_at,
      updated_at: friendship.updated_at,
    }, { status: 200 });
  }),

  // POST /friends/requests - Send friend request
  http.post('*/friends/requests', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { user_id: string; message?: string };
      const toUserId = body.user_id;
      
      if (!toUserId) {
        return HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            message: 'User ID is required',
            field: 'user_id',
            code: 'REQUIRED_FIELD',
          },
          { status: 400 }
        );
      }

      const friendshipKey = `${userId}:${toUserId}`;
      const existingFriendship = mockFriendships.get(friendshipKey);
      
      if (existingFriendship) {
        return HttpResponse.json(
          {
            type: 'CONFLICT_ERROR',
            message: 'Friend request already exists or users are already friends',
            code: 'DUPLICATE_REQUEST',
          },
          { status: 409 }
        );
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

      return HttpResponse.json(friendRequest, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // POST /friends/requests/:requestId/respond - Respond to friend request
  http.post('*/friends/requests/:requestId/respond', async ({ request, params }) => {
    const { requestId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { accept: boolean };
      const friendRequest = mockFriendRequests.get(requestId as string);
      
      if (!friendRequest || friendRequest.to_user_id !== userId) {
        return HttpResponse.json(
          {
            type: 'NOT_FOUND_ERROR',
            message: 'Friend request not found',
            code: 'REQUEST_NOT_FOUND',
          },
          { status: 404 }
        );
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

      return HttpResponse.json({
        id: requestId as string,
        status: newStatus,
        updated_at: now(),
      }, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // DELETE /friends/requests/:userId/cancel - Cancel friend request
  http.delete('*/friends/requests/:userId/cancel', ({ request, params }) => {
    const { userId: toUserId } = params;
    const fromUserId = extractUserId(request);
    
    if (!fromUserId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    const friendshipKey = `${fromUserId}:${toUserId}`;
    const reverseFriendshipKey = `${toUserId}:${fromUserId}`;
    
    const friendship = mockFriendships.get(friendshipKey);
    if (!friendship || friendship.status !== 'pending_sent') {
      return HttpResponse.json(
        {
          type: 'NOT_FOUND_ERROR',
          message: 'Friend request not found',
          code: 'REQUEST_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Remove friend request and friendships
    if (friendship.request_id) {
      mockFriendRequests.delete(friendship.request_id);
    }
    mockFriendships.delete(friendshipKey);
    mockFriendships.delete(reverseFriendshipKey);

    return HttpResponse.json({}, { status: 204 });
  }),

  // DELETE /friends/:friendId - Remove friend
  http.delete('*/friends/:friendId', ({ request, params }) => {
    const { friendId } = params;
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    const friendshipKey = `${userId}:${friendId}`;
    const reverseFriendshipKey = `${friendId}:${userId}`;
    
    const friendship = mockFriendships.get(friendshipKey) || 
                     mockFriendships.get(reverseFriendshipKey);
    
    if (!friendship || friendship.status !== 'friends') {
      return HttpResponse.json(
        {
          type: 'NOT_FOUND_ERROR',
          message: 'Friendship not found',
          code: 'FRIENDSHIP_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Remove friendship
    mockFriendships.delete(friendshipKey);
    mockFriendships.delete(reverseFriendshipKey);

    return HttpResponse.json({}, { status: 204 });
  }),

  // GET /friends/requests - Get friend requests
  http.get('*/friends/requests', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

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

    return HttpResponse.json({
      requests: paginatedRequests,
      total,
      has_more: offset + limit < total,
    }, { status: 200 });
  }),
];

// Continue with remaining handlers... (keeping original structure for brevity)

export const availabilityHandlers = [
  // GET /availability - Get current user's availability
  http.get('*/availability', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to view your availability',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    let availability = mockAvailability.get(userId);
    
    // Create default availability record if it doesn't exist
    if (!availability) {
      availability = {
        id: generateId(),
        user_id: userId,
        is_available: false,
        created_at: now(),
        updated_at: now(),
      };
      mockAvailability.set(userId, availability);
    }

    return HttpResponse.json(availability, { status: 200 });
  }),

  // PUT /availability - Update current user's availability
  http.put('*/availability', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to update your availability',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { is_available: boolean };
      
      if (typeof body.is_available !== 'boolean') {
        return HttpResponse.json(
          {
            error: 'Invalid request body',
            message: 'is_available must be a boolean',
            code: 'INVALID_BODY',
          },
          { status: 400 }
        );
      }

      let availability = mockAvailability.get(userId);
      
      if (!availability) {
        availability = {
          id: generateId(),
          user_id: userId,
          is_available: body.is_available,
          created_at: now(),
          updated_at: now(),
        };
      } else {
        availability = {
          ...availability,
          is_available: body.is_available,
          updated_at: now(),
        };
      }

      // Set last_available_at when becoming available
      if (body.is_available) {
        availability.last_available_at = now();
      }

      mockAvailability.set(userId, availability);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));

      return HttpResponse.json(availability, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'Invalid request body',
          message: 'Failed to parse request body',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }
  }),
];

// Mock database for onboarding
const mockOnboarding: Map<string, OnboardingStatusResponse> = new Map();
const mockUserProfiles: Map<string, any> = new Map();

// Initialize demo onboarding data
mockOnboarding.set('demo-user-1', {
  user_id: 'demo-user-1',
  status: 'not_started' as OnboardingStatusType,
  completed_steps: [],
  created_at: now(),
  updated_at: now(),
});

// Demo user profile
mockUserProfiles.set('demo-user-1', {
  id: 'demo-user-1',
  email: 'demo@example.com',
  username: 'demouser',
  first_name: 'Demo',
  last_name: 'User',
  bio: null,
  profile_picture: null,
  location: null,
  email_verified: true,
  created_at: now(),
  updated_at: now(),
});

export const onboardingHandlers = [
  // GET /onboarding/status - Get onboarding status
  http.get('*/onboarding/status', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    let onboardingStatus = mockOnboarding.get(userId);
    
    // Create default onboarding status if it doesn't exist
    if (!onboardingStatus) {
      onboardingStatus = {
        user_id: userId,
        status: 'not_started' as OnboardingStatusType,
        completed_steps: [],
        created_at: now(),
        updated_at: now(),
      };
      mockOnboarding.set(userId, onboardingStatus);
    }

    return HttpResponse.json(onboardingStatus, { status: 200 });
  }),

  // POST /onboarding/start - Start onboarding process
  http.post('*/onboarding/start', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { initial_step?: string };
      const initialStep = body.initial_step || 'profile_picture';
      
      const onboardingStatus = {
        user_id: userId,
        status: 'in_progress' as OnboardingStatusType,
        current_step: initialStep,
        completed_steps: [],
        created_at: now(),
        updated_at: now(),
      };
      
      mockOnboarding.set(userId, onboardingStatus);
      
      return HttpResponse.json({
        user_id: userId,
        status: 'in_progress',
        current_step: initialStep,
        message: 'Onboarding started successfully',
      }, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // POST /onboarding/step - Update onboarding step
  http.post('*/onboarding/step', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { step: string; data: Record<string, any> };
      
      if (!body.step) {
        return HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            message: 'Step is required',
            field: 'step',
            code: 'REQUIRED_FIELD',
          },
          { status: 400 }
        );
      }
      
      let onboardingStatus = mockOnboarding.get(userId);
      
      if (!onboardingStatus) {
        // Create if doesn't exist
        onboardingStatus = {
          user_id: userId,
          status: 'in_progress' as OnboardingStatusType,
          completed_steps: [],
          created_at: now(),
          updated_at: now(),
        };
      }
      
      // Add step to completed steps if not already there
      if (!onboardingStatus.completed_steps.includes(body.step as any)) {
        onboardingStatus.completed_steps.push(body.step as any);
      }
      
      // Determine next step
      const stepOrder = [
        'profile_picture',
        'bio', 
        'interests',
        'location_preferences',
        'privacy_settings',
        'notification_preferences',
        'welcome_tutorial'
      ];
      
      const currentIndex = stepOrder.indexOf(body.step);
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : null;
      
      onboardingStatus.current_step = nextStep;
      onboardingStatus.updated_at = now();
      
      // If this is the last step, mark as completed
      if (!nextStep) {
        onboardingStatus.status = 'completed';
      }
      
      mockOnboarding.set(userId, onboardingStatus);
      
      // Update user profile with step data if needed
      if (body.data) {
        let userProfile = mockUserProfiles.get(userId);
        if (!userProfile) {
          userProfile = {
            id: userId,
            email: `user${userId}@example.com`,
            username: `user${userId}`,
            first_name: 'User',
            last_name: userId,
            bio: null,
            profile_picture: null,
            location: null,
            email_verified: true,
            created_at: now(),
            updated_at: now(),
          };
        }
        
        // Update profile based on step data
        if (body.step === 'profile_picture' && body.data.profile_picture) {
          userProfile.profile_picture = body.data.profile_picture;
        } else if (body.step === 'bio' && body.data.bio) {
          userProfile.bio = body.data.bio;
        }
        
        userProfile.updated_at = now();
        mockUserProfiles.set(userId, userProfile);
      }
      
      return HttpResponse.json({
        user_id: userId,
        step: body.step,
        status: onboardingStatus.status,
        message: `Step ${body.step} completed successfully`,
      }, { status: 200 });
      
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // POST /onboarding/complete - Complete entire onboarding
  http.post('*/onboarding/complete', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    let onboardingStatus = mockOnboarding.get(userId);
    
    if (!onboardingStatus) {
      onboardingStatus = {
        user_id: userId,
        status: 'completed' as OnboardingStatusType,
        completed_steps: [
          'profile_picture',
          'bio', 
          'interests',
          'location_preferences',
          'privacy_settings',
          'notification_preferences',
          'welcome_tutorial'
        ] as any[],
        created_at: now(),
        updated_at: now(),
      };
    } else {
      onboardingStatus.status = 'completed';
      onboardingStatus.updated_at = now();
    }
    
    mockOnboarding.set(userId, onboardingStatus);
    
    return HttpResponse.json({
      user_id: userId,
      status: 'completed',
      completed_at: now(),
      message: 'Onboarding completed successfully',
    }, { status: 200 });
  }),

  // POST /onboarding/skip - Skip entire onboarding
  http.post('*/onboarding/skip', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    const onboardingStatus = {
      user_id: userId,
      status: 'skipped' as OnboardingStatusType,
      completed_steps: [],
      created_at: now(),
      updated_at: now(),
    };
    
    mockOnboarding.set(userId, onboardingStatus);
    
    return HttpResponse.json({
      user_id: userId,
      status: 'skipped',
      skipped_at: now(),
      message: 'Onboarding skipped successfully',
    }, { status: 200 });
  }),

  // POST /onboarding/skip-step - Skip specific step
  http.post('*/onboarding/skip-step', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as { step: string };
      
      if (!body.step) {
        return HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            message: 'Step is required',
            field: 'step',
            code: 'REQUIRED_FIELD',
          },
          { status: 400 }
        );
      }
      
      let onboardingStatus = mockOnboarding.get(userId);
      
      if (!onboardingStatus) {
        onboardingStatus = {
          user_id: userId,
          status: 'in_progress' as OnboardingStatusType,
          completed_steps: [],
          created_at: now(),
          updated_at: now(),
        };
      }
      
      // Determine next step after skipping current one
      const stepOrder = [
        'profile_picture',
        'bio', 
        'interests',
        'location_preferences',
        'privacy_settings',
        'notification_preferences',
        'welcome_tutorial'
      ];
      
      const currentIndex = stepOrder.indexOf(body.step);
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : null;
      
      onboardingStatus.current_step = nextStep;
      onboardingStatus.updated_at = now();
      
      // If this was the last step, mark as completed
      if (!nextStep) {
        onboardingStatus.status = 'completed';
      }
      
      mockOnboarding.set(userId, onboardingStatus);
      
      return HttpResponse.json({
        user_id: userId,
        step: body.step,
        status: onboardingStatus.status,
        message: `Step ${body.step} skipped successfully`,
      }, { status: 200 });
      
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // POST /users/profile - Update user profile (used during onboarding)
  http.post('*/users/profile', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as {
        bio?: string;
        profile_picture?: string;
        interests?: string[];
        location?: {
          latitude: number;
          longitude: number;
          address: string;
        };
        privacy_settings?: {
          profile_visibility: 'public' | 'friends' | 'private';
          location_sharing: boolean;
          activity_status: boolean;
        };
        notification_preferences?: {
          push_notifications: boolean;
          email_notifications: boolean;
          sms_notifications: boolean;
          marketing_emails: boolean;
        };
      };
      
      let userProfile = mockUserProfiles.get(userId);
      
      if (!userProfile) {
        userProfile = {
          id: userId,
          email: `user${userId}@example.com`,
          username: `user${userId}`,
          first_name: 'User',
          last_name: userId,
          bio: null,
          profile_picture: null,
          location: null,
          email_verified: true,
          created_at: now(),
          updated_at: now(),
        };
      }
      
      // Update profile fields from request body
      if (body.bio !== undefined) {
        userProfile.bio = body.bio;
      }
      if (body.profile_picture !== undefined) {
        userProfile.profile_picture = body.profile_picture;
      }
      if (body.location) {
        userProfile.location = body.location.address;
      }
      
      userProfile.updated_at = now();
      mockUserProfiles.set(userId, userProfile);
      
      return HttpResponse.json({
        user: userProfile,
        message: 'Profile updated successfully',
      }, { status: 200 });
      
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),
];

// Auth handlers for login/register (basic mock)
// User profile handlers
export const userHandlers = [
  // GET /users/profile/me - Get current user's profile
  http.get('*/users/profile/me', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    // Get user profile from mock database
    const userProfile = mockUserProfiles.get(userId);
    
    if (!userProfile) {
      // Create a default profile for the authenticated user
      const defaultProfile = {
        id: userId,
        email: `user${userId}@example.com`,
        username: `user${userId}`,
        first_name: 'Current',
        last_name: 'User',
        bio: 'Hello, I\'m using Link!',
        profile_picture: null,
        location: null,
        email_verified: true,
        created_at: now(),
        updated_at: now(),
        // Additional profile fields for full profile response
        age: 25,
        interests: ['technology', 'music', 'travel'],
        social_links: [
          {
            platform: 'instagram',
            url: 'https://instagram.com/currentuser',
            username: 'currentuser'
          }
        ],
        additional_photos: [],
        privacy_settings: {
          show_age: true,
          show_location: false,
          show_mutual_friends: true,
        },
        mutual_friends: 5,
        last_login_at: now(),
      };
      
      mockUserProfiles.set(userId, defaultProfile);
      return HttpResponse.json(defaultProfile, { status: 200 });
    }

    // Return the stored profile with additional fields for complete profile response
    const completeProfile = {
      ...userProfile,
      // Ensure all expected fields are present for current user's complete profile
      age: userProfile.age || 25,
      interests: userProfile.interests || ['technology', 'music'],
      social_links: userProfile.social_links || [],
      additional_photos: userProfile.additional_photos || [],
      privacy_settings: userProfile.privacy_settings || {
        show_age: true,
        show_location: false,
        show_mutual_friends: true,
      },
      mutual_friends: userProfile.mutual_friends || 0,
      last_login_at: userProfile.last_login_at || now(),
    };

    return HttpResponse.json(completeProfile, { status: 200 });
  }),

  // GET /users/profile/:userId - Get user profile
  http.get('*/users/profile/:userId', ({ request, params }) => {
    const { userId } = params;
    const requestingUserId = extractUserId(request);
    
    if (!requestingUserId) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    // Find user in nearbyUsers mock data
    const user = nearbyUsers.find(u => u.id === userId);
    
    if (!user) {
      return HttpResponse.json(
        {
          type: 'NOT_FOUND_ERROR',
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // TODO: TEMPORARY MOCK DATA - Replace with actual user-svc backend integration
    // These should be retrieved from user database, not generated
    // Backend changes needed:
    // 1. Add social_links table to user-svc database
    // 2. Add social_links field to UserProfile schema in OpenAPI spec
    // 3. Add CRUD endpoints for managing social links
    
    // TEMPORARY: Generate mock social links for development
    const generateMockSocialLinks = (name: string, profileType: string) => {
      if (profileType !== 'public') return [];
      
      const username = name.toLowerCase().replace(/\s+/g, '_');
      const socialPlatforms = ['instagram', 'twitter', 'facebook'];
      const numPlatforms = Math.floor(Math.random() * 3) + 1; // 1-3 platforms
      
      return socialPlatforms.slice(0, numPlatforms).map(platform => ({
        platform: platform as 'instagram' | 'twitter' | 'facebook',
        handle: platform === 'instagram' ? `@${username}` : 
               platform === 'twitter' ? `@${username}` : name,
        url: `https://${platform}.com/${username}`
      }));
    };
    
    // TODO: TEMPORARY MOCK DATA - Replace with actual user media from backend
    // These should be stored in user media/photos table
    // Backend changes needed:
    // 1. Add user_photos table or extend user media storage
    // 2. Add additional_photos field to UserProfile response
    // 3. Add photo upload/management endpoints
    
    // TEMPORARY: Generate mock additional photos for development  
    const generateMockAdditionalPhotos = (profileType: string, profilePicture: string | null) => {
      if (profileType !== 'public') return [];
      
      const additionalPhotoUrls = [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1494790108755-2616b612b5ab?w=300&h=300&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face'
      ];
      
      const numPhotos = Math.floor(Math.random() * 4) + 1; // 1-4 additional photos
      const photos = additionalPhotoUrls.slice(0, numPhotos);
      
      // Don't include profile picture in additional photos
      return photos.filter(photo => photo !== profilePicture);
    };

    // Convert User type to UserProfileResponse format matching backend
    const profileResponse = {
      id: user.id,
      email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      username: user.name.toLowerCase().replace(/\s+/g, '_'),
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ').slice(1).join(' ') || 'User',
      bio: user.bio,
      profile_picture: user.profilePicture || null,
      location: user.location ? `${user.location.proximityMiles} miles away` : null,
      date_of_birth: user.age ? new Date(Date.now() - user.age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
      email_verified: true,
      created_at: now(),
      updated_at: now(),
      // New backend fields matching updated API
      age: user.profileType === 'public' ? user.age : undefined, // Respect privacy settings
      interests: user.interests || [], // Real interests from mock data
      social_links: generateMockSocialLinks(user.name, user.profileType), // Mock social links
      additional_photos: generateMockAdditionalPhotos(user.profileType, user.profilePicture || null), // Mock photos
      privacy_settings: {
        show_age: user.profileType === 'public',
        show_location: user.profileType === 'public',
        show_mutual_friends: user.profileType === 'public',
      },
      // Friend-related fields
      is_friend: user.id === '2' || user.id === '3', // Mock some as friends
      mutual_friends: (user.profileType === 'public' && (user.id === '2' || user.id === '3')) ? user.mutualFriends?.length || 0 : undefined, // Respect privacy
      last_login_at: user.lastSeen?.toISOString() || now(), // Changed from last_active to match backend
    };

    return HttpResponse.json(profileResponse, { status: 200 });
  }),
];

export const authHandlers = [
  // POST /auth/login - Mock login
  http.post('*/auth/login', async ({ request }) => {
    try {
      const body = await request.json() as { email: string; password: string };
      
      // Simple mock authentication
      const user = {
        id: 'demo-user-1',
        email: body.email,
        username: 'demouser',
        first_name: 'Demo',
        last_name: 'User',
        profile_picture: null,
        bio: null,
        location: null,
        email_verified: true,
        created_at: now(),
        updated_at: now(),
      };

      const response = {
        user,
        token: 'dev-token-demo-user-1',
        message: 'Login successful',
      };

      return HttpResponse.json(response, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'AUTHENTICATION_ERROR',
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }
  }),

  // POST /auth/register - Mock registration
  http.post('*/auth/register', async ({ request }) => {
    try {
      const body = await request.json() as {
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        password: string;
      };
      
      const user = {
        id: 'demo-user-1',
        email: body.email,
        username: body.username,
        first_name: body.first_name,
        last_name: body.last_name,
        profile_picture: null,
        bio: null,
        location: null,
        email_verified: true,
        created_at: now(),
        updated_at: now(),
      };

      // Store user profile
      mockUserProfiles.set('demo-user-1', user);

      const response = {
        user,
        token: 'dev-token-demo-user-1',
        message: 'Registration successful',
      };

      return HttpResponse.json(response, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Registration failed',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),
];
