import { http } from 'msw';
import { 
  OnboardingStatusResponse, 
  OnboardingStatusType, 
  OnboardingStepType 
} from '../../services/onboardingClient';
import { extractUserId, generateId, now } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createSuccessResponse } from '../utils/responseBuilders';

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
  http.get('*/onboarding/status', ({ request }) => {
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
  http.post('*/onboarding/start', async ({ request }) => {
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
      
      return createSuccessResponse({
        user_id: userId,
        status: 'in_progress',
        current_step: initialStep,
        message: 'Onboarding started successfully',
      });
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // POST /onboarding/complete-step - Complete an onboarding step
  http.post('*/onboarding/complete-step', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as { 
        step: OnboardingStepType; 
        data?: any;
        next_step?: OnboardingStepType;
      };
      
      let onboardingStatus = mockOnboarding.get(userId);
      if (!onboardingStatus) {
        return createValidationError('No onboarding process found. Please start onboarding first.');
      }

      // Add step to completed steps if not already there
      if (!onboardingStatus.completed_steps.includes(body.step)) {
        onboardingStatus.completed_steps.push(body.step);
      }
      
      // Update current step or mark as completed
      if (body.next_step) {
        onboardingStatus.current_step = body.next_step;
        onboardingStatus.status = 'in_progress' as OnboardingStatusType;
      } else {
        onboardingStatus.status = 'completed' as OnboardingStatusType;
        delete onboardingStatus.current_step;
      }
      
      onboardingStatus.updated_at = now();
      mockOnboarding.set(userId, onboardingStatus);

      return createSuccessResponse({
        user_id: userId,
        completed_step: body.step,
        status: onboardingStatus.status,
        current_step: onboardingStatus.current_step,
        message: `Step "${body.step}" completed successfully`,
      });
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),

  // GET /users/me - Get current user profile
  http.get('*/users/me', ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    let profile = mockUserProfiles.get(userId);
    if (!profile) {
      // Create default profile
      profile = {
        id: userId,
        email: `${userId}@example.com`,
        username: userId,
        first_name: 'Demo',
        last_name: 'User',
        bio: null,
        profile_picture: null,
        location: null,
        email_verified: true,
        created_at: now(),
        updated_at: now(),
      };
      mockUserProfiles.set(userId, profile);
    }

    return createSuccessResponse(profile);
  }),

  // PUT /users/me - Update current user profile
  http.put('*/users/me', async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as {
        first_name?: string;
        last_name?: string;
        bio?: string;
        profile_picture?: string;
        location?: string;
      };
      
      let profile = mockUserProfiles.get(userId);
      if (!profile) {
        return createValidationError('User profile not found');
      }

      // Update profile with provided fields
      profile = {
        ...profile,
        ...body,
        updated_at: now(),
      };
      
      mockUserProfiles.set(userId, profile);

      return createSuccessResponse(profile);
    } catch (error) {
      return createValidationError('Invalid request body');
    }
  }),
];
