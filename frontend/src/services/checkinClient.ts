// Check-in service client for creating and managing user check-ins
// Follows the same error handling patterns as existing service clients

import { apiClient, AuthServiceError, ApiError, getErrorMessage, isAuthError } from './authClient';

// Extended API error type for check-in specific errors
export type CheckInApiError = ApiError | {
  type: 'CHECKIN_ERROR';
  message: string;
  code: 'CHECKIN_NOT_FOUND' | 'INVALID_PRIVACY_SETTING' | 'MEDIA_UPLOAD_FAILED' | 'LOCATION_INVALID';
};

// API endpoints
const CHECKIN_ENDPOINTS = {
  checkins: '/checkins',
  checkin: (id: string) => `/checkins/${id}`,
  publicCheckins: '/checkins/public',
  searchCheckins: '/checkins/search',
  userStats: '/checkins/stats',
  trendingTags: '/checkins/trending-tags',
} as const;

// Types matching backend models

export type Privacy = 'public' | 'friends' | 'private';
export type MediaType = 'image' | 'video';

export interface MediaAttachment {
  id: string;
  media_type: MediaType;
  file_name: string;
  file_url: string;
  thumbnail_url?: string;
  file_size?: number;
  duration_seconds?: number; // For videos
  mime_type?: string;
}

export interface LocationAttachment {
  id: string;
  location_name?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface TagAttachment {
  id: string;
  tag_name: string;
}

export interface FileAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
}

export interface VoiceNoteAttachment {
  id: string;
  file_name: string;
  file_url: string;
  duration_seconds: number;
  file_size?: number;
}

export interface CheckIn {
  id: string;
  user_id: string;
  text_content?: string;
  privacy: Privacy;
  media_attachments: MediaAttachment[];
  location?: LocationAttachment;
  tags: TagAttachment[];
  file_attachments: FileAttachment[];
  voice_note?: VoiceNoteAttachment;
  created_at: string;
  updated_at: string;
}

// Request types matching backend DTOs

export interface CreateCheckInRequest {
  text_content?: string;
  privacy: Privacy;
  media_attachments?: CreateMediaAttachment[];
  location?: CreateLocationAttachment;
  tags?: string[];
  file_attachments?: CreateFileAttachment[];
  voice_note?: CreateVoiceNoteAttachment;
}

export interface CreateMediaAttachment {
  media_type: MediaType;
  file_name: string;
  file_url: string;
  thumbnail_url?: string;
  file_size?: number;
  duration_seconds?: number;
  mime_type?: string;
}

