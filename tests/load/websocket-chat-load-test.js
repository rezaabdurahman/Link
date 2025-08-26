// WebSocket Chat Load Testing
// Tests real-time chat functionality under load
// Usage: k6 run --env SCENARIO=<scenario> tests/load/websocket-chat-load-test.js

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

export let wsConnectionErrors = new Rate('ws_connection_errors');
export let wsConnectionTime = new Trend('ws_connection_duration', true);
export let messageDeliveryTime = new Trend('message_delivery_duration', true);
export let messagesPerSecond = new Rate('messages_per_second');
export let activeConnections = new Counter('active_ws_connections');
export let messagesSent = new Counter('total_messages_sent');
export let messagesReceived = new Counter('total_messages_received');

// ============================================================================
// TEST SCENARIOS
// ============================================================================

const SCENARIOS = {
  // Basic WebSocket functionality test
  smoke: {
    stages: [{ duration: '1m', target: 2 }],
    thresholds: {
      ws_connection_errors: ['rate<0.1'],
      ws_connection_duration: ['p(95)<2000'],
      message_delivery_duration: ['p(95)<1000'],
    }
  },
  
  // Normal chat load
  load: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '2m', target: 10 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      ws_connection_errors: ['rate<0.05'],
      ws_connection_duration: ['p(95)<3000'],
      message_delivery_duration: ['p(95)<500'],
    }
  },
  
  // High concurrent connections
  stress: {
    stages: [
      { duration: '1m', target: 25 },
      { duration: '3m', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      ws_connection_errors: ['rate<0.15'],
      ws_connection_duration: ['p(95)<5000'],
      message_delivery_duration: ['p(95)<1500'],
    }
  },
  
  // Connection spike test
  spike: {
    stages: [
      { duration: '30s', target: 5 },
      { duration: '10s', target: 30 },  // Sudden spike
      { duration: '1m', target: 5 },
      { duration: '10s', target: 40 },  // Second spike
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      ws_connection_errors: ['rate<0.25'],
      ws_connection_duration: ['p(95)<8000'],
    }
  }
};

const scenario = __ENV.SCENARIO || 'load';
export let options = SCENARIOS[scenario];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/chat/ws';

const TEST_USERS = [
  { email: 'loadtest1@example.com', password: 'LoadTest123!', userId: 1 },
  { email: 'loadtest2@example.com', password: 'LoadTest123!', userId: 2 },
  { email: 'loadtest3@example.com', password: 'LoadTest123!', userId: 3 },
  { email: 'loadtest4@example.com', password: 'LoadTest123!', userId: 4 },
  { email: 'loadtest5@example.com', password: 'LoadTest123!', userId: 5 },
];

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

export default function() {
  const userIndex = Math.floor(Math.random() * TEST_USERS.length);
  const testUser = TEST_USERS[userIndex];
  
  // Get authentication token first
  const authToken = authenticateUser(testUser);
  if (!authToken) {
    wsConnectionErrors.add(1);
    return;
  }
  
  // Establish WebSocket connection and run chat simulation
  const wsUrl = `${WS_URL}?token=${encodeURIComponent(authToken)}`;
  
  const connectionStart = Date.now();
  const response = ws.connect(wsUrl, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'User-Agent': 'k6-websocket-load-test/1.0'
    }
  }, function(socket) {
    wsConnectionTime.add(Date.now() - connectionStart);
    activeConnections.add(1);
    
    socket.on('open', () => {
      console.log(`WebSocket connection opened for user ${testUser.userId}`);
      
      // Send initial presence message
      const presenceMessage = {
        type: 'presence',
        status: 'online',
        user_id: testUser.userId,
        timestamp: new Date().toISOString()
      };
      
      socket.send(JSON.stringify(presenceMessage));
      messagesSent.add(1);
    });
    
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        messagesReceived.add(1);
        
        // Calculate message delivery time if it's a response to our message
        if (message.timestamp && message.type === 'message_ack') {
          const deliveryTime = Date.now() - new Date(message.original_timestamp).getTime();
          messageDeliveryTime.add(deliveryTime);
        }
        
        // Handle different message types
        switch (message.type) {
          case 'message':
            handleIncomingMessage(socket, message, testUser);
            break;
          case 'typing':
            handleTypingIndicator(socket, message, testUser);
            break;
          case 'presence':
            console.log(`User ${message.user_id} is ${message.status}`);
            break;
        }
        
      } catch (error) {
        console.error(`Error parsing WebSocket message: ${error}`);
      }
    });
    
    socket.on('error', (error) => {
      console.error(`WebSocket error for user ${testUser.userId}: ${error}`);
      wsConnectionErrors.add(1);
    });
    
    socket.on('close', () => {
      console.log(`WebSocket connection closed for user ${testUser.userId}`);
      activeConnections.add(-1);
    });
    
    // Simulate realistic chat behavior
    simulateChatBehavior(socket, testUser);
    
    // Keep connection open for the test duration
    sleep(randomIntBetween(30, 60));
  });
  
  const connectionSuccess = check(response, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });
  
  if (!connectionSuccess) {
    wsConnectionErrors.add(1);
  }
}

