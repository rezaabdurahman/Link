# Frontend Observability & Monitoring

## 📊 Overview

This document outlines the comprehensive observability stack for the Link frontend application, providing real-user monitoring (RUM), performance tracking, error monitoring, and business metrics collection.

## 🏗️ Architecture

### Monitoring Stack Components

1. **Sentry**: Error tracking and performance monitoring
2. **Web Vitals**: Core Web Vitals and custom performance metrics
3. **Prometheus**: Metrics collection and alerting
4. **Grafana**: Visualization and dashboards
5. **Custom Hooks**: React integration for seamless tracking

### Data Flow

```
Frontend App → [Metrics Collection] → [Service Worker] → Prometheus
              ↓
            Sentry → [Error/Performance Data]
              ↓ 
            Web Vitals → [Performance Metrics]
```

## 🚀 Quick Start

### 1. Environment Setup

Add these environment variables to your `.env` files:

```bash
# Required for all environments
VITE_SENTRY_DSN=your-sentry-dsn
VITE_SENTRY_ENVIRONMENT=development|staging|production
VITE_APP_VERSION=1.0.0

# Optional: Direct metrics export
VITE_METRICS_EXPORT_URL=http://your-metrics-collector/metrics
VITE_METRICS_EXPORT_INTERVAL=30000
```

### 2. Initialization

The monitoring stack initializes automatically in `main.tsx`:

```typescript
import { initSentry } from './utils/sentry';
import { initWebVitals } from './utils/webVitals';
import { setupMetricsEndpoint } from './utils/metricsExporter';

// Initialize all monitoring
initSentry();
initWebVitals();
setupMetricsEndpoint();
```

### 3. Using Performance Monitoring Hooks

#### Basic Page Monitoring

```typescript
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';

const MyPage = () => {
  const { trackFeature, trackJourneyStep } = usePerformanceMonitoring('dashboard');
  
  const handleButtonClick = () => {
    const complete = trackFeature('navigation', 'button_click');
    // ... perform action
    complete({ success: true });
  };
  
  return <div>...</div>;
};
```

#### Form Performance Monitoring

```typescript
import { useFormPerformanceMonitoring } from '../hooks/usePerformanceMonitoring';

const LoginForm = () => {
  const { startForm, trackFieldInteraction, trackFormSubmission } = 
    useFormPerformanceMonitoring('login');
  
  useEffect(() => {
    startForm();
  }, []);
  
  const handleSubmit = async (data) => {
    try {
      await submitLogin(data);
      trackFormSubmission(true);
    } catch (error) {
      trackFormSubmission(false, [error.message]);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        onFocus={() => trackFieldInteraction('email', 'focus')}
        onBlur={() => trackFieldInteraction('email', 'blur')}
      />
    </form>
  );
};
```

#### API Call Monitoring

```typescript
import { useAPIPerformanceMonitoring } from '../hooks/usePerformanceMonitoring';

const useUserData = () => {
  const { trackAPICall } = useAPIPerformanceMonitoring();
  
  const fetchUser = useCallback(async (id: string) => {
    return trackAPICall('/api/users', 'GET', async () => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    });
  }, [trackAPICall]);
  
  return { fetchUser };
};
```

## 📊 Metrics Collected

### Core Web Vitals

| Metric | Description | Good | Poor | Unit |
|--------|-------------|------|------|------|
| **LCP** | Largest Contentful Paint | ≤ 2.5s | > 4s | ms |
| **FID** | First Input Delay | ≤ 100ms | > 300ms | ms |
| **CLS** | Cumulative Layout Shift | ≤ 0.1 | > 0.25 | ratio |
| **FCP** | First Contentful Paint | ≤ 1.8s | > 3s | ms |
| **TTFB** | Time to First Byte | ≤ 800ms | > 1.8s | ms |

### Business Metrics

- **User Journey Tracking**: Step completion rates and durations
- **Feature Usage**: Adoption rates and interaction patterns
- **Form Analytics**: Completion rates, abandonment points, field interactions
- **API Performance**: Success rates, latency distributions, error patterns
- **Session Analytics**: Duration, bounce rate, engagement scoring

### Technical Metrics

- **JavaScript Errors**: Error rates, types, and stack traces
- **Resource Loading**: Failed resources, slow loading assets
- **Memory Usage**: Heap size monitoring and leak detection
- **Network Performance**: Connection type impact, timeout rates
- **Bundle Performance**: Size tracking and load times

## 🎯 Service Level Objectives (SLOs)

### Availability SLO
- **Target**: 99.9% page load success rate
- **Error Budget**: 0.1%
- **Measurement**: 5-minute sliding window

### Performance SLOs
- **LCP Performance**: 75% of loads < 2.5s
- **FID Performance**: 95% of interactions < 100ms
- **CLS Stability**: 90% of sessions < 0.1 shift score

