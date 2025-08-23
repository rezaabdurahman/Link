import * as Sentry from "@sentry/react";

const isDevelopment = import.meta.env.NODE_ENV === "development";
const isTest = import.meta.env.NODE_ENV === "test";
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.NODE_ENV;

// Performance thresholds moved to webVitals.ts

// Initialize Sentry with comprehensive RUM
export const initSentry = () => {
  // Don't initialize Sentry in test environment
  if (isTest) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment,
    
    // Enhanced integrations for comprehensive monitoring
    integrations: [
      // Browser tracing with automatic instrumentation
      Sentry.browserTracingIntegration(),
      
      // Session Replay for debugging
      Sentry.replayIntegration({
        // Capture console messages and network requests
        maskAllText: !isDevelopment, // Mask sensitive data in production
        blockAllMedia: true, // Don't capture media for privacy
        mutationLimit: 10000,
        mutationBreadcrumbLimit: 750,
      }),
      
      // Web Vitals tracking integration  
      // Note: Metrics integration handled separately
      
      // Breadcrumbs for better debugging
      Sentry.breadcrumbsIntegration({
        console: isDevelopment, // Only in dev to avoid noise
        dom: true,
        fetch: true,
        history: true,
        sentry: true,
        xhr: true,
      }),
    ],

    // Performance monitoring sample rates
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,
    
    // Session replay sample rates  
    replaysSessionSampleRate: isDevelopment ? 1.0 : 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Enhanced error filtering and enrichment
    beforeSend(event, hint) {
      if (isDevelopment) {
        console.log("Sentry event:", event);
      }
      
      // Filter out known non-critical errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        const errorMessage = error?.value || '';
        
        // Filter out browser extension errors
        if (errorMessage.includes('extension')) return null;
        
        // Filter out ResizeObserver noise
        if (errorMessage.includes('ResizeObserver loop limit exceeded')) return null;
        
        // Filter out non-actionable network errors
        if (errorMessage.includes('Loading chunk') && errorMessage.includes('failed')) {
          // Log chunk loading failures but don't spam Sentry
          console.warn('Chunk loading failed:', errorMessage);
          return null;
        }
        
        // Filter out non-Error promise rejections
        if (errorMessage.includes('Non-Error promise rejection captured')) return null;
      }
      
      // Enrich error context
      const originalException = hint?.originalException;
      if (originalException instanceof Error) {
        // Add performance metrics context
        if ('performance' in window && window.performance.timing) {
          event.extra = {
            ...event.extra,
            performanceMetrics: getPerformanceMetrics(),
          };
        }
        
        // Add user interaction context
        event.extra = {
          ...event.extra,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          connectionType: (navigator as any).connection?.effectiveType,
        };
      }
      
      return event;
    },

    // Additional configuration
    debug: isDevelopment,
    release: import.meta.env.VITE_APP_VERSION || "unknown",
    
    // Enhanced initial scope
    initialScope: {
      tags: {
        component: "frontend",
        framework: "react",
        environment,
        version: import.meta.env.VITE_APP_VERSION || "unknown",
      },
      user: {
        // Will be set dynamically when user logs in
      },
      level: "info",
    },

    // Transport options for reliability
    transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
    
    // Maximum breadcrumbs to keep
    maxBreadcrumbs: 100,
    
    // Attach stack traces to captured messages
    attachStacktrace: true,
    
    // Send default PII (set to false for privacy)
    sendDefaultPii: false,
    
    // Send client reports
    sendClientReports: true,
  });
  
  // Set up Web Vitals tracking
  setupWebVitalsTracking();
  
  // Set up custom performance tracking
  setupCustomPerformanceTracking();
};

// Helper functions for manual error reporting
export const captureError = (
  error: Error, 
  context?: { [key: string]: any }
) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureMessage = (
  message: string, 
  level: Sentry.SeverityLevel = "info",
  context?: { [key: string]: any }
) => {
  Sentry.captureMessage(message, level);
  if (context) {
    Sentry.setContext("custom", context);
  }
};

export const setUserContext = (user: {
  id: string;
  email?: string;
  username?: string;
}) => {
  Sentry.setUser(user);
};

export const addBreadcrumb = (
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel
) => {
  Sentry.addBreadcrumb({
    message,
    category: category || "custom",
    level: level || "info",
    timestamp: Date.now() / 1000,
  });
};

// Use the new v10+ API for manual transactions
export const startTransaction = (name: string, op?: string) => {
  return Sentry.startSpan(
    {
      name,
      op: op || "navigation",
    },
    (span) => span
  );
};

