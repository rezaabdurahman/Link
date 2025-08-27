import { http, HttpResponse } from 'msw';

// Helper to generate UUID
const generateId = () => crypto.randomUUID();

// Helper to get current timestamp
const now = () => new Date().toISOString();

// User-specific check-ins data generator
const getUserSpecificCheckIns = (userId: string) => {
  // Create check-ins tailored to different user personas
  switch (userId) {
    case '6': // Sofia Martinez
      return [
        {
          id: `checkin-sofia-1`,
          user_id: userId,
          text_content: 'Art gallery opening tonight! Excited to see the new contemporary collection 🎨',
          privacy: 'public' as const,
          source: 'instagram' as const,
          source_metadata: {
            username: 'sofia_art_lover',
            profile_picture: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
            likes_count: 142,
            caption: 'Art gallery opening tonight! Excited to see the new contemporary collection 🎨 #art #gallery #contemporary',
            hashtags: ['art', 'gallery', 'contemporary']
          },
          source_post_id: 'instagram_post_sofia_art',
          source_username: 'sofia_art_lover',
          media_attachments: [
            {
              id: 'media-sofia-1',
              media_type: 'image' as const,
              file_name: 'art_gallery.jpg',
              file_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop',
              thumbnail_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=150&h=150&fit=crop',
              file_size: 234567,
              mime_type: 'image/jpeg'
            }
          ],
          location: {
            id: 'loc-sofia-1',
            location_name: 'Modern Art Gallery',
            latitude: 40.7614,
            longitude: -73.9776
          },
          tags: [
            { id: 'tag-sofia-1', tag_name: 'art' },
            { id: 'tag-sofia-2', tag_name: 'gallery' },
            { id: 'tag-sofia-3', tag_name: 'contemporary' }
          ],
          file_attachments: [],
          voice_note: undefined,
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `checkin-sofia-2`,
          user_id: userId,
          text_content: 'Perfect Sunday morning yoga session in the park ☀️🧘‍♀️',
          privacy: 'public' as const,
          source: 'manual' as const,
          source_metadata: undefined,
          source_post_id: undefined,
          source_username: undefined,
          media_attachments: [],
          location: {
            id: 'loc-sofia-2',
            location_name: 'Central Park',
            latitude: 40.7829,
            longitude: -73.9654
          },
          tags: [
            { id: 'tag-sofia-4', tag_name: 'yoga' },
            { id: 'tag-sofia-5', tag_name: 'wellness' },
            { id: 'tag-sofia-6', tag_name: 'sunday' }
          ],
          file_attachments: [],
          voice_note: undefined,
          created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
        }
      ];
    
    case '9': // Alex Rivera
      return [
        {
          id: `checkin-alex-1`,
          user_id: userId,
          text_content: 'Amazing morning surf session! The waves were perfect 🏄‍♂️🌊',
          privacy: 'public' as const,
          source: 'instagram' as const,
          source_metadata: {
            username: 'alex_ocean_explorer',
            profile_picture: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face',
            likes_count: 324,
            caption: 'Amazing morning surf session! The waves were perfect 🏄‍♂️🌊 #surfing #oceanlife #marinebiologist',
            hashtags: ['surfing', 'oceanlife', 'marinebiologist']
          },
          source_post_id: 'instagram_post_alex_surf',
          source_username: 'alex_ocean_explorer',
          media_attachments: [
            {
              id: 'media-alex-1',
              media_type: 'image' as const,
              file_name: 'morning_surf.jpg',
              file_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop',
              thumbnail_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=150&h=150&fit=crop',
              file_size: 298765,
              mime_type: 'image/jpeg'
            }
          ],
          location: {
            id: 'loc-alex-1',
            location_name: 'Ocean Beach',
            latitude: 37.7594,
            longitude: -122.5107
          },
          tags: [
            { id: 'tag-alex-1', tag_name: 'surfing' },
            { id: 'tag-alex-2', tag_name: 'oceanlife' },
            { id: 'tag-alex-3', tag_name: 'marinebiologist' }
          ],
          file_attachments: [],
          voice_note: undefined,
          created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `checkin-alex-2`,
          user_id: userId,
          text_content: 'Beach cleanup volunteer session. Collected 50 lbs of plastic today! Every bit helps 🌊♻️',
          privacy: 'public' as const,
          source: 'manual' as const,
          source_metadata: undefined,
          source_post_id: undefined,
          source_username: undefined,
          media_attachments: [],
          location: {
            id: 'loc-alex-2',
            location_name: 'Baker Beach',
            latitude: 37.7935,
            longitude: -122.4849
          },
          tags: [
            { id: 'tag-alex-4', tag_name: 'conservation' },
            { id: 'tag-alex-5', tag_name: 'cleanup' },
            { id: 'tag-alex-6', tag_name: 'volunteer' }
          ],
          file_attachments: [],
          voice_note: undefined,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }
      ];
    
    case '1': // Alex Thompson (currentUser)
      return [
        {
          id: 'checkin-alex-1',
          user_id: userId,
          text_content: 'Just watched an incredible indie film at the local theater. The cinematography was absolutely stunning! 🎬',
          privacy: 'public' as const,
          source: 'instagram' as const,
          source_metadata: {
            username: 'alexthompson',
            profile_picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
            likes_count: 89,
            caption: 'Just watched an incredible indie film at the local theater. The cinematography was absolutely stunning! 🎬 #indiefilm #cinema #art',
            hashtags: ['indiefilm', 'cinema', 'art']
          },
          source_post_id: 'instagram_post_alex_film',
          source_username: 'alexthompson',
          media_attachments: [
            {
              id: 'media-alex-1',
              media_type: 'image' as const,
              file_name: 'indie_theater.jpg',
              file_url: 'https://images.unsplash.com/photo-1489185078344-7012c2628c54?w=400&h=300&fit=crop',
              thumbnail_url: 'https://images.unsplash.com/photo-1489185078344-7012c2628c54?w=150&h=150&fit=crop',
              file_size: 198432,
              mime_type: 'image/jpeg'
            }
          ],
          location: {
            id: 'loc-alex-1',
            location_name: 'Indie Cinema House',
            latitude: 37.7849,
            longitude: -122.4094
          },
          tags: [
            { id: 'tag-alex-1', tag_name: 'indie films' },
            { id: 'tag-alex-2', tag_name: 'cinema' }
          ],
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'checkin-alex-2',
          user_id: userId,
          text_content: 'Perfect hiking weather today! Hit the trails early morning and caught this amazing sunrise view ☀️',
          privacy: 'public' as const,
          source: 'manual' as const,
          source_metadata: undefined,
          source_post_id: undefined,
          source_username: undefined,
          media_attachments: [
            {
              id: 'media-alex-2',
              media_type: 'image' as const,
              file_name: 'sunrise_hike.jpg',
              file_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=300&fit=crop',
              thumbnail_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=150&h=150&fit=crop',
              file_size: 287654,
              mime_type: 'image/jpeg'
            }
          ],
          location: {
            id: 'loc-alex-2',
            location_name: 'Twin Peaks Trail',
            latitude: 37.7544,
            longitude: -122.4474
          },
          tags: [
            { id: 'tag-alex-3', tag_name: 'hiking' },
            { id: 'tag-alex-4', tag_name: 'nature' }
          ],
          created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'checkin-alex-3',
          user_id: userId,
          text_content: 'Found this cozy little coffee shop with the best espresso in the neighborhood. Perfect spot for reading ☕📚',
          privacy: 'public' as const,
          source: 'manual' as const,
          source_metadata: undefined,
          source_post_id: undefined,
          source_username: undefined,
          media_attachments: [
            {
              id: 'media-alex-3',
              media_type: 'image' as const,
              file_name: 'coffee_shop.jpg',
              file_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
              thumbnail_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=150&h=150&fit=crop',
              file_size: 156789,
              mime_type: 'image/jpeg'
            }
          ],
          location: {
            id: 'loc-alex-3',
            location_name: 'Brew & Books Cafe',
            latitude: 37.7849,
            longitude: -122.4194
          },
          tags: [
            { id: 'tag-alex-5', tag_name: 'coffee' },
            { id: 'tag-alex-6', tag_name: 'reading' }
          ],
          created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ];
    
    default:
      // Default check-ins for unknown users or current user
      return [
        {
          id: 'checkin-default-1',
          user_id: userId,
          text_content: 'Just finished an amazing workout session at the gym! Feeling energized and ready to tackle the rest of the day.',
          privacy: 'public' as const,
          source: 'manual' as const,
          source_metadata: undefined,
          source_post_id: undefined,
          source_username: undefined,
          media_attachments: [],
          location: {
            id: 'loc-default-1',
            location_name: 'FitnessFirst Gym',
            latitude: 37.7749,
            longitude: -122.4194
          },
          tags: [
            { id: 'tag-default-1', tag_name: 'workout' },
            { id: 'tag-default-2', tag_name: 'fitness' }
          ],
          file_attachments: [],
          voice_note: undefined,
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'checkin-default-2',
          user_id: userId,
          text_content: 'Amazing sunset beach vibes 🌅',
          privacy: 'public' as const,
          source: 'instagram' as const,
          source_metadata: {
            username: 'beachlife_user',
            profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
            likes_count: 247,
            caption: 'Amazing sunset beach vibes 🌅 Nothing beats golden hour by the ocean #sunset #beachlife #goldenhour',
            hashtags: ['sunset', 'beachlife', 'goldenhour']
          },
          source_post_id: 'instagram_post_default_sunset',
          source_username: 'beachlife_user',
          media_attachments: [
            {
              id: 'media-default-1',
              media_type: 'image' as const,
              file_name: 'sunset_beach.jpg',
              file_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
              thumbnail_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150&h=150&fit=crop',
              file_size: 245760,
              mime_type: 'image/jpeg'
            }
          ],
          location: {
            id: 'loc-default-2',
            location_name: 'Santa Monica Beach',
            latitude: 34.0195,
            longitude: -118.4912
          },
          tags: [
            { id: 'tag-default-3', tag_name: 'sunset' },
            { id: 'tag-default-4', tag_name: 'beachlife' },
            { id: 'tag-default-5', tag_name: 'goldenhour' }
          ],
          file_attachments: [],
          voice_note: undefined,
          created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
        }
      ];
  }
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
    // Validate dev token format: dev-token-{userId} where userId is alphanumeric
    if (token.match(/^dev-token-[a-zA-Z0-9]+$/) && token.length >= 11 && token.length <= 50) {
      return token.replace('dev-token-', '');
    }
  }
  
  // SECURITY: Fallback to X-User-ID only in development/demo
  if (userIdHeader && userIdHeader.match(/^[a-zA-Z0-9-]+$/)) {
    return userIdHeader;
  }
  
  // SECURITY: Default to current user for MSW testing
  return '1'; // Alex Thompson (current user)
};

