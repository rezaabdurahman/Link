#!/bin/bash

echo "Enhanced Performance Testing - Phase 3.3"
echo "========================================"

# Function to measure time in milliseconds
measure_time() {
  local start_ns=$(date +%s%N)
  "$@" > /dev/null 2>&1
  local end_ns=$(date +%s%N)
  local duration_ms=$(( (end_ns - start_ns) / 1000000 ))
  echo $duration_ms
}

# Test 1: Response time analysis with higher precision
echo "1. Response Time Analysis (milliseconds):"
echo "   Testing gateway health endpoint..."

TOTAL_MS=0
REQUESTS=20

for i in $(seq 1 $REQUESTS); do
  TIME_MS=$(measure_time curl -s http://localhost:8080/health)
  TOTAL_MS=$((TOTAL_MS + TIME_MS))
  echo "   Request $i: ${TIME_MS}ms"
done

AVERAGE_MS=$((TOTAL_MS / REQUESTS))
echo "   Average response time: ${AVERAGE_MS}ms"

# Test 2: Concurrent load testing
echo ""
echo "2. Concurrent Load Testing:"
echo "   Testing with 50 concurrent requests..."

CONCURRENT_START=$(date +%s%N)
for i in {1..50}; do
  curl -s http://localhost:8080/health/live > /dev/null &
done
wait
CONCURRENT_END=$(date +%s%N)
CONCURRENT_MS=$(( (CONCURRENT_END - CONCURRENT_START) / 1000000 ))

echo "   50 concurrent requests completed in: ${CONCURRENT_MS}ms"
echo "   Average per request: $((CONCURRENT_MS / 50))ms"

# Test 3: Database query performance
echo ""
echo "3. Database Performance Analysis:"
echo "   Testing database queries..."

# Test simple database query performance
DB_START=$(date +%s%N)
QUERY_RESULT=$(docker exec backend-postgres-1 psql -U linkuser -d linkdb -t -c "SELECT COUNT(*) FROM users;")
DB_END=$(date +%s%N)
DB_MS=$(( (DB_END - DB_START) / 1000000 ))

echo "   Database query time: ${DB_MS}ms"
echo "   Users in database: $QUERY_RESULT"

# Test 4: Service endpoint performance comparison
echo ""
echo "4. Service Endpoint Performance Comparison:"

services=("8081:user-svc" "8083:discovery-svc" "8088:location-svc" "8086:stories-svc" "8087:opportunities-svc")

for service_info in "${services[@]}"; do
  IFS=':' read -r port service_name <<< "$service_info"
  TIME_MS=$(measure_time curl -s http://localhost:$port/health/live)
  echo "   $service_name: ${TIME_MS}ms"
done

# Test 5: Memory efficiency check
echo ""
echo "5. Memory Efficiency Analysis:"

# Get current metrics
GOROUTINES=$(curl -s http://localhost:8081/metrics | grep "go_goroutines " | awk '{print $2}')
HEAP_SIZE=$(curl -s http://localhost:8081/metrics | grep "go_memstats_heap_inuse_bytes " | awk '{print $2}')
GC_COUNT=$(curl -s http://localhost:8081/metrics | grep "go_gc_duration_seconds_count " | awk '{print $2}')

echo "   Active goroutines: $GOROUTINES"
echo "   Heap in use: $HEAP_SIZE bytes ($((HEAP_SIZE / 1024 / 1024))MB)"
echo "   GC cycles completed: $GC_COUNT"

# Test 6: Rate limiting effectiveness
echo ""
echo "6. Rate Limiting Effectiveness:"
echo "   Current rate limit status:"
curl -s -I http://localhost:8080/health 2>/dev/null | grep -i "x-ratelimit" | while read line; do
  echo "   $line"
done

echo ""
echo "Performance Analysis Complete!"
echo ""
echo "Performance Summary:"
echo "- Gateway average response time: ${AVERAGE_MS}ms"
echo "- 50 concurrent requests completed in: ${CONCURRENT_MS}ms" 
echo "- Database query performance: ${DB_MS}ms"
echo "- Memory efficiency: $((HEAP_SIZE / 1024 / 1024))MB heap, $GOROUTINES goroutines"
echo "- Total users in system: $QUERY_RESULT"
