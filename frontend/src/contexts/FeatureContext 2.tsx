import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { featureService } from '../services/featureService';
import { env } from '../utils/env';

// Types
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

export interface FeatureContextType {
  // Feature flags
  flags: Record<string, FeatureFlag>;
  isFeatureEnabled: (key: string) => boolean;
  getFeatureValue: (key: string, defaultValue?: any) => any;
  getFeatureVariant: (key: string) => string | null;
  
  // Experiments
  experiments: Record<string, Experiment>;
  getExperiment: (key: string) => Experiment | null;
  isInExperiment: (key: string) => boolean;
  
  // State management
  loading: boolean;
  error: string | null;
  refreshFeatures: () => Promise<void>;
  
  // Event tracking
  trackEvent: (eventType: string, properties?: Record<string, any>) => void;
}

export interface UserContext {
  userId?: string;
  attributes?: Record<string, any>;
  environment?: string;
}

interface FeatureProviderProps {
  children: ReactNode;
  userContext?: UserContext;
  refreshInterval?: number; // in milliseconds, 0 to disable
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<FeatureProviderProps> = ({ 
  children, 
  userContext = {},
  refreshInterval = 5 * 60 * 1000 // 5 minutes default
}) => {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [experiments] = useState<Record<string, Experiment>>({});
  // Note: setExperiments will be used for experiment evaluation in future implementation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build evaluation context
  const buildEvaluationContext = () => ({
    // API Gateway handles user authentication and injects user context via headers
    // No need to pass user_id from frontend - it will be extracted from JWT by API Gateway
    environment: userContext.environment || env.APP_MODE,
    user_attributes: {
      ...userContext.attributes,
      app_version: env.APP_VERSION,
      user_agent: navigator.userAgent,
      timestamp: Date.now(),
    }
  });

  const fetchFeatures = async (): Promise<void> => {
    try {
      setError(null);
      
      const context = buildEvaluationContext();
      const result = await featureService.getAllFlags(context);
      
      if (result.flags) {
        setFlags(result.flags);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch feature flags:', err);
      setError('Failed to load feature flags');
      setLoading(false);
    }
  };

  const refreshFeatures = async () => {
    setLoading(true);
    await fetchFeatures();
  };

  // Feature flag methods
  const isFeatureEnabled = (key: string): boolean => {
    const flag = flags[key];
    return flag ? flag.enabled : false;
  };

  const getFeatureValue = (key: string, defaultValue: any = null): any => {
    const flag = flags[key];
    if (!flag || !flag.enabled) {
      return defaultValue;
    }
    return flag.value !== undefined ? flag.value : flag.enabled;
  };

  const getFeatureVariant = (key: string): string | null => {
    const flag = flags[key];
    return flag?.variant || null;
  };

  // Experiment methods
  const getExperiment = (key: string): Experiment | null => {
    return experiments[key] || null;
  };

  const isInExperiment = (key: string): boolean => {
    const experiment = experiments[key];
    return experiment ? experiment.in_experiment : false;
  };

  // Event tracking
  const trackEvent = async (eventType: string, properties: Record<string, any> = {}) => {
    try {
      await featureService.trackEvent({
        event_type: eventType,
        user_id: userContext.userId,
        properties: {
          ...properties,
          environment: userContext.environment || env.APP_MODE,
          timestamp: Date.now(),
        }
      });
    } catch (err) {
      console.error('Failed to track feature event:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchFeatures();
  }, [userContext.userId, userContext.environment]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchFeatures, refreshInterval);
      return () => clearInterval(interval);
    }
    // Return undefined explicitly for the else case
    return undefined;
  }, [refreshInterval]);

  // Track feature evaluations
  useEffect(() => {
    Object.entries(flags).forEach(([key, flag]) => {
      if (flag.enabled) {
        trackEvent('feature_evaluated', {
          feature_key: key,
          enabled: flag.enabled,
          variant: flag.variant,
          reason: flag.reason,
        });
      }
    });
  }, [flags]);

  const value: FeatureContextType = {
    flags,
    isFeatureEnabled,
    getFeatureValue,
    getFeatureVariant,
    experiments,
    getExperiment,
    isInExperiment,
    loading,
    error,
    refreshFeatures,
    trackEvent,
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = (): FeatureContextType => {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};