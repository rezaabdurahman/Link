import { http } from 'msw';
import { AvailabilityResponse } from '../../services/availabilityClient';
import { extractUserId, generateId, now, parsePaginationParams } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createSuccessResponse, createPaginatedResponse } from '../utils/responseBuilders';
import { buildApiUrl, API_ENDPOINTS } from '../utils/config';

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

// Add the demo user 'user-jane' for proper availability functionality
mockAvailability.set('user-jane', {
  id: generateId(),
  user_id: 'user-jane',
  is_available: false,
  created_at: now(),
  updated_at: now(),
});

export const handlers = [
  // GET /availability - Get current user's availability
  http.get(buildApiUrl(API_ENDPOINTS.AVAILABILITY.status), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
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

    return createSuccessResponse(availability);
  }),

  // PUT /availability - Update current user's availability (TOGGLE FUNCTIONALITY)
  http.put(buildApiUrl(API_ENDPOINTS.AVAILABILITY.update), async ({ request }) => {
    console.log('🔄 MSW: Availability PUT request received', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    const userId = extractUserId(request);
    console.log('🔄 MSW: Extracted userId:', userId);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { is_available: boolean };
      
      if (typeof body.is_available !== 'boolean') {
        return createValidationError('is_available must be a boolean');
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
      
      console.log('🔄 MSW: Updated availability:', { userId, is_available: body.is_available });
      
      return createSuccessResponse(availability);
    } catch (error) {
      console.error('❌ MSW: Availability update error:', error);
      return createValidationError('Failed to parse request body');
    }
  }),
  
  // GET /availability/:userId - Get specific user's availability
  http.get(buildApiUrl('/availability/:userId'), ({ request, params }) => {
    const { userId } = params;
    const requestingUserId = extractUserId(request);
    
    if (!requestingUserId) {
      return createAuthError();
    }

    const availability = mockAvailability.get(userId as string);
    
    if (!availability) {
      // Return default unavailable status
      return createSuccessResponse({
        user_id: userId as string,
        is_available: false,
        created_at: now(),
        updated_at: now(),
      });
    }

    // Return public availability info (no sensitive data)
    return createSuccessResponse({
      user_id: availability.user_id,
      is_available: availability.is_available,
      last_available_at: availability.last_available_at,
      updated_at: availability.updated_at,
    });
  }),
  
  // GET /available-users - Get list of available users
  http.get(buildApiUrl('/available-users'), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const { limit, offset } = parsePaginationParams(url);

    // Get available users from mock data
    const allAvailableUsers = Array.from(mockAvailability.values())
      .filter(av => av.is_available && av.user_id !== userId)
      .map(av => ({
        user_id: av.user_id,
        is_available: av.is_available,
        last_available_at: av.last_available_at,
        updated_at: av.updated_at,
      }));

    const total = allAvailableUsers.length;
    const paginatedUsers = allAvailableUsers.slice(offset, offset + limit);

    return createPaginatedResponse(paginatedUsers, total, limit, offset);
  }),
  
  // POST /availability/heartbeat - Send heartbeat to maintain availability
  http.post(buildApiUrl('/availability/heartbeat'), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    // Update last heartbeat timestamp
    let availability = mockAvailability.get(userId);
    if (availability && availability.is_available) {
      availability.last_available_at = now();
      availability.updated_at = now();
      mockAvailability.set(userId, availability);
    }

    return createSuccessResponse({
      status: 'success',
      availability: availability || null,
    });
  }),
];
