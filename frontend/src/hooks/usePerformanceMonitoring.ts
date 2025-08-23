// React hook for performance monitoring and Web Vitals tracking
// Provides easy integration with components for comprehensive observability

import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  trackPageLoad, 
  trackFeatureInteraction, 
  trackUserJourneyStep,
  trackCustomMetric,
} from '../utils/webVitals';
import { trackUserJourney, trackFeatureUsage } from '../utils/sentry';
import { 
  trackUserJourney as metricsTrackUserJourney, 
  trackFeatureUsage as metricsTrackFeatureUsage,
  trackAPICall,
} from '../utils/metricsExporter';

// Performance monitoring hook
export const usePerformanceMonitoring = (pageName?: string) => {
  const location = useLocation();
  const pageStartTime = useRef<number>(performance.now());
  const currentPageName = pageName || location.pathname.replace('/', '') || 'home';

  // Track page load performance
  useEffect(() => {
    pageStartTime.current = performance.now();
    trackPageLoad(currentPageName);
    
    // Track route changes
    trackUserJourney(`route_${currentPageName}`, {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location.pathname, currentPageName]);

  // Track feature interactions
  const trackFeature = useCallback((feature: string, action: string, metadata?: Record<string, any>) => {
    const startTime = performance.now();
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    // Track in both Sentry and Web Vitals
    trackFeatureUsage(feature, action, metadata);
    trackFeatureInteraction(feature, action);
    
    // Track in Prometheus metrics
    metricsTrackFeatureUsage(feature, action, environment);
    
    // Return a function to track completion time
    return (completionMetadata?: Record<string, any>) => {
      const duration = performance.now() - startTime;
      trackFeatureInteraction(feature, `${action}_complete`, duration);
      
      if (completionMetadata) {
        trackCustomMetric({
          name: `feature_${feature}_${action}_completion`,
          value: Math.round(duration),
          unit: 'ms',
          rating: duration > 1000 ? 'poor' : duration > 500 ? 'needs-improvement' : 'good',
          context: { ...metadata, ...completionMetadata },
        });
      }
    };
  }, []);

  // Track user journey steps
  const trackJourneyStep = useCallback((journey: string, step: string, metadata?: Record<string, any>) => {
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    trackUserJourneyStep(journey, step, {
      page: currentPageName,
      ...metadata,
    });
    
    // Track in Prometheus metrics
    metricsTrackUserJourney(journey, step, undefined, environment);
  }, [currentPageName]);

  // Track component mount/unmount performance
  const trackComponentLifecycle = useCallback((componentName: string) => {
    const mountTime = performance.now();
    
    trackCustomMetric({
      name: `component_${componentName}_mount`,
      value: Math.round(mountTime - pageStartTime.current),
      unit: 'ms',
      context: {
        component: componentName,
        page: currentPageName,
      },
    });

    // Return cleanup function
    return () => {
      const unmountTime = performance.now();
      const lifecycleDuration = unmountTime - mountTime;
      
      trackCustomMetric({
        name: `component_${componentName}_lifecycle`,
        value: Math.round(lifecycleDuration),
        unit: 'ms',
        context: {
          component: componentName,
          page: currentPageName,
        },
      });
    };
  }, [currentPageName]);

  // Track async operations
  const trackAsyncOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      trackCustomMetric({
        name: `async_${operationName}_success`,
        value: Math.round(duration),
        unit: 'ms',
        rating: duration > 2000 ? 'poor' : duration > 1000 ? 'needs-improvement' : 'good',
        context: {
          operation: operationName,
          page: currentPageName,
          success: true,
          ...metadata,
        },
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      trackCustomMetric({
        name: `async_${operationName}_error`,
        value: Math.round(duration),
        unit: 'ms',
        rating: 'poor',
        context: {
          operation: operationName,
          page: currentPageName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          ...metadata,
        },
      });
      
      throw error;
    }
  }, [currentPageName]);

  return {
    trackFeature,
    trackJourneyStep,
    trackComponentLifecycle,
    trackAsyncOperation,
    currentPageName,
  };
};

// Hook for tracking form performance
export const useFormPerformanceMonitoring = (formName: string) => {
  const { trackFeature, trackJourneyStep } = usePerformanceMonitoring();
  const formStartTime = useRef<number | null>(null);
  const fieldInteractionTimes = useRef<Record<string, number>>({});

  // Track form start
  const startForm = useCallback(() => {
    formStartTime.current = performance.now();
    trackJourneyStep('form_interaction', 'form_start', { form: formName });
  }, [formName, trackJourneyStep]);

  // Track field interactions
  const trackFieldInteraction = useCallback((fieldName: string, action: 'focus' | 'blur' | 'change') => {
    const now = performance.now();
    
    if (action === 'focus') {
      fieldInteractionTimes.current[fieldName] = now;
    } else if (action === 'blur' && fieldInteractionTimes.current[fieldName]) {
      const duration = now - fieldInteractionTimes.current[fieldName];
      
      trackCustomMetric({
        name: `form_field_interaction`,
        value: Math.round(duration),
        unit: 'ms',
        context: {
          form: formName,
          field: fieldName,
          duration,
        },
      });
    }
    
    trackFeature(`form_${formName}`, `field_${action}`, { field: fieldName });
  }, [formName, trackFeature]);

  // Track form submission
  const trackFormSubmission = useCallback((success: boolean, errors?: string[]) => {
    if (formStartTime.current) {
      const totalTime = performance.now() - formStartTime.current;
      
      trackCustomMetric({
        name: `form_completion`,
        value: Math.round(totalTime),
        unit: 'ms',
        rating: success ? 'good' : 'poor',
        context: {
          form: formName,
          success,
          errors,
          totalTime,
        },
      });

      trackJourneyStep('form_interaction', success ? 'form_success' : 'form_error', {
        form: formName,
        errors,
        totalTime,
      });
    }
  }, [formName, trackJourneyStep]);

  // Track form abandonment
  const trackFormAbandonment = useCallback((reason?: string) => {
    if (formStartTime.current) {
      const timeSpent = performance.now() - formStartTime.current;
      
      trackCustomMetric({
        name: `form_abandonment`,
        value: Math.round(timeSpent),
        unit: 'ms',
        rating: 'poor',
        context: {
          form: formName,
          reason,
          timeSpent,
        },
      });

      trackJourneyStep('form_interaction', 'form_abandon', {
        form: formName,
        reason,
        timeSpent,
      });
    }
  }, [formName, trackJourneyStep]);

  return {
    startForm,
    trackFieldInteraction,
    trackFormSubmission,
    trackFormAbandonment,
  };
};

// Hook for tracking API call performance
export const useAPIPerformanceMonitoring = () => {
  const { trackAsyncOperation } = usePerformanceMonitoring();

  const trackAPI = useCallback(async <T>(
    endpoint: string,
    method: string,
    apiCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    const startTime = performance.now();
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    try {
      const result = await trackAsyncOperation(
        `api_${method.toLowerCase()}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
        apiCall,
        {
          endpoint,
          method,
          ...metadata,
        }
      );
      
      const duration = performance.now() - startTime;
      
      // Track successful API call in Prometheus
      trackAPICall(endpoint, method, 200, duration, environment);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
      
      // Track failed API call in Prometheus
      trackAPICall(endpoint, method, status, duration, environment);
      
      throw error;
    }
  }, [trackAsyncOperation]);

  return { trackAPICall: trackAPI };
};

// Hook for tracking user interaction performance
export const useInteractionPerformanceMonitoring = () => {
  const { trackFeature } = usePerformanceMonitoring();

  // Track click interactions
  const trackClick = useCallback((elementName: string, metadata?: Record<string, any>) => {
    const completionTracker = trackFeature('user_interaction', 'click', {
      element: elementName,
      ...metadata,
    });

    // Return function to track any post-click processing
    return completionTracker;
  }, [trackFeature]);

  // Track scroll performance
  const trackScroll = useCallback(() => {
    let scrollStartTime = performance.now();
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      
      scrollTimeout = setTimeout(() => {
        const scrollDuration = performance.now() - scrollStartTime;
        
        trackCustomMetric({
          name: 'scroll_interaction',
          value: Math.round(scrollDuration),
          unit: 'ms',
          context: {
            scrollY: window.scrollY,
            viewportHeight: window.innerHeight,
            documentHeight: document.documentElement.scrollHeight,
          },
        });
      }, 150); // Debounce scroll end detection
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  return {
    trackClick,
    trackScroll,
  };
};