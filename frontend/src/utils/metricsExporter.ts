// Prometheus metrics exporter for frontend
// Collects and formats client-side metrics for Prometheus consumption

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface Metric {
  name: string;
  type: 'counter' | 'histogram' | 'gauge' | 'summary';
  help: string;
  values: MetricValue[];
}

class PrometheusMetricsExporter {
  private metrics: Map<string, Metric> = new Map();
  private readonly namespace = 'frontend';
  
  // Counter metric (monotonically increasing)
  incrementCounter(name: string, help: string, labels?: Record<string, string>, value: number = 1) {
    const fullName = `${this.namespace}_${name}`;
    
    if (!this.metrics.has(fullName)) {
      this.metrics.set(fullName, {
        name: fullName,
        type: 'counter',
        help,
        values: [],
      });
    }
    
    const metric = this.metrics.get(fullName)!;
    const existingValue = metric.values.find(v => this.labelsEqual(v.labels, labels));
    
    if (existingValue) {
      existingValue.value += value;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({
        value,
        labels,
        timestamp: Date.now(),
      });
    }
  }
  
  // Gauge metric (can increase or decrease)
  setGauge(name: string, help: string, value: number, labels?: Record<string, string>) {
    const fullName = `${this.namespace}_${name}`;
    
    if (!this.metrics.has(fullName)) {
      this.metrics.set(fullName, {
        name: fullName,
        type: 'gauge',
        help,
        values: [],
      });
    }
    
    const metric = this.metrics.get(fullName)!;
    const existingValue = metric.values.find(v => this.labelsEqual(v.labels, labels));
    
    if (existingValue) {
      existingValue.value = value;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({
        value,
        labels,
        timestamp: Date.now(),
      });
    }
  }
  
  // Histogram metric for timing data
  observeHistogram(name: string, help: string, value: number, labels?: Record<string, string>, buckets?: number[]) {
    const fullName = `${this.namespace}_${name}`;
    const defaultBuckets = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const useBuckets = buckets || defaultBuckets;
    
    if (!this.metrics.has(fullName)) {
      this.metrics.set(fullName, {
        name: fullName,
        type: 'histogram',
        help,
        values: [],
      });
    }
    
    const metric = this.metrics.get(fullName)!;
    
    // Create bucket counters
    for (const bucket of useBuckets) {
      if (value <= bucket) {
        const bucketLabels = { ...labels, le: bucket.toString() };
        const bucketValue = metric.values.find(v => this.labelsEqual(v.labels, bucketLabels));
        
        if (bucketValue) {
          bucketValue.value += 1;
          bucketValue.timestamp = Date.now();
        } else {
          metric.values.push({
            value: 1,
            labels: bucketLabels,
            timestamp: Date.now(),
          });
        }
      }
    }
    
    // +Inf bucket
    const infLabels = { ...labels, le: '+Inf' };
    const infValue = metric.values.find(v => this.labelsEqual(v.labels, infLabels));
    
    if (infValue) {
      infValue.value += 1;
      infValue.timestamp = Date.now();
    } else {
      metric.values.push({
        value: 1,
        labels: infLabels,
        timestamp: Date.now(),
      });
    }
  }
  
