// Onboarding service layer for API interactions
// Provides functions for managing user onboarding flow with robust error handling

import { apiClient, AuthServiceError } from './authClient';

// Onboarding API endpoints
const ONBOARDING_ENDPOINTS = {
  status: '/onboarding/status',
  start: '/onboarding/start',
  updateStep: '/onboarding/step',
  complete: '/onboarding/complete',
  skip: '/onboarding/skip',
  skipStep: '/onboarding/skip-step',
  profile: '/users/profile',
} as const;

// Onboarding Step Types
export type OnboardingStepType = 
  | 'profile_picture'
  | 'bio'
  | 'interests'
  | 'location_preferences'
  | 'privacy_settings'
  | 'notification_preferences'
  | 'welcome_tutorial';

// Onboarding Status Enum
export type OnboardingStatusType = 'not_started' | 'in_progress' | 'completed' | 'skipped';

// Request/Response Types
export interface OnboardingStatusResponse {
  user_id: string;
  status: OnboardingStatusType;
  current_step?: OnboardingStepType;
  completed_steps: OnboardingStepType[];
  created_at: string;
  updated_at: string;
}

export interface StartOnboardingRequest {
  initial_step?: OnboardingStepType;
}

export interface StartOnboardingResponse {
  user_id: string;
  status: OnboardingStatusType;
  current_step: OnboardingStepType;
  message: string;
}

export interface UpdateStepRequest {
  step: OnboardingStepType;
  data: Record<string, any>; // Flexible data structure for different step types
}

export interface UpdateStepResponse {
  user_id: string;
  step: OnboardingStepType;
  status: OnboardingStatusType;
  message: string;
}

export interface CompleteOnboardingResponse {
  user_id: string;
  status: OnboardingStatusType;
  completed_at: string;
  message: string;
}

export interface SkipOnboardingResponse {
  user_id: string;
  status: OnboardingStatusType;
  skipped_at: string;
  message: string;
}

export interface SkipStepRequest {
  step: OnboardingStepType;
}

export interface SkipStepResponse {
  user_id: string;
  step: OnboardingStepType;
  status: OnboardingStatusType;
  message: string;
}

// Profile Update Types (for onboarding steps)
export interface ProfileUpdateRequest {
  bio?: string;
  profile_picture?: string;
  interests?: string[];
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  privacy_settings?: {
    profile_visibility: 'public' | 'friends' | 'private';
    location_sharing: boolean;
    activity_status: boolean;
  };
  notification_preferences?: {
    push_notifications: boolean;
    email_notifications: boolean;
    sms_notifications: boolean;
    marketing_emails: boolean;
  };
}

export interface ProfileUpdateResponse {
  user: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    bio?: string | null;
    profile_picture?: string | null;
    location?: string | null;
    email_verified: boolean;
    created_at: string;
    updated_at: string;
  };
  message: string;
}

// Onboarding service functions

/**
 * Get current onboarding status for authenticated user
 * @returns Promise resolving to onboarding status
 * @throws AuthServiceError with detailed error information
 */
