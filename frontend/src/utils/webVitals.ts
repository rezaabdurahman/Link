// Web Vitals tracking and reporting utility
// Integrates with Sentry for performance monitoring and alerting

import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';
import { captureMessage, addBreadcrumb } from './sentry';
import { trackWebVital } from './metricsExporter';

// Performance thresholds based on Core Web Vitals recommendations
export const WEB_VITALS_THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },     // First Contentful Paint
  LCP: { good: 2500, poor: 4000 },     // Largest Contentful Paint
  FID: { good: 100, poor: 300 },       // First Input Delay  
  CLS: { good: 0.1, poor: 0.25 },      // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 },     // Time to First Byte
} as const;

// Web Vitals rating function
export const getVitalRating = (vital: keyof typeof WEB_VITALS_THRESHOLDS, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const thresholds = WEB_VITALS_THRESHOLDS[vital];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
};

// Custom metrics tracking
interface CustomMetric {
  name: string;
  value: number;
  unit: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  context?: Record<string, any>;
}

// Track custom business metrics
export const trackCustomMetric = (metric: CustomMetric) => {
  addBreadcrumb(
    `${metric.name}: ${metric.value}${metric.unit}`,
    'custom-metric',
    metric.rating === 'poor' ? 'warning' : 'info'
  );

  // Report poor performance as issues
  if (metric.rating === 'poor') {
    captureMessage(
      `Poor ${metric.name} performance: ${metric.value}${metric.unit}`,
      'warning'
    );
  }
};

// Page load performance tracking
export const trackPageLoad = (pageName: string) => {
  if (!('performance' in window)) return;

  const startTime = performance.now();
  
  // Track when page becomes interactive
  const trackInteractive = () => {
    const interactiveTime = performance.now() - startTime;
    
    trackCustomMetric({
      name: `page_interactive_${pageName}`,
      value: Math.round(interactiveTime),
      unit: 'ms',
      rating: interactiveTime > 3000 ? 'poor' : interactiveTime > 1500 ? 'needs-improvement' : 'good',
      context: { page: pageName },
    });
    
    // Also track in Prometheus metrics
    // metricsTrackPageLoad(pageName, interactiveTime, environment);
  };

  // Track when all resources are loaded  
  const trackComplete = () => {
    const completeTime = performance.now() - startTime;
    
    trackCustomMetric({
      name: `page_complete_${pageName}`,
      value: Math.round(completeTime),
      unit: 'ms',
      rating: completeTime > 5000 ? 'poor' : completeTime > 2500 ? 'needs-improvement' : 'good',
      context: { page: pageName },
    });
  };

  // Use appropriate timing based on document state
  if (document.readyState === 'complete') {
    trackComplete();
  } else if (document.readyState === 'interactive') {
    trackInteractive();
    window.addEventListener('load', trackComplete, { once: true });
  } else {
    document.addEventListener('DOMContentLoaded', trackInteractive, { once: true });
    window.addEventListener('load', trackComplete, { once: true });
  }
};

// Feature interaction tracking
export const trackFeatureInteraction = (feature: string, action: string, duration?: number) => {
  const metric: CustomMetric = {
    name: `feature_${feature}_${action}`,
    value: duration || 0,
    unit: duration ? 'ms' : 'count',
    context: {
      feature,
      action,
      timestamp: Date.now(),
    },
  };

  if (duration) {
    metric.rating = duration > 1000 ? 'poor' : duration > 500 ? 'needs-improvement' : 'good';
  }

  trackCustomMetric(metric);
};

// Network performance tracking
export const trackNetworkTiming = (request: {
  url: string;
  method: string;
  status: number;
  duration: number;
  size?: number;
}) => {
  const { url, method, status, duration, size } = request;
  
  // Track request duration
  trackCustomMetric({
    name: `network_${method.toLowerCase()}_duration`,
    value: Math.round(duration),
    unit: 'ms',
    rating: duration > 2000 ? 'poor' : duration > 1000 ? 'needs-improvement' : 'good',
    context: {
      url: url.replace(/https?:\/\/[^\/]+/, ''), // Remove domain for privacy
      method,
      status,
      size,
    },
  });

  // Track error rates
  if (status >= 400) {
    trackCustomMetric({
      name: `network_error_${Math.floor(status / 100)}xx`,
      value: 1,
      unit: 'count',
      rating: 'poor',
      context: { url, method, status },
    });
  }

  // Track large responses
  if (size && size > 1024 * 1024) { // > 1MB
    trackCustomMetric({
      name: 'network_large_response',
      value: Math.round(size / 1024),
      unit: 'kb',
      rating: 'poor',
      context: { url, method, size },
    });
  }
};

