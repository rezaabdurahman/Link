import { useEffect } from 'react';
import { create } from 'zustand';
import { subscriptionClient } from '../services/subscriptionClient';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'basic' | 'pro';
  price_cents: number;
  currency: string;
  features: {
    max_discovery_per_month: number;
    max_radius_km: number;
    unlimited_chats: boolean;
    priority_support: boolean;
  };
  is_active: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  current_period_start?: string;
  current_period_end?: string;
  canceled_at?: string;
  created_at: string;
}

export interface UsageMetrics {
  user_id: string;
  current_period: string;
  discovery_count: number;
  discovery_limit: number;
  radius_used_km: number;
  radius_limit_km: number;
  days_remaining: number;
}

export interface SubscriptionLimits {
  user_id: string;
  tier: 'basic' | 'pro';
  max_discovery_per_month: number;
  max_radius_km: number;
  remaining_discoveries: number;
  current_period_start: string;
  current_period_end: string;
  is_active: boolean;
}

interface SubscriptionStore {
  // State
  currentSubscription: UserSubscription | null;
  availablePlans: SubscriptionPlan[];
  usage: UsageMetrics | null;
  limits: SubscriptionLimits | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchSubscription: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchLimits: () => Promise<void>;
  createCheckoutSession: (tier: 'basic' | 'pro', successUrl: string, cancelUrl: string) => Promise<string>;
  createCustomerPortalSession: (returnUrl: string) => Promise<string>;
  cancelSubscription: (immediate?: boolean) => Promise<void>;
  checkFeatureAccess: (feature: string) => boolean;
  getRemainingDiscoveries: () => number;
  getMaxRadius: () => number;
  isProUser: () => boolean;
  clearError: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  // Initial state
  currentSubscription: null,
  availablePlans: [],
  usage: null,
  limits: null,
  loading: false,
  error: null,

  // Actions
  fetchSubscription: async () => {
    set({ loading: true, error: null });
    try {
      const data = await subscriptionClient.getCurrentSubscription();
      set({ 
        currentSubscription: data.subscription,
        usage: data.usage,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch subscription',
        loading: false 
      });
    }
  },

  fetchPlans: async () => {
    set({ loading: true, error: null });
    try {
      const data = await subscriptionClient.getPlans();
      set({ 
        availablePlans: data.plans,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch plans',
        loading: false 
      });
    }
  },

  fetchLimits: async () => {
    set({ loading: true, error: null });
    try {
      const data = await subscriptionClient.getUserLimits();
      set({ 
        limits: data.limits,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch limits',
        loading: false 
      });
    }
  },

  createCheckoutSession: async (tier, successUrl, cancelUrl) => {
    set({ loading: true, error: null });
    try {
      const response = await subscriptionClient.createCheckoutSession({
        tier,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      set({ loading: false });
      return response.checkout_url;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
        loading: false 
      });
      throw error;
    }
  },

  createCustomerPortalSession: async (returnUrl) => {
    set({ loading: true, error: null });
    try {
      const response = await subscriptionClient.createCustomerPortalSession({
        return_url: returnUrl,
      });
      set({ loading: false });
      return response.portal_url;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create portal session',
        loading: false 
      });
      throw error;
    }
  },

  cancelSubscription: async (immediate = false) => {
    set({ loading: true, error: null });
    try {
      await subscriptionClient.cancelSubscription(immediate);
      // Refresh subscription data
      await get().fetchSubscription();
      set({ loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to cancel subscription',
        loading: false 
      });
    }
  },

  checkFeatureAccess: (feature: string) => {
    const { limits } = get();
    if (!limits) return false;

    switch (feature) {
      case 'discovery':
        return limits.remaining_discoveries > 0;
      case 'radius_3km':
        return limits.max_radius_km >= 3.0;
      case 'priority_support':
        return limits.tier === 'pro';
      default:
        return false;
    }
  },

  getRemainingDiscoveries: () => {
    const { limits } = get();
    return limits?.remaining_discoveries ?? 0;
  },

  getMaxRadius: () => {
    const { limits } = get();
    return limits?.max_radius_km ?? 1.0;
  },

  isProUser: () => {
    const { currentSubscription } = get();
    return currentSubscription?.plan.tier === 'pro';
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Hook for easier usage in components
export const useSubscription = () => {
  const store = useSubscriptionStore();
  
  // Auto-fetch subscription data on first use
  useEffect(() => {
    if (!store.currentSubscription && !store.loading) {
      store.fetchSubscription();
      store.fetchLimits();
    }
  }, [store.currentSubscription, store.loading]);

  return store;
};

export default useSubscriptionStore;