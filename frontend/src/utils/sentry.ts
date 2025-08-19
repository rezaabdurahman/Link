import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

// Initialize Sentry
export const initSentry = () => {
  // Don't initialize Sentry in test environment
  if (isTest) return;

  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    
    // Performance Monitoring
    integrations: [
      new BrowserTracing({
        // Set tracing origin patterns
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/api\.yourdomain\.com/,
          /^https:\/\/yourdomain\.com/,
        ],
      }),
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
    release: process.env.VITE_APP_VERSION || "unknown",
    
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

export const startTransaction = (name: string, op?: string) => {
  return Sentry.startTransaction({
    name,
    op: op || "navigation",
  });
};