/**
 * Mock Service Worker handlers for check-in functionality
 * These handlers simulate the backend API endpoints for check-ins
 * Only used in development mode with MSW
 */
export const handlers = [
  // GET /checkins - Get user's check-ins
  http.get('*/checkins', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'CHECKIN_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('page_size') || '20', 10);
    const privacy = url.searchParams.get('privacy') as 'public' | 'friends' | 'private' | null;
    const targetUserId = url.searchParams.get('user_id'); // For viewing specific user's check-ins

    // Determine which user's check-ins to show
    const checkInOwnerUserId = targetUserId || userId;

    // Generate user-specific check-ins based on user ID
    const mockCheckInsData = getUserSpecificCheckIns(checkInOwnerUserId);

    // Filter by privacy if specified
    let filteredCheckins = mockCheckInsData;
    if (privacy) {
      filteredCheckins = mockCheckInsData.filter(checkin => checkin.privacy === privacy);
    }

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const paginatedCheckins = filteredCheckins.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < filteredCheckins.length;

    console.log(`📝 MSW: Returning ${paginatedCheckins.length} check-ins for user ${userId}`);

    return HttpResponse.json({
      checkins: paginatedCheckins,
      total: filteredCheckins.length,
      page,
      page_size: pageSize,
      has_more: hasMore
    }, { status: 200 });
  }),

  // POST /checkins - Create new check-in
  http.post('*/checkins', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'CHECKIN_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as {
        text_content?: string;
        privacy: 'public' | 'friends' | 'private';
        media_attachments?: any[];
        location?: any;
        tags?: string[];
        file_attachments?: any[];
        voice_note?: any;
      };

      console.log('📝 MSW: Creating check-in:', { userId, body });

      // Validate required fields
      if (!body.text_content && 
          (!body.media_attachments || body.media_attachments.length === 0) &&
          !body.location &&
          (!body.file_attachments || body.file_attachments.length === 0) &&
          !body.voice_note) {
        return HttpResponse.json(
          {
            type: 'CHECKIN_ERROR',
            message: 'Check-in must have either text content or attachments',
            code: 'INVALID_PRIVACY_SETTING',
          },
          { status: 400 }
        );
      }

      // Create new check-in
      const newCheckIn = {
        id: generateId(),
        user_id: userId,
        text_content: body.text_content,
        privacy: body.privacy,
        media_attachments: body.media_attachments || [],
        location: body.location,
        tags: (body.tags || []).map((tagName) => ({
          id: generateId(),
          tag_name: tagName
        })),
        file_attachments: body.file_attachments || [],
        voice_note: body.voice_note,
        created_at: now(),
        updated_at: now()
      };

      console.log('📝 MSW: Created check-in:', newCheckIn.id);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      return HttpResponse.json(newCheckIn, { status: 201 });
    } catch (error) {
      console.error('📝 MSW: Error creating check-in:', error);
      return HttpResponse.json(
        {
          type: 'CHECKIN_ERROR',
          message: 'Invalid request body',
          code: 'INVALID_PRIVACY_SETTING',
        },
        { status: 400 }
      );
    }
  }),

  // PUT /checkins/:id - Update check-in
  http.put('*/checkins/:checkInId', async ({ request, params }) => {
    const userId = extractUserId(request);
    const { checkInId } = params;
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'CHECKIN_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as {
        text_content?: string;
        privacy?: 'public' | 'friends' | 'private';
      };

      console.log('📝 MSW: Updating check-in:', checkInId, body);

      console.log('📝 MSW: Updating check-in privacy:', body.privacy);

      // Mock updated check-in - in reality, this would update in database
      const updatedCheckIn = {
        id: checkInId as string,
        user_id: userId,
        text_content: body.text_content || 'Updated check-in text',
        privacy: body.privacy || 'public' as const,
        media_attachments: [],
        location: {
          id: 'loc-1',
          location_name: 'Updated Location',
          latitude: 37.7749,
          longitude: -122.4194
        },
        tags: [
          { id: 'tag-updated', tag_name: 'updated' }
        ],
        file_attachments: [],
        voice_note: undefined,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        updated_at: now()
      };

      return HttpResponse.json(updatedCheckIn, { status: 200 });
    } catch (error) {
      console.error('📝 MSW: Error updating check-in:', error);
      return HttpResponse.json(
        {
          type: 'CHECKIN_ERROR',
          message: 'Invalid request body',
          code: 'CHECKIN_NOT_FOUND',
        },
        { status: 400 }
      );
    }
  }),

  // DELETE /checkins/:id - Delete check-in
  http.delete('*/checkins/:checkInId', ({ request, params }) => {
    const userId = extractUserId(request);
    const { checkInId } = params;
    
    if (!userId) {
      return HttpResponse.json(
        {
          type: 'CHECKIN_ERROR',
          message: 'Authentication required',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }

    console.log('📝 MSW: Deleting check-in:', checkInId);

    // Mock successful deletion
    return HttpResponse.json({}, { status: 204 });
  }),
];