// User journey tracking with performance context
export const trackUserJourneyStep = (journey: string, step: string, metadata?: Record<string, any>) => {
  const stepMetric: CustomMetric = {
    name: `journey_${journey}_${step}`,
    value: 1,
    unit: 'step',
    context: {
      journey,
      step,
      timestamp: Date.now(),
      url: window.location.pathname,
      ...metadata,
    },
  };

  trackCustomMetric(stepMetric);

  // Also track timing if previous step was recorded
  const previousStepKey = `journey_${journey}_previous_step_time`;
  const previousTime = sessionStorage.getItem(previousStepKey);
  
  if (previousTime) {
    const stepDuration = Date.now() - parseInt(previousTime, 10);
    
    trackCustomMetric({
      name: `journey_${journey}_step_duration`,
      value: stepDuration,
      unit: 'ms',
      rating: stepDuration > 30000 ? 'poor' : stepDuration > 10000 ? 'needs-improvement' : 'good',
      context: {
        journey,
        fromStep: sessionStorage.getItem(`journey_${journey}_previous_step`) || 'unknown',
        toStep: step,
      },
    });
  }

  // Store current step info for next measurement
  sessionStorage.setItem(previousStepKey, Date.now().toString());
  sessionStorage.setItem(`journey_${journey}_previous_step`, step);
};

// Initialize Web Vitals tracking
export const initWebVitals = () => {
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
  
  // Track Core Web Vitals on page load
  onCLS((metric: any) => {
    const rating = getVitalRating('CLS', metric.value);
    
    trackCustomMetric({
      name: 'cls',
      value: parseFloat(metric.value.toFixed(4)),
      unit: 'ratio',
      rating,
      context: { id: metric.id, entries: metric.entries.length },
    });
    
    // Track in Prometheus metrics
    trackWebVital('CLS', metric.value, window.location.pathname, environment);
  });

  onFID((metric: any) => {
    const rating = getVitalRating('FID', metric.value);
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    trackCustomMetric({
      name: 'fid',
      value: Math.round(metric.value),
      unit: 'ms',
      rating,
      context: { id: metric.id, entries: metric.entries.length },
    });
    
    // Track in Prometheus metrics
    trackWebVital('FID', metric.value, window.location.pathname, environment);
  });

  onFCP((metric: any) => {
    const rating = getVitalRating('FCP', metric.value);
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    trackCustomMetric({
      name: 'fcp',
      value: Math.round(metric.value),
      unit: 'ms',
      rating,
      context: { id: metric.id, entries: metric.entries.length },
    });
    
    // Track in Prometheus metrics
    trackWebVital('FCP', metric.value, window.location.pathname, environment);
  });

  onLCP((metric: any) => {
    const rating = getVitalRating('LCP', metric.value);
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    trackCustomMetric({
      name: 'lcp',
      value: Math.round(metric.value),
      unit: 'ms',
      rating,
      context: { id: metric.id, entries: metric.entries.length },
    });
    
    // Track in Prometheus metrics
    trackWebVital('LCP', metric.value, window.location.pathname, environment);
  });

  onTTFB((metric: any) => {
    const rating = getVitalRating('TTFB', metric.value);
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV || 'development';
    
    trackCustomMetric({
      name: 'ttfb',
      value: Math.round(metric.value),
      unit: 'ms',
      rating,
      context: { id: metric.id, entries: metric.entries.length },
    });
    
    // Track in Prometheus metrics
    trackWebVital('TTFB', metric.value, window.location.pathname, environment);
  });

  // Track device and connection context
  trackDeviceContext();
};

// Track device and connection performance context
const trackDeviceContext = () => {
  const context: Record<string, any> = {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
    navigator: {
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
    },
  };

  // Add connection information if available
  const connection = (navigator as any).connection;
  if (connection) {
    context.connection = {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }

  // Add memory information if available
  const memory = (performance as any).memory;
  if (memory) {
    context.memory = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }

  trackCustomMetric({
    name: 'device_context',
    value: 1,
    unit: 'snapshot',
    context,
  });
};

// Functions are exported individually above