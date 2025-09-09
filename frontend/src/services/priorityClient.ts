import { apiClient } from './authClient';

// Types for priority service API
export interface PriorityConversation {
  conversation_id: string;
  priority: number;
  score: number;
  explanation: string[];
  features?: {
    hours_since_last_inbound?: number;
    hours_since_last_outbound?: number;
    unread_count: number;
    days_since_last_contact?: number;
    reciprocity_gap: number;
    cadence_gap_days: number;
    inner_circle: boolean;
    special_date_flag: boolean;
    platform: string;
    needs_reply_prob: number;
    contains_date_action_prob: number;
    sentiment_score: number;
    relationship_tone: string;
  };
}

export interface PriorityResponse {
  conversations: PriorityConversation[];
  model_version: string;
  experiment_id?: string;
  generated_at: string;
  cache_hit?: boolean;
  debug_info?: {
    total_candidates: number;
    filtered_candidates: number;
    processing_time_ms: number;
    cache_hit_rate?: number;
    feature_extraction_ms: number;
    ranking_ms: number;
  };
}

export interface UserActionRequest {
  actionType: 'conversation_opened' | 'reply' | 'skip' | 'snooze' | 'archive';
  conversationId: string;
  metadata?: {
    created_new?: boolean;
    participant_id?: string;
    timestamp?: string;
    from_priority_sort?: boolean;
    position?: number;
    session_id?: string;
    model_version?: string;
  };
}

export interface UserSession {
  session_id: string;
  user_id: string;
  device_type?: string;
  start_time: string;
  last_activity: string;
  total_actions: number;
  actions_per_minute: number;
  session_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface PriorityClientOptions {
  conversationIds?: string[];
  limit?: number;
  includeContext?: boolean;
  device_type?: string;
}

// Priority API client functions
export const getPriorityRankings = async (options: PriorityClientOptions = {}): Promise<PriorityResponse> => {
  const params = new URLSearchParams();
  
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  
  if (options.conversationIds && options.conversationIds.length > 0) {
    params.append('conversation_ids', options.conversationIds.join(','));
  }
  
  if (options.includeContext) {
    params.append('include_context', 'true');
  }

  const url = `/api/v1/conversations/priority${params.toString() ? `?${params.toString()}` : ''}`;
  
  try {
    const response = await apiClient.get<PriorityResponse>(url);
    return response;
  } catch (error) {
    console.error('Failed to get priority rankings:', error);
    throw error;
  }
};

export const recordUserAction = async (action: UserActionRequest): Promise<{ status: string; message: string }> => {
  try {
    const response = await apiClient.post<{ status: string; message: string }>('/api/v1/conversations/priority/action', action);
    return response;
  } catch (error) {
    console.error('Failed to record user action:', error);
    throw error;
  }
};

export const refreshConversationData = async (): Promise<{ status: string; message: string; duration: string }> => {
  try {
    const response = await apiClient.post<{ status: string; message: string; duration: string }>('/api/v1/conversations/priority/refresh');
    return response;
  } catch (error) {
    console.error('Failed to refresh conversation data:', error);
    throw error;
  }
};

export const getUserSession = async (deviceType?: string): Promise<UserSession> => {
  const params = new URLSearchParams();
  
  if (deviceType) {
    params.append('device_type', deviceType);
  }

  const url = `/api/v1/conversations/priority/session${params.toString() ? `?${params.toString()}` : ''}`;
  
  try {
    const response = await apiClient.get<UserSession>(url);
    return response;
  } catch (error) {
    console.error('Failed to get user session:', error);
    throw error;
  }
};

// Utility functions
export const isPriorityServiceError = (error: any): error is { error: string; code: string } => {
  return error && typeof error === 'object' && 'error' in error && 'code' in error;
};

export const getPriorityServiceErrorMessage = (error: any): string => {
  if (isPriorityServiceError(error)) {
    return error.error;
  }
  return 'An unexpected error occurred with the priority service';
};

// Feature flag helpers
// Note: These should be replaced with proper useFeatureFlag hook in components
export const shouldUsePriorityService = (): boolean => {
  // Temporary implementation - should use proper feature flag service
  return process.env.NODE_ENV === 'development' || 
         process.env.REACT_APP_ENABLE_PRIORITY_SERVICE === 'true';
};

export const isDebugModeEnabled = (): boolean => {
  return process.env.NODE_ENV === 'development' || 
         process.env.REACT_APP_PRIORITY_DEBUG_MODE === 'true';
};

// Types are already exported via interface declarations above