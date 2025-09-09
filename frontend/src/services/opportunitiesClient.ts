import { apiClient, AuthServiceError, ApiError, getErrorMessage, isAuthError } from './authClient';

// Types matching the backend models
export interface Opportunity {
  id: string;
  user_id: string;
  title: string;
  description: string;
  opportunity_type: 'event' | 'person' | 'activity' | 'place';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  priority_score: number;
  metadata: Record<string, any>;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  activity_preferences: Record<string, number>;
  location_preferences: Record<string, any>;
  social_preferences: Record<string, any>;
  time_preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OpportunityFeedback {
  action: 'accepted' | 'rejected' | 'ignored';
  feedback_score?: number;
  interaction_time_seconds?: number;
}

export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  status: string;
}

export interface GenerateOpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  message: string;
}

export interface UserStats {
  feedback: {
    total_feedback: number;
    accepted_count: number;
    rejected_count: number;
    ignored_count: number;
    average_score: number;
    acceptance_rate: number;
  };
  bandit: {
    total_arms: number;
    total_impressions: number;
    total_successes: number;
    average_alpha: number;
    average_beta: number;
    overall_success_rate: number;
  };
  top_arms: Array<{
    arm_name: string;
    total_impressions: number;
    total_successes: number;
    success_rate: number;
    confidence_lower_bound: number;
    confidence_upper_bound: number;
    last_updated: string;
  }>;
  last_updated: string;
}

// API endpoints
const OPPORTUNITIES_ENDPOINTS = {
  list: '/opportunities',
  get: (id: string) => `/opportunities/${id}`,
  feedback: (id: string) => `/opportunities/${id}/feedback`,
  generate: '/opportunities/generate',
  stats: '/opportunities/stats',
  preferences: '/preferences', // Fixed: should be /preferences not /opportunities/preferences
} as const;

/**
 * Get opportunities for the current user
 */
export async function getOpportunities(
  status: 'pending' | 'accepted' | 'rejected' | 'expired' = 'pending',
  limit: number = 10
): Promise<OpportunitiesResponse> {
  try {
    const response = await apiClient.get(OPPORTUNITIES_ENDPOINTS.list, {
      params: { status, limit: limit.toString() }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting opportunities:', error);
    throw new AuthServiceError(getErrorMessage(error), 'OPPORTUNITIES_FETCH_ERROR');
  }
}

/**
 * Get a specific opportunity by ID
 */
export async function getOpportunity(id: string): Promise<Opportunity> {
  try {
    const response = await apiClient.get(OPPORTUNITIES_ENDPOINTS.get(id));
    return response.data;
  } catch (error) {
    console.error('Error getting opportunity:', error);
    throw new AuthServiceError(getErrorMessage(error), 'OPPORTUNITY_FETCH_ERROR');
  }
}

/**
 * Submit feedback for an opportunity
 */
export async function submitOpportunityFeedback(
  opportunityId: string,
  feedback: OpportunityFeedback
): Promise<{ message: string; action: string }> {
  try {
    const response = await apiClient.post(OPPORTUNITIES_ENDPOINTS.feedback(opportunityId), feedback);
    return response.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw new AuthServiceError(getErrorMessage(error), 'FEEDBACK_SUBMIT_ERROR');
  }
}

/**
 * Generate new opportunities for the user
 */
export async function generateOpportunities(): Promise<GenerateOpportunitiesResponse> {
  try {
    const response = await apiClient.post(OPPORTUNITIES_ENDPOINTS.generate, {});
    return response.data;
  } catch (error) {
    console.error('Error generating opportunities:', error);
    throw new AuthServiceError(getErrorMessage(error), 'OPPORTUNITIES_GENERATE_ERROR');
  }
}

/**
 * Get user statistics including bandit performance
 */
export async function getOpportunityStats(): Promise<UserStats> {
  try {
    const response = await apiClient.get(OPPORTUNITIES_ENDPOINTS.stats);
    return response.data;
  } catch (error) {
    console.error('Error getting opportunity stats:', error);
    throw new AuthServiceError(getErrorMessage(error), 'STATS_FETCH_ERROR');
  }
}

/**
 * Get user preferences
 */
export async function getUserOpportunityPreferences(): Promise<UserPreferences> {
  try {
    const response = await apiClient.get(OPPORTUNITIES_ENDPOINTS.preferences);
    return response.data;
  } catch (error) {
    console.error('Error getting preferences:', error);
    throw new AuthServiceError(getErrorMessage(error), 'PREFERENCES_FETCH_ERROR');
  }
}

/**
 * Update user preferences
 */
export async function updateUserOpportunityPreferences(preferences: Partial<UserPreferences>): Promise<{ message: string }> {
  try {
    const response = await apiClient.put(OPPORTUNITIES_ENDPOINTS.preferences, preferences);
    return response.data;
  } catch (error) {
    console.error('Error updating preferences:', error);
    throw new AuthServiceError(getErrorMessage(error), 'PREFERENCES_UPDATE_ERROR');
  }
}

/**
 * Accept an opportunity (convenience method)
 */
export async function acceptOpportunity(
  opportunityId: string,
  feedbackScore?: number,
  interactionTime?: number
): Promise<{ message: string; action: string }> {
  return submitOpportunityFeedback(opportunityId, {
    action: 'accepted',
    feedback_score: feedbackScore,
    interaction_time_seconds: interactionTime,
  });
}

/**
 * Reject an opportunity (convenience method)
 */
export async function rejectOpportunity(
  opportunityId: string,
  feedbackScore?: number,
  interactionTime?: number
): Promise<{ message: string; action: string }> {
  return submitOpportunityFeedback(opportunityId, {
    action: 'rejected',
    feedback_score: feedbackScore,
    interaction_time_seconds: interactionTime,
  });
}

/**
 * Update activity preference
 */
export async function updateActivityPreference(activity: string, score: number): Promise<{ message: string }> {
  // Get current preferences first
  const preferences = await getUserOpportunityPreferences();
  
  const updatedPreferences = {
    ...preferences,
    activity_preferences: {
      ...preferences.activity_preferences,
      [activity]: score,
    },
  };

  return updateUserOpportunityPreferences(updatedPreferences);
}

/**
 * Batch update activity preferences
 */
export async function updateActivityPreferences(
  activityScores: Record<string, number>
): Promise<{ message: string }> {
  const preferences = await getUserOpportunityPreferences();
  
  const updatedPreferences = {
    ...preferences,
    activity_preferences: {
      ...preferences.activity_preferences,
      ...activityScores,
    },
  };

  return updateUserOpportunityPreferences(updatedPreferences);
}