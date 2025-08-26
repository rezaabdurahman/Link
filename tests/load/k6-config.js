// K6 Load Testing Configuration
// Centralized configuration for all load tests
// Import this into your K6 tests for consistent configuration

export const TEST_ENVIRONMENTS = {
  development: {
    baseUrl: 'http://localhost:8080',
    frontendUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:8080',
    database: {
      host: 'localhost',
      port: 5432,
    },
    sloTargets: {
      availability: 0.95,        // 95% uptime
      apiLatencyP95: 500,        // 500ms P95
      frontendLoadP95: 3000,     // 3s page load
      errorRate: 0.05,           // 5% error rate
    }
  },
  
  staging: {
    baseUrl: 'https://api-staging.link-app.com',
    frontendUrl: 'https://staging.link-app.com', 
    wsUrl: 'wss://api-staging.link-app.com',
    database: {
      host: 'staging-db.link-app.com',
      port: 5432,
    },
    sloTargets: {
      availability: 0.99,        // 99% uptime
      apiLatencyP95: 300,        // 300ms P95
      frontendLoadP95: 2000,     // 2s page load
      errorRate: 0.02,           // 2% error rate
    }
  },
  
  production: {
    baseUrl: 'https://api.link-app.com',
    frontendUrl: 'https://link-app.com',
    wsUrl: 'wss://api.link-app.com',
    database: {
      host: 'prod-db.link-app.com',
      port: 5432,
    },
    sloTargets: {
      availability: 0.999,       // 99.9% uptime
      apiLatencyP95: 200,        // 200ms P95
      frontendLoadP95: 1500,     // 1.5s page load
      errorRate: 0.001,          // 0.1% error rate
    }
  }
};

export const TEST_SCENARIOS = {
  // Smoke test - verify basic functionality
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { test_type: 'smoke' },
  },
  
  // Load test - simulate normal user load
  load: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 10 },
      { duration: '2m', target: 0 },
    ],
    tags: { test_type: 'load' },
  },
  
  // Stress test - find breaking point
  stress: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 30 },
      { duration: '5m', target: 30 },
      { duration: '2m', target: 0 },
    ],
    tags: { test_type: 'stress' },
  },
  
  // Spike test - sudden traffic increases
  spike: {
    executor: 'ramping-vus',
    stages: [
      { duration: '1m', target: 5 },
      { duration: '10s', target: 50 },  // Spike
      { duration: '1m', target: 5 },
      { duration: '10s', target: 60 },  // Bigger spike
      { duration: '1m', target: 0 },
    ],
    tags: { test_type: 'spike' },
  },
  
  // Soak test - prolonged load to find memory leaks
  soak: {
    executor: 'constant-vus',
    vus: 10,
    duration: '1h',
    tags: { test_type: 'soak' },
  },
  
  // Breakpoint test - gradually increase load to failure
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 50,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 200,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 150 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],
    tags: { test_type: 'breakpoint' },
  }
};

