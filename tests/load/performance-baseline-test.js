// Performance Baseline Testing
// Establishes performance baselines and validates SLO compliance
// Usage: k6 run --env TARGET_ENV=<env> tests/load/performance-baseline-test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// SLO-BASED CUSTOM METRICS
// ============================================================================

// Availability SLOs (99.9% target)
export let sloApiAvailability = new Rate('slo_api_availability');
export let sloFrontendAvailability = new Rate('slo_frontend_availability');
export let sloServiceAvailability = new Rate('slo_service_availability');

// Latency SLOs (P95 targets)
export let sloApiLatencyP95 = new Trend('slo_api_latency_p95', true);
export let sloFrontendLatencyP95 = new Trend('slo_frontend_latency_p95', true);
export let sloSearchLatencyP95 = new Trend('slo_search_latency_p95', true);
export let sloAILatencyP95 = new Trend('slo_ai_latency_p95', true);

// User Journey SLOs
export let sloRegistrationSuccess = new Rate('slo_registration_success');
export let sloLoginSuccess = new Rate('slo_login_success');
export let sloDiscoverySuccess = new Rate('slo_discovery_success');
export let sloChatMessageDelivery = new Rate('slo_chat_message_delivery');

// Error Budget Metrics
export let errorBudgetConsumption = new Counter('error_budget_consumption');
export let criticalErrorRate = new Rate('critical_error_rate');

// ============================================================================
// ENVIRONMENT-SPECIFIC CONFIGURATION
// ============================================================================

const TARGET_ENV = __ENV.TARGET_ENV || 'development';

const ENVIRONMENTS = {
  development: {
    baseUrl: 'http://localhost:8080',
    frontendUrl: 'http://localhost:3000',
    expectedLatency: { api: 200, frontend: 2000, search: 1500, ai: 5000 },
    availabilityTarget: 0.95, // 95% for dev
    errorRateTarget: 0.05     // 5% errors acceptable in dev
  },
  staging: {
    baseUrl: 'https://api-staging.link-app.com',
    frontendUrl: 'https://staging.link-app.com',
    expectedLatency: { api: 150, frontend: 1500, search: 1000, ai: 4000 },
    availabilityTarget: 0.99,  // 99% for staging
    errorRateTarget: 0.02      // 2% errors acceptable in staging
  },
  production: {
    baseUrl: 'https://api.link-app.com',
    frontendUrl: 'https://link-app.com',
    expectedLatency: { api: 100, frontend: 1000, search: 800, ai: 3000 },
    availabilityTarget: 0.999, // 99.9% for production
    errorRateTarget: 0.001     // 0.1% errors acceptable in production
  }
};

const ENV_CONFIG = ENVIRONMENTS[TARGET_ENV];
const { baseUrl, frontendUrl, expectedLatency, availabilityTarget, errorRateTarget } = ENV_CONFIG;

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

export let options = {
  stages: [
    { duration: '1m', target: 5 },    // Warm up
    { duration: '10m', target: 10 },  // Sustained baseline load
    { duration: '1m', target: 0 },    // Cool down
  ],
  
  // SLO-based thresholds
  thresholds: {
    // API Gateway SLOs (99.9% availability, <200ms P95)
    'slo_api_availability': [`rate>${availabilityTarget}`],
    'slo_api_latency_p95': [`p(95)<${expectedLatency.api}`],
    
    // Frontend SLOs
    'slo_frontend_availability': [`rate>${availabilityTarget}`],
    'slo_frontend_latency_p95': [`p(95)<${expectedLatency.frontend}`],
    
    // Service-specific SLOs
    'slo_search_latency_p95': [`p(95)<${expectedLatency.search}`],
    'slo_ai_latency_p95': [`p(95)<${expectedLatency.ai}`],
    
    // User Journey SLOs (95% success rate minimum)
    'slo_registration_success': ['rate>0.95'],
    'slo_login_success': ['rate>0.98'],
    'slo_discovery_success': ['rate>0.97'],
    'slo_chat_message_delivery': ['rate>0.99'],
    
    // Overall error rates
    'critical_error_rate': [`rate<${errorRateTarget}`],
    'http_req_failed': [`rate<${errorRateTarget}`],
  }
};

