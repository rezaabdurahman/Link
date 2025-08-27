// User service layer for user profile operations
// Provides getUserProfile function with robust error handling reusing AuthApiClient pattern

import { apiClient, AuthServiceError, ApiError, getErrorMessage, isAuthError } from './authClient';
import { AuthUser } from '../types/index';

// API endpoints
const USER_ENDPOINTS = {
  myProfile: '/users/profile/me',
  updateProfile: '/users/profile',
  profile: (userId: string) => `/users/profile/${userId}`,
  searchFriends: '/users/friends/search',
  block: '/users/block',
  unblock: (userId: string) => `/users/block/${userId}`,
  blockedUsers: '/users/blocked',
} as const;

// Contact endpoints
const CONTACT_ENDPOINTS = {
  lookup: '/users/contacts/lookup',
  addContact: '/users/contacts',
  sendInvitation: '/users/invitations',
  sentInvitations: '/users/invitations/sent',
  acceptInvitation: '/users/invitations/accept',
  invitationDetails: (code: string) => `/users/invitations/${code}`,
} as const;

// Friend request endpoints
const FRIEND_ENDPOINTS = {
  sendRequest: '/users/friends/requests',
  receivedRequests: '/users/friends/requests/received',
  sentRequests: '/users/friends/requests/sent',
  acceptRequest: (requestId: string) => `/users/friends/requests/${requestId}/accept`,
  declineRequest: (requestId: string) => `/users/friends/requests/${requestId}/decline`,
  cancelRequest: (requestId: string) => `/users/friends/requests/${requestId}`,
  friends: '/users/friends',
  removeFriend: (userId: string) => `/users/friends/${userId}`,
  friendshipStatus: (userId: string) => `/users/friends/status/${userId}`,
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
  readonly show_name: boolean;
  readonly show_social_media: boolean;
  readonly show_montages: boolean;
  readonly show_checkins: boolean;
}

// Profile Visibility Type
export type ProfileVisibility = 'public' | 'private';

// User Profile Response Interface
// Extends the existing AuthUser type with additional user profile fields
export interface UserProfileResponse extends AuthUser {
  // Additional profile fields that might be available for other users
  readonly age?: number; // Calculated from date_of_birth, respecting privacy
  readonly interests: string[];
  readonly social_links: SocialLink[];
  readonly additional_photos: string[];
  readonly privacy_settings: PrivacySettings;
  readonly profile_visibility: ProfileVisibility;
  readonly is_friend?: boolean;
  readonly mutual_friends?: number; // Changed from mutual_friends_count to match backend
  readonly last_login_at?: string; // ISO string format, changed from last_active
}

