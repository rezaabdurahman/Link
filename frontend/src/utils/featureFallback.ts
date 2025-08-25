import { env } from '../utils/env';
import { FEATURE_DEFAULTS, EXPERIMENT_DEFAULTS, ENVIRONMENT_OVERRIDES, FeatureDefaultKey } from '../config/featureDefaults';
import type { FeatureFlag, Experiment } from '../contexts/FeatureContext';

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

class FeatureFallbackManager {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
  };

  private readonly maxFailures = 3;
  private readonly resetTimeout = 30000; // 30 seconds
  private readonly fallbackCache = new Map<string, any>();
  
  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.fallbackCache.size;
  }

  /**
   * Check if feature service is available based on circuit breaker state
   */
  isServiceAvailable(): boolean {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'closed':
        return true;
      case 'open':
        // Check if we should try to reset
        if (now - this.circuitBreaker.lastFailureTime > this.resetTimeout) {
          this.circuitBreaker.state = 'half-open';
          return true;
        }
        return false;
      case 'half-open':
        return true;
      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'closed';
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.maxFailures) {
      this.circuitBreaker.state = 'open';
      console.warn('Feature service circuit breaker opened due to failures');
    }
  }

  /**
   * Get fallback value for a feature flag
   */
  getFallbackFlag(key: string): FeatureFlag {
    const environmentOverrides = ENVIRONMENT_OVERRIDES[env.APP_MODE as keyof typeof ENVIRONMENT_OVERRIDES] || {};
    const envOverride = (environmentOverrides as any)[key];
    const defaultValue = envOverride !== undefined ? envOverride : 
                        FEATURE_DEFAULTS[key as FeatureDefaultKey] ?? 
                        false;

    return {
      key,
      enabled: defaultValue,
      value: defaultValue,
      reason: 'fallback_default',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get fallback value for an experiment
   */
  getFallbackExperiment(key: string): Experiment {
    const defaultExperiment = EXPERIMENT_DEFAULTS[key as keyof typeof EXPERIMENT_DEFAULTS];
    
    return {
      key,
      reason: 'fallback_default',
      timestamp: new Date().toISOString(),
      ...defaultExperiment,
    };
  }

  /**
   * Get all fallback flags
   */
  getAllFallbackFlags(): Record<string, FeatureFlag> {
    const flags: Record<string, FeatureFlag> = {};
    const environmentOverrides = ENVIRONMENT_OVERRIDES[env.APP_MODE as keyof typeof ENVIRONMENT_OVERRIDES] || {};
    
    // Combine defaults with environment overrides
    const allFlags = { ...FEATURE_DEFAULTS, ...environmentOverrides };
    
    Object.entries(allFlags).forEach(([key, defaultValue]) => {
      flags[key] = {
        key,
        enabled: defaultValue,
        value: defaultValue,
        reason: 'fallback_default',
        timestamp: new Date().toISOString(),
      };
    });
    
    return flags;
  }

  /**
   * Cache feature evaluation result
   */
  cacheResult(key: string, value: any): void {
    this.fallbackCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: 60000, // 1 minute
    });
  }

  /**
   * Get cached result if available and not expired
   */
  getCachedResult(key: string): any | null {
    const cached = this.fallbackCache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.fallbackCache.delete(key);
      return null;
    }
    
    return cached.value;
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.fallbackCache.clear();
  }

  /**
   * Get circuit breaker status for debugging
   */
  getCircuitBreakerStatus() {
    return {
      state: this.circuitBreaker.state,
      failures: this.circuitBreaker.failures,
      lastFailureTime: this.circuitBreaker.lastFailureTime,
      isServiceAvailable: this.isServiceAvailable(),
    };
  }
}

// Singleton instance
export const featureFallbackManager = new FeatureFallbackManager();

// Enhanced feature service wrapper with fallback
export class ResilientFeatureService {
  private baseService: any;

  constructor(baseService: any) {
    this.baseService = baseService;
  }

  async evaluateFlag(flagKey: string, context?: any): Promise<FeatureFlag> {
    // Check circuit breaker
    if (!featureFallbackManager.isServiceAvailable()) {
      console.warn(`Feature service unavailable, using fallback for flag: ${flagKey}`);
      return featureFallbackManager.getFallbackFlag(flagKey);
    }

    // Check cache first
    const cacheKey = `flag:${flagKey}:${JSON.stringify(context)}`;
    const cachedResult = featureFallbackManager.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const result = await this.baseService.evaluateFlag(flagKey, context);
      featureFallbackManager.recordSuccess();
      featureFallbackManager.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Feature service error for flag ${flagKey}:`, error);
      featureFallbackManager.recordFailure();
      return featureFallbackManager.getFallbackFlag(flagKey);
    }
  }

  async evaluateExperiment(experimentKey: string, context?: any): Promise<Experiment> {
    if (!featureFallbackManager.isServiceAvailable()) {
      console.warn(`Feature service unavailable, using fallback for experiment: ${experimentKey}`);
      return featureFallbackManager.getFallbackExperiment(experimentKey);
    }

    const cacheKey = `exp:${experimentKey}:${JSON.stringify(context)}`;
    const cachedResult = featureFallbackManager.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const result = await this.baseService.evaluateExperiment(experimentKey, context);
      featureFallbackManager.recordSuccess();
      featureFallbackManager.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Feature service error for experiment ${experimentKey}:`, error);
      featureFallbackManager.recordFailure();
      return featureFallbackManager.getFallbackExperiment(experimentKey);
    }
  }

  async getAllFlags(context?: any): Promise<{ flags: Record<string, FeatureFlag> }> {
    if (!featureFallbackManager.isServiceAvailable()) {
      console.warn('Feature service unavailable, using fallback for all flags');
      return { flags: featureFallbackManager.getAllFallbackFlags() };
    }

    const cacheKey = `all_flags:${JSON.stringify(context)}`;
    const cachedResult = featureFallbackManager.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const result = await this.baseService.getAllFlags(context);
      featureFallbackManager.recordSuccess();
      featureFallbackManager.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Feature service error for all flags:', error);
      featureFallbackManager.recordFailure();
      return { flags: featureFallbackManager.getAllFallbackFlags() };
    }
  }

  // Passthrough methods that are less critical
  async trackEvent(event: any): Promise<any> {
    if (!featureFallbackManager.isServiceAvailable()) {
      console.warn('Feature service unavailable, skipping event tracking:', event.event_type);
      return { success: false, reason: 'service_unavailable' };
    }

    try {
      const result = await this.baseService.trackEvent(event);
      featureFallbackManager.recordSuccess();
      return result;
    } catch (error) {
      console.error('Feature service error for event tracking:', error);
      featureFallbackManager.recordFailure();
      // Don't fail the application for tracking errors
      return { success: false, reason: 'tracking_failed' };
    }
  }

  async invalidateCache(keys: string[] = []): Promise<any> {
    try {
      // Clear local cache
      featureFallbackManager.clearCache();
      
      // Try to invalidate remote cache if service is available
      if (featureFallbackManager.isServiceAvailable()) {
        return await this.baseService.invalidateCache(keys);
      }
      
      return { success: true, reason: 'local_cache_cleared' };
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return { success: false, reason: 'cache_invalidation_failed' };
    }
  }

  // Debugging method
  getServiceStatus() {
    return {
      circuitBreaker: featureFallbackManager.getCircuitBreakerStatus(),
      cacheSize: featureFallbackManager.getCacheSize(),
    };
  }
}