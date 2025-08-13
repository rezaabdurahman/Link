import { API_CONFIG } from '../config/appConstants';
import { AuthToken, User } from '../types';
import { getToken } from '../utils/secureTokenStorage';

// Search API request types
export interface SearchUsersRequest {
  query?: string;
  distance?: number; // in miles
  interests?: string[];
  limit?: number;
  offset?: number;
}

// Search API response types
export interface SearchUsersResponse {
  users: User[];
  total: number;
  hasMore: boolean;
  filters?: {
    maxDistance: number;
    availableInterests: string[];
  };
}

// API Error types
export interface SearchAPIError {
  error: string;
  message: string;
  code: number;
  details?: Record<string, any>;
  timestamp: string;
}

// Custom error class for search operations
export class SearchError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SearchError';
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
    let errorData: SearchAPIError;
    try {
      errorData = await response.json();
    } catch {
      // If we can't parse the error response, create a generic error
      throw new SearchError(
        response.statusText || 'An unexpected error occurred',
        response.status
      );
    }

    throw new SearchError(
      errorData.message || 'An unexpected error occurred',
      errorData.code || response.status,
      errorData.details
    );
  }

  try {
    return await response.json();
  } catch {
    throw new SearchError('Failed to parse response', 500);
  }
};

/**
 * Search for available users based on query and filters
 * @param request - The search request parameters
 * @returns Promise<SearchUsersResponse> - The search results
 * @throws SearchError - If the request fails or user is not authenticated
 */
export const searchAvailableUsers = async (
  request: SearchUsersRequest = {}
): Promise<SearchUsersResponse> => {
  const token = await getToken();
  if (!token) {
    throw new SearchError('Authentication required', 401);
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  
  if (request.query && request.query.trim()) {
    queryParams.append('q', request.query.trim());
  }
  
  if (request.distance !== undefined && request.distance > 0) {
    queryParams.append('distance', request.distance.toString());
  }
  
  if (request.interests && request.interests.length > 0) {
    request.interests.forEach(interest => {
      queryParams.append('interests', interest);
    });
  }
  
  if (request.limit !== undefined && request.limit > 0) {
    queryParams.append('limit', request.limit.toString());
  }
  
  if (request.offset !== undefined && request.offset >= 0) {
    queryParams.append('offset', request.offset.toString());
  }

  const url = `${API_CONFIG.BASE_URL}/discovery/available-users/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<SearchUsersResponse>(response);
};

// Utility functions for error handling

/**
 * Check if an error is a SearchError
 * @param error - The error to check
 * @returns boolean - True if the error is a SearchError
 */
export const isSearchError = (error: any): error is SearchError => {
  return error instanceof SearchError;
};

/**
 * Get a user-friendly error message from a SearchError
 * @param error - The SearchError
 * @returns string - A user-friendly error message
 */
export const getSearchErrorMessage = (error: SearchError): string => {
  switch (error.code) {
    case 401:
      return 'You need to be logged in to search for users.';
    case 403:
      return 'You don\'t have permission to search for users.';
    case 422:
      return 'Invalid search parameters. Please check your filters and try again.';
    case 429:
      return 'Too many requests. Please wait a moment before searching again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred while searching.';
  }
};

/**
 * Validate search query
 * @param query - The search query to validate
 * @returns object - Validation result with isValid flag and error message
 */
export const validateSearchQuery = (query: string): {
  isValid: boolean;
  error?: string;
} => {
  if (query && query.trim().length > 100) {
    return { isValid: false, error: 'Search query must be 100 characters or less.' };
  }

  return { isValid: true };
};

/**
 * Validate distance filter
 * @param distance - The distance to validate
 * @returns object - Validation result with isValid flag and error message
 */
export const validateDistance = (distance: number): {
  isValid: boolean;
  error?: string;
} => {
  if (distance < 0) {
    return { isValid: false, error: 'Distance must be a positive number.' };
  }

  if (distance > 50) { // 50 mile max
    return { isValid: false, error: 'Distance cannot exceed 50 miles.' };
  }

  return { isValid: true };
};
