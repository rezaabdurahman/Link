import { ErrorInfo } from 'react';
import { 
  ErrorSeverity, 
  ErrorMetadata, 
  RecoveryStrategy, 
  ErrorBoundaryConfig,
  ErrorAnalytics 
} from '../utils/errorTypes';
import { 
  createErrorMetadata, 
  generateRecoveryStrategies, 
  reportError,
  shouldReportError,
  trackErrorRecovery,
  analyzeNetworkError,
  analyzeChunkLoadingError
} from '../utils/errorUtils';
import * as Sentry from '@sentry/react';

class ErrorService {
  private analytics?: ErrorAnalytics;
  private config: ErrorBoundaryConfig;
  private errorHistory: Map<string, ErrorMetadata[]> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.config = {
      level: 'global',
      maxRetries: 3,
      retryDelay: 1000,
      enableReporting: true,
      enableAnalytics: true,
      ignoredErrors: [
        /ResizeObserver loop limit exceeded/,
        /Non-Error promise rejection captured/,
        /Loading chunk \d+ failed/,
        /extension/i,
        /^Script error\.$/
      ],
      ...config
    };
  }

  // Set analytics provider
  setAnalytics(analytics: ErrorAnalytics): void {
    this.analytics = analytics;
  }

  // Main error handling method
  async handleError(
    error: Error, 
    errorInfo?: ErrorInfo,
    context?: { navigate?: (path: string) => void; reload?: () => void; retry?: () => void }
  ): Promise<ErrorMetadata> {
    
    // Check if error should be ignored
    if (this.shouldIgnoreError(error)) {
      throw new Error('Error ignored by configuration');
    }

    // Create comprehensive metadata
    const metadata = await createErrorMetadata(error, errorInfo, {
      level: this.config.level,
      routeName: context ? 'dynamic' : undefined
    });

    // Analyze specific error types
    await this.analyzeSpecificErrorTypes(error, metadata);

    // Generate recovery strategies
    metadata.recoveryStrategies = generateRecoveryStrategies(
      metadata.type, 
      metadata, 
      context
    );

    // Store in history
    this.addToHistory(metadata);

    // Track analytics
    if (this.config.enableAnalytics && this.analytics) {
      this.trackErrorAnalytics(metadata);
    }

    // Report error if enabled and not spam
    if (this.config.enableReporting && shouldReportError(metadata.fingerprint)) {
      await this.reportErrorWithContext(error, metadata);
    }

    return metadata;
  }

  // Check if error should be ignored based on config
  private shouldIgnoreError(error: Error): boolean {
    if (!this.config.ignoredErrors) return false;

    const message = error.message || '';
    const name = error.name || '';
    const fullErrorString = `${name}: ${message}`;

    return this.config.ignoredErrors.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(fullErrorString) || pattern.test(message);
      }
      return fullErrorString.includes(pattern) || message.includes(pattern);
    });
  }

  // Analyze specific error types for enhanced context
  private async analyzeSpecificErrorTypes(error: Error, metadata: ErrorMetadata): Promise<void> {
    // Network error analysis
    const networkDetails = analyzeNetworkError(error);
    if (networkDetails) {
      metadata.context = { ...metadata.context, networkDetails };
    }

    // Chunk loading error analysis
    const chunkDetails = analyzeChunkLoadingError(error);
    if (chunkDetails) {
      metadata.context = { ...metadata.context, chunkDetails };
      
      // Special handling for chunk loading errors
      if (chunkDetails.networkStatus === 'offline') {
        metadata.severity = ErrorSeverity.HIGH;
        metadata.recoveryStrategies.unshift({
          type: 'refresh',
          label: 'Reload when online',
          description: 'Reload the page once you\'re back online',
          action: () => {
            const checkOnline = () => {
              if (navigator.onLine) {
                window.location.reload();
              } else {
                setTimeout(checkOnline, 1000);
              }
            };
            checkOnline();
          },
          priority: 0
        });
      }
    }

    // Memory pressure analysis
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (memoryPressure > 0.9) {
        metadata.context = { 
          ...metadata.context, 
          memoryPressure: {
            used: memory.usedJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            pressure: memoryPressure
          }
        };
        
        // Suggest memory-clearing strategies
        metadata.recoveryStrategies.unshift({
          type: 'refresh',
          label: 'Clear memory',
          description: 'Reload to free up memory',
          action: () => window.location.reload(),
          priority: 0
        });
      }
    }
  }

  // Enhanced error reporting with full context
  private async reportErrorWithContext(error: Error, metadata: ErrorMetadata): Promise<void> {
    try {
      const context = await import('../utils/errorUtils').then(m => m.collectErrorContext());
      
      await reportError({
        error,
        metadata,
        context
      });

      // Track successful reporting
      if (this.analytics) {
        this.analytics.track('error_reported', {
          errorId: metadata.id,
          errorType: metadata.type,
          severity: metadata.severity
        });
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
      
      // Fallback: at least log to Sentry directly
      Sentry.captureException(error, {
        tags: {
          error_id: metadata.id,
          error_type: metadata.type,
          severity: metadata.severity,
          reporting_failed: true
        }
      });
    }
  }

  // Track error analytics
  private trackErrorAnalytics(metadata: ErrorMetadata): void {
    if (!this.analytics) return;

    this.analytics.track('error_occurred', {
      errorId: metadata.id,
      errorType: metadata.type,
      severity: metadata.severity,
      isRecoverable: metadata.isRecoverable,
      fingerprint: metadata.fingerprint,
      route: metadata.context?.route
    });

    this.analytics.increment('errors.total');
    this.analytics.increment(`errors.by_type.${metadata.type}`);
    this.analytics.increment(`errors.by_severity.${metadata.severity}`);

    // Track error patterns
    const hourlyKey = `errors.hourly.${new Date().getHours()}`;
    this.analytics.increment(hourlyKey);
  }

  // Execute recovery strategy
  async executeRecovery(metadata: ErrorMetadata, strategy: RecoveryStrategy): Promise<boolean> {
    try {
      const recoveryKey = `${metadata.fingerprint}-${strategy.type}`;
      const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
      
      // Prevent infinite recovery loops
      if (attempts >= 3) {
        console.warn('Max recovery attempts reached for:', recoveryKey);
        return false;
      }

      // Track recovery attempt
      trackErrorRecovery(metadata, strategy);
      this.recoveryAttempts.set(recoveryKey, attempts + 1);

      // Analytics
      if (this.analytics) {
        this.analytics.track('recovery_attempted', {
          errorId: metadata.id,
          strategyType: strategy.type,
          attemptNumber: attempts + 1
        });
      }

      // Execute strategy with timeout
      await Promise.race([
        strategy.action(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Recovery timeout')), 10000)
        )
      ]);

      // Track successful recovery
      if (this.analytics) {
        this.analytics.track('recovery_successful', {
          errorId: metadata.id,
          strategyType: strategy.type
        });
      }

      return true;
    } catch (recoveryError) {
      console.error('Recovery strategy failed:', recoveryError as Error);
      
      if (this.analytics) {
        this.analytics.track('recovery_failed', {
          errorId: metadata.id,
          strategyType: strategy.type,
          failureReason: (recoveryError as Error).message
        });
      }

      return false;
    }
  }

  // Add error to history for pattern analysis
  private addToHistory(metadata: ErrorMetadata): void {
    const fingerprint = metadata.fingerprint;
    const existing = this.errorHistory.get(fingerprint) || [];
    
    existing.push(metadata);
    
    // Keep only last 10 occurrences per fingerprint
    if (existing.length > 10) {
      existing.shift();
    }
    
    this.errorHistory.set(fingerprint, existing);
    
    // Analyze patterns
    this.analyzeErrorPatterns(fingerprint, existing);
  }

  // Analyze error patterns for insights
  private analyzeErrorPatterns(fingerprint: string, history: ErrorMetadata[]): void {
    if (history.length < 3) return;

    const recentErrors = history.slice(-5);
    const timeSpan = recentErrors[recentErrors.length - 1].timestamp - recentErrors[0].timestamp;
    
    // Detect error storms (multiple errors in short time)
    if (recentErrors.length >= 3 && timeSpan < 60000) { // 1 minute
      console.warn('Error storm detected:', fingerprint);
      
      if (this.analytics) {
        this.analytics.track('error_storm_detected', {
          fingerprint,
          errorCount: recentErrors.length,
          timeSpan
        });
      }

      // Auto-report error storms
      Sentry.captureMessage('Error storm detected', {
        level: 'warning',
        tags: {
          fingerprint,
          error_type: recentErrors[0].type,
          pattern: 'storm'
        },
        extra: {
          errorCount: recentErrors.length,
          timeSpan,
          history: recentErrors.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            type: e.type
          }))
        }
      });
    }

    // Detect regression patterns (increasing error frequency)
    if (history.length >= 5) {
      const older = history.slice(0, -2);
      const newer = history.slice(-2);
      
      const olderAvgInterval = this.calculateAverageInterval(older);
      const newerAvgInterval = this.calculateAverageInterval(newer);
      
      if (newerAvgInterval < olderAvgInterval * 0.5) { // 50% faster occurrence
        if (this.analytics) {
          this.analytics.track('error_regression_detected', {
            fingerprint,
            oldInterval: olderAvgInterval,
            newInterval: newerAvgInterval
          });
        }
      }
    }
  }

  // Calculate average time interval between errors
  private calculateAverageInterval(errors: ErrorMetadata[]): number {
    if (errors.length < 2) return Infinity;
    
    const intervals = [];
    for (let i = 1; i < errors.length; i++) {
      intervals.push(errors[i].timestamp - errors[i-1].timestamp);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  // Get error statistics
  getErrorStats(): {
    totalErrors: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentPatterns: Array<{fingerprint: string; count: number; lastSeen: number}>;
  } {
    const stats = {
      totalErrors: 0,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recentPatterns: [] as Array<{fingerprint: string; count: number; lastSeen: number}>
    };

    this.errorHistory.forEach((history, fingerprint) => {
      stats.totalErrors += history.length;
      
      history.forEach(error => {
        stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
        stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      });

      if (history.length > 0) {
        stats.recentPatterns.push({
          fingerprint,
          count: history.length,
          lastSeen: Math.max(...history.map(e => e.timestamp))
        });
      }
    });

    // Sort patterns by recent activity
    stats.recentPatterns.sort((a, b) => b.lastSeen - a.lastSeen);

    return stats;
  }

  // Clear old error history (cleanup)
  cleanupHistory(maxAge: number = 24 * 60 * 60 * 1000): void { // Default 24 hours
    const cutoff = Date.now() - maxAge;
    
    this.errorHistory.forEach((history, fingerprint) => {
      const filtered = history.filter(error => error.timestamp > cutoff);
      
      if (filtered.length === 0) {
        this.errorHistory.delete(fingerprint);
      } else {
        this.errorHistory.set(fingerprint, filtered);
      }
    });

    // Also cleanup recovery attempts
    this.recoveryAttempts.clear();
  }
}

// Global error service instance
export const errorService = new ErrorService();

// Error boundary hook for easy integration
export const useErrorHandler = () => {
  return {
    handleError: errorService.handleError.bind(errorService),
    executeRecovery: errorService.executeRecovery.bind(errorService),
    getStats: errorService.getErrorStats.bind(errorService)
  };
};

export default errorService;