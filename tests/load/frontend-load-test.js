// Frontend load testing for Link application
// Tests the frontend application under load
// Usage: k6 run tests/load/frontend-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let pageLoadTime = new Trend('page_load_time', true);
export let staticResourceTime = new Trend('static_resource_time', true);
export let totalRequests = new Counter('total_requests');

// Test configuration
export let options = {
  stages: [
    // Warm-up
    { duration: '10s', target: 2 },
    // Ramp up
    { duration: '30s', target: 10 },
    // Stay at peak
    { duration: '1m', target: 10 },
    // Ramp down
    { duration: '10s', target: 0 },
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% under 3s
    http_req_failed: ['rate<0.02'],    // Error rate under 2%
    page_load_time: ['p(90)<2000'],    // 90% of page loads under 2s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test main page load
  testMainPage();
  
  // Test static resources
  testStaticResources();
  
  // Test app routes
  testAppRoutes();
  
  sleep(1);
}

function testMainPage() {
  const start = Date.now();
  const response = http.get(BASE_URL);
  const loadTime = Date.now() - start;
  
  pageLoadTime.add(loadTime);
  totalRequests.add(1);
  
  const success = check(response, {
    'main page status is 200': (r) => r.status === 200,
    'main page loads in <3s': (r) => r.timings.duration < 3000,
    'main page contains React app': (r) => r.body.includes('root'),
    'main page has correct content-type': (r) => r.headers['Content-Type']?.includes('text/html'),
  });
  
  if (!success) {
    errorRate.add(1);
    console.log(`Main page load failed: ${response.status}`);
  }
}

function testStaticResources() {
  // Test common static resources that a frontend app would load
  const staticResources = [
    '/favicon.ico',
    '/manifest.json',
    // Add other static resources your app uses
  ];
  
  staticResources.forEach(resource => {
    const start = Date.now();
    const response = http.get(`${BASE_URL}${resource}`);
    const loadTime = Date.now() - start;
    
    staticResourceTime.add(loadTime);
    totalRequests.add(1);
    
    // Allow 404 for optional resources like favicon
    const success = check(response, {
      [`${resource} loads successfully or 404`]: (r) => r.status === 200 || r.status === 404,
      [`${resource} loads quickly`]: (r) => r.timings.duration < 1000,
    });
    
    if (!success && response.status !== 404) {
      errorRate.add(1);
      console.log(`Static resource ${resource} failed: ${response.status}`);
    }
  });
}

function testAppRoutes() {
  // Test different routes in the SPA
  const routes = [
    '/',
    '/login',
    '/signup', 
    '/dashboard',
    '/profile',
    // Add other routes your app supports
  ];
  
  routes.forEach(route => {
    const start = Date.now();
    const response = http.get(`${BASE_URL}${route}`);
    const loadTime = Date.now() - start;
    
    pageLoadTime.add(loadTime);
    totalRequests.add(1);
    
    // SPA routes should all return the same HTML (React handles routing)
    const success = check(response, {
      [`Route ${route} returns 200`]: (r) => r.status === 200,
      [`Route ${route} loads in <2s`]: (r) => r.timings.duration < 2000,
      [`Route ${route} returns HTML`]: (r) => r.headers['Content-Type']?.includes('text/html'),
    });
    
    if (!success) {
      errorRate.add(1);
      console.log(`Route ${route} failed: ${response.status}`);
    }
  });
}

export function setup() {
  console.log(`Starting frontend load test against ${BASE_URL}`);
  
  // Health check
  const response = http.get(BASE_URL);
  if (response.status !== 200) {
    throw new Error(`Frontend is not available: ${response.status}`);
  }
  
  console.log('Frontend is responding, starting load test...');
  return { baseUrl: BASE_URL };
}

export function teardown(data) {
  console.log('Frontend load test completed');
  console.log(`Total requests made: ${totalRequests.count || 'unknown'}`);
}
