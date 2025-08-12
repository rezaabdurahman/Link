import { rest } from 'msw';
import { BroadcastResponse } from '../services/broadcastClient';

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
  rest.get('*/broadcasts', (req, res, ctx) => {
    const userId = extractUserId(req);
    
    if (!userId) {
      return res(
        ctx.status(401),
        ctx.json({
          error: 'unauthorized',
          message: 'User not authenticated',
          code: 401,
          timestamp: now(),
        })
      );
    }

    const broadcast = mockBroadcasts.get(userId);

    if (!broadcast) {
      return res(
        ctx.status(404),
        ctx.json({
          error: 'not_found',
          message: 'No active broadcast found',
          code: 404,
          timestamp: now(),
        })
      );
    }

    // Check if broadcast is expired
    if (broadcast.expires_at && new Date(broadcast.expires_at) < new Date()) {
      mockBroadcasts.delete(userId);
      return res(
        ctx.status(404),
        ctx.json({
          error: 'not_found',
          message: 'No active broadcast found',
          code: 404,
          timestamp: now(),
        })
      );
    }

    return res(ctx.json(broadcast));
  }),

  // POST /broadcasts - Create new broadcast
  rest.post('*/broadcasts', async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    const userIdHeader = req.headers.get('X-User-ID');
    
    if (!authHeader && !userIdHeader) {
      return res(
        ctx.status(401),
        ctx.json({
          error: 'unauthorized',
          message: 'User not authenticated',
          code: 401,
          timestamp: now(),
        })
      );
    }

    try {
      const body = await req.json() as { message: string; expires_in_hours?: number };
      
      // Validation
      if (!body.message || body.message.trim().length === 0) {
        return res(
          ctx.status(400),
          ctx.json({
            error: 'validation_error',
            message: 'Broadcast message cannot be empty',
            code: 400,
            timestamp: now(),
          })
        );
      }

      if (body.message.length > 200) {
        return res(
          ctx.status(400),
          ctx.json({
            error: 'validation_error',
            message: 'Broadcast message must be 200 characters or less',
            code: 400,
            timestamp: now(),
          })
        );
      }

      const userId = userIdHeader || 'demo-user-1';
      
      // Check if user already has a broadcast
      if (mockBroadcasts.has(userId)) {
        return res(
          ctx.status(409),
          ctx.json({
            error: 'conflict_error',
            message: 'You already have an active broadcast. Please update or delete it first.',
            code: 409,
            timestamp: now(),
          })
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

      return res(ctx.status(201), ctx.json(broadcast));
    } catch (error) {
      return res(
        ctx.status(400),
        ctx.json({
          error: 'validation_error',
          message: 'Invalid request data',
          code: 400,
          timestamp: now(),
        })
      );
    }
  }),
];
