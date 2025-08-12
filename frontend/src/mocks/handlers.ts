import { http, HttpResponse } from 'msw';
import { BroadcastResponse, PublicBroadcastResponse } from '../services/broadcastClient';

// Mock database for broadcasts
const mockBroadcasts: Map<string, BroadcastResponse> = new Map();

// Helper to generate UUID
const generateId = () => crypto.randomUUID();

// Helper to get current timestamp
const now = () => new Date().toISOString();

// Helper to calculate expiration time
const getExpirationTime = (hours: number = 24) => {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration.toISOString();
};

// SECURITY: Helper to safely extract and validate user ID
const extractUserId = (request: Request): string | null => {
  const authHeader = request.headers.get('Authorization');
  const userIdHeader = request.headers.get('X-User-ID');
  
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
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

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

  // PUT /broadcasts - Update existing broadcast
  http.put('*/broadcasts', async ({ request }) => {
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
      const existingBroadcast = mockBroadcasts.get(userId);

      if (!existingBroadcast) {
        return HttpResponse.json(
          {
            error: 'not_found',
            message: 'No active broadcast found to update',
            code: 404,
            timestamp: now(),
          },
          { status: 404 }
        );
      }

      // Update broadcast
      const updatedBroadcast: BroadcastResponse = {
        ...existingBroadcast,
        message: body.message.trim(),
        expires_at: getExpirationTime(body.expires_in_hours),
        updated_at: now(),
      };

      mockBroadcasts.set(userId, updatedBroadcast);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      return HttpResponse.json(updatedBroadcast, { status: 200 });
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

  // DELETE /broadcasts - Delete user's broadcast
  http.delete('*/broadcasts', ({ request }) => {
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

    const userId = userIdHeader || 'demo-user-1';
    const existingBroadcast = mockBroadcasts.get(userId);

    if (!existingBroadcast) {
      return HttpResponse.json(
        {
          error: 'not_found',
          message: 'No active broadcast found to delete',
          code: 404,
          timestamp: now(),
        },
        { status: 404 }
      );
    }

    mockBroadcasts.delete(userId);
    
    // 204 No Content response
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /broadcasts/:userId - Get public user broadcast
  http.get('*/broadcasts/:userId', ({ params }) => {
    const { userId } = params;
    const broadcast = mockBroadcasts.get(userId as string);

    if (!broadcast) {
      return HttpResponse.json(
        {
          error: 'not_found',
          message: 'User not found or no active broadcast',
          code: 404,
          timestamp: now(),
        },
        { status: 404 }
      );
    }

    // Check if broadcast is expired
    if (broadcast.expires_at && new Date(broadcast.expires_at) < new Date()) {
      mockBroadcasts.delete(userId as string);
      return HttpResponse.json(
        {
          error: 'not_found',
          message: 'User not found or no active broadcast',
          code: 404,
          timestamp: now(),
        },
        { status: 404 }
      );
    }

    // Return public broadcast data (no sensitive info)
    const publicBroadcast: PublicBroadcastResponse = {
      user_id: broadcast.user_id,
      message: broadcast.message,
      created_at: broadcast.created_at,
      updated_at: broadcast.updated_at,
    };

    return HttpResponse.json(publicBroadcast, { status: 200 });
  }),
];
