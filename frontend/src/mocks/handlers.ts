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
import { currentUser, nearbyUsers } from '../data/mockData';

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

  // POST /api/v1/search - Unified search endpoint (NEW)
  http.post('*/api/v1/search', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to search for users',
          code: 401,
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json();
      const { query, scope, filters, pagination } = body;

      // Validate required scope parameter
      if (!scope || !['friends', 'discovery', 'all'].includes(scope)) {
        return HttpResponse.json(
          {
            error: 'Invalid scope',
            message: 'Scope must be "friends", "discovery", or "all"',
            code: 400,
          },
          { status: 400 }
        );
      }

      const limit = Math.min(Math.max(pagination?.limit || 50, 1), 100);
      const offset = Math.max(pagination?.offset || 0, 0);
      
      let searchResults = [];
      
      if (scope === 'friends') {
        // Mock friends search - simulate having friends who match
        const mockFriends = nearbyUsers.filter(user => {
          // Simulate friend relationship for some users
          const isFriend = ['user-2', 'user-3', 'user-5'].includes(user.id);
          if (!isFriend) return false;
          
          // Apply search query if provided
          if (query && query.trim()) {
            const searchTerm = query.toLowerCase();
            return (
              user.name.toLowerCase().includes(searchTerm) ||
              user.bio?.toLowerCase().includes(searchTerm) ||
              user.interests?.some(interest => 
                interest.toLowerCase().includes(searchTerm)
              )
            );
          }
          return true;
        });
        searchResults = mockFriends;
      } else if (scope === 'discovery') {
        // Discovery search - available users only
        let availableUsers = Array.from(mockAvailability.values())
          .filter(availability => 
            availability.is_available && 
            availability.user_id !== userId
          );

        // Apply search query
        if (query && query.trim()) {
          const mockUsers = nearbyUsers.filter(user =>
            user.name.toLowerCase().includes(query.toLowerCase()) ||
            user.bio?.toLowerCase().includes(query.toLowerCase()) ||
            user.interests?.some(interest =>
              interest.toLowerCase().includes(query.toLowerCase())
            )
          );
          
          availableUsers = availableUsers.filter(availability =>
            mockUsers.some(user => user.id === availability.user_id)
          );
        }

        // Convert to user objects
        searchResults = availableUsers.map(availability => {
          const mockUser = nearbyUsers.find(user => user.id === availability.user_id);
          return mockUser || {
            id: availability.user_id,
            name: `User ${availability.user_id}`,
            age: 25,
            profilePicture: null,
            bio: 'Mock user for testing',
            interests: ['test'],
            location: 'Unknown',
            isAvailable: availability.is_available,
            mutualFriends: 0,
            connectionPriority: 'medium' as const,
            lastSeen: availability.last_available_at,
            profileType: 'standard' as const,
          };
        });
      } else {
        // 'all' scope - combine friends and discovery
        // This would be more complex in real implementation
        searchResults = nearbyUsers.filter(user => user.id !== userId);
        
        if (query && query.trim()) {
          const searchTerm = query.toLowerCase();
          searchResults = searchResults.filter(user =>
            user.name.toLowerCase().includes(searchTerm) ||
            user.bio?.toLowerCase().includes(searchTerm) ||
            user.interests?.some(interest => 
              interest.toLowerCase().includes(searchTerm)
            )
          );
        }
      }

      // Apply filters
      if (filters?.distance) {
        searchResults = searchResults.filter(user => 
          user.location?.proximityMiles <= filters.distance
        );
      }

      if (filters?.interests?.length > 0) {
        searchResults = searchResults.filter(user =>
          user.interests?.some(interest =>
            filters.interests.includes(interest)
          )
        );
      }

      if (filters?.available_only) {
        searchResults = searchResults.filter(user => {
          const availability = mockAvailability.get(user.id);
          return availability?.is_available;
        });
      }

      // Sort by relevance (mock ranking)
      searchResults.sort((a, b) => {
        // Simple mock ranking - prioritize users with matching interests
        if (query) {
          const aScore = a.interests?.filter(i => 
            i.toLowerCase().includes(query.toLowerCase())
          ).length || 0;
          const bScore = b.interests?.filter(i => 
            i.toLowerCase().includes(query.toLowerCase())
          ).length || 0;
          return bScore - aScore;
        }
        return 0;
      });

      const totalCount = searchResults.length;
      const paginatedResults = searchResults.slice(offset, offset + limit);

      const response = {
        users: paginatedResults,
        total: totalCount,
        hasMore: offset + limit < totalCount,
        scope,
        query,
        filters: {
          maxDistance: 50,
          availableInterests: ['technology', 'sports', 'music', 'art', 'travel'],
          appliedFilters: filters || {},
        },
        metadata: {
          searchTime: Math.floor(Math.random() * 100) + 50, // Mock search time
          source: 'semantic_search' as const,
          relevanceScores: paginatedResults.reduce((acc, user, index) => {
            acc[user.id] = Math.max(0.95 - index * 0.1, 0.1);
            return acc;
          }, {} as Record<string, number>),
        },
      };

      return HttpResponse.json(response, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'Invalid request body',
          message: 'Failed to parse request body',
          code: 400,
        },
        { status: 400 }
      );
    }
  }),

  // GET /discovery/available-users/search - Search available users with semantic ranking (DEPRECATED)
  http.get('*/discovery/available-users/search', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to search for users',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

    // Get available users (excluding the requesting user)
    let availableUsers = Array.from(mockAvailability.values())
      .filter(availability => 
        availability.is_available && 
        availability.user_id !== userId
      );

    // If there's a search query, simulate search filtering
    if (query && query.trim()) {
      // Simple mock search - filter users based on mock user data
      const mockUsers = nearbyUsers.filter(user => 
        user.name.toLowerCase().includes(query.toLowerCase()) ||
        user.bio?.toLowerCase().includes(query.toLowerCase()) ||
        user.interests?.some(interest => 
          interest.toLowerCase().includes(query.toLowerCase())
        )
      );
      
      // Filter availability records to match search results
      availableUsers = availableUsers.filter(availability =>
        mockUsers.some(user => user.id === availability.user_id)
      );
    }

    // Sort by last_available_at descending (most recent first)
    availableUsers.sort((a, b) => {
      const aTime = a.last_available_at ? new Date(a.last_available_at).getTime() : 0;
      const bTime = b.last_available_at ? new Date(b.last_available_at).getTime() : 0;
      return bTime - aTime;
    });

    const totalCount = availableUsers.length;
    const paginatedUsers = availableUsers.slice(offset, offset + limit);

    // Convert to SearchUsersResponse format with User objects
    const users = paginatedUsers.map(availability => {
      const mockUser = nearbyUsers.find(user => user.id === availability.user_id);
      return mockUser || {
        id: availability.user_id,
        name: `User ${availability.user_id}`,
        age: 25,
        profilePicture: null,
        bio: 'Mock user for testing',
        interests: ['test'],
        location: 'Unknown',
        isAvailable: availability.is_available,
        mutualFriends: 0,
        connectionPriority: 'medium' as const,
        lastSeen: availability.last_available_at,
        profileType: 'standard' as const,
      };
    });

    const response = {
      users,
      total: totalCount,
      hasMore: offset + limit < totalCount,
      filters: {
        maxDistance: 25,
        availableInterests: ['technology', 'sports', 'music', 'art', 'travel']
      },
      deprecationWarning: 'This endpoint is deprecated. Please use POST /api/v1/search with scope: "discovery" instead.'
    };

    // Add deprecation warning header
    const headers = new Headers({
      'X-Deprecation-Warning': 'This endpoint is deprecated. Please use POST /api/v1/search with scope: "discovery" instead.',
      'X-Deprecation-Sunset': '2025-12-31', // Example sunset date
    });

    return HttpResponse.json(response, { status: 200, headers });
  }),

  // GET /api/v1/users/friends/search - Search friends (DEPRECATED)
  http.get('*/api/v1/users/friends/search', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          error: 'Authentication required',
          message: 'You must be logged in to search friends',
          code: 401,
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 20;
    
    // Mock friends search - simulate having friends who match
    const mockFriends = nearbyUsers.filter(user => {
      // Simulate friend relationship for some users
      const isFriend = ['user-2', 'user-3', 'user-5'].includes(user.id);
      if (!isFriend) return false;
      
      // Apply search query if provided
      if (query.trim()) {
        const searchTerm = query.toLowerCase();
        return (
          user.name.toLowerCase().includes(searchTerm) ||
          user.bio?.toLowerCase().includes(searchTerm) ||
          user.interests?.some(interest => 
            interest.toLowerCase().includes(searchTerm)
          )
        );
      }
      return true;
    });

    // Convert to the expected format for friends search
    const friends = mockFriends.map(user => ({
      id: user.id,
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ')[1] || '',
      profile_picture: user.profilePicture,
      bio: user.bio,
      interests: user.interests,
      is_friend: true,
      mutual_friends_count: user.mutualFriends?.length || 0,
      last_active: user.lastSeen,
    }));

    const response = {
      friends,
      deprecationWarning: 'This endpoint is deprecated. Please use POST /api/v1/search with scope: "friends" instead.'
    };

    // Add deprecation warning header
    const headers = new Headers({
      'X-Deprecation-Warning': 'This endpoint is deprecated. Please use POST /api/v1/search with scope: "friends" instead.',
      'X-Deprecation-Sunset': '2025-12-31', // Example sunset date
    });

    return HttpResponse.json(response, { status: 200, headers });
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

  // POST /onboarding/start - Start onboarding
  http.post('*/onboarding/start', ({ request }) => {
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

    const onboardingStatus: OnboardingStatusResponse = {
      user_id: userId,
      status: 'in_progress' as OnboardingStatusType,
      current_step: 'profile_picture' as OnboardingStepType,
      completed_steps: [],
      created_at: now(),
      updated_at: now(),
    };

    mockOnboarding.set(userId, onboardingStatus);

    const response: StartOnboardingResponse = {
      user_id: userId,
      status: 'in_progress' as OnboardingStatusType,
      current_step: 'profile_picture' as OnboardingStepType,
      message: 'Onboarding started successfully',
    };

    return HttpResponse.json(response, { status: 200 });
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
      const body = await request.json() as { step: OnboardingStepType; data: Record<string, any> };
      
      let onboardingStatus = mockOnboarding.get(userId);
      if (!onboardingStatus) {
        return HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            message: 'Onboarding not started',
            code: 'INVALID_FORMAT',
          },
          { status: 400 }
        );
      }

      // Update step and add to completed steps
      const stepOrder: OnboardingStepType[] = [
        'profile_picture', 'bio', 'interests', 'location_preferences',
        'privacy_settings', 'notification_preferences', 'welcome_tutorial'
      ];

      if (!onboardingStatus.completed_steps.includes(body.step)) {
        onboardingStatus.completed_steps.push(body.step);
      }

      // Set next step or complete onboarding if all steps are done
      const currentIndex = stepOrder.indexOf(body.step);
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : undefined;
      
      // Check if this was the last step
      const isLastStep = currentIndex === stepOrder.length - 1;
      
      onboardingStatus = {
        ...onboardingStatus,
        status: isLastStep ? 'completed' : onboardingStatus.status,
        current_step: nextStep,
        updated_at: now(),
      };

      mockOnboarding.set(userId, onboardingStatus);

      // Store step data in user profile
      const userProfile = mockUserProfiles.get(userId) || {};
      if (body.step === 'bio' && body.data.bio) {
        userProfile.bio = body.data.bio;
      }
      if (body.step === 'profile_picture' && body.data.profile_picture) {
        userProfile.profile_picture = body.data.profile_picture;
      }
      if (body.step === 'interests' && body.data.interests) {
        userProfile.interests = body.data.interests;
      }
      userProfile.updated_at = now();
      mockUserProfiles.set(userId, userProfile);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      const response: UpdateStepResponse = {
        user_id: userId,
        step: body.step,
        status: onboardingStatus.status,
        message: 'Step updated successfully',
      };

      return HttpResponse.json(response, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // POST /onboarding/complete - Complete onboarding
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

    const onboardingStatus: OnboardingStatusResponse = {
      user_id: userId,
      status: 'completed' as OnboardingStatusType,
      completed_steps: [
        'profile_picture', 'bio', 'interests', 'location_preferences',
        'privacy_settings', 'notification_preferences', 'welcome_tutorial'
      ] as OnboardingStepType[],
      created_at: now(),
      updated_at: now(),
    };

    mockOnboarding.set(userId, onboardingStatus);

    const response: CompleteOnboardingResponse = {
      user_id: userId,
      status: 'completed' as OnboardingStatusType,
      completed_at: now(),
      message: 'Onboarding completed successfully',
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  // POST /onboarding/skip - Skip onboarding
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

    const onboardingStatus: OnboardingStatusResponse = {
      user_id: userId,
      status: 'skipped' as OnboardingStatusType,
      completed_steps: [],
      created_at: now(),
      updated_at: now(),
    };

    mockOnboarding.set(userId, onboardingStatus);

    const response: SkipOnboardingResponse = {
      user_id: userId,
      status: 'skipped' as OnboardingStatusType,
      skipped_at: now(),
      message: 'Onboarding skipped successfully',
    };

    return HttpResponse.json(response, { status: 200 });
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
      const body = await request.json() as { step: OnboardingStepType };
      
      let onboardingStatus = mockOnboarding.get(userId);
      if (!onboardingStatus) {
        return HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            message: 'Onboarding not started',
            code: 'INVALID_FORMAT',
          },
          { status: 400 }
        );
      }

      // Mark step as completed (skipped)
      if (!onboardingStatus.completed_steps.includes(body.step)) {
        onboardingStatus.completed_steps.push(body.step);
      }

      // Set next step or complete onboarding if all steps are done
      const stepOrder: OnboardingStepType[] = [
        'profile_picture', 'bio', 'interests', 'location_preferences',
        'privacy_settings', 'notification_preferences', 'welcome_tutorial'
      ];
      const currentIndex = stepOrder.indexOf(body.step);
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : undefined;
      
      // Check if this was the last step
      const isLastStep = currentIndex === stepOrder.length - 1;

      onboardingStatus = {
        ...onboardingStatus,
        status: isLastStep ? 'completed' : onboardingStatus.status,
        current_step: nextStep,
        updated_at: now(),
      };

      mockOnboarding.set(userId, onboardingStatus);

      const response: SkipStepResponse = {
        user_id: userId,
        step: body.step,
        status: onboardingStatus.status,
        message: 'Step skipped successfully',
      };

      return HttpResponse.json(response, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // POST /users/profile - Update user profile
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
      const body = await request.json();
      
      const userProfile = mockUserProfiles.get(userId) || {
        id: userId,
        email: `${userId}@example.com`,
        username: userId,
        first_name: 'Demo',
        last_name: 'User',
        email_verified: true,
        created_at: now(),
      };

      // Update profile fields
      if (body && typeof body === 'object') {
        Object.keys(body).forEach(key => {
          if (body[key] !== undefined) {
            userProfile[key] = body[key];
          }
        });
      }
      
      userProfile.updated_at = now();
      mockUserProfiles.set(userId, userProfile);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));

      const response: ProfileUpdateResponse = {
        user: userProfile,
        message: 'Profile updated successfully',
      };

      return HttpResponse.json(response, { status: 200 });
    } catch (error) {
      return HttpResponse.json(
        {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
  }),

  // GET /users/profile/:userId - Get user profile by ID
  http.get('*/users/profile/:userId', ({ params, request }) => {
    const requestingUserId = extractUserId(request);
    
    if (!requestingUserId) {
      return HttpResponse.json(
        {
          error: 'unauthorized',
          message: 'Authentication required',
          code: 401,
          timestamp: now(),
        },
        { status: 401 }
      );
    }

    const { userId } = params;
    
    // Check if requesting current user's profile from mockUserProfiles
    if (userId === requestingUserId && mockUserProfiles.has(userId as string)) {
      const user = mockUserProfiles.get(userId as string);
      return HttpResponse.json(user, { status: 200 });
    }
    
    // Check if user is the currentUser from mockData
    if (userId === currentUser.id) {
      return HttpResponse.json({
        id: currentUser.id,
        name: currentUser.name,
        age: currentUser.age,
        profile_picture: currentUser.profilePicture,
        bio: currentUser.bio,
        interests: currentUser.interests,
        location: currentUser.location,
        is_available: currentUser.isAvailable,
        mutual_friends: currentUser.mutualFriends,
        connection_priority: currentUser.connectionPriority,
        last_seen: currentUser.lastSeen,
        profile_type: currentUser.profileType,
        created_at: now(),
        updated_at: now(),
      }, { status: 200 });
    }
    
    // Look for user in nearbyUsers from mockData
    const nearbyUser = nearbyUsers.find(user => user.id === userId);
    if (nearbyUser) {
      return HttpResponse.json({
        id: nearbyUser.id,
        name: nearbyUser.name,
        age: nearbyUser.age,
        profile_picture: nearbyUser.profilePicture,
        profile_media: nearbyUser.profileMedia,
        bio: nearbyUser.bio,
        interests: nearbyUser.interests,
        location: nearbyUser.location,
        is_available: nearbyUser.isAvailable,
        mutual_friends: nearbyUser.mutualFriends,
        connection_priority: nearbyUser.connectionPriority,
        last_seen: nearbyUser.lastSeen,
        broadcast: nearbyUser.broadcast,
        profile_type: nearbyUser.profileType,
        created_at: now(),
        updated_at: now(),
      }, { status: 200 });
    }
    
    // User not found - return 404 error with consistent format
    return HttpResponse.json(
      {
        error: 'not_found',
        message: 'User profile not found',
        code: 404,
        timestamp: now(),
      },
      { status: 404 }
    );
  }),
];

// Auth handlers for login/register (basic mock)
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