  // Helper to compare label sets
  private labelsEqual(labels1?: Record<string, string>, labels2?: Record<string, string>): boolean {
    if (!labels1 && !labels2) return true;
    if (!labels1 || !labels2) return false;
    
    const keys1 = Object.keys(labels1).sort();
    const keys2 = Object.keys(labels2).sort();
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => labels1[key] === labels2[key]);
  }
  
  // Export metrics in Prometheus format
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    
    for (const [, metric] of this.metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      for (const value of metric.values) {
        let labelStr = '';
        if (value.labels && Object.keys(value.labels).length > 0) {
          const labelPairs = Object.entries(value.labels)
            .map(([key, val]) => `${key}="${val}"`)
            .join(',');
          labelStr = `{${labelPairs}}`;
        }
        
        const timestamp = value.timestamp || Date.now();
        lines.push(`${metric.name}${labelStr} ${value.value} ${timestamp}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  // Export metrics as JSON (for debugging)
  exportJSON(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, metric] of this.metrics) {
      result[name] = {
        type: metric.type,
        help: metric.help,
        values: metric.values,
      };
    }
    
    return result;
  }
  
  // Clear all metrics
  clear() {
    this.metrics.clear();
  }
  
  // Get metric count
  getMetricCount(): number {
    return this.metrics.size;
  }
}

// Global metrics exporter instance
export const metricsExporter = new PrometheusMetricsExporter();

// Convenience functions for common metrics
export const trackPageLoad = (page: string, duration: number, environment: string = 'development') => {
  metricsExporter.incrementCounter('page_load_total', 'Total page loads', { page, environment });
  metricsExporter.observeHistogram('page_load_duration_seconds', 'Page load duration', duration / 1000, { page, environment });
};

export const trackAPICall = (endpoint: string, method: string, status: number, duration: number, environment: string = 'development') => {
  const labels = { endpoint, method, status: status.toString(), environment };
  
  metricsExporter.incrementCounter('api_request_total', 'Total API requests', labels);
  metricsExporter.observeHistogram('api_request_duration_seconds', 'API request duration', duration / 1000, labels);
  
  if (status >= 400) {
    metricsExporter.incrementCounter('api_request_errors_total', 'Total API request errors', labels);
  }
};

export const trackWebVital = (name: string, value: number, page: string, environment: string = 'development') => {
  const labels = { page, environment };
  
  switch (name) {
    case 'CLS':
      metricsExporter.observeHistogram('web_vitals_cls', 'Cumulative Layout Shift', value, labels, [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]);
      break;
    case 'FID':
      metricsExporter.observeHistogram('web_vitals_fid', 'First Input Delay (ms)', value, labels, [0, 50, 100, 150, 200, 250, 300, 400, 500]);
      break;
    case 'FCP':
      metricsExporter.observeHistogram('web_vitals_fcp', 'First Contentful Paint (ms)', value, labels);
      break;
    case 'LCP':
      metricsExporter.observeHistogram('web_vitals_lcp', 'Largest Contentful Paint (ms)', value, labels);
      break;
    case 'TTFB':
      metricsExporter.observeHistogram('web_vitals_ttfb', 'Time to First Byte (ms)', value, labels);
      break;
  }
};

export const trackUserJourney = (journey: string, step: string, duration?: number, environment: string = 'development') => {
  const labels = { journey, step, environment };
  
  metricsExporter.incrementCounter('user_journey_step_total', 'User journey steps', labels);
  
  if (duration !== undefined) {
    metricsExporter.observeHistogram('user_journey_duration_seconds', 'User journey step duration', duration / 1000, labels);
  }
};

export const trackFeatureUsage = (feature: string, action: string, environment: string = 'development') => {
  const labels = { feature, action, environment };
  metricsExporter.incrementCounter('feature_usage_total', 'Feature usage count', labels);
};

export const trackError = (type: string, page: string, environment: string = 'development') => {
  const labels = { type, page, environment };
  metricsExporter.incrementCounter('javascript_errors_total', 'JavaScript errors', labels);
};

export const trackFormInteraction = (form: string, action: 'start' | 'complete' | 'abandon', field?: string, environment: string = 'development') => {
  const labels = { form, action, environment, ...(field && { field }) };
  metricsExporter.incrementCounter(`form_${action}_total`, `Form ${action} events`, labels);
};

export const setActiveUsers = (count: number, environment: string = 'development') => {
  metricsExporter.setGauge('active_users', 'Currently active users', count, { environment });
};

export const setMemoryUsage = (used: number, total: number, environment: string = 'development') => {
  metricsExporter.setGauge('memory_used_bytes', 'Memory used in bytes', used, { environment });
  metricsExporter.setGauge('memory_total_bytes', 'Total memory in bytes', total, { environment });
};

// Export metrics via service worker or endpoint
export const setupMetricsEndpoint = () => {
  // Register service worker to handle /metrics requests
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/metrics-sw.js').catch(console.warn);
  }
  
  // Alternative: Set up a periodic export to a backend endpoint
  const exportInterval = parseInt(import.meta.env.VITE_METRICS_EXPORT_INTERVAL || '30000', 10);
  
  setInterval(() => {
    if (import.meta.env.VITE_METRICS_EXPORT_URL) {
      exportMetricsToBackend();
    }
  }, exportInterval);
};

// Export metrics to backend service
const exportMetricsToBackend = async () => {
  try {
    const exportUrl = import.meta.env.VITE_METRICS_EXPORT_URL;
    if (!exportUrl) {
      console.warn('No metrics export URL configured');
      return;
    }
    
    const metrics = metricsExporter.exportPrometheusFormat();
    
    await fetch(exportUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: metrics,
    });
  } catch (error) {
    console.warn('Failed to export metrics:', error);
  }
};