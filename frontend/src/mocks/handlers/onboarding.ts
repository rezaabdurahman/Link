import { http } from 'msw';
import { 
  OnboardingStatusResponse, 
  OnboardingStatusType, 
  OnboardingStepType,
  StartOnboardingResponse,
  UpdateStepResponse,
  CompleteOnboardingResponse,
  SkipOnboardingResponse,
  SkipStepResponse,
  ProfileUpdateResponse
} from '../../services/onboardingClient';
import { extractUserId, now } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createSuccessResponse } from '../utils/responseBuilders';
import { buildApiUrl, API_ENDPOINTS } from '../utils/config';

// Mock database for onboarding
const mockOnboarding: Map<string, OnboardingStatusResponse> = new Map();
const mockUserProfiles: Map<string, any> = new Map();

// Initialize demo onboarding data
mockOnboarding.set('demo-user-1', {
  user_id: 'demo-user-1',
  status: 'not_started' as OnboardingStatusType,
  completed_steps: [],
  created_at: now(),
  updated_at: now(),
});

// Demo user profile
mockUserProfiles.set('demo-user-1', {
  id: 'demo-user-1',
  email: 'demo@example.com',
  username: 'demouser',
  first_name: 'Demo',
  last_name: 'User',
  bio: null,
  profile_picture: null,
  location: null,
  email_verified: true,
  created_at: now(),
  updated_at: now(),
});