export const TEST_DATA = {
  // Test user pools for different scenarios
  users: {
    existing: [
      { email: 'loadtest1@example.com', password: 'LoadTest123!', userId: 1, interests: ['technology', 'music'] },
      { email: 'loadtest2@example.com', password: 'LoadTest123!', userId: 2, interests: ['sports', 'travel'] },
      { email: 'loadtest3@example.com', password: 'LoadTest123!', userId: 3, interests: ['food', 'photography'] },
      { email: 'loadtest4@example.com', password: 'LoadTest123!', userId: 4, interests: ['art', 'books'] },
      { email: 'loadtest5@example.com', password: 'LoadTest123!', userId: 5, interests: ['technology', 'sports'] },
    ],
    
    // Generate new user data
    generateNew: () => ({
      email: `loadtest_${Math.random().toString(36).substring(7)}@example.com`,
      password: 'LoadTest123!',
      first_name: `Test${Math.random().toString(36).substring(7)}`,
      last_name: `User${Math.random().toString(36).substring(7)}`,
      interests: TEST_DATA.interests.slice(0, Math.floor(Math.random() * 4) + 2),
    }),
  },
  
  // Common test data
  interests: [
    'technology', 'sports', 'music', 'travel', 'food', 'photography',
    'art', 'books', 'movies', 'fitness', 'cooking', 'gaming'
  ],
  
  locations: [
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco', city: 'San Francisco', state: 'CA' },
    { lat: 40.7128, lng: -74.0060, name: 'New York', city: 'New York', state: 'NY' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles', city: 'Los Angeles', state: 'CA' },
    { lat: 41.8781, lng: -87.6298, name: 'Chicago', city: 'Chicago', state: 'IL' },
    { lat: 29.7604, lng: -95.3698, name: 'Houston', city: 'Houston', state: 'TX' },
  ],
  
  // Realistic message templates
  messageTemplates: [
    "Hey! How's it going?",
    "That sounds awesome!",
    "I'm interested in that too 😊",
    "What do you think about this?",
    "Cool! Thanks for sharing",
    "I totally agree with you",
    "That's really interesting",
    "Nice to meet you!",
    "What are you up to today?",
    "I love that idea!",
    "Count me in! 🙌",
    "That's so cool",
    "I'm excited about this",
    "Good point! 👍",
    "Absolutely! 💯"
  ],
  
  // Search queries that users commonly make
  searchQueries: [
    'technology enthusiasts',
    'coffee lovers',
    'hiking buddies',
    'music festival',
    'book club',
    'startup founders',
    'photography',
    'fitness motivation',
    'travel adventure',
    'food recommendations'
  ]
};

// Utility functions for load tests
export const TEST_UTILS = {
  // Get environment configuration
  getEnvironmentConfig: (env = 'development') => {
    return TEST_ENVIRONMENTS[env] || TEST_ENVIRONMENTS.development;
  },
  
  // Get test scenario configuration
  getScenarioConfig: (scenario = 'load') => {
    return TEST_SCENARIOS[scenario] || TEST_SCENARIOS.load;
  },
  
  // Random selection utilities
  randomUser: () => {
    const users = TEST_DATA.users.existing;
    return users[Math.floor(Math.random() * users.length)];
  },
  
  randomLocation: () => {
    const locations = TEST_DATA.locations;
    return locations[Math.floor(Math.random() * locations.length)];
  },
  
  randomInterests: (count = 3) => {
    const interests = TEST_DATA.interests;
    const shuffled = interests.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },
  
  randomMessage: () => {
    const templates = TEST_DATA.messageTemplates;
    return templates[Math.floor(Math.random() * templates.length)];
  },
  
  randomSearchQuery: () => {
    const queries = TEST_DATA.searchQueries;
    return queries[Math.floor(Math.random() * queries.length)];
  },
  
  // HTTP request utilities
  createAuthHeaders: (token) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'k6-load-test/1.0'
  }),
  
  createStandardHeaders: () => ({
    'Content-Type': 'application/json',
    'User-Agent': 'k6-load-test/1.0',
    'Accept': 'application/json'
  }),
  
  // Response validation utilities
  isSuccessResponse: (response) => {
    return response.status >= 200 && response.status < 300;
  },
  
  isValidJSON: (response) => {
    try {
      JSON.parse(response.body);
      return true;
    } catch {
      return false;
    }
  },
  
  // Timing utilities
  randomDelay: (min = 1, max = 3) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  // User behavior simulation
  simulateThinkTime: () => {
    // Simulate realistic user "think time" between actions
    const thinkTime = Math.random() < 0.3 ? 
      Math.floor(Math.random() * 2000) + 500 :  // 30% quick actions (0.5-2.5s)
      Math.floor(Math.random() * 8000) + 2000;  // 70% slower actions (2-10s)
    return thinkTime / 1000; // Convert to seconds for sleep()
  },
  
  // Error handling
  logError: (context, response, expectedStatus = [200, 201]) => {
    const status = response ? response.status : 'no response';
    const body = response ? response.body.substring(0, 200) : 'no body';
    console.error(`❌ ${context} failed. Status: ${status}, Expected: ${expectedStatus}, Body: ${body}`);
  },
  
  // Weighted selection utility
  weightedSelect: (options) => {
    const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const option of options) {
      currentWeight += option.weight;
      if (random <= currentWeight) {
        return option.value;
      }
    }
    
    return options[0].value; // Fallback
  }
};

// Common test thresholds based on environment
export const getThresholds = (environment = 'development') => {
  const config = TEST_ENVIRONMENTS[environment];
  const slo = config.sloTargets;
  
  return {
    // HTTP request thresholds
    'http_req_duration': [`p(95)<${slo.apiLatencyP95}`],
    'http_req_failed': [`rate<${slo.errorRate}`],
    
    // SLO-based thresholds
    'slo_api_availability': [`rate>${slo.availability}`],
    'slo_frontend_availability': [`rate>${slo.availability}`],
    'slo_api_latency_p95': [`p(95)<${slo.apiLatencyP95}`],
    'slo_frontend_latency_p95': [`p(95)<${slo.frontendLoadP95}`],
    
    // User journey thresholds
    'journey_success': ['rate>0.95'],
    'authentication_duration': [`p(95)<${slo.apiLatencyP95 * 2}`], // 2x for auth
    'search_response_duration': [`p(95)<${slo.apiLatencyP95 * 3}`], // 3x for search
    
    // WebSocket thresholds
    'ws_connection_errors': ['rate<0.05'],
    'ws_connection_duration': ['p(95)<3000'],
    'message_delivery_duration': ['p(95)<1000'],
  };
};

// Export default configuration
export default {
  environments: TEST_ENVIRONMENTS,
  scenarios: TEST_SCENARIOS,
  data: TEST_DATA,
  utils: TEST_UTILS,
  getThresholds
};