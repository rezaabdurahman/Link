#!/bin/bash

echo "Performance Testing - Phase 3.3"
echo "==============================="

# Test 1: Baseline response times
echo "1. Baseline Response Time Analysis:"
echo "   Testing gateway health endpoint..."

# Measure multiple requests to get average
TOTAL_TIME=0
REQUESTS=10

for i in $(seq 1 $REQUESTS); do
  START_TIME=$(date +%s.%3N)
  curl -s http://localhost:8080/health > /dev/null
  END_TIME=$(date +%s.%3N)
  REQUEST_TIME=$(echo "$END_TIME - $START_TIME" | bc)
  TOTAL_TIME=$(echo "$TOTAL_TIME + $REQUEST_TIME" | bc)
  echo "   Request $i: ${REQUEST_TIME}s"
done

AVERAGE_TIME=$(echo "scale=3; $TOTAL_TIME / $REQUESTS" | bc)
echo "   Average response time: ${AVERAGE_TIME}s"

# Test 2: Memory usage before and after load
echo ""
echo "2. Memory Usage Analysis:"
echo "   Before load test:"
MEMORY_BEFORE=$(curl -s http://localhost:8081/metrics | grep "go_memstats_heap_alloc_bytes " | awk '{print $2}')
echo "   Heap allocated: $MEMORY_BEFORE bytes"

echo "   Running concurrent requests..."
# Generate some load
for i in {1..20}; do
  curl -s http://localhost:8081/health/live > /dev/null &
done
wait

echo "   After load test:"
MEMORY_AFTER=$(curl -s http://localhost:8081/metrics | grep "go_memstats_heap_alloc_bytes " | awk '{print $2}')
echo "   Heap allocated: $MEMORY_AFTER bytes"

MEMORY_DIFF=$(echo "$MEMORY_AFTER - $MEMORY_BEFORE" | bc)
echo "   Memory difference: $MEMORY_DIFF bytes"

# Test 3: Database connection analysis
echo ""
echo "3. Database Performance:"
echo "   Checking PostgreSQL connections..."
ACTIVE_CONNECTIONS=$(docker exec backend-postgres-1 psql -U linkuser -d linkdb -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
echo "   Active PostgreSQL connections: $ACTIVE_CONNECTIONS"

TOTAL_CONNECTIONS=$(docker exec backend-postgres-1 psql -U linkuser -d linkdb -t -c "SELECT count(*) FROM pg_stat_activity;")
echo "   Total PostgreSQL connections: $TOTAL_CONNECTIONS"

# Test 4: Rate limiting performance
echo ""
echo "4. Rate Limiting Performance:"
echo "   Testing rate limit response times..."

# Make requests and check rate limit headers
RATE_LIMIT_START=$(date +%s.%3N)
curl -s -I http://localhost:8080/health | grep -i "ratelimit" | head -3
RATE_LIMIT_END=$(date +%s.%3N)
RATE_LIMIT_TIME=$(echo "$RATE_LIMIT_END - $RATE_LIMIT_START" | bc)
echo "   Rate limit check time: ${RATE_LIMIT_TIME}s"

# Test 5: Service health check times
echo ""
echo "5. Service Health Check Performance:"
for service in user discovery location stories opportunities; do
  if [ "$service" = "user" ]; then
    PORT=8081
  elif [ "$service" = "discovery" ]; then
    PORT=8083
  elif [ "$service" = "location" ]; then
    PORT=8088
  elif [ "$service" = "stories" ]; then
    PORT=8086
  elif [ "$service" = "opportunities" ]; then
    PORT=8087
  fi
  
  SERVICE_START=$(date +%s.%3N)
  curl -s http://localhost:$PORT/health/live > /dev/null
  SERVICE_END=$(date +%s.%3N)
  SERVICE_TIME=$(echo "$SERVICE_END - $SERVICE_START" | bc)
  echo "   $service-svc health check: ${SERVICE_TIME}s"
done

echo ""
echo "Performance testing completed!"
echo ""
echo "Performance Summary:"
echo "- Gateway average response time: ${AVERAGE_TIME}s"
echo "- Memory usage change: $MEMORY_DIFF bytes"
echo "- Active DB connections: $ACTIVE_CONNECTIONS"
echo "- Rate limiting overhead: ${RATE_LIMIT_TIME}s"
