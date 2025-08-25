import { env } from '../utils/env';
import { ResilientFeatureService } from '../utils/featureFallback';

export interface EvaluationContext {
  user_id?: string;
  environment?: string;
  user_attributes?: Record<string, any>;
  custom?: Record<string, any>;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value?: any;
  variant?: string;
  reason: string;
  timestamp: string;
}

export interface Experiment {
  key: string;
  variant_id?: string;
  variant?: string;
  payload?: Record<string, any>;
  in_experiment: boolean;
  reason: string;
  timestamp: string;
}

export interface TrackEventRequest {
  event_type: string;
  user_id?: string;
  flag_key?: string;
  experiment_key?: string;
  variant_key?: string;
  properties?: Record<string, any>;
}

class BaseFeatureService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.API_BASE_URL;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add user ID from context if available
    const userContext = this.getUserContext();
    if (userContext.userId) {
      defaultHeaders['X-User-ID'] = userContext.userId;
    }
    if (userContext.environment) {
      defaultHeaders['X-Environment'] = userContext.environment;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Feature service request failed: ${endpoint}`, error);
      throw error;
    }
  }

  private getUserContext(): { userId?: string; environment?: string } {
    // The API Gateway handles JWT parsing and injects user context via headers
    // We don't need to parse tokens in the frontend - the backend will get user info from headers
    return {
      userId: undefined, // User ID will be extracted from JWT by API Gateway
      environment: env.APP_MODE,
    };
  }

  async evaluateFlag(flagKey: string, context?: EvaluationContext): Promise<FeatureFlag> {
    const params = new URLSearchParams();
    
    if (context?.user_id) {
      params.append('user_id', context.user_id);
    }
    if (context?.environment) {
      params.append('environment', context.environment);
    }
    if (context?.user_attributes) {
      Object.entries(context.user_attributes).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<FeatureFlag>(`/features/flags/${flagKey}/evaluate${query}`);
  }

  async evaluateFlags(flagKeys: string[], context?: EvaluationContext): Promise<{ flags: Record<string, FeatureFlag> }> {
    const body = {
      flag_keys: flagKeys,
      user_attributes: context?.user_attributes,
      custom: context?.custom,
    };

    const params = new URLSearchParams();
    if (context?.user_id) {
      params.append('user_id', context.user_id);
    }
    if (context?.environment) {
      params.append('environment', context.environment);
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    
    return this.request<{ flags: Record<string, FeatureFlag> }>(`/features/flags/evaluate${query}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getAllFlags(context?: EvaluationContext): Promise<{ flags: Record<string, FeatureFlag> }> {
    const params = new URLSearchParams();
    
    if (context?.user_id) {
      params.append('user_id', context.user_id);
    }
    if (context?.environment) {
      params.append('environment', context.environment);
    }
    if (context?.user_attributes) {
      Object.entries(context.user_attributes).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    
    // Try POST first for complex attributes, fallback to GET
    try {
      return await this.request<{ flags: Record<string, FeatureFlag> }>(`/features/flags${query}`, {
        method: 'POST',
        body: JSON.stringify({
          user_attributes: context?.user_attributes,
          custom: context?.custom,
        }),
      });
    } catch (error) {
      // Fallback to GET request
      return this.request<{ flags: Record<string, FeatureFlag> }>(`/features/flags${query}`);
    }
  }

  async evaluateExperiment(experimentKey: string, context?: EvaluationContext): Promise<Experiment> {
    const params = new URLSearchParams();
    
    if (context?.user_id) {
      params.append('user_id', context.user_id);
    }
    if (context?.environment) {
      params.append('environment', context.environment);
    }
    if (context?.user_attributes) {
      Object.entries(context.user_attributes).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Experiment>(`/features/experiments/${experimentKey}/evaluate${query}`);
  }

  async trackEvent(event: TrackEventRequest): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/features/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async invalidateCache(keys: string[] = []): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/features/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    });
  }
}

// Create the base service and wrap it with resilience
const baseFeatureService = new BaseFeatureService();
export const featureService = new ResilientFeatureService(baseFeatureService);