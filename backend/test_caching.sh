#!/bin/bash

echo "Testing Redis Caching Implementation"
echo "===================================="

# Test 1: Register a new user to test profile caching
echo "1. Creating a test user for cache testing..."
TIMESTAMP=$(date +%s)
USER_RESPONSE=$(curl -s -X POST http://localhost:8081/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"cachetest${TIMESTAMP}@example.com\",\"password\":\"testpass123\",\"name\":\"Cache Test User\",\"username\":\"cachetest${TIMESTAMP}\"}")

USER_ID=$(echo $USER_RESPONSE | jq -r '.user.id // empty')
TOKEN=$(echo $USER_RESPONSE | jq -r '.token // empty')

if [ "$USER_ID" = "" ]; then
  echo "   Failed to create user. Response: $USER_RESPONSE"
  exit 1
fi

echo "   User created successfully: $USER_ID"

# Test 2: Test profile caching by making multiple requests
echo ""
echo "2. Testing profile caching performance..."

# First request (cache miss - should hit database)
echo "   Making first profile request (cache miss)..."
START_TIME=$(date +%s%N)
PROFILE1=$(curl -s http://localhost:8081/api/v1/users/profile/me -H "Authorization: Bearer $TOKEN")
END_TIME=$(date +%s%N)
FIRST_REQUEST_MS=$(( (END_TIME - START_TIME) / 1000000 ))

echo "   First request time: ${FIRST_REQUEST_MS}ms"

# Second request (cache hit - should be faster)
echo "   Making second profile request (cache hit)..."
START_TIME=$(date +%s%N)
PROFILE2=$(curl -s http://localhost:8081/api/v1/users/profile/me -H "Authorization: Bearer $TOKEN")
END_TIME=$(date +%s%N)
SECOND_REQUEST_MS=$(( (END_TIME - START_TIME) / 1000000 ))

echo "   Second request time: ${SECOND_REQUEST_MS}ms"

# Compare results
if [ $SECOND_REQUEST_MS -lt $FIRST_REQUEST_MS ]; then
  echo "   ✅ Cache hit was faster: ${SECOND_REQUEST_MS}ms < ${FIRST_REQUEST_MS}ms"
else
  echo "   ⚠️  Cache hit not faster (this could be normal for very fast operations)"
fi

# Test 3: Check Redis cache contents
echo ""
echo "3. Checking Redis cache contents..."
CACHE_KEYS=$(docker exec backend-redis-1 redis-cli --scan --pattern "user-svc:*" | head -5)
if [ -n "$CACHE_KEYS" ]; then
  echo "   ✅ Cache keys found:"
  echo "$CACHE_KEYS" | while read key; do
    echo "     - $key"
  done
else
  echo "   ⚠️  No cache keys found"
fi

# Test 4: Test cache invalidation by updating profile
echo ""
echo "4. Testing cache invalidation on profile update..."

# Update the user profile
UPDATE_RESPONSE=$(curl -s -X PUT http://localhost:8081/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Updated","last_name":"Name","bio":"Cache test bio"}')

echo "   Profile updated"

# Make another request to see if cache was invalidated
START_TIME=$(date +%s%N)
PROFILE3=$(curl -s http://localhost:8081/api/v1/users/profile/me -H "Authorization: Bearer $TOKEN")
END_TIME=$(date +%s%N)
THIRD_REQUEST_MS=$(( (END_TIME - START_TIME) / 1000000 ))

echo "   Request after update: ${THIRD_REQUEST_MS}ms"

# Verify the updated data is returned
UPDATED_NAME=$(echo $PROFILE3 | jq -r '.first_name // empty')
if [ "$UPDATED_NAME" = "Updated" ]; then
  echo "   ✅ Cache invalidation working - updated data returned"
else
  echo "   ⚠️  Cache invalidation issue - old data may be cached"
fi

# Test 5: Check cache hit/miss with Redis info
echo ""
echo "5. Redis cache statistics..."
REDIS_INFO=$(docker exec backend-redis-1 redis-cli info stats | grep -E "(keyspace_hits|keyspace_misses)")
if [ -n "$REDIS_INFO" ]; then
  echo "   Redis cache stats:"
  echo "$REDIS_INFO" | while read line; do
    echo "     $line"
  done
else
  echo "   Redis stats not available"
fi

# Test 6: Test concurrent cache performance
echo ""
echo "6. Testing concurrent cache performance..."
echo "   Making 10 concurrent cached requests..."

CONCURRENT_START=$(date +%s%N)
for i in {1..10}; do
  curl -s http://localhost:8081/api/v1/users/profile/me -H "Authorization: Bearer $TOKEN" > /dev/null &
done
wait
CONCURRENT_END=$(date +%s%N)
CONCURRENT_MS=$(( (CONCURRENT_END - CONCURRENT_START) / 1000000 ))

echo "   10 concurrent requests completed in: ${CONCURRENT_MS}ms"
echo "   Average per request: $((CONCURRENT_MS / 10))ms"

echo ""
echo "Cache Testing Complete!"
echo ""
echo "Cache Performance Summary:"
echo "- First request (cache miss): ${FIRST_REQUEST_MS}ms"
echo "- Second request (cache hit): ${SECOND_REQUEST_MS}ms"
echo "- After update (cache invalidated): ${THIRD_REQUEST_MS}ms"
echo "- 10 concurrent cached requests: ${CONCURRENT_MS}ms total"
