import { API_CONFIG } from '../config/appConstants';
import { AuthToken, User } from '../types';
import { getToken } from '../utils/secureTokenStorage';

// Unified Search API request types
export interface UnifiedSearchRequest {
  query?: string;
  scope: 'friends' | 'discovery' | 'all';
  filters?: {
    distance?: number; // in miles
    available_only?: boolean;
    friends_only?: boolean;
    location?: {
      lat?: number;
      lng?: number;
      radius?: number;
    };
  };
  pagination?: {
    limit?: number;
    offset?: number;
    page?: number;
  };
}

// Unified Search API response types
export interface UnifiedSearchResponse {
  users: User[];
  total: number;
  hasMore: boolean;
  scope: 'friends' | 'discovery' | 'all';
  query?: string;
  filters?: {
    maxDistance: number;
    appliedFilters: Record<string, any>;
  };
  metadata?: {
    searchTime: number; // milliseconds
    source: 'semantic_search' | 'database' | 'hybrid';
    relevanceScores?: Record<string, number>;
  };
}

// API Error types for unified search
export interface UnifiedSearchAPIError {
  error: string;
  message: string;
  code: number;
  details?: Record<string, any>;
  timestamp: string;
  deprecationWarning?: string;
}

// Custom error class for unified search operations
export class UnifiedSearchError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly details?: Record<string, any>,
    public readonly deprecationWarning?: string
  ) {
    super(message);
    this.name = 'UnifiedSearchError';
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
    let errorData: UnifiedSearchAPIError;
    try {
      errorData = await response.json();
    } catch {
      // If we can't parse the error response, create a generic error
      throw new UnifiedSearchError(
        response.statusText || 'An unexpected error occurred',
        response.status
      );
    }

    throw new UnifiedSearchError(
      errorData.message || 'An unexpected error occurred',
      errorData.code || response.status,
      errorData.details,
      errorData.deprecationWarning
    );
  }

  try {
    const data = await response.json();
    console.log('🔍 UnifiedSearchClient: Received', data.users?.length || 0, 'users');
    
    // Transform date strings back to Date objects for User type compatibility
    if (data.users && Array.isArray(data.users)) {
      data.users = data.users.map((user: any) => ({
        ...user,
        lastSeen: user.lastSeen ? new Date(user.lastSeen) : new Date()
      }));
    }
    
    return data;
  } catch (error) {
    console.error('🔍 UnifiedSearchClient: Failed to parse response:', error);
    throw new UnifiedSearchError('Failed to parse response', 500);
  }
};

/**
 * Unified search for users based on query, scope, and filters
 * This replaces the previous searchAvailableUsers and searchFriends functions
 * @param request - The unified search request parameters
 * @returns Promise<UnifiedSearchResponse> - The search results
 * @throws UnifiedSearchError - If the request fails or user is not authenticated
 */
export const unifiedSearch = async (
  request: UnifiedSearchRequest
): Promise<UnifiedSearchResponse> => {
  const token = await getToken();
  if (!token) {
    throw new UnifiedSearchError('Authentication required', 401);
  }

  // Validate required parameters
  if (!request.scope || !['friends', 'discovery', 'all'].includes(request.scope)) {
    throw new UnifiedSearchError('Invalid scope. Must be "friends", "discovery", or "all"', 400);
  }

  const url = `${API_CONFIG.BASE_URL}/search`;
  
  console.log('🔍 UnifiedSearchClient: Making search request to:', url);
  console.log('🔍 UnifiedSearchClient: Request payload:', JSON.stringify(request, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: createAuthHeaders(token),
    body: JSON.stringify(request),
  });
  
  console.log('🔍 UnifiedSearchClient: Response status:', response.status);

  return handleResponse<UnifiedSearchResponse>(response);
};


// Utility functions for error handling

/**
 * Check if an error is a UnifiedSearchError
 * @param error - The error to check
 * @returns boolean - True if the error is a UnifiedSearchError
 */
export const isUnifiedSearchError = (error: any): error is UnifiedSearchError => {
  return error instanceof UnifiedSearchError;
};

/**
 * Get a user-friendly error message from a UnifiedSearchError
 * @param error - The UnifiedSearchError
 * @returns string - A user-friendly error message
 */
export const getUnifiedSearchErrorMessage = (error: UnifiedSearchError): string => {
  if (error.deprecationWarning) {
    console.warn('DEPRECATION WARNING:', error.deprecationWarning);
  }

  switch (error.code) {
    case 400:
      return 'Invalid search parameters. Please check your filters and try again.';
    case 401:
      return 'You need to be logged in to search for users.';
    case 403:
      return 'You don\'t have permission to search for users.';
    case 422:
      return 'Invalid search query or filters. Please adjust and try again.';
    case 429:
      return 'Too many requests. Please wait a moment before searching again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred while searching.';
  }
};

/**
 * Validate unified search request
 * @param request - The search request to validate
 * @returns object - Validation result with isValid flag and error message
 */
export const validateUnifiedSearchRequest = (request: UnifiedSearchRequest): {
  isValid: boolean;
  error?: string;
} => {
  // Validate scope
  if (!request.scope || !['friends', 'discovery', 'all'].includes(request.scope)) {
    return { 
      isValid: false, 
      error: 'Scope must be "friends", "discovery", or "all".' 
    };
  }

  // Validate query length
  if (request.query && request.query.trim().length > 200) {
    return { 
      isValid: false, 
      error: 'Search query must be 200 characters or less.' 
    };
  }

  // Validate distance
  if (request.filters?.distance !== undefined) {
    if (request.filters.distance < 0) {
      return { 
        isValid: false, 
        error: 'Distance must be a positive number.' 
      };
    }
    if (request.filters.distance > 100) {
      return { 
        isValid: false, 
        error: 'Distance cannot exceed 100 miles.' 
      };
    }
  }

  // Validate pagination
  if (request.pagination?.limit !== undefined) {
    if (request.pagination.limit < 1 || request.pagination.limit > 100) {
      return { 
        isValid: false, 
        error: 'Limit must be between 1 and 100.' 
      };
    }
  }

  return { isValid: true };
};

// Note: Legacy error handling exports removed
// Use UnifiedSearchError, isUnifiedSearchError, and getUnifiedSearchErrorMessage instead