// Test user configuration
const TEST_USERS = [
  { email: 'baseline1@example.com', password: 'Baseline123!', userId: 1 },
  { email: 'baseline2@example.com', password: 'Baseline123!', userId: 2 },
  { email: 'baseline3@example.com', password: 'Baseline123!', userId: 3 },
];

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

export default function() {
  const testUser = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  // Weighted test distribution matching real user behavior
  const testWeights = [
    { test: 'baselineAPIHealthChecks', weight: 30 },      // 30% - Health monitoring
    { test: 'baselineUserAuthFlow', weight: 25 },         // 25% - Authentication
    { test: 'baselineDiscoveryFlow', weight: 20 },        // 20% - Discovery
    { test: 'baselineChatFlow', weight: 15 },             // 15% - Chat
    { test: 'baselineSearchFlow', weight: 10 },           // 10% - Search
  ];
  
  const selectedTest = selectWeightedTest(testWeights);
  
  try {
    switch(selectedTest) {
      case 'baselineAPIHealthChecks':
        executeAPIHealthBaseline();
        break;
      case 'baselineUserAuthFlow':
        executeUserAuthBaseline(testUser);
        break;
      case 'baselineDiscoveryFlow':
        executeDiscoveryBaseline(testUser);
        break;
      case 'baselineChatFlow':
        executeChatBaseline(testUser);
        break;
      case 'baselineSearchFlow':
        executeSearchBaseline(testUser);
        break;
    }
  } catch (error) {
    console.error(`Baseline test ${selectedTest} failed: ${error}`);
    criticalErrorRate.add(1);
    errorBudgetConsumption.add(1);
  }
  
  sleep(randomIntBetween(1, 2));
}

// ============================================================================
// BASELINE TEST IMPLEMENTATIONS
// ============================================================================

function executeAPIHealthBaseline() {
  group('🔍 API Health Baseline', () => {
    const endpoints = [
      { name: 'API Gateway Health', path: '/health' },
      { name: 'API Gateway Version', path: '/version' },
      { name: 'API Gateway Metrics', path: '/metrics' },
    ];
    
    endpoints.forEach(endpoint => {
      const startTime = Date.now();
      const response = http.get(`${baseUrl}${endpoint.path}`, {
        timeout: '10s',
        tags: { endpoint: endpoint.name }
      });
      const duration = Date.now() - startTime;
      
      sloApiLatencyP95.add(duration);
      
      const isAvailable = check(response, {
        [`${endpoint.name} is available`]: (r) => r.status === 200,
        [`${endpoint.name} responds quickly`]: (r) => r.timings.duration < expectedLatency.api,
      });
      
      sloApiAvailability.add(isAvailable ? 1 : 0);
      
      if (!isAvailable) {
        errorBudgetConsumption.add(1);
        if (endpoint.path === '/health') {
          criticalErrorRate.add(1); // Health endpoint failures are critical
        }
      }
    });
  });
}

function executeUserAuthBaseline(testUser) {
  group('🔐 User Authentication Baseline', () => {
    let success = true;
    
    // Registration baseline
    group('Registration Flow', () => {
      const newUser = {
        email: `baseline_${randomString(8)}@example.com`,
        password: 'Baseline123!',
        first_name: 'Baseline',
        last_name: 'User',
      };
      
      const startTime = Date.now();
      const response = http.post(
        `${baseUrl}/auth/register`,
        JSON.stringify(newUser),
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: '5s',
          tags: { flow: 'registration' }
        }
      );
      const duration = Date.now() - startTime;
      
      sloApiLatencyP95.add(duration);
      
      const registrationSuccess = check(response, {
        'registration succeeds': (r) => [200, 201].includes(r.status),
        'registration returns user data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.user || body.id;
          } catch { return false; }
        },
        'registration meets SLO': (r) => r.timings.duration < expectedLatency.api * 2, // 2x for creation
      });
      
      sloRegistrationSuccess.add(registrationSuccess ? 1 : 0);
      success = success && registrationSuccess;
    });
    
    // Login baseline
    group('Login Flow', () => {
      const startTime = Date.now();
      const response = http.post(
        `${baseUrl}/auth/login`,
        JSON.stringify({ email: testUser.email, password: testUser.password }),
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: '3s',
          tags: { flow: 'login' }
        }
      );
      const duration = Date.now() - startTime;
      
      sloApiLatencyP95.add(duration);
      
      const loginSuccess = check(response, {
        'login succeeds': (r) => [200, 201].includes(r.status),
        'login returns token': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.token || body.access_token;
          } catch { return false; }
        },
        'login meets SLO': (r) => r.timings.duration < expectedLatency.api,
      });
      
      sloLoginSuccess.add(loginSuccess ? 1 : 0);
      success = success && loginSuccess;
    });
    
    if (!success) {
      errorBudgetConsumption.add(1);
    }
  });
}