### User Experience SLO
- **Composite Score**: 80% overall UX score
- **Components**: LCP (25%), FID (25%), CLS (25%), Success Rate (25%)

### Business SLOs
- **Critical Journeys**: 90% completion rate
- **Form Success**: 85% completion rate
- **API Performance**: 95% of requests < 1s

## 🚨 Alerting

### Alert Levels

#### Critical Alerts
- Page load success rate < 99.9%
- JavaScript error spike (>1 error/sec)
- Critical user journey failure (<30% completion)
- Fast error budget burn (exhausted in <1 hour)

#### Warning Alerts
- Poor Core Web Vitals performance
- High API error rates (>5%)
- Moderate error budget burn
- Form completion rate drops

#### Info Alerts
- Slow error budget consumption
- Performance degradation trends
- Resource loading issues

### Alert Routing

```yaml
# AlertManager configuration example
route:
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'frontend-alerts'
  
  routes:
  - match:
      component: frontend
      severity: critical
    receiver: 'frontend-critical'
    
  - match:
      component: frontend
      severity: warning
    receiver: 'frontend-warnings'
```

## 📈 Dashboards

### Performance Dashboard (`frontend-performance.json`)

**Panels Include:**
- Core Web Vitals trends and distributions
- API request performance and error rates
- Resource loading performance
- Memory usage and bundle size tracking
- User journey completion funnels

**Key Queries:**
```promql
# LCP P95 performance
histogram_quantile(0.95, rate(frontend_web_vitals_lcp_bucket[5m]))

# API error rate
rate(frontend_api_request_total{status=~"4..|5.."}[5m]) / rate(frontend_api_request_total[5m])

# User journey completion rate
sum(rate(frontend_user_journey_step_total{step="complete"}[5m])) / sum(rate(frontend_user_journey_step_total{step="start"}[5m]))
```

### User Experience Dashboard (`frontend-user-experience.json`)

**Panels Include:**
- User experience composite score
- Session analytics and engagement metrics
- Feature adoption and usage patterns
- Form completion analytics
- Geographic performance distribution

## 🛠️ Development Workflow

### Local Development

1. **Environment Setup**:
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Set development Sentry DSN
   VITE_SENTRY_DSN=your-dev-dsn
   VITE_SENTRY_ENVIRONMENT=development
   ```

2. **Start Monitoring Stack**:
   ```bash
   # Start backend and monitoring services
   cd backend && docker-compose up -d
   
   # Start monitoring stack
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

3. **Access Dashboards**:
   - Grafana: http://localhost:3001
   - Prometheus: http://localhost:9090
   - Frontend Metrics: http://localhost:3000/metrics

### Testing Performance

```typescript
// Example performance test
import { trackCustomMetric } from '../utils/webVitals';

describe('Performance Tests', () => {
  it('should track component render time', () => {
    const startTime = performance.now();
    render(<MyComponent />);
    const duration = performance.now() - startTime;
    
    trackCustomMetric({
      name: 'component_render_time',
      value: duration,
      unit: 'ms',
      rating: duration > 100 ? 'poor' : 'good',
    });
    
    expect(duration).toBeLessThan(100);
  });
});
```

### CI/CD Integration

The monitoring setup includes:
- Lighthouse CI for performance budgets
- Bundle size tracking in builds
- Sentry release tracking
- Performance regression detection

## 📚 API Reference

### Web Vitals Utilities

```typescript
// Track page load performance
trackPageLoad(pageName: string): void

// Track feature interactions
trackFeatureInteraction(feature: string, action: string, duration?: number): void

// Track user journey steps
trackUserJourneyStep(journey: string, step: string, metadata?: Record<string, any>): void

// Track custom metrics
trackCustomMetric(metric: CustomMetric): void

// Track network requests
trackNetworkTiming(request: NetworkRequest): void
```

### Metrics Exporter

```typescript
// Increment counter metric
metricsExporter.incrementCounter(name: string, help: string, labels?: Record<string, string>, value?: number): void

// Set gauge value
metricsExporter.setGauge(name: string, help: string, value: number, labels?: Record<string, string>): void

// Observe histogram value
metricsExporter.observeHistogram(name: string, help: string, value: number, labels?: Record<string, string>, buckets?: number[]): void

// Export in Prometheus format
metricsExporter.exportPrometheusFormat(): string
```

### Performance Hooks

