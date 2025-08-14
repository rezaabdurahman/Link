// User service layer for user profile operations
// Provides getUserProfile function with robust error handling reusing AuthApiClient pattern

import { apiClient, AuthServiceError, ApiError, getErrorMessage, isAuthError } from './authClient';
import { AuthUser } from '../types/index';

// API endpoints
const USER_ENDPOINTS = {
  profile: (userId: string) => `/users/profile/${userId}`,
  searchFriends: '/api/v1/users/friends/search',
} as const;

// User Profile Response Interface
// Extends the existing AuthUser type with additional user profile fields
export interface UserProfileResponse extends AuthUser {
  // Additional profile fields that might be available for other users
  readonly is_friend?: boolean;
  readonly mutual_friends_count?: number;
  readonly last_active?: string; // ISO string format
  readonly privacy_settings?: {
    readonly show_age: boolean;
    readonly show_location: boolean;
    readonly show_mutual_friends: boolean;
  };
}

// Public User Interface for search results
export interface PublicUser extends AuthUser {
  readonly is_friend?: boolean;
  readonly mutual_friends_count?: number;
  readonly last_active?: string; // ISO string format
}

/**
 * Get user profile by user ID
 * @param userId - The ID of the user whose profile to fetch
 * @returns Promise resolving to user profile data
 * @throws AuthServiceError with detailed error information
 */
export async function getUserProfile(userId: string): Promise<UserProfileResponse> {
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

    const response = await apiClient.get<UserProfileResponse>(
      USER_ENDPOINTS.profile(userId.trim())
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to fetch user profile due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Search for friends with optional pagination
 * @param query - The search query string
 * @param options - Optional pagination parameters
 * @returns Promise resolving to search results with friends array
 * @throws AuthServiceError with detailed error information
 */
export async function searchFriends(query: string, options?: {page?: number; limit?: number}) {
  const params = new URLSearchParams({ q: query.trim() });
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  return apiClient.get<{friends: PublicUser[]}>(`${USER_ENDPOINTS.searchFriends}?${params}`);
}

// Re-export shared error handling utilities for consistency
export { AuthServiceError, getErrorMessage, isAuthError } from './authClient';
export type { ApiError } from './authClient';

// Helper function to check if a user profile is accessible
export function isProfileAccessible(error: unknown): boolean {
  if (!isAuthError(error)) {
    return true;
  }
  
  const authError = error as AuthServiceError;
  return authError.error.type !== 'AUTHORIZATION_ERROR' || 
         authError.error.code !== 'ACCESS_DENIED';
}

// Helper function to get user-friendly profile error messages
export function getProfileErrorMessage(error: ApiError, userId?: string): string {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      if (error.field === 'userId') {
        return 'Invalid user ID provided';
      }
      return getErrorMessage(error);
    
    case 'AUTHORIZATION_ERROR':
      if (error.code === 'ACCESS_DENIED') {
        return userId 
          ? 'This user\'s profile is private or you don\'t have permission to view it'
          : 'You don\'t have permission to view this profile';
      }
      return getErrorMessage(error);
    
    case 'AUTHENTICATION_ERROR':
      return 'Please log in to view user profiles';
    
    default:
      return getErrorMessage(error);
  }
}
