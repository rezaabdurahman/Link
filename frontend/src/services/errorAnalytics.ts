import { ErrorAnalytics, ErrorMetadata } from '../utils/errorTypes';
import * as Sentry from '@sentry/react';

class BaseAnalyticsProvider implements ErrorAnalytics {
  track(event: string, properties?: Record<string, any>): void {
    console.log('Analytics:', event, properties);
  }

  identify(userId: string, properties?: Record<string, any>): void {
    console.log('Identify:', userId, properties);
  }

  increment(metric: string, value: number = 1): void {
    console.log('Increment:', metric, value);
  }

  timing(metric: string, duration: number): void {
    console.log('Timing:', metric, duration);
  }
}

class SentryAnalyticsProvider extends BaseAnalyticsProvider {
  track(event: string, properties?: Record<string, any>): void {
    super.track(event, properties);
    
    Sentry.addBreadcrumb({
      message: `Analytics: ${event}`,
      level: 'info',
      data: properties
    });
  }

  identify(userId: string, properties?: Record<string, any>): void {
    super.identify(userId, properties);
    
    Sentry.setUser({
      id: userId,
      ...properties
    });
  }

  increment(metric: string, value: number = 1): void {
    super.increment(metric, value);
    
    this.track('metric_increment', {
      metric,
      value
    });
  }

  timing(metric: string, duration: number): void {
    super.timing(metric, duration);
    
    this.track('performance_timing', {
      metric,
      duration
    });
  }
}

class LocalStorageAnalyticsProvider extends BaseAnalyticsProvider {
  private readonly storageKey = 'errorAnalytics';

  track(event: string, properties?: Record<string, any>): void {
    super.track(event, properties);
    
    try {
      const data = this.getData();
      const timestamp = Date.now();
      
      if (!data.events) data.events = [];
      
      data.events.push({
        event,
        properties,
        timestamp
      });

      // Keep only last 100 events
      if (data.events.length > 100) {
        data.events = data.events.slice(-100);
      }

      this.saveData(data);
    } catch (error) {
      console.warn('Failed to track analytics event:', error);
    }
  }

  identify(userId: string, properties?: Record<string, any>): void {
    super.identify(userId, properties);
    
    try {
      const data = this.getData();
      data.user = { userId, ...properties };
      this.saveData(data);
    } catch (error) {
      console.warn('Failed to identify user:', error);
    }
  }

  increment(metric: string, value: number = 1): void {
    super.increment(metric, value);
    
    try {
      const data = this.getData();
      if (!data.metrics) data.metrics = {};
      data.metrics[metric] = (data.metrics[metric] || 0) + value;
      this.saveData(data);
    } catch (error) {
      console.warn('Failed to increment metric:', error);
    }
  }

  timing(metric: string, duration: number): void {
    super.timing(metric, duration);
    
    try {
      const data = this.getData();
      if (!data.timings) data.timings = {};
      if (!data.timings[metric]) data.timings[metric] = [];
      
      data.timings[metric].push({
        duration,
        timestamp: Date.now()
      });

      // Keep only last 50 timings per metric
      if (data.timings[metric].length > 50) {
        data.timings[metric] = data.timings[metric].slice(-50);
      }

      this.saveData(data);
    } catch (error) {
      console.warn('Failed to track timing:', error);
    }
  }

  private getData(): any {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to get analytics data from localStorage:', error);
      return {};
    }
  }

  private saveData(data: any): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save analytics data to localStorage:', error);
    }
  }

  // Export data for debugging
  exportData(): any {
    return this.getData();
  }

  // Clear stored data
  clearData(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear analytics data:', error);
    }
  }
}

class CompositeAnalyticsProvider implements ErrorAnalytics {
  private providers: ErrorAnalytics[];

  constructor(...providers: ErrorAnalytics[]) {
    this.providers = providers;
  }

  track(event: string, properties?: Record<string, any>): void {
    this.providers.forEach(provider => {
      try {
        provider.track(event, properties);
      } catch (error) {
        console.warn('Analytics provider failed:', error);
      }
    });
  }

  identify(userId: string, properties?: Record<string, any>): void {
    this.providers.forEach(provider => {
      try {
        provider.identify(userId, properties);
      } catch (error) {
        console.warn('Analytics provider failed:', error);
      }
    });
  }

  increment(metric: string, value: number = 1): void {
    this.providers.forEach(provider => {
      try {
        provider.increment(metric, value);
      } catch (error) {
        console.warn('Analytics provider failed:', error);
      }
    });
  }

  timing(metric: string, duration: number): void {
    this.providers.forEach(provider => {
      try {
        provider.timing(metric, duration);
      } catch (error) {
        console.warn('Analytics provider failed:', error);
      }
    });
  }
}

// Error-specific analytics service
class ErrorAnalyticsService {
  private analytics: ErrorAnalytics;

  constructor(analytics: ErrorAnalytics) {
    this.analytics = analytics;
  }

