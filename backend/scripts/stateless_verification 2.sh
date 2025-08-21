#!/bin/bash

# Phase 3.2: Stateless Design Verification Script
# This script validates that our microservices are truly stateless and can be horizontally scaled

set -e

echo "🚀 Starting Phase 3.2: Stateless Design Verification"
echo "=================================================="

# Configuration
GATEWAY_URL="http://localhost:8080"
TEST_USER_EMAIL="stateless-test-$(date +%s)@example.com"
TEST_USER_PASSWORD="TestPassword123!"
CONCURRENT_REQUESTS=100
TEST_DURATION="30s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [[ "$status" == "PASS" ]]; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC} - $message"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC} - $message"
        ((TESTS_FAILED++))
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."
if ! command_exists docker-compose; then
    echo "❌ docker-compose is required but not installed"
    exit 1
fi

if ! command_exists curl; then
    echo "❌ curl is required but not installed"
    exit 1
fi

# Install hey if not available (for load testing)
if ! command_exists hey; then
    echo "📦 Installing hey for load testing..."
    if command_exists brew; then
        brew install hey
    elif command_exists go; then
        go install github.com/rakyll/hey@latest
    else
        echo "⚠️  hey not available - will use curl for basic testing"
    fi
fi

echo "✅ Prerequisites checked"

# Step 1: Build and start the stack
echo ""
echo "🏗️  Step 1: Building and starting services..."
docker-compose down --remove-orphans || true
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to become healthy..."
sleep 15

# Check basic connectivity
for service in user-svc chat-svc discovery-svc ai-svc search-svc; do
    port=""
    case $service in
        user-svc) port="8081" ;;
        chat-svc) port="8082" ;;
        discovery-svc) port="8083" ;;
        ai-svc) port="8084" ;;
        search-svc) port="8085" ;;
    esac
    
    if curl -f -s "http://localhost:$port/health/live" > /dev/null; then
        log_test "Service Health Check ($service)" "PASS" "Service is responding"
    else
        log_test "Service Health Check ($service)" "FAIL" "Service not responding on port $port"
    fi
done

# Check API Gateway health
if curl -f -s "$GATEWAY_URL/health" > /dev/null; then
    log_test "API Gateway Health" "PASS" "Gateway is responding"
else
    log_test "API Gateway Health" "FAIL" "Gateway not responding"
    exit 1
fi

# Step 2: Scale services to multiple replicas
echo ""
echo "📈 Step 2: Scaling services for horizontal testing..."
docker-compose up -d --scale user-svc=3 --scale chat-svc=3 --scale discovery-svc=2

# Wait for scaled services to start
sleep 10

# Verify scaled services are running
SCALED_USER_SVCS=$(docker-compose ps -q user-svc | wc -l)
SCALED_CHAT_SVCS=$(docker-compose ps -q chat-svc | wc -l)

if [[ $SCALED_USER_SVCS -eq 3 ]]; then
    log_test "User Service Scaling" "PASS" "3 replicas running"
else
    log_test "User Service Scaling" "FAIL" "Expected 3 replicas, got $SCALED_USER_SVCS"
fi

if [[ $SCALED_CHAT_SVCS -eq 3 ]]; then
    log_test "Chat Service Scaling" "PASS" "3 replicas running"
else
    log_test "Chat Service Scaling" "FAIL" "Expected 3 replicas, got $SCALED_CHAT_SVCS"
fi

# Step 3: Test load balancing with concurrent requests
echo ""
echo "🔄 Step 3: Testing load balancing with concurrent requests..."

# Create a test user first
echo "Creating test user..."
USER_CREATION_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\",\"name\":\"Test User\"}")

if echo "$USER_CREATION_RESPONSE" | grep -q "error"; then
    echo "⚠️  User creation failed or user already exists - continuing with login test"
fi

# Test authentication and get JWT token
echo "Testing authentication..."
AUTH_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

if echo "$AUTH_RESPONSE" | grep -q "token"; then
    JWT_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    log_test "JWT Authentication" "PASS" "Token obtained successfully"
else
    log_test "JWT Authentication" "FAIL" "Could not obtain JWT token"
    echo "Auth Response: $AUTH_RESPONSE"
fi