export interface CreateLocationAttachment {
  location_name?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface CreateFileAttachment {
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
}

export interface CreateVoiceNoteAttachment {
  file_name: string;
  file_url: string;
  duration_seconds: number;
  file_size?: number;
}

export interface UpdateCheckInRequest {
  text_content?: string;
  privacy?: Privacy;
}

// Response types

export interface CheckInListResponse {
  checkins: CheckIn[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface UserCheckInStats {
  total_checkins: number;
  checkins_this_week: number;
  checkins_this_month: number;
  media_checkins: number;
  location_checkins: number;
  popular_tags: TagStats[];
}

export interface TagStats {
  tag_name: string;
  count: number;
}

// Filter options

export interface CheckInFilter {
  page?: number;
  page_size?: number;
  privacy?: Privacy;
  start_date?: string; // ISO string
  end_date?: string;   // ISO string
  has_media?: boolean;
  has_location?: boolean;
  tags?: string[];
}

/**
 * Create a new check-in
 * @param request - Check-in creation data
 * @returns Promise resolving to the created check-in
 * @throws AuthServiceError with detailed error information
 */
export async function createCheckIn(request: CreateCheckInRequest): Promise<CheckIn> {
  try {
    // Validate request
    if (!request.text_content && 
        (!request.media_attachments || request.media_attachments.length === 0) &&
        !request.location &&
        (!request.file_attachments || request.file_attachments.length === 0) &&
        !request.voice_note) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Check-in must have either text content or attachments',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!request.privacy) {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Privacy setting is required',
        field: 'privacy',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.post<CheckIn>(
      CHECKIN_ENDPOINTS.checkins,
      request
    );

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to create check-in due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get a specific check-in by ID
 * @param checkInId - The ID of the check-in to retrieve
 * @returns Promise resolving to the check-in data
 * @throws AuthServiceError with detailed error information
 */
export async function getCheckIn(checkInId: string): Promise<CheckIn> {
  try {
    if (!checkInId || typeof checkInId !== 'string' || checkInId.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Check-in ID is required and must be a non-empty string',
        field: 'checkInId',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.get<CheckIn>(
      CHECKIN_ENDPOINTS.checkin(checkInId.trim())
    );

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get check-in due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get user's check-ins with filtering and pagination
 * @param filter - Filter options for querying check-ins
 * @returns Promise resolving to paginated check-ins list
 * @throws AuthServiceError with detailed error information
 */
export async function getUserCheckIns(filter?: CheckInFilter): Promise<CheckInListResponse> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filter?.page) {
      params.append('page', filter.page.toString());
    }
    if (filter?.page_size) {
      params.append('page_size', filter.page_size.toString());
    }
    if (filter?.privacy) {
      params.append('privacy', filter.privacy);
    }
    if (filter?.start_date) {
      params.append('start_date', filter.start_date);
    }
    if (filter?.end_date) {
      params.append('end_date', filter.end_date);
    }
    if (filter?.has_media !== undefined) {
      params.append('has_media', filter.has_media.toString());
    }
    if (filter?.has_location !== undefined) {
      params.append('has_location', filter.has_location.toString());
    }
    if (filter?.tags && filter.tags.length > 0) {
      params.append('tags', JSON.stringify(filter.tags));
    }

    const queryString = params.toString();
    const endpoint = queryString 
      ? `${CHECKIN_ENDPOINTS.checkins}?${queryString}` 
      : CHECKIN_ENDPOINTS.checkins;

    const response = await apiClient.get<CheckInListResponse>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get user check-ins due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Update a check-in
 * @param checkInId - The ID of the check-in to update
 * @param request - Update data
 * @returns Promise resolving to the updated check-in
 * @throws AuthServiceError with detailed error information
 */
export async function updateCheckIn(checkInId: string, request: UpdateCheckInRequest): Promise<CheckIn> {
  try {
    if (!checkInId || typeof checkInId !== 'string' || checkInId.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Check-in ID is required and must be a non-empty string',
        field: 'checkInId',
        code: 'REQUIRED_FIELD',
      });
    }

    const response = await apiClient.put<CheckIn>(
      CHECKIN_ENDPOINTS.checkin(checkInId.trim()),
      request
    );

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to update check-in due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Delete a check-in
 * @param checkInId - The ID of the check-in to delete
 * @returns Promise that resolves when deletion is successful
 * @throws AuthServiceError with detailed error information
 */
export async function deleteCheckIn(checkInId: string): Promise<void> {
  try {
    if (!checkInId || typeof checkInId !== 'string' || checkInId.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Check-in ID is required and must be a non-empty string',
        field: 'checkInId',
        code: 'REQUIRED_FIELD',
      });
    }

    await apiClient.delete<void>(
      CHECKIN_ENDPOINTS.checkin(checkInId.trim())
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to delete check-in due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get public check-ins for discovery
 * @param filter - Filter options for querying public check-ins
 * @returns Promise resolving to paginated public check-ins list
 * @throws AuthServiceError with detailed error information
 */
export async function getPublicCheckIns(filter?: CheckInFilter): Promise<CheckInListResponse> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filter?.page) {
      params.append('page', filter.page.toString());
    }
    if (filter?.page_size) {
      params.append('page_size', filter.page_size.toString());
    }
    if (filter?.start_date) {
      params.append('start_date', filter.start_date);
    }
    if (filter?.end_date) {
      params.append('end_date', filter.end_date);
    }
    if (filter?.has_media !== undefined) {
      params.append('has_media', filter.has_media.toString());
    }
    if (filter?.has_location !== undefined) {
      params.append('has_location', filter.has_location.toString());
    }
    if (filter?.tags && filter.tags.length > 0) {
      params.append('tags', JSON.stringify(filter.tags));
    }

    const queryString = params.toString();
    const endpoint = queryString 
      ? `${CHECKIN_ENDPOINTS.publicCheckins}?${queryString}` 
      : CHECKIN_ENDPOINTS.publicCheckins;

    const response = await apiClient.get<CheckInListResponse>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get public check-ins due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Search check-ins by query
 * @param query - Search query (supports hashtags)
 * @param filter - Additional filter options
 * @returns Promise resolving to search results
 * @throws AuthServiceError with detailed error information
 */
export async function searchCheckIns(query: string, filter?: CheckInFilter): Promise<CheckInListResponse> {
  try {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new AuthServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Search query is required and must be a non-empty string',
        field: 'query',
        code: 'REQUIRED_FIELD',
      });
    }

    // Build query parameters
    const params = new URLSearchParams();
    params.append('q', query.trim());
    
    if (filter?.page) {
      params.append('page', filter.page.toString());
    }
    if (filter?.page_size) {
      params.append('page_size', filter.page_size.toString());
    }

    const endpoint = `${CHECKIN_ENDPOINTS.searchCheckins}?${params.toString()}`;
    const response = await apiClient.get<CheckInListResponse>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to search check-ins due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get user check-in statistics
 * @returns Promise resolving to user statistics
 * @throws AuthServiceError with detailed error information
 */
export async function getUserStats(): Promise<UserCheckInStats> {
  try {
    const response = await apiClient.get<UserCheckInStats>(
      CHECKIN_ENDPOINTS.userStats
    );
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get user statistics due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Get trending hashtags
 * @param limit - Number of trending tags to return
 * @returns Promise resolving to trending tags
 * @throws AuthServiceError with detailed error information
 */
export async function getTrendingTags(limit: number = 10): Promise<TagStats[]> {
  try {
    const params = new URLSearchParams();
    params.append('limit', Math.min(Math.max(1, limit), 100).toString()); // Clamp between 1-100

    const endpoint = `${CHECKIN_ENDPOINTS.trendingTags}?${params.toString()}`;
    const response = await apiClient.get<TagStats[]>(endpoint);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to get trending tags due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

// Helper functions

/**
 * Convert frontend CheckInData to backend CreateCheckInRequest
 * This helper bridges the gap between the frontend modal data and backend API
 */
export function convertCheckInDataToRequest(
  checkInData: {
    text: string;
    mediaAttachments: any[];
    fileAttachments: any[];
    voiceNote: any;
    locationAttachment: any;
    tags: any[];
  },
  privacy: Privacy = 'public'
): CreateCheckInRequest {
  const request: CreateCheckInRequest = {
    privacy,
  };

  // Add text content if provided
  if (checkInData.text && checkInData.text.trim() !== '') {
    request.text_content = checkInData.text.trim();
  }

  // Convert media attachments
  if (checkInData.mediaAttachments && checkInData.mediaAttachments.length > 0) {
    request.media_attachments = checkInData.mediaAttachments.map(media => ({
      media_type: media.type === 'video' ? 'video' : 'image',
      file_name: media.name || 'media',
      file_url: media.url,
      thumbnail_url: media.thumbnail,
      file_size: media.size,
      duration_seconds: media.duration,
      mime_type: media.mimeType,
    }));
  }

  // Convert location
  if (checkInData.locationAttachment) {
    request.location = {
      location_name: checkInData.locationAttachment.name || 'Current Location',
      latitude: checkInData.locationAttachment.coordinates.lat,
      longitude: checkInData.locationAttachment.coordinates.lng,
    };
  }

  // Convert file attachments
  if (checkInData.fileAttachments && checkInData.fileAttachments.length > 0) {
    request.file_attachments = checkInData.fileAttachments.map(file => ({
      file_name: file.name,
      file_url: file.url || '#', // TODO: Handle file upload
      file_size: file.size,
      mime_type: file.type,
    }));
  }

  // Convert voice note
  if (checkInData.voiceNote) {
    request.voice_note = {
      file_name: 'voice_note.wav',
      file_url: checkInData.voiceNote.url || '#', // TODO: Handle voice note upload
      duration_seconds: checkInData.voiceNote.duration,
    };
  }

  // Convert tags
  if (checkInData.tags && checkInData.tags.length > 0) {
    request.tags = checkInData.tags.map(tag => tag.label || tag);
  }

  return request;
}

// Error handling helpers

export function getCheckInErrorMessage(error: CheckInApiError): string {
  // Handle check-in specific errors
  if (error.type === 'CHECKIN_ERROR') {
    switch (error.code) {
      case 'CHECKIN_NOT_FOUND':
        return 'Check-in not found';
      case 'INVALID_PRIVACY_SETTING':
        return 'Invalid privacy setting';
      case 'MEDIA_UPLOAD_FAILED':
        return 'Failed to upload media. Please try again.';
      case 'LOCATION_INVALID':
        return 'Invalid location coordinates';
    }
  }
  
  // Handle standard API errors
  switch (error.code) {
    case 'ACCESS_DENIED':
      return 'You don\'t have permission to access this check-in';
    default:
      return getErrorMessage(error as ApiError);
  }
}

export function isCheckInError(error: unknown): error is AuthServiceError {
  return isAuthError(error);
}

// Re-export shared utilities
export { AuthServiceError, getErrorMessage, isAuthError } from './authClient';
export type { ApiError } from './authClient';