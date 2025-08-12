import { API_CONFIG } from '../config/appConstants';
import { AuthToken } from '../types';
import { getToken } from '../utils/secureTokenStorage';

// Broadcast API response types
export interface BroadcastResponse {
  id: string;
  user_id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface PublicBroadcastResponse {
  user_id: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBroadcastRequest {
  message: string;
  expires_in_hours?: number;
}

export interface UpdateBroadcastRequest {
  message: string;
  expires_in_hours?: number;
}

// API Error types
export interface APIError {
  error: string;
  message: string;
  code: number;
  details?: Record<string, any>;
  timestamp: string;
}

// Custom error class for broadcast operations
export class BroadcastError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BroadcastError';
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
      throw new BroadcastError(
        response.statusText || 'An unexpected error occurred',
        response.status
      );
    }

    throw new BroadcastError(
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
    throw new BroadcastError('Failed to parse response', 500);
  }
};

/**
 * Get the current user's active broadcast
 * @returns Promise<BroadcastResponse> - The user's active broadcast
 * @throws BroadcastError - If the request fails or user is not authenticated
 */
export const getCurrentUserBroadcast = async (): Promise<BroadcastResponse> => {
  const token = await getToken();
  if (!token) {
    throw new BroadcastError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/broadcasts`, {
    method: 'GET',
    headers: createAuthHeaders(token),
  });

  return handleResponse<BroadcastResponse>(response);
};

/**
 * Create a new broadcast for the current user
 * @param request - The broadcast creation request
 * @returns Promise<BroadcastResponse> - The created broadcast
 * @throws BroadcastError - If the request fails or user is not authenticated
 */
export const createBroadcast = async (
  request: CreateBroadcastRequest
): Promise<BroadcastResponse> => {
  const token = await getToken();
  if (!token) {
    throw new BroadcastError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/broadcasts`, {
    method: 'POST',
    headers: createAuthHeaders(token),
    body: JSON.stringify(request),
  });

  return handleResponse<BroadcastResponse>(response);
};

/**
 * Update the current user's existing broadcast
 * @param request - The broadcast update request
 * @returns Promise<BroadcastResponse> - The updated broadcast
 * @throws BroadcastError - If the request fails or user is not authenticated
 */
export const updateBroadcast = async (
  request: UpdateBroadcastRequest
): Promise<BroadcastResponse> => {
  const token = await getToken();
  if (!token) {
    throw new BroadcastError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/broadcasts`, {
    method: 'PUT',
    headers: createAuthHeaders(token),
    body: JSON.stringify(request),
  });

  return handleResponse<BroadcastResponse>(response);
};

/**
 * Delete the current user's broadcast
 * @returns Promise<void> - No content on success
 * @throws BroadcastError - If the request fails or user is not authenticated
 */
export const deleteBroadcast = async (): Promise<void> => {
  const token = await getToken();
  if (!token) {
    throw new BroadcastError('Authentication required', 401);
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/broadcasts`, {
    method: 'DELETE',
    headers: createAuthHeaders(token),
  });

  return handleResponse<void>(response);
};

/**
 * Get a specific user's broadcast by their user ID (public endpoint)
 * @param userId - The target user's ID
 * @returns Promise<PublicBroadcastResponse> - The user's public broadcast data
 * @throws BroadcastError - If the request fails or broadcast not found
 */
export const getUserBroadcast = async (
  userId: string
): Promise<PublicBroadcastResponse> => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/broadcasts/${userId}`, {
    method: 'GET',
    headers: createAuthHeaders(), // No token needed for public endpoint
  });

  return handleResponse<PublicBroadcastResponse>(response);
};

// Utility functions for error handling

/**
 * Check if an error is a BroadcastError
 * @param error - The error to check
 * @returns boolean - True if the error is a BroadcastError
 */
export const isBroadcastError = (error: any): error is BroadcastError => {
  return error instanceof BroadcastError;
};

/**
 * Get a user-friendly error message from a BroadcastError
 * @param error - The BroadcastError
 * @returns string - A user-friendly error message
 */
export const getBroadcastErrorMessage = (error: BroadcastError): string => {
  switch (error.code) {
    case 401:
      return 'You need to be logged in to manage broadcasts.';
    case 403:
      return 'You don\'t have permission to perform this action.';
    case 404:
      return 'Broadcast not found.';
    case 409:
      return 'You already have an active broadcast. Please update or delete it first.';
    case 422:
      return 'Invalid broadcast data. Please check your message and try again.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};

/**
 * Validate broadcast message content
 * @param message - The broadcast message to validate
 * @returns object - Validation result with isValid flag and error message
 */
export const validateBroadcastMessage = (message: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!message || message.trim().length === 0) {
    return { isValid: false, error: 'Broadcast message cannot be empty.' };
  }

  if (message.trim().length > 200) {
    return { isValid: false, error: 'Broadcast message must be 200 characters or less.' };
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
    return { isValid: false, error: 'Broadcast must expire in at least 1 hour.' };
  }

  if (hours > 168) { // 7 days
    return { isValid: false, error: 'Broadcast can expire in at most 7 days (168 hours).' };
  }

  return { isValid: true };
};