export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  try {
    const response = await apiClient.get<OnboardingStatusResponse>(ONBOARDING_ENDPOINTS.status);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to fetch onboarding status due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Start the onboarding process for authenticated user
 * @param request Optional initial step configuration
 * @returns Promise resolving to started onboarding status
 * @throws AuthServiceError with detailed error information
 */
export async function startOnboarding(request: StartOnboardingRequest = {}): Promise<StartOnboardingResponse> {
  try {
    const response = await apiClient.post<StartOnboardingResponse>(ONBOARDING_ENDPOINTS.start, request);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to start onboarding due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Update a specific onboarding step
 * @param request Step data to update
 * @returns Promise resolving to updated step status
 * @throws AuthServiceError with detailed error information
 */
export async function updateOnboardingStep(request: UpdateStepRequest): Promise<UpdateStepResponse> {
  try {
    const response = await apiClient.post<UpdateStepResponse>(ONBOARDING_ENDPOINTS.updateStep, request);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to update onboarding step due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Complete the entire onboarding process
 * @returns Promise resolving to completion status
 * @throws AuthServiceError with detailed error information
 */
export async function completeOnboarding(): Promise<CompleteOnboardingResponse> {
  try {
    const response = await apiClient.post<CompleteOnboardingResponse>(ONBOARDING_ENDPOINTS.complete);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to complete onboarding due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Skip the entire onboarding process
 * @returns Promise resolving to skip status
 * @throws AuthServiceError with detailed error information
 */
export async function skipOnboarding(): Promise<SkipOnboardingResponse> {
  try {
    const response = await apiClient.post<SkipOnboardingResponse>(ONBOARDING_ENDPOINTS.skip);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to skip onboarding due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Skip a specific onboarding step
 * @param request Step to skip
 * @returns Promise resolving to skip status
 * @throws AuthServiceError with detailed error information
 */
export async function skipOnboardingStep(request: SkipStepRequest): Promise<SkipStepResponse> {
  try {
    const response = await apiClient.post<SkipStepResponse>(ONBOARDING_ENDPOINTS.skipStep, request);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to skip onboarding step due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Update user profile (used during onboarding steps)
 * @param request Profile data to update
 * @returns Promise resolving to updated profile
 * @throws AuthServiceError with detailed error information
 */
export async function updateProfile(request: ProfileUpdateRequest): Promise<ProfileUpdateResponse> {
  try {
    const response = await apiClient.post<ProfileUpdateResponse>(ONBOARDING_ENDPOINTS.profile, request);
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

// Helper functions for step management

/**
 * Check if a specific step is completed
 * @param status Onboarding status response
 * @param step Step to check
 * @returns Boolean indicating if step is completed
 */
export function isStepCompleted(status: OnboardingStatusResponse, step: OnboardingStepType): boolean {
  return status.completed_steps.includes(step);
}

/**
 * Get the next step in the onboarding flow
 * @param currentStep Current step
 * @returns Next step or null if at the end
 */
export function getNextStep(currentStep: OnboardingStepType): OnboardingStepType | null {
  const stepOrder: OnboardingStepType[] = [
    'profile_picture',
    'bio',
    'interests',
    'location_preferences',
    'privacy_settings',
    'notification_preferences',
    'welcome_tutorial',
  ];

  const currentIndex = stepOrder.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
    return null;
  }

  return stepOrder[currentIndex + 1];
}

/**
 * Get the previous step in the onboarding flow
 * @param currentStep Current step
 * @returns Previous step or null if at the beginning
 */
export function getPreviousStep(currentStep: OnboardingStepType): OnboardingStepType | null {
  const stepOrder: OnboardingStepType[] = [
    'profile_picture',
    'bio',
    'interests',
    'location_preferences',
    'privacy_settings',
    'notification_preferences',
    'welcome_tutorial',
  ];

  const currentIndex = stepOrder.indexOf(currentStep);
  if (currentIndex <= 0) {
    return null;
  }

  return stepOrder[currentIndex - 1];
}

/**
 * Calculate onboarding progress as a percentage
 * @param status Onboarding status response
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(status: OnboardingStatusResponse): number {
  const totalSteps = 7; // Total number of onboarding steps
  const completedCount = status.completed_steps.length;
  return Math.round((completedCount / totalSteps) * 100);
}

/**
 * Get step display name for UI
 * @param step Step type
 * @returns Human-readable step name
 */
export function getStepDisplayName(step: OnboardingStepType): string {
  const stepNames: Record<OnboardingStepType, string> = {
    profile_picture: 'Profile Picture',
    bio: 'About You',
    interests: 'Your Interests',
    location_preferences: 'Location Settings',
    privacy_settings: 'Privacy Settings',
    notification_preferences: 'Notifications',
    welcome_tutorial: 'Welcome Tutorial',
  };

  return stepNames[step] || step;
}

/**
 * Get step description for UI
 * @param step Step type
 * @returns Step description text
 */
export function getStepDescription(step: OnboardingStepType): string {
  const stepDescriptions: Record<OnboardingStepType, string> = {
    profile_picture: 'Add a profile picture to help others recognize you',
    bio: 'Tell others a bit about yourself',
    interests: 'Select topics and activities you enjoy',
    location_preferences: 'Set your location and privacy preferences',
    privacy_settings: 'Configure who can see your profile and activity',
    notification_preferences: 'Choose how you want to be notified',
    welcome_tutorial: 'Learn how to use Link effectively',
  };

  return stepDescriptions[step] || '';
}

/**
 * Get step number for UI
 * @param step Step type
 * @returns Step number (1-7)
 */
export function getStepNumber(step: OnboardingStepType): number {
  const stepOrder: OnboardingStepType[] = [
    'profile_picture',
    'bio',
    'interests',
    'location_preferences',
    'privacy_settings',
    'notification_preferences',
    'welcome_tutorial',
  ];

  const index = stepOrder.indexOf(step);
  return index >= 0 ? index + 1 : 1;
}