function executeDiscoveryBaseline(testUser) {
  group('🔍 Discovery Flow Baseline', () => {
    const authToken = authenticateUser(testUser);
    if (!authToken) {
      sloDiscoverySuccess.add(0);
      errorBudgetConsumption.add(1);
      return;
    }
    
    let success = true;
    
    // Frontend page load
    group('Discovery Page Load', () => {
      const startTime = Date.now();
      const response = http.get(`${frontendUrl}/discovery`, {
        timeout: '10s',
        tags: { page: 'discovery' }
      });
      const duration = Date.now() - startTime;
      
      sloFrontendLatencyP95.add(duration);
      
      const pageSuccess = check(response, {
        'discovery page loads': (r) => r.status === 200,
        'discovery page meets SLO': (r) => r.timings.duration < expectedLatency.frontend,
      });
      
      sloFrontendAvailability.add(pageSuccess ? 1 : 0);
      success = success && pageSuccess;
    });
    
    // Discovery API calls
    group('Discovery API Baseline', () => {
      const endpoints = [
        '/discovery/nearby?limit=20',
        '/discovery/availability',
        '/users/me'
      ];
      
      endpoints.forEach(endpoint => {
        const startTime = Date.now();
        const response = http.get(`${baseUrl}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          timeout: '5s',
          tags: { api: 'discovery' }
        });
        const duration = Date.now() - startTime;
        
        sloApiLatencyP95.add(duration);
        
        const apiSuccess = check(response, {
          [`${endpoint} responds successfully`]: (r) => r.status === 200,
          [`${endpoint} meets SLO`]: (r) => r.timings.duration < expectedLatency.api,
        });
        
        sloServiceAvailability.add(apiSuccess ? 1 : 0);
        success = success && apiSuccess;
      });
    });
    
    sloDiscoverySuccess.add(success ? 1 : 0);
    if (!success) {
      errorBudgetConsumption.add(1);
    }
  });
}

function executeChatBaseline(testUser) {
  group('💬 Chat Flow Baseline', () => {
    const authToken = authenticateUser(testUser);
    if (!authToken) {
      sloChatMessageDelivery.add(0);
      errorBudgetConsumption.add(1);
      return;
    }
    
    let success = true;
    
    // Chat API baseline
    group('Chat API Baseline', () => {
      const endpoints = [
        '/chat/conversations?limit=10',
        '/chat/messages?conversation_id=1&limit=20'
      ];
      
      endpoints.forEach(endpoint => {
        const startTime = Date.now();
        const response = http.get(`${baseUrl}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          timeout: '3s',
          tags: { api: 'chat' }
        });
        const duration = Date.now() - startTime;
        
        sloApiLatencyP95.add(duration);
        
        const apiSuccess = check(response, {
          [`Chat ${endpoint} responds`]: (r) => r.status === 200,
          [`Chat ${endpoint} meets SLO`]: (r) => r.timings.duration < expectedLatency.api,
        });
        
        success = success && apiSuccess;
      });
    });
    
    // Message send baseline
    group('Message Send Baseline', () => {
      const messageData = {
        recipient_id: randomIntBetween(1, 10),
        content: `Baseline test message ${randomString(10)}`,
        message_type: 'text'
      };
      
      const startTime = Date.now();
      const response = http.post(
        `${baseUrl}/chat/messages`,
        JSON.stringify(messageData),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          timeout: '5s',
          tags: { operation: 'message_send' }
        }
      );
      const duration = Date.now() - startTime;
      
      sloApiLatencyP95.add(duration);
      
      const sendSuccess = check(response, {
        'message sends successfully': (r) => [200, 201].includes(r.status),
        'message send meets SLO': (r) => r.timings.duration < expectedLatency.api,
      });
      
      success = success && sendSuccess;
    });
    
    sloChatMessageDelivery.add(success ? 1 : 0);
    if (!success) {
      errorBudgetConsumption.add(1);
    }
  });
}

