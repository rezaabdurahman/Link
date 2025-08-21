import * as Sentry from "@sentry/react";

const isDevelopment = import.meta.env.NODE_ENV === "development";
const isTest = import.meta.env.NODE_ENV === "test";

// Initialize Sentry
export const initSentry = () => {
  // Don't initialize Sentry in test environment
  if (isTest) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.NODE_ENV,
    
    // Performance Monitoring - using the new v10+ API
    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Performance traces sample rate (adjust for production)
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,

    // Session replay sample rate
    replaysSessionSampleRate: isDevelopment ? 1.0 : 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Filter out development noise
    beforeSend(event) {
      if (isDevelopment) {
        console.log("Sentry event:", event);
      }
      
      // Filter out known non-critical errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
          return null;
        }
        if (error?.value?.includes('Non-Error promise rejection captured')) {
          return null;
        }
      }
      
      return event;
    },

    // Additional configuration
    debug: isDevelopment,
    release: import.meta.env.VITE_APP_VERSION || "unknown",
    
    // Set user context automatically
    initialScope: {
      tags: {
        component: "frontend",
        framework: "react",
      },
    },
  });
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
