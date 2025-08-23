// Service Worker for exposing Prometheus metrics endpoint
// Handles /metrics requests and returns formatted metrics data

let metricsData = '';
let lastUpdate = 0;

// Listen for messages from main thread with metrics data
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'METRICS_UPDATE') {
    metricsData = event.data.metrics;
    lastUpdate = Date.now();
  }
});

// Handle fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle metrics endpoint
  if (url.pathname === '/metrics') {
    event.respondWith(handleMetricsRequest(event.request));
    return;
  }
  
  // Handle health check
  if (url.pathname === '/health') {
    event.respondWith(handleHealthRequest());
    return;
  }
  
  // For all other requests, let them pass through
  return;
});

async function handleMetricsRequest(request) {
  // Add CORS headers for Prometheus scraping
  const headers = new Headers({
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  // Handle OPTIONS requests for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Return cached metrics if recent, otherwise return basic info
  if (Date.now() - lastUpdate < 60000 && metricsData) { // 1 minute cache
    return new Response(metricsData, { status: 200, headers });
  }

  // Fallback metrics when no data is available
  const fallbackMetrics = `
# HELP frontend_service_worker_status Service worker status
# TYPE frontend_service_worker_status gauge
frontend_service_worker_status{status="active"} 1

# HELP frontend_metrics_last_update_timestamp Last metrics update timestamp
# TYPE frontend_metrics_last_update_timestamp gauge
frontend_metrics_last_update_timestamp ${lastUpdate}

# HELP frontend_metrics_requests_total Total requests to metrics endpoint
# TYPE frontend_metrics_requests_total counter
frontend_metrics_requests_total ${getRequestCount()}
`;

  return new Response(fallbackMetrics.trim(), { status: 200, headers });
}

async function handleHealthRequest() {
  const healthData = {
    status: 'healthy',
    service: 'frontend-metrics',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - (self.registration ? self.registration.installing?.scriptURL ? 0 : Date.now() - 60000 : 0),
    version: '1.0.0',
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Simple counter for metrics requests
let requestCount = 0;
function getRequestCount() {
  return ++requestCount;
}

// Notify main thread that service worker is ready
self.addEventListener('activate', (event) => {
  console.log('Frontend metrics service worker activated');
  
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('install', (event) => {
  console.log('Frontend metrics service worker installed');
  
  // Skip waiting to activate immediately
  event.waitUntil(self.skipWaiting());
});