  trackError(metadata: ErrorMetadata): void {
    this.analytics.track('error_occurred', {
      errorId: metadata.id,
      errorType: metadata.type,
      severity: metadata.severity,
      fingerprint: metadata.fingerprint,
      isRecoverable: metadata.isRecoverable,
      route: metadata.context?.route,
      userAgent: metadata.context?.userAgent,
      timestamp: metadata.timestamp
    });

    this.analytics.increment('errors.total');
    this.analytics.increment(`errors.by_type.${metadata.type}`);
    this.analytics.increment(`errors.by_severity.${metadata.severity}`);

    // Track hourly error patterns
    const hour = new Date().getHours();
    this.analytics.increment(`errors.hourly.${hour}`);
  }

  trackRecovery(metadata: ErrorMetadata, strategyType: string, success: boolean): void {
    this.analytics.track('error_recovery', {
      errorId: metadata.id,
      errorType: metadata.type,
      strategyType,
      success,
      timestamp: Date.now()
    });

    this.analytics.increment(`recovery.${strategyType}.${success ? 'success' : 'failure'}`);
  }

  trackErrorPattern(pattern: 'storm' | 'regression' | 'spike', metadata: { 
    fingerprint: string; 
    count?: number; 
    timespan?: number; 
    severity?: string 
  }): void {
    this.analytics.track('error_pattern_detected', {
      pattern,
      ...metadata,
      timestamp: Date.now()
    });

    this.analytics.increment(`patterns.${pattern}`);
  }

  trackUserFeedback(errorId: string, feedback: { 
    helpful: boolean; 
    description?: string; 
    reproductionSteps?: string[] 
  }): void {
    this.analytics.track('error_feedback', {
      errorId,
      helpful: feedback.helpful,
      hasDescription: !!feedback.description,
      hasSteps: !!(feedback.reproductionSteps && feedback.reproductionSteps.length > 0),
      timestamp: Date.now()
    });

    this.analytics.increment(`feedback.${feedback.helpful ? 'positive' : 'negative'}`);
  }

  trackPerformanceImpact(errorType: string, impact: {
    memoryUsage?: number;
    renderTime?: number;
    networkLatency?: number;
  }): void {
    if (impact.memoryUsage) {
      this.analytics.timing(`performance.${errorType}.memory`, impact.memoryUsage);
    }
    
    if (impact.renderTime) {
      this.analytics.timing(`performance.${errorType}.render`, impact.renderTime);
    }
    
    if (impact.networkLatency) {
      this.analytics.timing(`performance.${errorType}.network`, impact.networkLatency);
    }
  }

  // Get error statistics
  getErrorStats(): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoveryRates: Record<string, { attempts: number; successes: number; rate: number }>;
    recentPatterns: any[];
  }> {
    // In a real implementation, this would query the analytics backend
    // For now, return dummy data or data from localStorage provider
    if (this.analytics instanceof LocalStorageAnalyticsProvider) {
      const data = this.analytics.exportData();
      
      return Promise.resolve({
        totalErrors: data.metrics?.['errors.total'] || 0,
        errorsByType: Object.entries(data.metrics || {})
          .filter(([key]) => key.startsWith('errors.by_type.'))
          .reduce((acc, [key, value]) => {
            const type = key.replace('errors.by_type.', '');
            acc[type] = value as number;
            return acc;
          }, {} as Record<string, number>),
        errorsBySeverity: Object.entries(data.metrics || {})
          .filter(([key]) => key.startsWith('errors.by_severity.'))
          .reduce((acc, [key, value]) => {
            const severity = key.replace('errors.by_severity.', '');
            acc[severity] = value as number;
            return acc;
          }, {} as Record<string, number>),
        recoveryRates: {},
        recentPatterns: data.events?.filter((e: any) => e.event === 'error_pattern_detected') || []
      });
    }

    return Promise.resolve({
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoveryRates: {},
      recentPatterns: []
    });
  }
}

// Factory function to create analytics provider based on environment
export function createAnalyticsProvider(): ErrorAnalytics {
  const providers: ErrorAnalytics[] = [];

  // Always include console logging
  providers.push(new BaseAnalyticsProvider());

  // Add Sentry in production
  if (process.env.NODE_ENV === 'production') {
    providers.push(new SentryAnalyticsProvider());
  }

  // Add localStorage provider for persistence
  if (typeof window !== 'undefined' && window.localStorage) {
    providers.push(new LocalStorageAnalyticsProvider());
  }

  return new CompositeAnalyticsProvider(...providers);
}

// Global error analytics service instance
export const errorAnalyticsService = new ErrorAnalyticsService(createAnalyticsProvider());

// Export individual providers for testing
export {
  BaseAnalyticsProvider,
  SentryAnalyticsProvider,
  LocalStorageAnalyticsProvider,
  CompositeAnalyticsProvider,
  ErrorAnalyticsService
};