// Montage service client for fetching user montages from the API Gateway
// Follows the same error handling patterns as authClient.ts and userClient.ts

import { apiClient, AuthServiceError, ApiError, getErrorMessage } from './authClient';
import {
  MontageResponse,
  MontageOptions,
  MontageRegenerateResponse,
  MontageDeleteResponse,
  isMontageResponse,
} from '../types/montage';

// Extended API error type for montage-specific errors
export type MontageApiError = ApiError | {
  type: 'MONTAGE_ERROR';
  message: string;
  code: 'MONTAGE_NOT_FOUND' | 'MONTAGE_GENERATION_FAILED' | 'INSUFFICIENT_DATA' | 'RATE_LIMIT_EXCEEDED';
};

// API endpoints for montage operations
const MONTAGE_ENDPOINTS = {
  montage: (userId: string) => `/users/${userId}/montage`,
  regenerate: (userId: string) => `/users/${userId}/montage/regenerate`,
  delete: (userId: string) => `/users/${userId}/montage`,
} as const;

/**
 * Fetch montage data for a specific user
 * @param userId - The ID of the user whose montage to fetch
 * @param options - Optional parameters for filtering and pagination
 * @returns Promise resolving to montage response data
 * @throws AuthServiceError with detailed error information
 */
export async function fetchMontage(
  userId: string,
  options?: MontageOptions
): Promise<MontageResponse> {
  try {
    // Validate userId parameter
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'User ID is required and must be a non-empty string',
        field: 'userId',
        code: 'REQUIRED_FIELD',
      });
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (options?.interest) {
      params.append('interest', options.interest);
    }
    if (options?.cursor) {
      params.append('cursor', options.cursor);
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }

    const queryString = params.toString();
    const endpoint = queryString 
      ? `${MONTAGE_ENDPOINTS.montage(userId.trim())}?${queryString}`
      : MONTAGE_ENDPOINTS.montage(userId.trim());

    const response = await apiClient.get<MontageResponse>(endpoint);
    
    // Validate response structure
    if (!isMontageResponse(response)) {
      throw new AuthServiceError({
        type: 'SERVER_ERROR',
        message: 'Invalid response format from montage service',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to fetch montage due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Regenerate montage for a specific user
 * @param userId - The ID of the user whose montage to regenerate
 * @param interest - Optional interest filter for regeneration
 * @returns Promise resolving to regeneration response
 * @throws AuthServiceError with detailed error information
 */
export async function regenerateMontage(
  userId: string,
  interest?: string
): Promise<MontageRegenerateResponse> {
  try {
    // Validate userId parameter
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'User ID is required and must be a non-empty string',
        field: 'userId',
        code: 'REQUIRED_FIELD',
      });
    }

    const requestBody: { interest?: string } = {};
    if (interest) {
      requestBody.interest = interest;
    }

    const response = await apiClient.post<MontageRegenerateResponse>(
      MONTAGE_ENDPOINTS.regenerate(userId.trim()),
      requestBody
    );

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to regenerate montage due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Delete montage for a specific user and optional interest
 * @param userId - The ID of the user whose montage to delete
 * @param interest - Optional interest filter for deletion
 * @returns Promise resolving to deletion response
 * @throws AuthServiceError with detailed error information
 */
export async function deleteMontage(
  userId: string,
  interest?: string
): Promise<MontageDeleteResponse> {
  try {
    // Validate userId parameter
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'User ID is required and must be a non-empty string',
        field: 'userId',
        code: 'REQUIRED_FIELD',
      });
    }

    // Build query parameters for DELETE request
    const params = new URLSearchParams();
    if (interest) {
      params.append('interest', interest);
    }

    const queryString = params.toString();
    const endpoint = queryString 
      ? `${MONTAGE_ENDPOINTS.delete(userId.trim())}?${queryString}`
      : MONTAGE_ENDPOINTS.delete(userId.trim());

    const response = await apiClient.delete<MontageDeleteResponse>(endpoint);

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to delete montage due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Helper function to get user-friendly montage error messages
 * @param error - The API error to get message for
 * @param userId - Optional user ID for context
 * @returns User-friendly error message
 */
export function getMontageErrorMessage(error: MontageApiError, userId?: string): string {
  // Handle montage-specific errors
  if (error.type === 'MONTAGE_ERROR') {
    switch (error.code) {
      case 'MONTAGE_NOT_FOUND':
        return userId 
          ? `No montage found for this user`
          : 'Montage not found';
          
      case 'MONTAGE_GENERATION_FAILED':
        return 'Failed to generate montage. Please try again later.';
        
      case 'INSUFFICIENT_DATA':
        return userId 
          ? 'This user doesn\'t have enough check-ins to generate a montage'
          : 'Not enough data to generate montage';
          
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many requests. Please wait a moment before trying again.';
    }
  }
  
  // Handle standard API errors
  switch (error.code) {
    case 'ACCESS_DENIED':
      return userId 
        ? 'You don\'t have permission to view this user\'s montage'
        : 'Access denied to montage';
        
    case 'USER_BLOCKED':
      return 'This content is not available due to privacy settings';
        
    case 'TOO_MANY_REQUESTS':
      return 'Too many requests. Please wait a moment before trying again.';
      
    default:
      return getErrorMessage(error as ApiError);
  }
}

/**
 * Helper function to check if a montage error is recoverable
 * @param error - The error to check
 * @returns Boolean indicating if the error is recoverable with retry
 */
export function isMontageErrorRecoverable(error: unknown): boolean {
  if (!(error instanceof AuthServiceError)) {
    return false;
  }

  const { code } = error.error;
  
  // Recoverable errors that might succeed on retry
  const recoverableCodes = [
    'INTERNAL_SERVER_ERROR',
    'SERVICE_UNAVAILABLE',
    'DATABASE_ERROR',
    'TOO_MANY_REQUESTS',
  ];
  
  return recoverableCodes.includes(code || '');
}

/**
 * Helper function to determine if user should see permission-related error
 * @param error - The error to check
 * @returns Boolean indicating if this is a permission/access error
 */
export function isMontagePermissionError(error: unknown): boolean {
  if (!(error instanceof AuthServiceError)) {
    return false;
  }

  const { type } = error.error;
  
  return (
    type === 'AUTHORIZATION_ERROR' ||
    type === 'BUSINESS_LOGIC_ERROR'
  );
}

// Re-export shared error handling utilities for consistency
export { AuthServiceError, getErrorMessage } from './authClient';
export type { ApiError } from './authClient';
