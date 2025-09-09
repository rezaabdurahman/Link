// Comprehensive K6 Load Testing for Critical User Journeys
// Tests all major user flows under production-like conditions
// Usage: k6 run --env SCENARIO=<scenario_name> tests/load/comprehensive-user-journeys.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

export let errorRate = new Rate('errors');
export let journeySuccessRate = new Rate('journey_success');
export let authenticationTime = new Trend('authentication_duration', true);
export let discoveryLoadTime = new Trend('discovery_load_duration', true);
export let chatLoadTime = new Trend('chat_load_duration', true);
export let searchResponseTime = new Trend('search_response_duration', true);
export let aiSummaryTime = new Trend('ai_summary_duration', true);
export let featureFlagTime = new Trend('feature_flag_duration', true);
export let websocketConnectionTime = new Trend('websocket_connection_duration', true);
export let totalAPIRequests = new Counter('total_api_requests');
export let journeyStepCounter = new Counter('journey_steps_completed');

// ============================================================================
// TEST CONFIGURATION & SCENARIOS  
// ============================================================================

const SCENARIOS = {
  // Smoke test - minimal load to verify basic functionality
  smoke: {
    stages: [{ duration: '1m', target: 1 }],
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed: ['rate<0.05'],
      journey_success: ['rate>0.9'],
    }
  },
  
  // Load test - normal production traffic
  load: {
    stages: [
      { duration: '2m', target: 10 },   // Ramp up
      { duration: '5m', target: 10 },   // Stay
      { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000', 'p(99)<5000'],
      http_req_failed: ['rate<0.02'],
      journey_success: ['rate>0.95'],
      authentication_duration: ['p(95)<2000'],
      discovery_load_duration: ['p(95)<1500'],
    }
  },
  
  // Stress test - beyond normal capacity
  stress: {
    stages: [
      { duration: '2m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 40 },
      { duration: '5m', target: 40 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed: ['rate<0.1'],
      journey_success: ['rate>0.8'],
    }
  },
  
  // Spike test - sudden traffic spikes
  spike: {
    stages: [
      { duration: '1m', target: 5 },
      { duration: '10s', target: 50 },  // Sudden spike
      { duration: '1m', target: 5 },
      { duration: '10s', target: 50 },  // Second spike
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<8000'],
      http_req_failed: ['rate<0.15'],
    }
  }
};

const scenario = __ENV.SCENARIO || 'load';
export let options = SCENARIOS[scenario];

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080';

// Test user pools for different scenarios
const TEST_USERS = {
  existing: [
    { email: 'loadtest1@example.com', password: 'LoadTest123!', userId: 1 },
    { email: 'loadtest2@example.com', password: 'LoadTest123!', userId: 2 },
    { email: 'loadtest3@example.com', password: 'LoadTest123!', userId: 3 },
  ],
  interests: ['technology', 'sports', 'music', 'travel', 'food', 'photography'],
  locations: [
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
    { lat: 40.7128, lng: -74.0060, name: 'New York' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
  ]
};

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

export default function() {
  const userIndex = Math.floor(Math.random() * TEST_USERS.existing.length);
  const testUser = TEST_USERS.existing[userIndex];
  
  // Weighted journey selection based on real user behavior
  const journeyWeights = [
    { journey: 'completeRegistrationJourney', weight: 10 },    // 10%
    { journey: 'authenticatedDiscoveryJourney', weight: 40 },  // 40% 
    { journey: 'chatJourney', weight: 25 },                   // 25%
    { journey: 'searchJourney', weight: 15 },                 // 15%
    { journey: 'profileManagementJourney', weight: 10 },      // 10%
  ];
  
  const selectedJourney = selectWeightedJourney(journeyWeights);
  
  let journeySuccess = false;
  try {
    switch(selectedJourney) {
      case 'completeRegistrationJourney':
        journeySuccess = executeRegistrationJourney();
        break;
      case 'authenticatedDiscoveryJourney':
        journeySuccess = executeDiscoveryJourney(testUser);
        break;
      case 'chatJourney':
        journeySuccess = executeChatJourney(testUser);
        break;
      case 'searchJourney':
        journeySuccess = executeSearchJourney(testUser);
        break;
      case 'profileManagementJourney':
        journeySuccess = executeProfileJourney(testUser);
        break;
      default:
        journeySuccess = executeDiscoveryJourney(testUser);
    }
  } catch (error) {
    console.error(`Journey ${selectedJourney} failed with error: ${error}`);
    journeySuccess = false;
  }
  
  journeySuccessRate.add(journeySuccess ? 1 : 0);
  
  // Realistic pause between user sessions
  sleep(randomIntBetween(1, 3));
}

// ============================================================================
// JOURNEY IMPLEMENTATIONS
// ============================================================================

function executeRegistrationJourney() {
  return group('🚀 Complete Registration Journey', () => {
    let authToken = null;
    let success = true;
    
    // Step 1: Load registration page
    group('Load Registration Page', () => {
      const response = http.get(`${FRONTEND_URL}/register`);
      const stepSuccess = check(response, {
        'registration page loads': (r) => r.status === 200,
        'registration page contains form': (r) => r.body.includes('register') || r.body.includes('signup'),
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 2: Create new user account
    group('User Registration', () => {
      const newUser = {
        email: `loadtest_${randomString(8)}@example.com`,
        password: 'LoadTest123!',
        first_name: `Test${randomString(5)}`,
        last_name: `User${randomString(5)}`,
        interests: TEST_USERS.interests.slice(0, randomIntBetween(2, 4)),
      };
      
      const start = Date.now();
      const response = http.post(
        `${BASE_URL}/auth/register`,
        JSON.stringify(newUser),
        { headers: { 'Content-Type': 'application/json' } }
      );
      authenticationTime.add(Date.now() - start);
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'registration successful': (r) => [200, 201].includes(r.status),
        'registration returns user data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.user || body.id;
          } catch { return false; }
        },
        'registration under 3s': (r) => r.timings.duration < 3000,
      });
      
      if (stepSuccess && response.status < 300) {
        try {
          const body = JSON.parse(response.body);
          authToken = body.token || body.access_token;
        } catch (e) {
          console.log('Failed to parse registration response');
        }
      }
      
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 3: Complete onboarding process
    if (authToken) {
      group('Onboarding Completion', () => {
        const onboardingData = {
          interests: TEST_USERS.interests.slice(0, 3),
          location: TEST_USERS.locations[0],
          bio: `Test user bio ${randomString(10)}`,
        };
        
        const response = http.post(
          `${BASE_URL}/users/onboarding/complete`,
          JSON.stringify(onboardingData),
          { headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }}
        );
        totalAPIRequests.add(1);
        
        const stepSuccess = check(response, {
          'onboarding completion successful': (r) => [200, 204].includes(r.status),
          'onboarding under 2s': (r) => r.timings.duration < 2000,
        });
        
        success = success && stepSuccess;
        journeyStepCounter.add(1);
      });
    }
    
    if (!success) errorRate.add(1);
    return success;
  });
}

function executeDiscoveryJourney(testUser) {
  return group('🔍 Authenticated Discovery Journey', () => {
    let authToken = null;
    let success = true;
    
    // Step 1: Authenticate user
    group('User Authentication', () => {
      authToken = authenticateUser(testUser);
      success = success && (authToken !== null);
      journeyStepCounter.add(1);
    });
    
    if (!authToken) {
      errorRate.add(1);
      return false;
    }
    
    // Step 2: Load discovery page
    group('Load Discovery Page', () => {
      const response = http.get(`${FRONTEND_URL}/discovery`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const stepSuccess = check(response, {
        'discovery page loads': (r) => r.status === 200,
        'discovery page under 2s': (r) => r.timings.duration < 2000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 3: Get nearby users
    group('Discovery API - Nearby Users', () => {
      const start = Date.now();
      const response = http.get(
        `${BASE_URL}/discovery/nearby?limit=20&radius=10`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      discoveryLoadTime.add(Date.now() - start);
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'nearby users loaded': (r) => r.status === 200,
        'nearby users under 1.5s': (r) => r.timings.duration < 1500,
        'nearby users returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.users || body);
          } catch { return false; }
        }
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 4: Toggle availability
    group('Update Availability Status', () => {
      const response = http.post(
        `${BASE_URL}/discovery/availability`,
        JSON.stringify({ available: true, location: TEST_USERS.locations[0] }),
        { headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'availability update successful': (r) => [200, 204].includes(r.status),
        'availability update under 1s': (r) => r.timings.duration < 1000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 5: Check feature flags for discovery features
    group('Feature Flag Evaluation', () => {
      const start = Date.now();
      const response = http.get(
        `${BASE_URL}/features/evaluate?flags=enhanced_discovery,proximity_filters`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      featureFlagTime.add(Date.now() - start);
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'feature flags loaded': (r) => r.status === 200,
        'feature flags under 500ms': (r) => r.timings.duration < 500,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    if (!success) errorRate.add(1);
    return success;
  });
}

function executeChatJourney(testUser) {
  return group('💬 Chat Journey', () => {
    let authToken = null;
    let success = true;
    
    // Step 1: Authenticate
    group('User Authentication', () => {
      authToken = authenticateUser(testUser);
      success = success && (authToken !== null);
      journeyStepCounter.add(1);
    });
    
    if (!authToken) {
      errorRate.add(1);
      return false;
    }
    
    // Step 2: Load chat page
    group('Load Chat Interface', () => {
      const start = Date.now();
      const response = http.get(`${FRONTEND_URL}/chat`);
      chatLoadTime.add(Date.now() - start);
      
      const stepSuccess = check(response, {
        'chat page loads': (r) => r.status === 200,
        'chat page under 2s': (r) => r.timings.duration < 2000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 3: Get conversations list
    group('Load Conversations', () => {
      const response = http.get(
        `${BASE_URL}/chat/conversations?limit=50`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'conversations loaded': (r) => r.status === 200,
        'conversations under 1s': (r) => r.timings.duration < 1000,
        'conversations returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.conversations || body);
          } catch { return false; }
        }
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 4: Send a message (simulated)
    group('Send Message', () => {
      const messageData = {
        recipient_id: randomIntBetween(1, 100),
        content: `Test message ${randomString(20)}`,
        message_type: 'text'
      };
      
      const response = http.post(
        `${BASE_URL}/chat/messages`,
        JSON.stringify(messageData),
        { headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'message sent successfully': (r) => [200, 201].includes(r.status),
        'message send under 1s': (r) => r.timings.duration < 1000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 5: Test AI conversation summary
    group('AI Conversation Summary', () => {
      const start = Date.now();
      const response = http.get(
        `${BASE_URL}/ai/conversations/1/summary`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      aiSummaryTime.add(Date.now() - start);
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'AI summary loads': (r) => [200, 404].includes(r.status), // 404 is acceptable if no conversation
        'AI summary under 5s': (r) => r.timings.duration < 5000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    if (!success) errorRate.add(1);
    return success;
  });
}

function executeSearchJourney(testUser) {
  return group('🔎 Search Journey', () => {
    let authToken = null;
    let success = true;
    
    // Step 1: Authenticate
    group('User Authentication', () => {
      authToken = authenticateUser(testUser);
      success = success && (authToken !== null);
      journeyStepCounter.add(1);
    });
    
    if (!authToken) {
      errorRate.add(1);
      return false;
    }
    
    // Step 2: Perform user search
    group('User Search', () => {
      const searchQueries = ['technology', 'sports', 'music', 'travel', 'food'];
      const query = searchQueries[randomIntBetween(0, searchQueries.length - 1)];
      
      const start = Date.now();
      const response = http.get(
        `${BASE_URL}/search/users?query=${encodeURIComponent(query)}&limit=20`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      searchResponseTime.add(Date.now() - start);
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'search results loaded': (r) => r.status === 200,
        'search under 2s': (r) => r.timings.duration < 2000,
        'search returns results': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.results || body.users || Array.isArray(body);
          } catch { return false; }
        }
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 3: Advanced search with filters
    group('Advanced Search with Filters', () => {
      const searchData = {
        query: 'technology music professionals aged 25-35',
        filters: {
          location: { radius: 50, lat: 37.7749, lng: -122.4194 }
        },
        limit: 10
      };
      
      const response = http.post(
        `${BASE_URL}/search/advanced`,
        JSON.stringify(searchData),
        { headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'advanced search successful': (r) => r.status === 200,
        'advanced search under 3s': (r) => r.timings.duration < 3000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 4: Search reindexing status (admin endpoint)
    group('Search Health Check', () => {
      const response = http.get(
        `${BASE_URL}/search/health`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'search health check': (r) => r.status === 200,
        'search health under 1s': (r) => r.timings.duration < 1000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    if (!success) errorRate.add(1);
    return success;
  });
}

function executeProfileJourney(testUser) {
  return group('👤 Profile Management Journey', () => {
    let authToken = null;
    let success = true;
    
    // Step 1: Authenticate
    group('User Authentication', () => {
      authToken = authenticateUser(testUser);
      success = success && (authToken !== null);
      journeyStepCounter.add(1);
    });
    
    if (!authToken) {
      errorRate.add(1);
      return false;
    }
    
    // Step 2: Load profile page
    group('Load Profile Page', () => {
      const response = http.get(`${FRONTEND_URL}/profile`);
      
      const stepSuccess = check(response, {
        'profile page loads': (r) => r.status === 200,
        'profile page under 2s': (r) => r.timings.duration < 2000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 3: Get user profile data
    group('Load Profile Data', () => {
      const response = http.get(
        `${BASE_URL}/users/me`,
        { headers: { 'Authorization': `Bearer ${authToken}` }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'profile data loaded': (r) => r.status === 200,
        'profile data under 1s': (r) => r.timings.duration < 1000,
        'profile contains user info': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.email || body.id;
          } catch { return false; }
        }
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 4: Update profile
    group('Update Profile', () => {
      const updateData = {
        bio: `Updated bio ${randomString(15)}`,
        interests: TEST_USERS.interests.slice(0, randomIntBetween(3, 5)),
      };
      
      const response = http.put(
        `${BASE_URL}/users/profile`,
        JSON.stringify(updateData),
        { headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'profile update successful': (r) => [200, 204].includes(r.status),
        'profile update under 2s': (r) => r.timings.duration < 2000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    // Step 5: Update privacy settings
    group('Update Privacy Settings', () => {
      const privacyData = {
        profile_visibility: 'friends',
        location_sharing: true,
        activity_status: 'visible'
      };
      
      const response = http.put(
        `${BASE_URL}/users/privacy`,
        JSON.stringify(privacyData),
        { headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }}
      );
      totalAPIRequests.add(1);
      
      const stepSuccess = check(response, {
        'privacy update successful': (r) => [200, 204].includes(r.status),
        'privacy update under 1s': (r) => r.timings.duration < 1000,
      });
      success = success && stepSuccess;
      journeyStepCounter.add(1);
    });
    
    if (!success) errorRate.add(1);
    return success;
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function authenticateUser(user) {
  const start = Date.now();
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  authenticationTime.add(Date.now() - start);
  totalAPIRequests.add(1);
  
  const success = check(response, {
    'authentication successful': (r) => [200, 201].includes(r.status),
    'auth response contains token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch { return false; }
    }
  });
  
  if (success) {
    try {
      const body = JSON.parse(response.body);
      return body.token || body.access_token;
    } catch (e) {
      console.log('Failed to parse authentication response');
    }
  }
  
  return null;
}

function selectWeightedJourney(journeyWeights) {
  const totalWeight = journeyWeights.reduce((sum, item) => sum + item.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const item of journeyWeights) {
    currentWeight += item.weight;
    if (random <= currentWeight) {
      return item.journey;
    }
  }
  
  return journeyWeights[0].journey; // Fallback
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log(`🚀 Starting comprehensive user journey tests`);
  console.log(`📊 Scenario: ${scenario}`);
  console.log(`🎯 Target: ${BASE_URL}`);
  console.log(`🖥️  Frontend: ${FRONTEND_URL}`);
  
  // Health check all services
  const services = [
    { name: 'API Gateway', url: `${BASE_URL}/health` },
    { name: 'Frontend', url: FRONTEND_URL },
  ];
  
  services.forEach(service => {
    const response = http.get(service.url, { timeout: '10s' });
    if (response.status !== 200) {
      console.error(`❌ ${service.name} health check failed: ${response.status}`);
    } else {
      console.log(`✅ ${service.name} is healthy`);
    }
  });
  
  return { 
    baseUrl: BASE_URL, 
    frontendUrl: FRONTEND_URL,
    scenario: scenario,
    startTime: new Date().toISOString()
  };
}

export function teardown(data) {
  const duration = Math.round((Date.now() - new Date(data.startTime).getTime()) / 1000);
  
  console.log('\n🏁 Comprehensive Journey Testing Complete');
  console.log(`📊 Scenario: ${data.scenario}`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📈 Total API Requests: ${totalAPIRequests.count || 'N/A'}`);
  console.log(`📋 Journey Steps Completed: ${journeyStepCounter.count || 'N/A'}`);
  console.log(`✅ Target: ${data.baseUrl}`);
  console.log('\n📋 Key Metrics Summary:');
  console.log('  - journey_success: Journey completion rate');
  console.log('  - authentication_duration: Auth response times');
  console.log('  - discovery_load_duration: Discovery page load times');
  console.log('  - chat_load_duration: Chat functionality response times');
  console.log('  - search_response_duration: Search API response times');
  console.log('  - ai_summary_duration: AI service response times');
  console.log('  - feature_flag_duration: Feature flag evaluation times');
}