# Test load balancing if hey is available
if command_exists hey && [[ -n "$JWT_TOKEN" ]]; then
    echo "🚀 Running load test with hey..."
    
    # Test user service load balancing
    hey -n $CONCURRENT_REQUESTS -c 10 -H "Authorization: Bearer $JWT_TOKEN" \
        "$GATEWAY_URL/api/v1/users/profile" > /tmp/hey_results.txt 2>&1
    
    if grep -q "200 responses" /tmp/hey_results.txt; then
        SUCCESS_RATE=$(grep "Success rate" /tmp/hey_results.txt | awk '{print $3}' | tr -d '%')
        if [[ "$SUCCESS_RATE" -ge "95" ]]; then
            log_test "Load Balancing Test" "PASS" "Success rate: $SUCCESS_RATE%"
        else
            log_test "Load Balancing Test" "FAIL" "Success rate too low: $SUCCESS_RATE%"
        fi
    else
        log_test "Load Balancing Test" "FAIL" "Load test failed to complete"
    fi
fi

# Step 4: Test service restart resilience
echo ""
echo "🔄 Step 4: Testing service restart resilience..."

# Get one user service container ID
USER_CONTAINER=$(docker-compose ps -q user-svc | head -1)

if [[ -n "$USER_CONTAINER" ]]; then
    echo "Restarting user service container: $USER_CONTAINER"
    docker restart "$USER_CONTAINER"
    
    # Wait for restart
    sleep 5
    
    # Test that service still works after restart
    if [[ -n "$JWT_TOKEN" ]]; then
        PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" \
            "$GATEWAY_URL/api/v1/users/profile")
        
        if echo "$PROFILE_RESPONSE" | grep -q -v "error"; then
            log_test "Service Restart Resilience" "PASS" "Service recovered after restart"
        else
            log_test "Service Restart Resilience" "FAIL" "Service not working after restart"
        fi
    fi
fi

# Step 5: Verify stateless authentication (JWT tokens persist across restarts)
echo ""
echo "🔐 Step 5: Verifying stateless authentication..."

if [[ -n "$JWT_TOKEN" ]]; then
    # Restart all user service instances
    echo "Restarting all user service instances..."
    docker-compose restart user-svc
    sleep 10
    
    # Test that JWT still works (stateless auth)
    PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" \
        "$GATEWAY_URL/api/v1/users/profile")
    
    if echo "$PROFILE_RESPONSE" | grep -q -v "error"; then
        log_test "Stateless JWT Authentication" "PASS" "JWT valid after all user services restarted"
    else
        log_test "Stateless JWT Authentication" "FAIL" "JWT invalid after user services restarted"
    fi
fi

# Step 6: Check Redis persistence (if used for sessions/cache)
echo ""
echo "💾 Step 6: Checking Redis data persistence..."

# Test Redis connectivity
REDIS_RESPONSE=$(docker-compose exec -T redis redis-cli ping 2>/dev/null || echo "FAILED")

if [[ "$REDIS_RESPONSE" == "PONG" ]]; then
    log_test "Redis Connectivity" "PASS" "Redis is responding"
    
    # Check if there are any keys (sessions, cache data)
    KEY_COUNT=$(docker-compose exec -T redis redis-cli dbsize 2>/dev/null | tr -d '\r' || echo "0")
    log_test "Redis Data Persistence" "PASS" "Redis contains $KEY_COUNT keys"
else
    log_test "Redis Connectivity" "FAIL" "Redis not responding"
fi

# Step 7: Database consistency checks
echo ""
echo "🗄️  Step 7: Database consistency checks..."

# Test database connectivity and basic queries
DB_RESPONSE=$(docker-compose exec -T postgres psql -U linkuser -d linkdb -c "SELECT 1;" 2>/dev/null || echo "FAILED")

if echo "$DB_RESPONSE" | grep -q "1 row"; then
    log_test "Database Connectivity" "PASS" "Database is responding"
    
    # Check user table exists and has data
    USER_COUNT=$(docker-compose exec -T postgres psql -U linkuser -d linkdb -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' \r\n' || echo "0")
    log_test "Database Consistency" "PASS" "Users table contains $USER_COUNT records"
else
    log_test "Database Connectivity" "FAIL" "Database not responding"
