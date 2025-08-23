import { API_CONFIG } from '../config/appConstants';
import { AuthToken } from '../types';
import { getToken } from '../utils/secureTokenStorage';

// Cue API response types
export interface CueResponse {
  id: string;
  user_id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface CueMatchResponse {
  id: string;
  matched_with: string;
  match_score: number;
  is_viewed: boolean;
  created_at: string;
}

export interface CueMatchesResponse {
  matches: CueMatchResponse[];
  count: number;
}

export interface CreateCueRequest {
  message: string;
  expires_in_hours?: number;
}

export interface UpdateCueRequest {
  message: string;
  expires_in_hours?: number;
}

export interface HasMatchResponse {
  has_match: boolean;
  user_id: string;
}

// API Error types
export interface APIError {
  error: string;
  message: string;
  code: number;
  details?: Record<string, any>;
  timestamp: string;
}

// Custom error class for cue operations
export class CueError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CueError';
  }
}

// Helper function to create auth headers
const createAuthHeaders = (token?: AuthToken): Headers => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  });

  if (token) {
    headers.set('Authorization', `${token.tokenType} ${token.token}`);
    
    // SECURITY: Only add X-User-ID in development/demo for MSW
    // This header is NEVER sent to production APIs
    const isDev = import.meta.env?.DEV;
    const isDemo = import.meta.env?.VITE_APP_MODE === 'demo';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
    
    if ((isDev || isDemo) && hostname === 'localhost' && token.token.startsWith('dev-token-')) {
      // Extract user ID from dev token (format: dev-token-{userId})
      const userId = token.token.replace('dev-token-', '');
      // SECURITY: Validate user ID format before adding header
      if (userId.match(/^[a-zA-Z0-9-]+$/)) {
        headers.set('X-User-ID', userId);
      }
    }
  }

  return headers;
};

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData: APIError;
    try {
      errorData = await response.json();
    } catch {
      // If we can't parse the error response, create a generic error
      throw new CueError(
        response.statusText || 'An unexpected error occurred',
        response.status
      );
    }

    throw new CueError(
      errorData.message || 'An unexpected error occurred',
      errorData.code || response.status,
      errorData.details
    );
  }

  // Handle 204 No Content responses (like DELETE operations)
  if (response.status === 204) {
    return {} as T;
  }

  try {
    return await response.json();
  } catch {
    throw new CueError('Failed to parse response', 500);
  }
};

/**
 * Get the current user's active cue
 * @returns Promise<CueResponse> - The user's active cue
 * @throws CueError - If the request fails or user is not authenticated
 */
export const getCurrentUserCue = async (): Promise<CueResponse> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<CueResponse>(response);
};

/**
 * Create a new cue for the current user
 * @param request - The cue creation request
 * @returns Promise<CueResponse> - The created cue
 * @throws CueError - If the request fails or user is not authenticated
 */
export const createCue = async (
  request: CreateCueRequest
): Promise<CueResponse> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues`, {
    method: 'POST',
    headers: createAuthHeaders(token),
    body: JSON.stringify(request),
  });

  return handleResponse<CueResponse>(response);
};

/**
 * Update the current user's existing cue
 * @param request - The cue update request
 * @returns Promise<CueResponse> - The updated cue
 * @throws CueError - If the request fails or user is not authenticated
 */
export const updateCue = async (
  request: UpdateCueRequest
): Promise<CueResponse> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues`, {
    method: 'PUT',
    headers: createAuthHeaders(token),
    body: JSON.stringify(request),
  });

  return handleResponse<CueResponse>(response);
};

/**
 * Delete the current user's cue
 * @returns Promise<void> - No content on success
 * @throws CueError - If the request fails or user is not authenticated
 */
export const deleteCue = async (): Promise<void> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues`, {
    method: 'DELETE',
    headers: createAuthHeaders(token),
  });

  return handleResponse<void>(response);
};

/**
 * Get the current user's cue matches
 * @returns Promise<CueMatchesResponse> - The user's cue matches
 * @throws CueError - If the request fails or user is not authenticated
 */
export const getCueMatches = async (): Promise<CueMatchesResponse> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues/matches`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<CueMatchesResponse>(response);
};

/**
 * Mark a cue match as viewed
 * @param matchId - The ID of the match to mark as viewed
 * @returns Promise<void> - Success response
 * @throws CueError - If the request fails or user is not authenticated
 */
export const markMatchAsViewed = async (matchId: string): Promise<void> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues/matches/${matchId}/viewed`, {
    method: 'POST',
    headers: createAuthHeaders(token),
  });

  return handleResponse<void>(response);
};

/**
 * Check if the current user has a cue match with another user
 * @param userId - The ID of the other user to check
 * @returns Promise<HasMatchResponse> - Whether there's a match
 * @throws CueError - If the request fails or user is not authenticated
 */
export const hasCueMatchWith = async (userId: string): Promise<HasMatchResponse> => {
  const token = await getToken();
  if (!token) {
    throw new CueError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/cues/matches/check/${userId}`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<HasMatchResponse>(response);
};

// Utility functions for error handling

/**
 * Check if an error is a CueError
 * @param error - The error to check
 * @returns boolean - True if the error is a CueError
 */
export const isCueError = (error: any): error is CueError => {
  return error instanceof CueError;
};

/**
 * Get a user-friendly error message from a CueError
 * @param error - The CueError
 * @returns string - A user-friendly error message
 */
export const getCueErrorMessage = (error: CueError): string => {
  switch (error.code) {
    case 401:
      return 'You need to be logged in to manage cues.';
    case 403:
      return 'You don\'t have permission to perform this action.';
    case 404:
      return 'Cue not found.';
    case 409:
      return 'You already have an active cue. Please update or delete it first.';
    case 422:
      return 'Invalid cue data. Please check your message and try again.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};

/**
 * Validate cue message content
 * @param message - The cue message to validate
 * @returns object - Validation result with isValid flag and error message
 */
export const validateCueMessage = (message: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!message || message.trim().length === 0) {
    return { isValid: false, error: 'Cue message cannot be empty.' };
  }

  if (message.trim().length > 200) {
    return { isValid: false, error: 'Cue message must be 200 characters or less.' };
  }

  return { isValid: true };
};

/**
 * Validate expiration hours
 * @param hours - The expiration hours to validate
 * @returns object - Validation result with isValid flag and error message
 */
export const validateExpirationHours = (hours: number): {
  isValid: boolean;
  error?: string;
} => {
  if (hours < 1) {
    return { isValid: false, error: 'Cue must expire in at least 1 hour.' };
  }

  if (hours > 168) { // 7 days
    return { isValid: false, error: 'Cue can expire in at most 7 days (168 hours).' };
  }

  return { isValid: true };
};