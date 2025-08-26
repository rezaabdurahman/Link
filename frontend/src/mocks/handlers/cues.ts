import { http, HttpResponse } from 'msw';
import { API_CONFIG } from '../../config/appConstants';

// Mock cue storage
interface MockCue {
  id: string;
  user_id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

interface MockCueMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  cue1_id: string;
  cue2_id: string;
  match_score: number;
  is_active: boolean;
  user1_viewed: boolean;
  user2_viewed: boolean;
  created_at: string;
  updated_at: string;
}

let mockCues: MockCue[] = [];
let mockMatches: MockCueMatch[] = [];

// Helper function to generate UUID-like string
const generateId = (): string => {
  return 'mock-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Helper function to calculate similarity between two strings (simple word overlap)
const calculateSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
};

// Helper function to find and create matches
const findMatches = (newCue: MockCue) => {
  for (const existingCue of mockCues) {
    if (existingCue.user_id === newCue.user_id || !existingCue.is_active) {
      continue;
    }

    // Check if match already exists
    const existingMatch = mockMatches.find(match => 
      match.is_active &&
      ((match.user1_id === newCue.user_id && match.user2_id === existingCue.user_id) ||
       (match.user1_id === existingCue.user_id && match.user2_id === newCue.user_id))
    );

    if (existingMatch) continue;

    // Calculate similarity
    const similarity = calculateSimilarity(newCue.message, existingCue.message);
    
    // Create match if similarity is above threshold (0.3)
    if (similarity >= 0.3) {
      const match: MockCueMatch = {
        id: generateId(),
        user1_id: newCue.user_id,
        user2_id: existingCue.user_id,
        cue1_id: newCue.id,
        cue2_id: existingCue.id,
        match_score: similarity,
        is_active: true,
        user1_viewed: false,
        user2_viewed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      mockMatches.push(match);
    }
  }
};

export const cueHandlers = [
  // GET /cues - Get current user's cue
  http.get(`${API_CONFIG.BASE_URL}/cues`, () => {
    console.log('📝 MSW: Get current user cue request received');

    // For demo mode, return no active cue (404 is normal)
    console.log('📝 MSW: No active cue for demo user - returning 404');
    return HttpResponse.json(
      { error: 'not_found', message: 'No active cue found', code: 404 },
      { status: 404 }
    );
  }),

  // POST /cues - Create a new cue
  http.post(`${API_CONFIG.BASE_URL}/cues`, async ({ request }) => {
    const userId = request.headers.get('X-User-ID');
    if (!userId) {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'User not authenticated', code: 401 },
        { status: 401 }
      );
    }

    const body = await request.json() as { message: string; expires_in_hours?: number };
    
    if (!body.message || body.message.trim().length === 0) {
      return HttpResponse.json(
        { error: 'validation_error', message: 'Cue message cannot be empty', code: 400 },
        { status: 400 }
      );
    }

    if (body.message.length > 200) {
      return HttpResponse.json(
        { error: 'validation_error', message: 'Cue message must be 200 characters or less', code: 400 },
        { status: 400 }
      );
    }

    // Deactivate existing cues for this user
    mockCues.forEach(cue => {
      if (cue.user_id === userId && cue.is_active) {
        cue.is_active = false;
        cue.updated_at = new Date().toISOString();
      }
    });

    const expiresAt = body.expires_in_hours 
      ? new Date(Date.now() + body.expires_in_hours * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default 24 hours

    const newCue: MockCue = {
      id: generateId(),
      user_id: userId,
      message: body.message.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt
    };

    mockCues.push(newCue);

    // Find matches asynchronously
    setTimeout(() => findMatches(newCue), 100);

    return HttpResponse.json(newCue, { status: 201 });
  }),

  // PUT /cues - Update existing cue
  http.put(`${API_CONFIG.BASE_URL}/cues`, async ({ request }) => {
    const userId = request.headers.get('X-User-ID');
    if (!userId) {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'User not authenticated', code: 401 },
        { status: 401 }
      );
    }

    const body = await request.json() as { message: string; expires_in_hours?: number };
    
    const existingCue = mockCues.find(cue => cue.user_id === userId && cue.is_active);
    if (!existingCue) {
      return HttpResponse.json(
        { error: 'not_found', message: 'No active cue found to update', code: 404 },
        { status: 404 }
      );
    }

    existingCue.message = body.message.trim();
    existingCue.updated_at = new Date().toISOString();
    
    if (body.expires_in_hours) {
      existingCue.expires_at = new Date(Date.now() + body.expires_in_hours * 60 * 60 * 1000).toISOString();
    }

    // Find new matches after update
    setTimeout(() => findMatches(existingCue), 100);

    return HttpResponse.json(existingCue);
  }),

  // DELETE /cues - Delete current user's cue
  http.delete(`${API_CONFIG.BASE_URL}/cues`, ({ request }) => {
    const userId = request.headers.get('X-User-ID');
    if (!userId) {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'User not authenticated', code: 401 },
        { status: 401 }
      );
    }

    const existingCue = mockCues.find(cue => cue.user_id === userId && cue.is_active);
    if (!existingCue) {
      return HttpResponse.json(
        { error: 'not_found', message: 'No active cue found to delete', code: 404 },
        { status: 404 }
      );
    }

    existingCue.is_active = false;
    existingCue.updated_at = new Date().toISOString();

    return new HttpResponse(null, { status: 204 });
  }),

  // GET /cues/matches - Get user's cue matches
  http.get(`${API_CONFIG.BASE_URL}/cues/matches`, () => {
    console.log('📝 MSW: Get cue matches request received');

    // For demo mode, return empty matches array
    console.log('📝 MSW: Returning empty cue matches for demo');
    return HttpResponse.json({
      matches: [],
      count: 0
    });
  }),

  // POST /cues/matches/:matchId/viewed - Mark match as viewed
  http.post(`${API_CONFIG.BASE_URL}/cues/matches/:matchId/viewed`, ({ request, params }) => {
    const userId = request.headers.get('X-User-ID');
    const { matchId } = params;
    
    if (!userId) {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'User not authenticated', code: 401 },
        { status: 401 }
      );
    }

    const match = mockMatches.find(m => m.id === matchId);
    if (!match) {
      return HttpResponse.json(
        { error: 'not_found', message: 'Match not found', code: 404 },
        { status: 404 }
      );
    }

    if (match.user1_id === userId) {
      match.user1_viewed = true;
    } else if (match.user2_id === userId) {
      match.user2_viewed = true;
    } else {
      return HttpResponse.json(
        { error: 'forbidden', message: 'User is not part of this match', code: 403 },
        { status: 403 }
      );
    }

    match.updated_at = new Date().toISOString();

    return HttpResponse.json({ message: 'Match marked as viewed' });
  }),

  // GET /cues/matches/check/:userId - Check if user has match with another user
  http.get(`${API_CONFIG.BASE_URL}/cues/matches/check/:userId`, ({ request, params }) => {
    const currentUserId = request.headers.get('X-User-ID');
    const { userId: otherUserId } = params;
    
    if (!currentUserId) {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'User not authenticated', code: 401 },
        { status: 401 }
      );
    }

    const hasMatch = mockMatches.some(match => 
      match.is_active &&
      ((match.user1_id === currentUserId && match.user2_id === otherUserId) ||
       (match.user1_id === otherUserId && match.user2_id === currentUserId))
    );

    return HttpResponse.json({
      has_match: hasMatch,
      user_id: otherUserId
    });
  }),
];