function executeSearchBaseline(testUser) {
  group('🔎 Search Flow Baseline', () => {
    const authToken = authenticateUser(testUser);
    if (!authToken) {
      errorBudgetConsumption.add(1);
      return;
    }
    
    const searchQueries = ['technology', 'sports', 'music', 'travel'];
    const query = searchQueries[randomIntBetween(0, searchQueries.length - 1)];
    
    const startTime = Date.now();
    const response = http.get(
      `${baseUrl}/search/users?query=${encodeURIComponent(query)}&limit=10`,
      { 
        headers: { 'Authorization': `Bearer ${authToken}` },
        timeout: '8s',
        tags: { api: 'search' }
      }
    );
    const duration = Date.now() - startTime;
    
    sloSearchLatencyP95.add(duration);
    
    const searchSuccess = check(response, {
      'search responds successfully': (r) => r.status === 200,
      'search meets SLO': (r) => r.timings.duration < expectedLatency.search,
      'search returns results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.results || body.users || Array.isArray(body);
        } catch { return false; }
      }
    });
    
    if (!searchSuccess) {
      errorBudgetConsumption.add(1);
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function authenticateUser(user) {
  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { 
      headers: { 'Content-Type': 'application/json' },
      timeout: '3s'
    }
  );
  
  if ([200, 201].includes(response.status)) {
    try {
      const body = JSON.parse(response.body);
      return body.token || body.access_token;
    } catch (e) {
      console.log('Failed to parse authentication response');
    }
  }
  
  return null;
}

function selectWeightedTest(testWeights) {
  const totalWeight = testWeights.reduce((sum, item) => sum + item.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const item of testWeights) {
    currentWeight += item.weight;
    if (random <= currentWeight) {
      return item.test;
    }
  }
  
  return testWeights[0].test;
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log(`📊 Starting Performance Baseline Testing`);
  console.log(`🎯 Environment: ${TARGET_ENV}`);
  console.log(`🌐 API: ${baseUrl}`);
  console.log(`🖥️  Frontend: ${frontendUrl}`);
  console.log(`📈 SLO Targets:`);
  console.log(`   - Availability: ${(availabilityTarget * 100).toFixed(1)}%`);
  console.log(`   - API Latency P95: ${expectedLatency.api}ms`);
  console.log(`   - Frontend Load P95: ${expectedLatency.frontend}ms`);
  console.log(`   - Search Latency P95: ${expectedLatency.search}ms`);
  console.log(`   - AI Latency P95: ${expectedLatency.ai}ms`);
  console.log(`   - Error Rate: <${(errorRateTarget * 100).toFixed(2)}%`);
  
  // Verify environment health
  const healthCheck = http.get(`${baseUrl}/health`, { timeout: '10s' });
  if (healthCheck.status !== 200) {
    throw new Error(`Environment ${TARGET_ENV} failed health check: ${healthCheck.status}`);
  }
  
  console.log(`✅ Environment health check passed`);
  
  return { 
    environment: TARGET_ENV,
    config: ENV_CONFIG,
    startTime: new Date().toISOString()
  };
}

export function teardown(data) {
  const duration = Math.round((Date.now() - new Date(data.startTime).getTime()) / 1000);
  
  console.log('\n🏁 Performance Baseline Test Complete');
  console.log(`🎯 Environment: ${data.environment}`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`💸 Error Budget Consumed: ${errorBudgetConsumption.count || 0} events`);
  
  console.log('\n📊 SLO Baseline Results Summary:');
  console.log('  ✅ SLO metrics have been established for:');
  console.log('     - API Gateway availability and latency');
  console.log('     - Frontend page load performance');  
  console.log('     - User journey success rates');
  console.log('     - Service-specific response times');
  console.log('     - Error budget consumption tracking');
  
  console.log('\n🎯 Use this data to:');
  console.log('  - Set up Prometheus recording rules');
  console.log('  - Configure Grafana SLO dashboards');
  console.log('  - Define alerting thresholds');
  console.log('  - Track performance regressions');
  console.log(`  - Monitor ${data.environment} environment health`);
}