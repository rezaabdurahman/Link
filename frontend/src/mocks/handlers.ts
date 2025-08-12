import { http, HttpResponse } from 'msw';
import { BroadcastResponse } from '../services/broadcastClient';
import { AvailabilityResponse, PublicAvailabilityResponse, AvailableUsersResponse, HeartbeatResponse } from '../services/availabilityClient';

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

  // GET /availability/:userId - Get specific user's availability
  http.get('*/availability/:userId', ({ params, request }) => {
    const requestingUserId = extractUserId(request);
    
    if (!requestingUserId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to view user availability',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const { userId } = params;
    const availability = mockAvailability.get(userId as string);

    if (!availability) {
      return HttpResponse.json(
        {
          error: 'Availability information not found',
          message: 'Unable to retrieve user availability at this time',
          code: 'SERVICE_ERROR',
        },
        { status: 404 }
      );
    }

    // Return public availability data (no internal IDs)
    const publicAvailability: PublicAvailabilityResponse = {
      user_id: availability.user_id,
      is_available: availability.is_available,
      last_available_at: availability.last_available_at,
    };

    return HttpResponse.json(publicAvailability, { status: 200 });
  }),

  // GET /available-users - Get list of available users
  http.get('*/available-users', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to discover available users',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

    // Get available users (excluding the requesting user)
    const availableUsers = Array.from(mockAvailability.values())
      .filter(availability => 
        availability.is_available && 
        availability.user_id !== userId
      )
      .sort((a, b) => {
        // Sort by last_available_at descending
        const aTime = a.last_available_at ? new Date(a.last_available_at).getTime() : 0;
        const bTime = b.last_available_at ? new Date(b.last_available_at).getTime() : 0;
        return bTime - aTime;
      });

    const totalCount = availableUsers.length;
    const paginatedUsers = availableUsers.slice(offset, offset + limit);

    // Convert to public responses
    const publicResponses: PublicAvailabilityResponse[] = paginatedUsers.map(availability => ({
      user_id: availability.user_id,
      is_available: availability.is_available,
      last_available_at: availability.last_available_at,
    }));

    const response: AvailableUsersResponse = {
      data: publicResponses,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: offset + limit < totalCount,
        total_pages: Math.ceil(totalCount / limit),
      },
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  // POST /availability/heartbeat - Send heartbeat
  http.post('*/availability/heartbeat', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'User ID not found in context',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    let availability = mockAvailability.get(userId);
    
    if (!availability) {
      // Create new availability record as available
      availability = {
        id: generateId(),
        user_id: userId,
        is_available: true,
        last_available_at: now(),
        created_at: now(),
        updated_at: now(),
      };
    } else {
      // Update existing record
      availability = {
        ...availability,
        is_available: true,
        last_available_at: now(),
        updated_at: now(),
      };
    }

    mockAvailability.set(userId, availability);

    const response: HeartbeatResponse = {
      status: 'success',
      availability,
    };

    return HttpResponse.json(response, { status: 200 });
  }),
];
