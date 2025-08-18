import { http } from 'msw';
import { BroadcastResponse } from '../../services/broadcastClient';
import { extractUserId, generateId, now, getExpirationTime, simulateDelay } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createNotFoundError, createConflictError, createSuccessResponse } from '../utils/responseBuilders';

// Mock database for broadcasts
const mockBroadcasts: Map<string, BroadcastResponse> = new Map();

// Initialize some demo broadcast data
mockBroadcasts.set('2', {
  id: generateId(),
  user_id: '2',
  message: '🔌 Anyone have a phone charger I can borrow?',
  is_active: true,
  expires_at: getExpirationTime(48), // expires in 48 hours
  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
  updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
});

mockBroadcasts.set('3', {
  id: generateId(),
  user_id: '3',
  message: '🏃‍♀️ Training for the SF Marathon!',
  is_active: true,
  expires_at: getExpirationTime(24), // expires in 24 hours
  created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
  updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
});

mockBroadcasts.set('4', {
  id: generateId(),
  user_id: '4',
  message: '🎵 Playing at The Fillmore tonight!',
  is_active: true,
  expires_at: getExpirationTime(12), // expires in 12 hours
  created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
  updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
});

export const handlers = [
  // GET /broadcasts - Get current user's broadcast
  http.get('*/broadcasts', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const broadcast = mockBroadcasts.get(userId);

    if (!broadcast) {
      return createNotFoundError('No active broadcast found');
    }

    // Check if broadcast is expired
    if (broadcast.expires_at && new Date(broadcast.expires_at) < new Date()) {
      mockBroadcasts.delete(userId);
      return createNotFoundError('No active broadcast found');
    }

    return createSuccessResponse(broadcast);
  }),

  // POST /broadcasts - Create new broadcast
  http.post('*/broadcasts', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { message: string; expires_in_hours?: number };
      
      // Validation
      if (!body.message || body.message.trim().length === 0) {
        return createValidationError('Broadcast message cannot be empty');
      }

      if (body.message.length > 200) {
        return createValidationError('Broadcast message must be 200 characters or less');
      }
      
      // Check if user already has a broadcast
      if (mockBroadcasts.has(userId)) {
        return createConflictError('You already have an active broadcast. Please update or delete it first.');
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
      await simulateDelay(process.env.NODE_ENV === 'test' ? 10 : 300);

      return createSuccessResponse(broadcast, 201);
    } catch (error) {
      return createValidationError('Invalid request data');
    }
  }),
  
  // PUT /broadcasts - Update existing broadcast
  http.put('*/broadcasts', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { message: string; expires_in_hours?: number };
      
      // Validation
      if (!body.message || body.message.trim().length === 0) {
        return createValidationError('Broadcast message cannot be empty');
      }

      if (body.message.length > 200) {
        return createValidationError('Broadcast message must be 200 characters or less');
      }

      const existingBroadcast = mockBroadcasts.get(userId);
      if (!existingBroadcast) {
        return createNotFoundError('No active broadcast found to update');
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
      await simulateDelay(process.env.NODE_ENV === 'test' ? 10 : 300);

      return createSuccessResponse(updatedBroadcast);
    } catch (error) {
      return createValidationError('Invalid request data');
    }
  }),

  // DELETE /broadcasts - Delete current user's broadcast
  http.delete('*/broadcasts', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const broadcast = mockBroadcasts.get(userId);
    if (!broadcast) {
      return createNotFoundError('No active broadcast found to delete');
    }

    mockBroadcasts.delete(userId);
    
    return createSuccessResponse({ message: 'Broadcast deleted successfully' });
  }),
  
  // GET /broadcasts/:userId - Get specific user's public broadcast
  http.get('*/broadcasts/:userId', ({ request, params }) => {
    const { userId } = params;
    const requestingUserId = extractUserId(request);
    
    console.log('🔍 MSW: GET broadcast for user:', userId, 'requested by:', requestingUserId);
    
    const broadcast = mockBroadcasts.get(userId as string);
    
    if (!broadcast) {
      console.log('📻 MSW: No broadcast found for user:', userId);
      return createNotFoundError('No active broadcast found');
    }
    
    // Check if broadcast is expired
    if (broadcast.expires_at && new Date(broadcast.expires_at) < new Date()) {
      mockBroadcasts.delete(userId as string);
      console.log('📻 MSW: Broadcast expired for user:', userId);
      return createNotFoundError('No active broadcast found');
    }
    
    // Return public broadcast data (without sensitive info like id)
    const publicBroadcast = {
      user_id: broadcast.user_id,
      message: broadcast.message,
      created_at: broadcast.created_at,
      updated_at: broadcast.updated_at,
    };
    
    console.log('📻 MSW: Returning public broadcast for user:', userId, publicBroadcast);
    return createSuccessResponse(publicBroadcast);
  }),
];
