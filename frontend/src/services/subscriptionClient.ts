import { SubscriptionPlan, UserSubscription, UsageMetrics, SubscriptionLimits } from '../stores/subscriptionStore';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface GetPlansResponse {
  plans: SubscriptionPlan[];
}

interface GetSubscriptionResponse {
  subscription: UserSubscription;
  usage: UsageMetrics;
}

interface GetLimitsResponse {
  limits: SubscriptionLimits;
}

interface CreateCheckoutRequest {
  tier: 'basic' | 'pro';
  success_url: string;
  cancel_url: string;
}

interface CreateCheckoutResponse {
  checkout_url: string;
  session_id: string;
}

interface CreatePortalRequest {
  return_url: string;
}

interface CreatePortalResponse {
  portal_url: string;
}

class SubscriptionClient {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    if (userId) {
      headers['X-User-ID'] = userId;
    }
    
    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || 
        errorData?.message || 
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  async getPlans(): Promise<GetPlansResponse> {
    return this.makeRequest<GetPlansResponse>('/api/v1/subscriptions/plans');
  }

  async getCurrentSubscription(): Promise<GetSubscriptionResponse> {
    return this.makeRequest<GetSubscriptionResponse>('/api/v1/subscriptions/current');
  }

  async getUserLimits(): Promise<GetLimitsResponse> {
    return this.makeRequest<GetLimitsResponse>('/api/v1/subscriptions/usage');
  }

  async createCheckoutSession(request: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return this.makeRequest<CreateCheckoutResponse>('/api/v1/subscriptions/create-checkout', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async createCustomerPortalSession(request: CreatePortalRequest): Promise<CreatePortalResponse> {
    return this.makeRequest<CreatePortalResponse>('/api/v1/subscriptions/portal', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async cancelSubscription(immediate = false): Promise<{ message: string }> {
    const params = immediate ? '?immediate=true' : '';
    return this.makeRequest<{ message: string }>(`/api/v1/subscriptions/cancel${params}`, {
      method: 'POST',
    });
  }
}

export const subscriptionClient = new SubscriptionClient();