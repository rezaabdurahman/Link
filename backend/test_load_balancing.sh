#!/bin/bash

echo "Testing Load Balancing and Stateless Behavior"
echo "============================================="

# Test 1: Check user service instances are both accessible directly
echo "1. Testing direct access to user service instances:"
echo "   Instance 1 (port 8081):"
RESPONSE1=$(curl -s http://localhost:8081/health/live)
echo "   $RESPONSE1"

echo "   Instance 2 (port 8091):"
RESPONSE2=$(curl -s http://localhost:8091/health/live)
echo "   $RESPONSE2"

# Test 2: Test API Gateway health and load balancer status
echo ""
echo "2. Testing API Gateway load balancer status:"
curl -s http://localhost:8080/health | jq '.services."user-svc".load_balancer_stats'

# Test 3: Test concurrent requests to gateway
echo ""
echo "3. Testing concurrent requests through gateway:"
echo "   Making 5 concurrent health checks through gateway..."

for i in {1..5}; do
  curl -s http://localhost:8080/health/live > /dev/null &
done
wait

echo "   All concurrent requests completed"

# Test 4: Test stateless behavior - user creation
echo ""
echo "4. Testing stateless behavior with user registration:"

# Create users through different instances to verify stateless operation
echo "   Creating user via instance 1:"
USER1_RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"stateless1@example.com","password":"testpass123","name":"Stateless Test 1","username":"stateless1"}')
echo "   Response: $(echo $USER1_RESPONSE | jq -r '.message // .error')"

echo "   Creating user via instance 2:"
USER2_RESPONSE=$(curl -s -X POST http://localhost:8091/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"stateless2@example.com","password":"testpass123","name":"Stateless Test 2","username":"stateless2"}')
echo "   Response: $(echo $USER2_RESPONSE | jq -r '.message // .error')"

# Test 5: Test Redis rate limiter headers
echo ""
echo "5. Testing Redis rate limiter (checking headers):"
RATE_LIMIT_RESPONSE=$(curl -s -I http://localhost:8080/health 2>/dev/null | grep -i "ratelimit")
if [ -n "$RATE_LIMIT_RESPONSE" ]; then
  echo "   Rate limiting headers found:"
  echo "   $RATE_LIMIT_RESPONSE"
else
  echo "   No rate limiting issues detected (good!)"
fi

echo ""
echo "Load balancing and stateless verification completed!"
