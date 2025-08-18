// MSW mock handlers for montage API endpoints
// Provides realistic mock responses for development and testing

import { http } from 'msw';
import { MontageResponse, MontageItem, MontageRegenerateResponse, MontageDeleteResponse } from '../../types/montage';
import { buildApiUrl } from '../utils/config';
import { createAuthError, createNotFoundError, createSuccessResponse, createServerError } from '../utils/responseBuilders';

// Mock montage items data
const mockMontageItems: MontageItem[] = [
  {
    checkin_id: 'c1111111-e89b-12d3-a456-426614174000',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
      media_type: 'image',
      tags: ['coffee', 'morning', 'cafe'],
      description: 'Perfect morning coffee at my favorite spot',
      location: 'Blue Bottle Coffee',
      timestamp: '2024-01-15T08:00:00Z',
    },
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    checkin_id: 'c2222222-e89b-12d3-a456-426614174001',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400',
      media_type: 'image',
      tags: ['books', 'reading', 'library'],
      description: 'Lost in a good book at the local library',
      location: 'Central Library',
      timestamp: '2024-01-14T14:30:00Z',
    },
    created_at: '2024-01-14T14:30:00Z',
  },
  {
    checkin_id: 'c3333333-e89b-12d3-a456-426614174002',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      media_type: 'image',
      tags: ['nature', 'hiking', 'mountains'],
      description: 'Breathtaking view from the summit',
      location: 'Mount Tamalpais',
      timestamp: '2024-01-13T16:45:00Z',
    },
    created_at: '2024-01-13T16:45:00Z',
  },
  {
    checkin_id: 'c4444444-e89b-12d3-a456-426614174003',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
      media_type: 'image',
      tags: ['food', 'dinner', 'restaurant'],
      description: 'Amazing pasta at this new Italian place',
      location: 'Nonna Rosa Trattoria',
      timestamp: '2024-01-12T19:20:00Z',
    },
    created_at: '2024-01-12T19:20:00Z',
  },
  {
    checkin_id: 'c5555555-e89b-12d3-a456-426614174004',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      media_type: 'image',
      tags: ['art', 'museum', 'culture'],
      description: 'Inspiring exhibition at the modern art museum',
      location: 'SFMOMA',
      timestamp: '2024-01-11T11:15:00Z',
    },
    created_at: '2024-01-11T11:15:00Z',
  },
];

// Helper to filter items by interest
const filterItemsByInterest = (items: MontageItem[], interest?: string): MontageItem[] => {
  if (!interest) return items;
  
  return items.filter(item => 
    item.widget_metadata.tags?.some(tag => 
      tag.toLowerCase().includes(interest.toLowerCase())
    )
  );
};

// Helper to paginate items
const paginateItems = (items: MontageItem[], cursor?: string, limit = 20) => {
  let startIndex = 0;
  
  if (cursor) {
    const cursorIndex = items.findIndex(item => item.checkin_id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }
  
  const paginatedItems = items.slice(startIndex, startIndex + limit);
  const nextCursor = paginatedItems.length === limit && startIndex + limit < items.length
    ? items[startIndex + limit - 1].checkin_id
    : undefined;
  
  return {
    items: paginatedItems,
    nextCursor,
    hasMore: startIndex + limit < items.length,
  };
};

export const handlers = [
  // GET /users/:userId/montage - Fetch user montage
  http.get(buildApiUrl('/users/:userId/montage'), ({ params, request }) => {
    const { userId } = params;
    const url = new URL(request.url);
    const interest = url.searchParams.get('interest');
    const cursor = url.searchParams.get('cursor');
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    // Simulate different user scenarios
    if (userId === 'blocked-user') {
      return createAuthError("You don't have permission to view this user's montage", 'ACCESS_DENIED');
    }

    if (userId === 'not-found-user') {
      return createNotFoundError('User not found');
    }

    if (userId === 'no-data-user') {
      return createNotFoundError("This user doesn't have enough check-ins to generate a montage");
    }

    // Filter and paginate items
    const filteredItems = filterItemsByInterest(mockMontageItems, interest || undefined);
    const paginatedResult = paginateItems(filteredItems, cursor || undefined, limit);

    const response: MontageResponse = {
      type: interest ? 'interest-based' : 'general',
      items: paginatedResult.items,
      metadata: {
        total_count: filteredItems.length,
        page_size: limit,
        generated_at: new Date().toISOString(),
        next_cursor: paginatedResult.nextCursor,
        has_more: paginatedResult.hasMore,
      },
      user_id: userId as string,
      ...(interest && { interest }),
    };

    return createSuccessResponse(response);
  }),

  // POST /users/:userId/montage/regenerate - Regenerate user montage
  http.post(buildApiUrl('/users/:userId/montage/regenerate'), ({ params }) => {
    const { userId } = params;

    // Simulate permission error
    if (userId === 'blocked-user') {
      return createAuthError("You don't have permission to regenerate this user's montage", 'ACCESS_DENIED');
    }

    // Simulate server error occasionally
    if (Math.random() < 0.1) {
      return createServerError('Failed to regenerate montage. Please try again later.');
    }

    const response: MontageRegenerateResponse = {
      message: 'Montage regenerated successfully',
      user_id: userId as string,
      timestamp: new Date().toISOString(),
    };

    return createSuccessResponse(response);
  }),

  // DELETE /users/:userId/montage - Delete user montage
  http.delete(buildApiUrl('/users/:userId/montage'), ({ params, request }) => {
    const { userId } = params;
    const url = new URL(request.url);
    const interest = url.searchParams.get('interest');

    // Simulate permission error
    if (userId === 'blocked-user') {
      return createAuthError("You don't have permission to delete this user's montage", 'ACCESS_DENIED');
    }

    const response: MontageDeleteResponse = {
      message: interest 
        ? `Montage for interest '${interest}' deleted successfully`
        : 'Montage deleted successfully',
      user_id: userId as string,
    };

    return createSuccessResponse(response);
  }),
];