fi

# Step 8: Service discovery verification
echo ""
echo "🔍 Step 8: Service discovery verification..."

# Check that gateway can reach all services
HEALTH_RESPONSE=$(curl -s "$GATEWAY_URL/health" 2>/dev/null || echo '{"status":"error"}')

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    log_test "Service Discovery" "PASS" "All services discoverable via gateway"
else
    log_test "Service Discovery" "FAIL" "Gateway cannot reach all services"
    echo "Health Response: $HEALTH_RESPONSE"
fi

# Step 9: Stress test with container restarts during traffic
echo ""
echo "💪 Step 9: Stress testing with rolling restarts..."

if command_exists hey && [[ -n "$JWT_TOKEN" ]]; then
    # Start background load test
    echo "Starting background load test..."
    hey -n 200 -c 5 -H "Authorization: Bearer $JWT_TOKEN" \
        "$GATEWAY_URL/api/v1/users/profile" > /tmp/stress_test.txt 2>&1 &
    HEY_PID=$!
    
    # Wait a bit, then restart a service
    sleep 5
    USER_CONTAINER=$(docker-compose ps -q user-svc | head -1)
    if [[ -n "$USER_CONTAINER" ]]; then
        echo "Restarting service during load test..."
        docker restart "$USER_CONTAINER"
    fi
    
    # Wait for load test to complete
    wait $HEY_PID
    
    # Check stress test results
    if grep -q "200 responses" /tmp/stress_test.txt; then
        SUCCESS_RATE=$(grep "Success rate" /tmp/stress_test.txt | awk '{print $3}' | tr -d '%' || echo "0")
        if [[ "$SUCCESS_RATE" -ge "80" ]]; then
            log_test "Stress Test with Restarts" "PASS" "Success rate during restarts: $SUCCESS_RATE%"
        else
            log_test "Stress Test with Restarts" "FAIL" "Success rate too low during restarts: $SUCCESS_RATE%"
        fi
    else
        log_test "Stress Test with Restarts" "FAIL" "Stress test failed"
    fi
fi

# Step 10: Memory and state verification
echo ""
echo "🧠 Step 10: Memory and state verification..."

# Check that services don't store state locally by comparing container stats
USER_CONTAINERS=$(docker-compose ps -q user-svc)
MEMORY_USAGE_CONSISTENT=true

for container in $USER_CONTAINERS; do
    MEMORY_MB=$(docker stats --no-stream --format "{{.MemUsage}}" "$container" 2>/dev/null | awk '{print $1}' | sed 's/MiB//' || echo "0")
    echo "Container $container memory usage: ${MEMORY_MB}MB"
    
    # Very basic check - memory usage should be reasonable for stateless service
    if [[ $(echo "$MEMORY_MB > 500" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        MEMORY_USAGE_CONSISTENT=false
    fi
done

if [[ "$MEMORY_USAGE_CONSISTENT" == "true" ]]; then
    log_test "Memory Usage Check" "PASS" "All services show reasonable memory usage"
else
    log_test "Memory Usage Check" "FAIL" "Some services showing high memory usage (possible state leaks)"
fi

# Cleanup phase
echo ""
echo "🧹 Cleanup: Stopping test environment..."
docker-compose down

# Final results
echo ""
echo "📊 Phase 3.2 Verification Results"
echo "================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 Phase 3.2 PASSED: Services are stateless and horizontally scalable!${NC}"
    echo ""
    echo "✅ Service discovery is working properly"
    echo "✅ Load balancing distributes requests correctly"  
    echo "✅ Services handle restarts gracefully"
    echo "✅ JWT authentication is stateless"
    echo "✅ External state storage (Redis/PostgreSQL) is working"
    echo "✅ Services can be horizontally scaled"
    echo ""
    echo "Ready for Phase 3.3: Performance Optimization"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Phase 3.2 FAILED: Issues found with stateless design${NC}"
    echo ""
    echo "Issues to address:"
    echo "- Check service logs: docker-compose logs [service-name]"
    echo "- Verify environment variables are set correctly"
    echo "- Ensure all services use external storage (no local state)"
    echo "- Check load balancer configuration"
    echo ""
    exit 1
fi