// ============================================================================
// CHAT SIMULATION FUNCTIONS
// ============================================================================

function simulateChatBehavior(socket, testUser) {
  const behaviorPatterns = [
    'activeChatter',    // Sends many messages
    'occasionalUser',   // Sends few messages
    'lurker',          // Mostly receives, rarely sends
    'typingUser'       // Frequently shows typing indicators
  ];
  
  const behavior = behaviorPatterns[randomIntBetween(0, behaviorPatterns.length - 1)];
  
  switch (behavior) {
    case 'activeChatter':
      simulateActiveChatter(socket, testUser);
      break;
    case 'occasionalUser':
      simulateOccasionalUser(socket, testUser);
      break;
    case 'lurker':
      simulateLurker(socket, testUser);
      break;
    case 'typingUser':
      simulateTypingUser(socket, testUser);
      break;
  }
}

function simulateActiveChatter(socket, testUser) {
  const messageCount = randomIntBetween(5, 15);
  const conversationId = randomIntBetween(1, 10);
  
  for (let i = 0; i < messageCount; i++) {
    setTimeout(() => {
      // Show typing indicator
      const typingMessage = {
        type: 'typing',
        conversation_id: conversationId,
        user_id: testUser.userId,
        is_typing: true,
        timestamp: new Date().toISOString()
      };
      socket.send(JSON.stringify(typingMessage));
      messagesSent.add(1);
      
      // Send actual message after short delay
      setTimeout(() => {
        const chatMessage = {
          type: 'message',
          conversation_id: conversationId,
          user_id: testUser.userId,
          content: generateRealisticMessage(),
          message_type: 'text',
          timestamp: new Date().toISOString()
        };
        
        socket.send(JSON.stringify(chatMessage));
        messagesSent.add(1);
        messagesPerSecond.add(1);
        
        // Stop typing indicator
        const stopTyping = { ...typingMessage, is_typing: false };
        socket.send(JSON.stringify(stopTyping));
        messagesSent.add(1);
        
      }, randomIntBetween(500, 2000)); // Typing simulation
      
    }, i * randomIntBetween(3000, 8000)); // Stagger messages
  }
}

function simulateOccasionalUser(socket, testUser) {
  const messageCount = randomIntBetween(1, 4);
  const conversationId = randomIntBetween(1, 10);
  
  for (let i = 0; i < messageCount; i++) {
    setTimeout(() => {
      const chatMessage = {
        type: 'message',
        conversation_id: conversationId,
        user_id: testUser.userId,
        content: generateRealisticMessage(),
        message_type: Math.random() > 0.8 ? 'emoji' : 'text',
        timestamp: new Date().toISOString()
      };
      
      socket.send(JSON.stringify(chatMessage));
      messagesSent.add(1);
      messagesPerSecond.add(1);
      
    }, i * randomIntBetween(10000, 20000));
  }
}

function simulateLurker(socket, testUser) {
  // Lurkers mostly just maintain presence, send very few messages
  setTimeout(() => {
    if (Math.random() > 0.7) { // 30% chance to send a message
      const chatMessage = {
        type: 'message',
        conversation_id: randomIntBetween(1, 10),
        user_id: testUser.userId,
        content: generateRealisticMessage(),
        message_type: 'text',
        timestamp: new Date().toISOString()
      };
      
      socket.send(JSON.stringify(chatMessage));
      messagesSent.add(1);
      messagesPerSecond.add(1);
    }
  }, randomIntBetween(20000, 40000));
}

function simulateTypingUser(socket, testUser) {
  // Frequently shows typing indicators, sometimes without sending messages
  const typingCount = randomIntBetween(8, 15);
  const conversationId = randomIntBetween(1, 10);
  
  for (let i = 0; i < typingCount; i++) {
    setTimeout(() => {
      // Start typing
      const startTyping = {
        type: 'typing',
        conversation_id: conversationId,
        user_id: testUser.userId,
        is_typing: true,
        timestamp: new Date().toISOString()
      };
      socket.send(JSON.stringify(startTyping));
      messagesSent.add(1);
      
      // Stop typing after random delay
      setTimeout(() => {
        const stopTyping = { ...startTyping, is_typing: false };
        socket.send(JSON.stringify(stopTyping));
        messagesSent.add(1);
        
        // 60% chance to actually send a message
        if (Math.random() > 0.4) {
          const chatMessage = {
            type: 'message',
            conversation_id: conversationId,
            user_id: testUser.userId,
            content: generateRealisticMessage(),
            message_type: 'text',
            timestamp: new Date().toISOString()
          };
          
          socket.send(JSON.stringify(chatMessage));
          messagesSent.add(1);
          messagesPerSecond.add(1);
        }
        
      }, randomIntBetween(1000, 5000));
      
    }, i * randomIntBetween(2000, 6000));
  }
}

