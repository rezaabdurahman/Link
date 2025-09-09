import { http } from 'msw';
import { nearbyUsers, currentUser } from '../../data/mockData';
import { extractUserId, now } from '../utils/mockHelpers';
import { createAuthError, createNotFoundError, createSuccessResponse } from '../utils/responseBuilders';
import { buildApiUrl, API_ENDPOINTS } from '../utils/config';
import { getFullName } from '../../utils/nameHelpers';

// Mock database for user profiles
const mockUserProfiles: Map<string, any> = new Map();

export const handlers = [

  // POST /search - Unified search endpoint
  http.post(buildApiUrl(API_ENDPOINTS.SEARCH.unified), async ({ request }) => {
    console.log('🔍 MSW: Search request received at:', buildApiUrl(API_ENDPOINTS.SEARCH.unified));
    
    try {
      const userId = extractUserId(request);
      console.log('🔍 MSW: Extracted user ID:', userId);
      
      if (!userId) {
        console.warn('🔍 MSW: No user ID found, returning auth error');
        return createAuthError();
      }

      const body = await request.json() as any;
      console.log('🔍 MSW: Search request body:', JSON.stringify(body, null, 2));
      
      // Filter out current user from results
      let results = nearbyUsers.filter(user => user.id !== userId);
      
      // Apply search query if provided
      if (body.query && body.query.trim()) {
        const searchTerm = body.query.toLowerCase().trim();
        results = results.filter(user => 
          getFullName(user)?.toLowerCase().includes(searchTerm) ||
          user.bio?.toLowerCase().includes(searchTerm) ||
          user.interests?.some(interest => 
            interest.toLowerCase().includes(searchTerm)
          )
        );
      }
      
      // Apply scope-specific filtering
      if (body.scope === 'discovery') {
        results = results.filter(user => user.isAvailable === true);
      }
      
      // Handle pagination
      const limit = body.pagination?.limit || body.limit || 20;
      const offset = body.pagination?.offset || 0;
      const totalResults = results.length;
      
      // Apply pagination
      results = results.slice(offset, offset + limit);
      const hasMore = (offset + results.length) < totalResults;
      
      console.log('🔍 MSW: Search pagination - limit:', limit, 'offset:', offset, 'total:', totalResults, 'returned:', results.length, 'hasMore:', hasMore);
      console.log('🔍 MSW: Search returning', results.length, 'results for scope:', body.scope, '- Users:', results.map(u => `${getFullName(u)} (${u.id})`));
      
      // Ensure Date objects are properly serialized
      const serializedResults = results.map(user => ({
        ...user,
        lastSeen: user.lastSeen instanceof Date ? user.lastSeen.toISOString() : user.lastSeen
      }));
      
      // Return response format that matches UnifiedSearchResponse interface
      return createSuccessResponse({
        users: serializedResults,
        total: totalResults,
        hasMore,
        scope: body.scope,
        query: body.query,
        filters: {
          maxDistance: 50,
          availableInterests: ['technology', 'music', 'sports', 'travel', 'food'],
          appliedFilters: body.filters || {},
        },
        metadata: {
          searchTime: Math.floor(Math.random() * 100) + 50, // Mock search time
          source: 'database' as const,
          relevanceScores: results.reduce((acc, user, index) => {
            acc[user.id] = 1.0 - (index * 0.1); // Mock relevance scores
            return acc;
          }, {} as Record<string, number>),
        },
      });
      
    } catch (error) {
      console.error('❌ MSW: Search error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SEARCH_ERROR',
            message: 'Internal search error',
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }),

  // GET /users/profile/me - Get current user's profile
  http.get(buildApiUrl(API_ENDPOINTS.USERS.me), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }
    
    // If this is user ID '1', return Alex Thompson (currentUser) data
    if (userId === '1') {
      const alexProfile = {
        id: currentUser.id,
        email: 'alex@example.com',
        username: 'alexthompson',
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        bio: currentUser.bio,
        profile_picture: currentUser.profilePicture,
        location: currentUser.location ? `${currentUser.location.proximityMiles} miles away` : null,
        date_of_birth: currentUser.age ? new Date(Date.now() - currentUser.age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
        email_verified: true,
        created_at: now(),
        updated_at: now(),
        age: currentUser.age,
        interests: currentUser.interests || [],
        social_links: [
          {
            platform: 'instagram',
            url: 'https://instagram.com/alexthompson',
            username: 'alexthompson'
          }
        ],
        additional_photos: [],
        privacy_settings: {
          show_name: true,
          show_age: true,
          show_location: true,
          show_social_media: true,
          show_montages: true,
          show_checkins: true,
          show_mutual_friends: true,
        },
        mutual_friends: currentUser.mutualFriends?.length || 0,
        last_login_at: now(),
        profile_visibility: 'public',
      };
      
      return createSuccessResponse(alexProfile);
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
          show_name: true,
          show_age: true,
          show_location: false,
          show_social_media: true,
          show_montages: true,
          show_checkins: true,
          show_mutual_friends: true,
        },
        mutual_friends: 5,
        last_login_at: now(),
        profile_visibility: 'public',
      };
      
      mockUserProfiles.set(userId, defaultProfile);
      return createSuccessResponse(defaultProfile);
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
        show_name: true,
        show_age: true,
        show_location: false,
        show_social_media: true,
        show_montages: true,
        show_checkins: true,
        show_mutual_friends: true,
      },
      mutual_friends: userProfile.mutual_friends || 0,
      last_login_at: userProfile.last_login_at || now(),
      profile_visibility: userProfile.profile_visibility || 'public',
    };

    return createSuccessResponse(completeProfile);
  }),

  // GET /users/profile/:userId - Get user profile
  http.get(buildApiUrl('/users/profile/:userId'), ({ request, params }) => {
    const { userId } = params;
    const requestingUserId = extractUserId(request);
    
    console.log('🔍 MSW: GET /users/profile/:userId - userId:', userId, 'requestingUserId:', requestingUserId);
    
    if (!requestingUserId) {
      return createAuthError();
    }

    // Check if this is the current user first
    let user = null;
    if (userId === currentUser.id) {
      user = currentUser;
    } else {
      // Find user in nearbyUsers mock data
      user = nearbyUsers.find(u => u.id === userId);
    }
    
    if (!user) {
      return createNotFoundError('User not found');
    }

    // Convert User type to UserProfileResponse format matching backend
    const profileResponse = {
      id: user.id,
      email: `${getFullName(user).toLowerCase().replace(/\s+/g, '.')}@example.com`,
      username: getFullName(user).toLowerCase().replace(/\s+/g, '_'),
      first_name: user.first_name,
      last_name: user.last_name || 'User',
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
      social_links: [ // Mock social links
        {
          platform: 'instagram',
          url: 'https://instagram.com/' + getFullName(user).toLowerCase().replace(/\s+/g, '_'),
          username: getFullName(user).toLowerCase().replace(/\s+/g, '_')
        }
      ],
      additional_photos: [], // Empty for now
      privacy_settings: {
        show_name: user.profileType === 'public',
        show_age: user.profileType === 'public',
        show_location: user.profileType === 'public',
        show_social_media: user.profileType === 'public',
        show_montages: user.profileType === 'public',
        show_checkins: user.profileType === 'public', // This was missing!
        show_mutual_friends: user.profileType === 'public',
      },
      // Friend-related fields
      is_friend: user.id === '2' || user.id === '3', // Mock some as friends
      mutual_friends: (user.profileType === 'public' && (user.id === '2' || user.id === '3')) ? user.mutualFriends?.length || 0 : undefined, // Respect privacy
      last_login_at: user.lastSeen?.toISOString() || now(), // Changed from last_active to match backend
    };

    console.log('🔍 MSW: Returning user profile:', profileResponse);
    return createSuccessResponse(profileResponse);
  }),

  // GET /auth/me - Get current user info (legacy endpoint)
  http.get(buildApiUrl(API_ENDPOINTS.AUTH.me), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    // Return the current demo user
    const user = {
      id: '17',
      email: 'jane@example.com',
      username: 'janesmith',
      first_name: 'Jane',
      last_name: 'Smith',
      profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Demo user for Link chat app',
      location: 'San Francisco, CA',
      date_of_birth: '1990-01-01',
      email_verified: true,
      created_at: now(),
      updated_at: now(),
    };

    return createSuccessResponse(user);
  }),

  // POST /auth/refresh - Refresh token
  http.post(buildApiUrl(API_ENDPOINTS.AUTH.refresh), ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.includes('dev-token-')) {
      return createAuthError();
    }

    // Return a new demo token
    const response = {
      token: `dev-token-${Date.now()}`,
      message: 'Token refreshed successfully',
    };

    return createSuccessResponse(response);
  }),

  // POST /auth/logout - Logout
  http.post(buildApiUrl(API_ENDPOINTS.AUTH.logout), () => {
    return createSuccessResponse({ message: 'Logout successful' });
  }),

  // PUT /users/profile - Update user profile
  http.put(buildApiUrl(API_ENDPOINTS.USERS.updateProfile), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const updates = await request.json() as any;
      console.log('🔄 MSW: Profile update request for user:', userId, 'with data:', updates);
      
      // Get current profile from mock database or create if not exists
      let currentProfile = mockUserProfiles.get(userId);
      
      if (!currentProfile) {
        // If this is user ID '1', use the current user data
        if (userId === '1') {
          currentProfile = {
            id: currentUser.id,
            email: 'alex@example.com',
            username: 'alexthompson',
            first_name: currentUser.first_name,
            last_name: currentUser.last_name,
            bio: currentUser.bio,
            profile_picture: currentUser.profilePicture,
            location: currentUser.location ? `${currentUser.location.proximityMiles} miles away` : null,
            date_of_birth: currentUser.age ? new Date(Date.now() - currentUser.age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
            email_verified: true,
            created_at: now(),
            updated_at: now(),
            age: currentUser.age,
            interests: currentUser.interests || [],
            social_links: [
              {
                platform: 'instagram',
                url: 'https://instagram.com/alexthompson',
                username: 'alexthompson'
              }
            ],
            additional_photos: [],
            privacy_settings: {
              show_name: true,
              show_age: true,
              show_location: true,
              show_social_media: true,
              show_montages: true,
              show_checkins: true,
              show_mutual_friends: true,
            },
            mutual_friends: currentUser.mutualFriends?.length || 0,
            last_login_at: now(),
            profile_visibility: 'public',
          };
        } else {
          // Create default profile for other users
          currentProfile = {
            id: userId,
            email: `user${userId}@example.com`,
            username: `user${userId}`,
            first_name: 'User',
            last_name: userId,
            bio: 'Hello, I\'m using Link!',
            profile_picture: null,
            location: null,
            email_verified: true,
            created_at: now(),
            updated_at: now(),
            age: 25,
            interests: ['technology'],
            social_links: [],
            additional_photos: [],
            privacy_settings: {
              show_name: true,
              show_age: true,
              show_location: true,
              show_social_media: true,
              show_montages: true,
              show_checkins: true,
              show_mutual_friends: true,
            },
            mutual_friends: 0,
            last_login_at: now(),
            profile_visibility: 'public',
          };
        }
      }

      // Apply updates to the profile
      const updatedProfile = {
        ...currentProfile,
        ...updates,
        updated_at: now(), // Always update the timestamp
      };

      // Store the updated profile
      mockUserProfiles.set(userId, updatedProfile);
      
      console.log('✅ MSW: Profile updated successfully for user:', userId);
      console.log('✅ MSW: Updated bio:', updatedProfile.bio);
      
      return createSuccessResponse(updatedProfile);
      
    } catch (error) {
      console.error('❌ MSW: Profile update error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: 'Failed to update profile',
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }),
];