// Public User Interface for search results
export interface PublicUser extends AuthUser {
  readonly privacy_settings: PrivacySettings;
  readonly profile_visibility?: ProfileVisibility;
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

// Friend Request Types
export interface FriendRequest {
  readonly id: string;
  readonly user: AuthUser;
  readonly message?: string;
  readonly status: 'pending' | 'accepted' | 'declined';
  readonly created_at: string;
}

export interface FriendshipStatus {
  readonly status: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self';
  readonly can_send_request: boolean;
}

export interface SendFriendRequestData {
  readonly requestee_id: string;
  readonly message?: string;
}

// Friend Request Functions

/**
 * Send a friend request to another user
 */
export async function sendFriendRequest(data: SendFriendRequestData): Promise<{ message: string; data: { id: string; requestee_id: string; status: string; created_at: string } }> {
  try {
    const response = await apiClient.post<{ message: string; data: { id: string; requestee_id: string; status: string; created_at: string } }>(
      FRIEND_ENDPOINTS.sendRequest,
      data
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to send friend request',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get received friend requests
 */
export async function getReceivedFriendRequests(options?: { status?: string; limit?: number; offset?: number }): Promise<{ data: FriendRequest[]; count: number; limit: number; offset: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `${FRIEND_ENDPOINTS.receivedRequests}?${queryString}` : FRIEND_ENDPOINTS.receivedRequests;
    
    const response = await apiClient.get<{ data: FriendRequest[]; count: number; limit: number; offset: number }>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get received friend requests',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get sent friend requests
 */
export async function getSentFriendRequests(options?: { status?: string; limit?: number; offset?: number }): Promise<{ data: FriendRequest[]; count: number; limit: number; offset: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `${FRIEND_ENDPOINTS.sentRequests}?${queryString}` : FRIEND_ENDPOINTS.sentRequests;
    
    const response = await apiClient.get<{ data: FriendRequest[]; count: number; limit: number; offset: number }>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get sent friend requests',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(requestId: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.put<{ message: string }>(
      FRIEND_ENDPOINTS.acceptRequest(requestId)
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to accept friend request',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(requestId: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.put<{ message: string }>(
      FRIEND_ENDPOINTS.declineRequest(requestId)
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to decline friend request',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Cancel a sent friend request
 */
export async function cancelFriendRequest(requestId: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.delete<{ message: string }>(
      FRIEND_ENDPOINTS.cancelRequest(requestId)
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to cancel friend request',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get user's friends list
 */
export async function getFriends(options?: { limit?: number; offset?: number }): Promise<{ data: PublicUser[]; count: number; limit: number; offset: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `${FRIEND_ENDPOINTS.friends}?${queryString}` : FRIEND_ENDPOINTS.friends;
    
    const response = await apiClient.get<{ data: PublicUser[]; count: number; limit: number; offset: number }>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get friends list',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Remove a friend
 */
export async function removeFriend(userId: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.delete<{ message: string }>(
      FRIEND_ENDPOINTS.removeFriend(userId)
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to remove friend',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get friendship status with another user
 */
export async function getFriendshipStatus(userId: string): Promise<{ data: FriendshipStatus }> {
  try {
    const response = await apiClient.get<{ data: FriendshipStatus }>(
      FRIEND_ENDPOINTS.friendshipStatus(userId)
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get friendship status',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

// Update Profile Request Interface
export interface UpdateProfileRequest {
  readonly first_name?: string;
  readonly last_name?: string;
  readonly bio?: string;
  readonly location?: string;
  readonly profile_picture?: string;
  readonly date_of_birth?: string; // ISO string format
  readonly interests?: string[];
  readonly social_links?: SocialLink[];
  readonly additional_photos?: string[];
  readonly privacy_settings?: PrivacySettings;
  readonly profile_visibility?: ProfileVisibility;
}

/**
 * Update the authenticated user's profile
 * @param updateData - The profile data to update
 * @returns Promise resolving to the updated user profile
 * @throws AuthServiceError with detailed error information
 */
export async function updateProfile(updateData: UpdateProfileRequest): Promise<UserProfileResponse> {
  try {
    // Validate required fields if present
    if (updateData.first_name !== undefined && updateData.first_name.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'First name cannot be empty',
        field: 'first_name',
        code: 'REQUIRED_FIELD',
      });
    }

    if (updateData.last_name !== undefined && updateData.last_name.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Last name cannot be empty',
        field: 'last_name',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.put<UserProfileResponse>(
      USER_ENDPOINTS.updateProfile,
      updateData
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to update profile due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

// Contact Management Types and Functions

// Contact lookup interfaces
export interface ContactLookupRequest {
  readonly identifier: string;
  readonly type: 'email' | 'phone';
}

export interface ContactLookupResponse {
  readonly found: boolean;
  readonly user?: {
    readonly id: string;
    readonly username: string;
    readonly first_name: string;
    readonly last_name?: string;
    readonly profile_picture?: string;
  };
}

// Add contact interfaces
export interface AddContactRequest {
  readonly user_id: string;
}

// Send invitation interfaces
export interface SendInvitationRequest {
  readonly identifier: string;
  readonly type: 'email' | 'phone';
  readonly message?: string;
}

export interface SendInvitationResponse {
  readonly message: string;
  readonly invitation_id: string;
}

// Contact invitation interface
export interface ContactInvitation {
  readonly id: string;
  readonly inviter_id: string;
  readonly identifier: string;
  readonly identifier_type: 'email' | 'phone';
  readonly invitation_code: string;
  readonly message?: string;
  readonly status: 'pending' | 'sent' | 'accepted' | 'expired';
  readonly sent_at?: string;
  readonly accepted_at?: string;
  readonly accepted_by_user_id?: string;
  readonly expires_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface GetSentInvitationsResponse {
  readonly invitations: ContactInvitation[];
  readonly count: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Look up a contact by email or phone number
 * @param request - The lookup request containing identifier and type
 * @returns Promise resolving to lookup response
 * @throws AuthServiceError with detailed error information
 */
export async function lookupContact(request: ContactLookupRequest): Promise<ContactLookupResponse> {
  try {
    if (!request.identifier || !request.type) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Identifier and type are required for contact lookup',
        code: 'REQUIRED_FIELD',
      });
    }

    if (request.type !== 'email' && request.type !== 'phone') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Type must be either "email" or "phone"',
        field: 'type',
        code: 'INVALID_FORMAT',
      });
    }

    const response = await apiClient.post<ContactLookupResponse>(
      CONTACT_ENDPOINTS.lookup,
      request
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to lookup contact due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Add an existing user as a contact (sends friend request)
 * @param request - The add contact request containing user ID
 * @returns Promise resolving when friend request is sent
 * @throws AuthServiceError with detailed error information
 */
export async function addContact(request: AddContactRequest): Promise<{ message: string }> {
  try {
    if (!request.user_id) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'User ID is required to add contact',
        field: 'user_id',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.post<{ message: string }>(
      CONTACT_ENDPOINTS.addContact,
      request
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to add contact due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Send an invitation to a non-existing user
 * @param request - The invitation request containing identifier, type, and optional message
 * @returns Promise resolving to invitation response
 * @throws AuthServiceError with detailed error information
 */
export async function sendInvitation(request: SendInvitationRequest): Promise<SendInvitationResponse> {
  try {
    if (!request.identifier || !request.type) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Identifier and type are required to send invitation',
        code: 'REQUIRED_FIELD',
      });
    }

    if (request.type !== 'email' && request.type !== 'phone') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Type must be either "email" or "phone"',
        field: 'type',
        code: 'INVALID_FORMAT',
      });
    }

    const response = await apiClient.post<SendInvitationResponse>(
      CONTACT_ENDPOINTS.sendInvitation,
      request
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to send invitation due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get sent invitations with pagination
 * @param options - Optional pagination parameters
 * @returns Promise resolving to sent invitations response
 * @throws AuthServiceError with detailed error information
 */
export async function getSentInvitations(options?: { limit?: number; offset?: number }): Promise<GetSentInvitationsResponse> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `${CONTACT_ENDPOINTS.sentInvitations}?${queryString}` : CONTACT_ENDPOINTS.sentInvitations;
    
    const response = await apiClient.get<GetSentInvitationsResponse>(endpoint);
    return response;
    
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get sent invitations due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Accept an invitation
 * @param invitationCode - The invitation code to accept
 * @returns Promise resolving when invitation is accepted
 * @throws AuthServiceError with detailed error information
 */
export async function acceptInvitation(invitationCode: string): Promise<{ message: string }> {
  try {
    if (!invitationCode) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Invitation code is required',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.post<{ message: string }>(
      CONTACT_ENDPOINTS.acceptInvitation,
      { invitation_code: invitationCode }
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to accept invitation due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get invitation details by code (public endpoint)
 * @param invitationCode - The invitation code to get details for
 * @returns Promise resolving to invitation details
 * @throws AuthServiceError with detailed error information
 */
export async function getInvitationDetails(invitationCode: string): Promise<any> {
  try {
    if (!invitationCode) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Invitation code is required',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.get<any>(
      CONTACT_ENDPOINTS.invitationDetails(invitationCode)
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get invitation details due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Helper function to get user-friendly contact error messages
 */
export function getContactErrorMessage(error: ApiError): string {
  // Use the message directly from the error, as the backend will provide user-friendly messages
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('rate limit') || message.includes('limit reached')) {
    return 'You have reached your invitation limit. Please try again later.';
  }
  if (message.includes('already friends')) {
    return 'You are already friends with this user.';
  }
  if (message.includes('already sent')) {
    return 'Friend request already sent to this user.';
  }
  if (message.includes('pending request')) {
    return 'You have a pending friend request from this user.';
  }
  if (message.includes('invitation') && message.includes('already')) {
    return 'Invitation already sent to this contact.';
  }
  if (message.includes('not found') || message.includes('expired')) {
    return 'Invitation not found or has expired.';
  }
  
  // Fall back to the original error message
  return getErrorMessage(error);
}
