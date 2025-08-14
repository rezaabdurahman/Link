import { API_CONFIG } from '../config/appConstants';
import { AuthToken } from '../types';
import { getToken } from '../utils/secureTokenStorage';

// Availability API response types
export interface AvailabilityResponse {
  id: string;
  user_id: string;
  is_available: boolean;
  last_available_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PublicAvailabilityResponse {
  user_id: string;
  is_available: boolean;
  last_available_at?: string;
}

export interface UpdateAvailabilityRequest {
  is_available: boolean;
}

export interface AvailableUsersResponse {
  data: PublicAvailabilityResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    total_pages: number;
  };
}

export interface HeartbeatResponse {
  status: string;
  availability: AvailabilityResponse;
}

// API Error types
export interface APIError {
  error: string;
  message: string;
  code: string;
  timestamp?: string;
}

// Custom error class for availability operations
export class AvailabilityError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AvailabilityError';
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
    const isDev = import.meta.env?.DEV;
    const isDemo = import.meta.env?.VITE_APP_MODE === 'demo';
    const enableMocking = import.meta.env?.VITE_ENABLE_MOCKING === 'true';
    
    // In demo mode or development, add X-User-ID header for MSW
    if ((isDev || isDemo || enableMocking) && token.token.startsWith('dev-token-')) {
      // Extract user ID from dev token (format: dev-token-{userId})
      const userId = token.token.replace('dev-token-', '');
      // SECURITY: Validate user ID format before adding header
      if (userId.match(/^[a-zA-Z0-9-]+$/)) {
        headers.set('X-User-ID', userId);
        console.log('🔧 AvailabilityClient: Added X-User-ID header for demo/dev mode:', userId);
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
      throw new AvailabilityError(
        response.statusText || 'An unexpected error occurred',
        response.status
      );
    }

    throw new AvailabilityError(
      errorData.message || 'An unexpected error occurred',
      response.status,
      errorData
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  try {
    return await response.json();
  } catch {
    throw new AvailabilityError('Failed to parse response', 500);
  }
};

/**
 * Get the current user's availability status
 * @returns Promise<AvailabilityResponse> - The user's availability status
 * @throws AvailabilityError - If the request fails or user is not authenticated
 */
export const getCurrentUserAvailability = async (): Promise<AvailabilityResponse> => {
  const token = await getToken();
  if (!token) {
    throw new AvailabilityError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/availability`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<AvailabilityResponse>(response);
};

/**
 * SET USER AVAILABILITY - Main method to set user as available or unavailable
 * @param isAvailable - Whether to set user as available (true) or unavailable (false)
 * @returns Promise<AvailabilityResponse> - The updated availability status
 * @throws AvailabilityError - If the request fails or user is not authenticated
 */
export const setUserAvailability = async (
  isAvailable: boolean
): Promise<AvailabilityResponse> => {
  console.log('🔄 AvailabilityClient: setUserAvailability called:', { isAvailable });
  
  const token = await getToken();
  console.log('🔐 AvailabilityClient: Token:', token ? 'present' : 'missing');
  
  if (!token) {
    console.error('❌ AvailabilityClient: No token available');
    throw new AvailabilityError('Authentication required', 401);
  }

  const url = `${API_CONFIG.BASE_URL}/availability`;
  const headers = createAuthHeaders(token);
  const body = JSON.stringify({ is_available: isAvailable });
  
  console.log('📡 AvailabilityClient: Making request:', {
    url,
    method: 'PUT',
    headers: Object.fromEntries(headers.entries()),
    body
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body,
  });

  console.log('📥 AvailabilityClient: Response received:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  return handleResponse<AvailabilityResponse>(response);
};

/**
 * Convenience method: Set user as AVAILABLE
 * @returns Promise<AvailabilityResponse> - The updated availability status
 */
export const setAvailable = async (): Promise<AvailabilityResponse> => {
  return setUserAvailability(true);
};

/**
 * Convenience method: Set user as UNAVAILABLE
 * @returns Promise<AvailabilityResponse> - The updated availability status
 */
export const setUnavailable = async (): Promise<AvailabilityResponse> => {
  return setUserAvailability(false);
};

/**
 * Get a specific user's availability status
 * @param userId - The target user's ID
 * @returns Promise<PublicAvailabilityResponse> - The user's availability status
 * @throws AvailabilityError - If the request fails or user is not authenticated
 */
export const getUserAvailability = async (
  userId: string
): Promise<PublicAvailabilityResponse> => {
  const token = await getToken();
  if (!token) {
    throw new AvailabilityError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/availability/${userId}`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<PublicAvailabilityResponse>(response);
};

/**
 * Get a list of users who are currently available for discovery
 * @param options - Pagination options
 * @returns Promise<AvailableUsersResponse> - Paginated list of available users
 * @throws AvailabilityError - If the request fails or user is not authenticated
 */
export const getAvailableUsers = async (
  options: { limit?: number; offset?: number } = {}
): Promise<AvailableUsersResponse> => {
  const token = await getToken();
  if (!token) {
    throw new AvailabilityError('Authentication required', 401);
  }

  const { limit = 50, offset = 0 } = options;
  const queryParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${API_CONFIG.BASE_URL}/available-users?${queryParams}`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<AvailableUsersResponse>(response);
};

/**
 * Send a heartbeat to keep the user marked as available
 * @returns Promise<HeartbeatResponse> - Confirmation of heartbeat
 * @throws AvailabilityError - If the request fails or user is not authenticated
 */
export const sendHeartbeat = async (): Promise<HeartbeatResponse> => {
  const token = await getToken();
  if (!token) {
    throw new AvailabilityError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/availability/heartbeat`, {
    method: 'POST',
    headers: createAuthHeaders(token),
  });

  return handleResponse<HeartbeatResponse>(response);
};

// Utility functions for error handling

/**
 * Check if an error is an AvailabilityError
 */
export const isAvailabilityError = (error: any): error is AvailabilityError => {
  return error instanceof AvailabilityError;
};

/**
 * Get a user-friendly error message from an AvailabilityError
 */
export const getAvailabilityErrorMessage = (error: AvailabilityError): string => {
  switch (error.code) {
    case 401:
      return 'You need to be logged in to manage your availability.';
    case 403:
      return 'You don\'t have permission to perform this action.';
    case 404:
      return 'Availability information not found.';
    case 422:
      return 'Invalid availability data. Please check your request and try again.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};

/**
 * Helper function to format last available time for display
 */
export const formatLastAvailable = (lastAvailableAt: string | undefined): string => {
  if (!lastAvailableAt) {
    return 'Never';
  }

  const lastAvailable = new Date(lastAvailableAt);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - lastAvailable.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
};

/**
 * Helper function to determine availability status styling
 */
export const getAvailabilityStatus = (
  isAvailable: boolean,
  lastAvailableAt?: string
): {
  status: 'available' | 'away' | 'offline';
  color: string;
  text: string;
} => {
  if (isAvailable) {
    return {
      status: 'available',
      color: 'green',
      text: 'Available',
    };
  }

  if (!lastAvailableAt) {
    return {
      status: 'offline',
      color: 'gray',
      text: 'Offline',
    };
  }

  const lastAvailable = new Date(lastAvailableAt);
  const now = new Date();
  const diffInHours = (now.getTime() - lastAvailable.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return {
      status: 'away',
      color: 'yellow',
      text: 'Away',
    };
  }

  return {
    status: 'offline',
    color: 'gray',
    text: 'Offline',
  };
};