```typescript
// Main performance monitoring
usePerformanceMonitoring(pageName?: string): {
  trackFeature: (feature: string, action: string, metadata?: any) => () => void;
  trackJourneyStep: (journey: string, step: string, metadata?: any) => void;
  trackComponentLifecycle: (componentName: string) => () => void;
  trackAsyncOperation: <T>(name: string, operation: () => Promise<T>, metadata?: any) => Promise<T>;
}

// Form performance monitoring
useFormPerformanceMonitoring(formName: string): {
  startForm: () => void;
  trackFieldInteraction: (field: string, action: 'focus' | 'blur' | 'change') => void;
  trackFormSubmission: (success: boolean, errors?: string[]) => void;
  trackFormAbandonment: (reason?: string) => void;
}

// API performance monitoring
useAPIPerformanceMonitoring(): {
  trackAPICall: <T>(endpoint: string, method: string, apiCall: () => Promise<T>, metadata?: any) => Promise<T>;
}

// User interaction monitoring
useInteractionPerformanceMonitoring(): {
  trackClick: (elementName: string, metadata?: any) => () => void;
  trackScroll: () => () => void;
}
```

## 🔧 Configuration

### Sentry Configuration

Located in `src/utils/sentry.ts`:

```typescript
// Key configuration options
{
  tracesSampleRate: isDevelopment ? 1.0 : 0.1,
  replaysSessionSampleRate: isDevelopment ? 1.0 : 0.01,
  replaysOnErrorSampleRate: 1.0,
  beforeSend: filterAndEnrichEvents,
  integrations: [
    browserTracingIntegration(),
    replayIntegration(),
    metricsAggregatorIntegration(),
  ]
}
```

### Web Vitals Configuration

Performance thresholds in `src/utils/webVitals.ts`:

```typescript
export const WEB_VITALS_THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
};
```

### Metrics Export Configuration

Environment variables:

```bash
# Metrics export endpoint (optional)
VITE_METRICS_EXPORT_URL=http://your-collector/metrics

# Export interval in milliseconds
VITE_METRICS_EXPORT_INTERVAL=30000

# Enable/disable specific tracking
VITE_ENABLE_PERFORMANCE_TRACKING=true
VITE_ENABLE_ERROR_TRACKING=true
VITE_ENABLE_USER_JOURNEY_TRACKING=true
```

## 🚀 Best Practices

### Performance Monitoring

1. **Selective Tracking**: Only track business-critical user journeys
2. **Sampling**: Use appropriate sampling rates for production
3. **Context**: Always include relevant metadata with metrics
4. **Privacy**: Avoid tracking PII in performance metrics

### Error Handling

1. **Error Boundaries**: Implement React error boundaries with monitoring
2. **Fallback UI**: Provide graceful degradation when monitoring fails
3. **Filter Noise**: Filter out non-actionable errors and browser quirks
4. **Context Enrichment**: Include user context and application state

### Business Metrics

1. **Goal Alignment**: Track metrics that align with business objectives
2. **User Journey Focus**: Monitor complete user flows, not just individual actions
3. **Conversion Tracking**: Measure success rates for critical actions
4. **Segmentation**: Break down metrics by user cohorts when relevant

### Development Guidelines

1. **Test Monitoring**: Include monitoring in your test scenarios
2. **Documentation**: Document custom metrics and their purposes
3. **Review Regularly**: Regularly review and clean up unused metrics
4. **Performance Impact**: Monitor the performance impact of monitoring itself

## 🔍 Troubleshooting

### Common Issues

#### Metrics Not Appearing

1. Check service worker registration: `navigator.serviceWorker.getRegistrations()`
2. Verify Prometheus scraping: Check `/metrics` endpoint
3. Confirm environment variables are set correctly
4. Check browser console for initialization errors

#### High Error Rates

1. Review Sentry `beforeSend` filters
2. Check for browser extension interference
3. Verify error boundaries are properly implemented
4. Monitor for memory leaks affecting stability

#### Performance Impact

1. Review sampling rates in production
2. Check metrics export frequency
3. Monitor bundle size increases
4. Profile performance monitoring overhead

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('debug', 'observability:*');

// Or via environment
VITE_DEBUG_OBSERVABILITY=true
```

### Monitoring Health

Check monitoring system health:

```bash
# Check service worker status
curl http://localhost:3000/health

# Check metrics endpoint
curl http://localhost:3000/metrics

# Verify Prometheus scraping
curl http://localhost:9090/api/v1/targets
```

## 📞 Support

- **Documentation**: Link to internal runbooks
- **Dashboards**: [Grafana Frontend Dashboards](http://grafana.yourdomain.com)
- **Alerts**: [AlertManager](http://alertmanager.yourdomain.com)
- **Issues**: [GitHub Issues](https://github.com/yourorg/link/issues)
- **Team Contact**: `@frontend-observability-team`

For complete setup instructions, advanced configuration, and troubleshooting guides, see the [monitoring README](../monitoring/README.md).

---

*This document is automatically updated with releases. Last updated: {{ current_date }}*