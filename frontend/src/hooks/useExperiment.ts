import { useCallback, useEffect, useState } from 'react';
import { useFeatures, Experiment } from '../contexts/FeatureContext';
import { featureService } from '../services/featureService';

/**
 * Hook to get experiment details
 */
export const useExperiment = (experimentKey: string): Experiment | null => {
  const { getExperiment } = useFeatures();
  return getExperiment(experimentKey);
};

/**
 * Hook to check if user is in an experiment
 */
export const useExperimentAssignment = (experimentKey: string): boolean => {
  const { isInExperiment } = useFeatures();
  return isInExperiment(experimentKey);
};

/**
 * Hook to get experiment variant
 */
export const useExperimentVariant = (experimentKey: string): string | null => {
  const experiment = useExperiment(experimentKey);
  return experiment?.variant || null;
};

/**
 * Hook to get experiment payload
 */
export const useExperimentPayload = <T = any>(experimentKey: string): T | null => {
  const experiment = useExperiment(experimentKey);
  return experiment?.payload as T || null;
};

/**
 * Hook for A/B test with variant-specific rendering
 */
export const useABTest = <T extends Record<string, any>>(
  experimentKey: string,
  variants: T
): T[keyof T] | null => {
  const experiment = useExperiment(experimentKey);
  
  if (!experiment || !experiment.in_experiment || !experiment.variant) {
    return variants.control || variants.default || null;
  }
  
  return variants[experiment.variant] || variants.control || variants.default || null;
};

/**
 * Hook for lazy experiment evaluation (useful for performance)
 */
export const useLazyExperiment = (experimentKey: string) => {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const evaluateExperiment = useCallback(async (context?: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await featureService.evaluateExperiment(experimentKey, context);
      setExperiment(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate experiment');
      setExperiment(null);
    } finally {
      setLoading(false);
    }
  }, [experimentKey]);
  
  return {
    experiment,
    loading,
    error,
    evaluateExperiment,
  };
};

/**
 * Hook for experiment conversion tracking
 */
export const useExperimentTracking = (experimentKey: string) => {
  const { trackEvent } = useFeatures();
  const experiment = useExperiment(experimentKey);
  
  const trackConversion = useCallback(async (
    conversionType: string,
    properties?: Record<string, any>
  ) => {
    if (!experiment || !experiment.in_experiment) {
      return;
    }
    
    await trackEvent('experiment_conversion', {
      experiment_key: experimentKey,
      variant: experiment.variant,
      conversion_type: conversionType,
      ...properties,
    });
  }, [experimentKey, experiment, trackEvent]);
  
  const trackExposure = useCallback(async (properties?: Record<string, any>) => {
    if (!experiment || !experiment.in_experiment) {
      return;
    }
    
    await trackEvent('experiment_exposure', {
      experiment_key: experimentKey,
      variant: experiment.variant,
      ...properties,
    });
  }, [experimentKey, experiment, trackEvent]);
  
  // Automatically track exposure when experiment is first loaded
  useEffect(() => {
    if (experiment?.in_experiment) {
      trackExposure();
    }
  }, [experiment?.in_experiment, trackExposure]);
  
  return {
    trackConversion,
    trackExposure,
    inExperiment: experiment?.in_experiment || false,
    variant: experiment?.variant || null,
  };
};