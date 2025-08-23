import { API_CONFIG } from '../config/appConstants';
import { getToken } from '../utils/secureTokenStorage';

// Hidden users API client
export interface HiddenUsersResponse {
  hidden_users: string[];
}

export interface HideUserRequest {
  user_id: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}

export class HiddenUsersError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'HiddenUsersError';
  }
}

// Helper function to create auth headers
const createAuthHeaders = async (): Promise<Headers> => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  });

  const token = await getToken();
  if (token) {
    headers.set('Authorization', `${token.tokenType} ${token.token}`);
  }

  return headers;
};

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      throw new HiddenUsersError(
        response.statusText || 'An unexpected error occurred',
        'NETWORK_ERROR'
      );
    }

    throw new HiddenUsersError(
      errorData.message || 'An unexpected error occurred',
      errorData.code || 'API_ERROR',
      errorData.details
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new HiddenUsersError('Failed to parse response', 'PARSE_ERROR');
  }
};

/**
 * Get the current user's hidden users list
 */
export const getHiddenUsers = async (): Promise<string[]> => {
  const url = `${API_CONFIG.BASE_URL}/users/hidden`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: await createAuthHeaders(),
  });

  const data = await handleResponse<HiddenUsersResponse>(response);
  return data.hidden_users;
};

/**
 * Hide a user from discovery
 */
export const hideUser = async (userId: string): Promise<void> => {
  const url = `${API_CONFIG.BASE_URL}/users/hidden`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: await createAuthHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });

  await handleResponse<{ message: string }>(response);
};

/**
 * Unhide a user from discovery
 */
export const unhideUser = async (userId: string): Promise<void> => {
  const url = `${API_CONFIG.BASE_URL}/users/hidden/${userId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: await createAuthHeaders(),
  });

  await handleResponse<{ message: string }>(response);
};

// Utility functions for error handling

/**
 * Check if an error is a HiddenUsersError
 */
export const isHiddenUsersError = (error: any): error is HiddenUsersError => {
  return error instanceof HiddenUsersError;
};

/**
 * Get a user-friendly error message from a HiddenUsersError
 */
export const getHiddenUsersErrorMessage = (error: HiddenUsersError): string => {
  switch (error.code) {
    case 'AUTH_REQUIRED':
    case 'MISSING_USER_CONTEXT':
      return 'You need to be logged in to manage hidden users.';
    case 'INVALID_USER_ID':
    case 'INVALID_USER_ID_TO_HIDE':
    case 'INVALID_USER_ID_TO_UNHIDE':
      return 'Invalid user ID provided.';
    case 'CANNOT_HIDE_SELF':
      return 'You cannot hide yourself.';
    case 'USER_NOT_FOUND':
      return 'User not found.';
    case 'NETWORK_ERROR':
      return 'Network error. Please check your connection and try again.';
    case 'PARSE_ERROR':
      return 'Failed to process server response.';
    default:
      return error.message || 'An unexpected error occurred while managing hidden users.';
  }
};