function handleIncomingMessage(socket, message, testUser) {
  // Simulate reading the message and potentially responding
  if (Math.random() > 0.7) { // 30% chance to respond
    setTimeout(() => {
      const response = {
        type: 'message',
        conversation_id: message.conversation_id,
        user_id: testUser.userId,
        content: generateRealisticResponse(message.content),
        message_type: 'text',
        reply_to: message.id,
        timestamp: new Date().toISOString()
      };
      
      socket.send(JSON.stringify(response));
      messagesSent.add(1);
      messagesPerSecond.add(1);
    }, randomIntBetween(1000, 5000)); // Response delay
  }
}

function handleTypingIndicator(socket, message, testUser) {
  // Respond to typing indicators by sometimes starting to type as well
  if (message.is_typing && Math.random() > 0.8) { // 20% chance to start typing too
    setTimeout(() => {
      const typingResponse = {
        type: 'typing',
        conversation_id: message.conversation_id,
        user_id: testUser.userId,
        is_typing: true,
        timestamp: new Date().toISOString()
      };
      
      socket.send(JSON.stringify(typingResponse));
      messagesSent.add(1);
      
      // Stop typing after delay
      setTimeout(() => {
        const stopTyping = { ...typingResponse, is_typing: false };
        socket.send(JSON.stringify(stopTyping));
        messagesSent.add(1);
      }, randomIntBetween(2000, 4000));
      
    }, randomIntBetween(500, 1500));
  }
}

function generateRealisticMessage() {
  const messageTemplates = [
    "Hey, how's it going?",
    "That sounds awesome!",
    "I'm interested in that too",
    "What do you think?",
    "Cool! 😊",
    "Thanks for sharing that",
    "I agree with you",
    "That's really interesting",
    "Nice to meet you!",
    "What are you up to today?",
    "I love that idea",
    "Count me in!",
    "That's so cool",
    "I'm excited about this",
    "Good point!",
    `Random message ${randomString(10)}`
  ];
  
  return messageTemplates[randomIntBetween(0, messageTemplates.length - 1)];
}

function generateRealisticResponse(originalMessage) {
  const responses = [
    "Totally!",
    "I know, right?",
    "Same here",
    "That's what I was thinking",
    "Absolutely",
    "For sure",
    "I'm in!",
    "Sounds good",
    "Me too!",
    "Exactly",
    `Replying to: "${originalMessage.substring(0, 20)}..."`
  ];
  
  return responses[randomIntBetween(0, responses.length - 1)];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function authenticateUser(user) {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  const success = check(response, {
    'authentication successful': (r) => [200, 201].includes(r.status),
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

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log(`🔌 Starting WebSocket Chat Load Test`);
  console.log(`📊 Scenario: ${scenario}`);
  console.log(`🎯 Target: ${WS_URL}`);
  
  // Health check WebSocket endpoint
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`API Gateway health check failed: ${healthResponse.status}`);
  }
  
  console.log(`✅ API Gateway is healthy`);
  
  // Test one authentication to ensure auth system works
  const testAuth = authenticateUser(TEST_USERS[0]);
  if (!testAuth) {
    throw new Error('Authentication test failed - cannot proceed with WebSocket test');
  }
  
  console.log(`✅ Authentication system is working`);
  
  return { 
    wsUrl: WS_URL,
    scenario: scenario,
    startTime: new Date().toISOString()
  };
}

export function teardown(data) {
  const duration = Math.round((Date.now() - new Date(data.startTime).getTime()) / 1000);
  
  console.log('\n🏁 WebSocket Chat Load Test Complete');
  console.log(`📊 Scenario: ${data.scenario}`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📨 Messages Sent: ${messagesSent.count || 'N/A'}`);
  console.log(`📬 Messages Received: ${messagesReceived.count || 'N/A'}`);
  console.log(`🔗 Peak Active Connections: ${activeConnections.count || 'N/A'}`);
  console.log(`✅ WebSocket URL: ${data.wsUrl}`);
  
  console.log('\n📋 WebSocket Metrics Summary:');
  console.log('  - ws_connection_errors: WebSocket connection failure rate');
  console.log('  - ws_connection_duration: Time to establish WebSocket connection');
  console.log('  - message_delivery_duration: End-to-end message delivery time');
  console.log('  - messages_per_second: Message throughput rate');
  console.log('  - active_ws_connections: Concurrent WebSocket connections');
}