export const handlers = [
  // GET /onboarding/status - Get onboarding status
  http.get(buildApiUrl(API_ENDPOINTS.ONBOARDING.status), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    let onboardingStatus = mockOnboarding.get(userId);
    
    // Create default onboarding status if it doesn't exist
    if (!onboardingStatus) {
      onboardingStatus = {
        user_id: userId,
        status: 'not_started' as OnboardingStatusType,
        completed_steps: [],
        created_at: now(),
        updated_at: now(),
      };
      mockOnboarding.set(userId, onboardingStatus);
    }

    return createSuccessResponse(onboardingStatus);
  }),

  // POST /onboarding/start - Start onboarding process
  http.post(buildApiUrl(API_ENDPOINTS.ONBOARDING.start), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { initial_step?: string };
      const initialStep = body.initial_step || 'profile_picture';
      
      const onboardingStatus: OnboardingStatusResponse = {
        user_id: userId,
        status: 'in_progress' as OnboardingStatusType,
        current_step: initialStep as OnboardingStepType,
        completed_steps: [] as OnboardingStepType[],
        created_at: now(),
        updated_at: now(),
      };
      
      mockOnboarding.set(userId, onboardingStatus);
      
      const response: StartOnboardingResponse = {
        user_id: userId,
        status: 'in_progress',
        current_step: initialStep as OnboardingStepType,
        message: 'Onboarding started successfully',
      };
      
      return createSuccessResponse(response);
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // POST /onboarding/step - Update onboarding step
  http.post(buildApiUrl(API_ENDPOINTS.ONBOARDING.step), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { step: string; data: Record<string, any> };
      
      if (!body.step) {
        return createValidationError('Step is required');
      }
      
      let onboardingStatus = mockOnboarding.get(userId);
      
      if (!onboardingStatus) {
        // Create if doesn't exist
        onboardingStatus = {
          user_id: userId,
          status: 'in_progress' as OnboardingStatusType,
          completed_steps: [],
          created_at: now(),
          updated_at: now(),
        };
      }
      
      // Add step to completed steps if not already there
      if (!onboardingStatus.completed_steps.includes(body.step as any)) {
        onboardingStatus.completed_steps.push(body.step as any);
      }
      
      // Determine next step
      const stepOrder = [
        'profile_picture',
        'bio', 
        'interests',
        'location_preferences',
        'privacy_settings',
        'notification_preferences',
        'welcome_tutorial'
      ];
      
      const currentIndex = stepOrder.indexOf(body.step);
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : null;
      
      onboardingStatus.current_step = nextStep as OnboardingStepType | undefined;
      onboardingStatus.updated_at = now();
      
      // If this is the last step, mark as completed
      if (!nextStep) {
        onboardingStatus.status = 'completed';
      }
      
      mockOnboarding.set(userId, onboardingStatus);
      
      // Update user profile with step data if needed
      if (body.data) {
        let userProfile = mockUserProfiles.get(userId);
        if (!userProfile) {
          userProfile = {
            id: userId,
            email: `user${userId}@example.com`,
            username: `user${userId}`,
            first_name: 'User',
            last_name: userId,
            bio: null,
            profile_picture: null,
            location: null,
            email_verified: true,
            created_at: now(),
            updated_at: now(),
          };
        }
        
        // Update profile based on step data
        if (body.step === 'profile_picture' && body.data.profile_picture) {
          userProfile.profile_picture = body.data.profile_picture;
        } else if (body.step === 'bio' && body.data.bio) {
          userProfile.bio = body.data.bio;
        }
        
        userProfile.updated_at = now();
        mockUserProfiles.set(userId, userProfile);
      }
      
      const response: UpdateStepResponse = {
        user_id: userId,
        step: body.step as OnboardingStepType,
        status: onboardingStatus.status,
        message: `Step ${body.step} completed successfully`,
      };
      
      return createSuccessResponse(response);
      
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // POST /onboarding/complete - Complete entire onboarding
  http.post(buildApiUrl(API_ENDPOINTS.ONBOARDING.complete), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    let onboardingStatus = mockOnboarding.get(userId);
    
    if (!onboardingStatus) {
      onboardingStatus = {
        user_id: userId,
        status: 'completed' as OnboardingStatusType,
        completed_steps: [
          'profile_picture',
          'bio', 
          'interests',
          'location_preferences',
          'privacy_settings',
          'notification_preferences',
          'welcome_tutorial'
        ] as any[],
        created_at: now(),
        updated_at: now(),
      };
    } else {
      onboardingStatus.status = 'completed';
      onboardingStatus.updated_at = now();
    }
    
    mockOnboarding.set(userId, onboardingStatus);
    
    const response: CompleteOnboardingResponse = {
      user_id: userId,
      status: 'completed',
      completed_at: now(),
      message: 'Onboarding completed successfully',
    };
    
    return createSuccessResponse(response);
  }),

  // POST /onboarding/skip - Skip entire onboarding
  http.post(buildApiUrl('/onboarding/skip'), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const onboardingStatus = {
      user_id: userId,
      status: 'skipped' as OnboardingStatusType,
      completed_steps: [],
      created_at: now(),
      updated_at: now(),
    };
    
    mockOnboarding.set(userId, onboardingStatus);
    
    const response: SkipOnboardingResponse = {
      user_id: userId,
      status: 'skipped',
      skipped_at: now(),
      message: 'Onboarding skipped successfully',
    };
    
    return createSuccessResponse(response);
  }),

  // POST /onboarding/skip-step - Skip specific step
  http.post(buildApiUrl('/onboarding/skip-step'), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { step: string };
      
      if (!body.step) {
        return createValidationError('Step is required');
      }
      
      let onboardingStatus = mockOnboarding.get(userId);
      
      if (!onboardingStatus) {
        onboardingStatus = {
          user_id: userId,
          status: 'in_progress' as OnboardingStatusType,
          completed_steps: [],
          created_at: now(),
          updated_at: now(),
        };
      }
      
      // Determine next step after skipping current one
      const stepOrder = [
        'profile_picture',
        'bio', 
        'interests',
        'location_preferences',
        'privacy_settings',
        'notification_preferences',
        'welcome_tutorial'
      ];
      
      const currentIndex = stepOrder.indexOf(body.step);
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : null;
      
      onboardingStatus.current_step = nextStep as OnboardingStepType | undefined;
      onboardingStatus.updated_at = now();
      
      // If this was the last step, mark as completed
      if (!nextStep) {
        onboardingStatus.status = 'completed';
      }
      
      mockOnboarding.set(userId, onboardingStatus);
      
      const response: SkipStepResponse = {
        user_id: userId,
        step: body.step as OnboardingStepType,
        status: onboardingStatus.status,
        message: `Step ${body.step} skipped successfully`,
      };
      
      return createSuccessResponse(response);
      
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // POST /users/profile - Update user profile (used during onboarding)
  http.post(buildApiUrl(API_ENDPOINTS.USERS.profile), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as {
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
      };
      
      let userProfile = mockUserProfiles.get(userId);
      
      if (!userProfile) {
        userProfile = {
          id: userId,
          email: `user${userId}@example.com`,
          username: `user${userId}`,
          first_name: 'User',
          last_name: userId,
          bio: null,
          profile_picture: null,
          location: null,
          email_verified: true,
          created_at: now(),
          updated_at: now(),
        };
      }
      
      // Update profile fields from request body
      if (body.bio !== undefined) {
        userProfile.bio = body.bio;
      }
      if (body.profile_picture !== undefined) {
        userProfile.profile_picture = body.profile_picture;
      }
      if (body.location) {
        userProfile.location = body.location.address;
      }
      
      userProfile.updated_at = now();
      mockUserProfiles.set(userId, userProfile);
      
      const response: ProfileUpdateResponse = {
        user: userProfile,
        message: 'Profile updated successfully',
      };
      
      return createSuccessResponse(response);
      
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),
];