// Performance metrics collection
export const getPerformanceMetrics = () => {
  if (!('performance' in window)) return {};
  
  const timing = window.performance.timing;
  const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  return {
    // Page load metrics
    pageLoad: timing.loadEventEnd - timing.navigationStart,
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    firstPaint: getFirstPaint(),
    firstContentfulPaint: getFirstContentfulPaint(),
    
    // Network timing
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    tcp: timing.connectEnd - timing.connectStart,
    ssl: timing.secureConnectionStart > 0 ? timing.connectEnd - timing.secureConnectionStart : 0,
    ttfb: timing.responseStart - timing.navigationStart,
    download: timing.responseEnd - timing.responseStart,
    
    // Resource metrics
    transferSize: navigation?.transferSize || 0,
    encodedBodySize: navigation?.encodedBodySize || 0,
    decodedBodySize: navigation?.decodedBodySize || 0,
    
    // Connection info
    connectionType: (navigator as any).connection?.effectiveType,
    downlink: (navigator as any).connection?.downlink,
    rtt: (navigator as any).connection?.rtt,
  };
};

// Get First Paint timing
const getFirstPaint = (): number | null => {
  const paintEntries = window.performance.getEntriesByType('paint');
  const fpEntry = paintEntries.find(entry => entry.name === 'first-paint');
  return fpEntry ? fpEntry.startTime : null;
};

// Get First Contentful Paint timing
const getFirstContentfulPaint = (): number | null => {
  const paintEntries = window.performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
  return fcpEntry ? fcpEntry.startTime : null;
};

// Web Vitals tracking setup - simplified version
const setupWebVitalsTracking = () => {
  // Web Vitals tracking will be handled by the webVitals utility
  console.log('Web Vitals tracking will be initialized separately');
};

// Custom performance tracking setup
const setupCustomPerformanceTracking = () => {
  // Track long tasks (performance bottlenecks)
  if ('PerformanceObserver' in window) {
    try {
      // Long Tasks Observer
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            Sentry.addBreadcrumb({
              category: 'performance',
              message: `Long Task: ${entry.duration.toFixed(2)}ms`,
              level: 'warning',
              data: {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
              },
            });

            // Report very long tasks as issues
            if (entry.duration > 100) {
              Sentry.captureMessage(
                `Very long task detected: ${entry.duration.toFixed(2)}ms`,
                'warning'
              );
            }
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });

      // Layout Shift Observer (additional CLS tracking)
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ((entry as any).hadRecentInput) continue; // Ignore user-initiated shifts
          
          const value = (entry as any).value;
          if (value > 0.1) {
            Sentry.addBreadcrumb({
              category: 'layout-shift',
              message: `Layout Shift: ${value.toFixed(4)}`,
              level: 'warning',
              data: {
                value,
                startTime: entry.startTime,
                sources: (entry as any).sources,
              },
            });
          }
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });

      // Resource loading performance
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;
          
          // Track slow resources
          if (resource.duration > 2000) {
            Sentry.addBreadcrumb({
              category: 'slow-resource',
              message: `Slow resource: ${resource.name}`,
              level: 'warning',
              data: {
                duration: resource.duration,
                size: resource.transferSize,
                type: resource.initiatorType,
              },
            });
          }

          // Track failed resources
          if (resource.transferSize === 0 && resource.duration > 0) {
            Sentry.addBreadcrumb({
              category: 'failed-resource',
              message: `Failed to load: ${resource.name}`,
              level: 'error',
              data: {
                duration: resource.duration,
                type: resource.initiatorType,
              },
            });
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });

    } catch (error) {
      console.warn('Failed to set up performance observers:', error);
    }
  }

  // Track JavaScript errors globally
  window.addEventListener('error', (event) => {
    // Don't double-report errors already caught by React Error Boundary
    if (event.error && !event.error.__sentryReported) {
      event.error.__sentryReported = true;
      
      Sentry.captureException(event.error, {
        tags: {
          errorType: 'global-error',
        },
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          message: event.message,
        },
      });
    }
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason, {
      tags: {
        errorType: 'unhandled-promise-rejection',
      },
      extra: {
        promise: event.promise,
      },
    });
  });
};

// Business metrics helpers
export const trackUserJourney = (step: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    category: 'user-journey',
    message: `User Journey: ${step}`,
    level: 'info',
    data,
  });
  
  // Also send as custom metric
  Sentry.setTag('journey_step', step);
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      Sentry.setExtra(`journey_${key}`, value);
    });
  }
};

export const trackFeatureUsage = (feature: string, action: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    category: 'feature-usage',
    message: `Feature: ${feature} - ${action}`,
    level: 'info',
    data,
  });
  
  Sentry.setTag('feature_used', feature);
  Sentry.setTag('feature_action', action);
};

export const trackAPICall = (endpoint: string, method: string, duration: number, status: number) => {
  const isError = status >= 400;
  
  Sentry.addBreadcrumb({
    category: 'api-call',
    message: `API ${method} ${endpoint} - ${status} (${duration}ms)`,
    level: isError ? 'error' : 'info',
    data: {
      endpoint,
      method,
      duration,
      status,
    },
  });

  // Track API performance metrics
  Sentry.setMeasurement(`api_${method.toLowerCase()}_duration`, duration, 'millisecond');
  
  if (isError) {
    Sentry.setTag('api_error', `${method} ${endpoint}`);
  }
};
