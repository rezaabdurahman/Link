// Basic load testing for Link API endpoints
// Usage: k6 run tests/load/basic-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let loginDuration = new Trend('login_duration', true);
export let apiResponseTime = new Trend('api_response_time', true);

// Test configuration
export let options = {
  stages: [
    // Warm-up
    { duration: '30s', target: 5 },
    // Ramp up to peak load
    { duration: '1m', target: 20 },
    // Stay at peak
    { duration: '2m', target: 20 },
    // Ramp down
    { duration: '30s', target: 0 },
  ],
  
  // Thresholds (SLA requirements)
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    errors: ['rate<0.1'],              // Custom error rate under 10%
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_USER_EMAIL = __ENV.TEST_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!';

// Test scenarios
export default function () {
  let authToken = null;
  
  // Test 1: Health Check
  testHealthCheck();
  
  // Test 2: User Authentication
  authToken = testUserLogin();
  
  if (authToken) {
    // Test 3: Authenticated API calls
    testAuthenticatedEndpoints(authToken);
  }
  
  // Brief pause between iterations
  sleep(1);
}

function testHealthCheck() {
  const response = http.get(`${BASE_URL}/health`);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
    'health check returns JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
  });
  
  if (!success) {
    errorRate.add(1);
    console.log(`Health check failed: ${response.status} ${response.body}`);
  }
}

function testUserLogin() {
  const loginPayload = {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  };
  
  const loginStart = Date.now();
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(loginPayload),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  const loginTime = Date.now() - loginStart;
  loginDuration.add(loginTime);
  
  const success = check(response, {
    'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login response contains token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch (e) {
        return false;
      }
    },
    'login response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  if (success) {
    try {
      const body = JSON.parse(response.body);
      return body.token || body.access_token;
    } catch (e) {
      console.log(`Failed to parse login response: ${e}`);
    }
  } else {
    errorRate.add(1);
    console.log(`Login failed: ${response.status} ${response.body}`);
  }
  
  return null;
}

function testAuthenticatedEndpoints(authToken) {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
  
  // Test different API endpoints
  const endpoints = [
    { method: 'GET', url: '/users/profile', name: 'user_profile' },
    { method: 'GET', url: '/users/me', name: 'user_me' },
    { method: 'GET', url: '/discovery/nearby', name: 'discovery_nearby' },
    { method: 'GET', url: '/stories/timeline', name: 'stories_timeline' },
  ];
  
  endpoints.forEach(endpoint => {
    const start = Date.now();
    let response;
    
    if (endpoint.method === 'GET') {
      response = http.get(`${BASE_URL}${endpoint.url}`, { headers });
    } else if (endpoint.method === 'POST') {
      response = http.post(`${BASE_URL}${endpoint.url}`, '{}', { headers });
    }
    
    const responseTime = Date.now() - start;
    apiResponseTime.add(responseTime);
    
    const success = check(response, {
      [`${endpoint.name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
      [`${endpoint.name} response time < 2s`]: (r) => r.timings.duration < 2000,
    });
    
    if (!success) {
      errorRate.add(1);
      console.log(`${endpoint.name} failed: ${response.status} ${response.body}`);
    }
  });
}

// Setup function (runs once)
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`Test user: ${TEST_USER_EMAIL}`);
  
  // Health check before starting
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    errorRate.add(1);
    console.error(`API is not healthy: ${healthResponse.status}`);
  }
  
  return { baseUrl: BASE_URL };
}

// Teardown function (runs once)
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Tested against: ${data.baseUrl}`);
}
