// User service layer for user profile operations
// Provides getUserProfile function with robust error handling reusing AuthApiClient pattern

import { apiClient, AuthServiceError, ApiError, getErrorMessage, isAuthError } from './authClient';
import { AuthUser } from '../types/index';

// API endpoints
const USER_ENDPOINTS = {
  myProfile: '/users/profile/me',
  profile: (userId: string) => `/users/profile/${userId}`,
  searchFriends: '/users/friends/search',
  block: '/users/block',
  unblock: (userId: string) => `/users/block/${userId}`,
  blockedUsers: '/users/blocked',
} as const;

// Social Link Interface
export interface SocialLink {
  readonly platform: string;
  readonly url: string;
  readonly username?: string;
}

// Privacy Settings Interface
export interface PrivacySettings {
  readonly show_age: boolean;
  readonly show_location: boolean;
  readonly show_mutual_friends: boolean;
}

// User Profile Response Interface
// Extends the existing AuthUser type with additional user profile fields
export interface UserProfileResponse extends AuthUser {
  // Additional profile fields that might be available for other users
  readonly age?: number; // Calculated from date_of_birth, respecting privacy
  readonly interests: string[];
  readonly social_links: SocialLink[];
  readonly additional_photos: string[];
  readonly privacy_settings: PrivacySettings;
  readonly is_friend?: boolean;
  readonly mutual_friends?: number; // Changed from mutual_friends_count to match backend
  readonly last_login_at?: string; // ISO string format, changed from last_active
}

// Public User Interface for search results
export interface PublicUser extends AuthUser {
  readonly is_friend?: boolean;
  readonly mutual_friends_count?: number;
  readonly last_active?: string; // ISO string format
}

/**
 * Get the authenticated user's own profile
 * @returns Promise resolving to the current user's complete profile data
 * @throws AuthServiceError with detailed error information
 */
export async function getMyProfile(): Promise<UserProfileResponse> {
  try {
    const response = await apiClient.get<UserProfileResponse>(
      USER_ENDPOINTS.myProfile
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to fetch your profile due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
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

/**
 * Block a user
 * @param userId - The ID of the user to block
 * @returns Promise resolving when user is successfully blocked
 * @throws AuthServiceError with detailed error information
 */
export async function blockUser(userId: string): Promise<void> {
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

    await apiClient.post<void>(USER_ENDPOINTS.block, {
      user_id: userId.trim()
    });
    
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to block user due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Unblock a user
 * @param userId - The ID of the user to unblock
 * @returns Promise resolving when user is successfully unblocked
 * @throws AuthServiceError with detailed error information
 */
export async function unblockUser(userId: string): Promise<void> {
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

    await apiClient.delete<void>(USER_ENDPOINTS.unblock(userId.trim()));
    
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to unblock user due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get list of blocked users
 * @param options - Optional pagination parameters
 * @returns Promise resolving to list of blocked users
 * @throws AuthServiceError with detailed error information
 */
export async function getBlockedUsers(options?: {page?: number; limit?: number}): Promise<PublicUser[]> {
  try {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `${USER_ENDPOINTS.blockedUsers}?${queryString}` : USER_ENDPOINTS.blockedUsers;
    
    const response = await apiClient.get<{blocked_users: PublicUser[]}>(endpoint);
    return response.blocked_users;
    
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to fetch blocked users due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Helper function to get user-friendly blocking error messages
 */
export function getBlockingErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'BLOCK_EXISTS':
      return 'This user is already blocked';
    case 'BLOCK_NOT_FOUND':
      return 'This user is not currently blocked';
    case 'CANNOT_BLOCK_SELF':
      return 'You cannot block yourself';
    case 'USER_BLOCKED':
      return 'This action is not available due to blocking restrictions';
    default:
      return getProfileErrorMessage(error);
  }
}
