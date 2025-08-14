#!/bin/bash

# Test script for AI Service health check endpoints
# Usage: ./scripts/test-health-endpoints.sh [base_url]

set -e

BASE_URL=${1:-"http://localhost:8081"}
FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "PASS")
            echo -e "${GREEN}✓ PASS${NC}: $message"
            ;;
        "FAIL")
            echo -e "${RED}✗ FAIL${NC}: $message"
            FAILED=$((FAILED + 1))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠ WARN${NC}: $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ INFO${NC}: $message"
            ;;
    esac
}

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    print_status "INFO" "Testing $endpoint..."
    
    # Make request and capture response details
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$BASE_URL$endpoint" 2>/dev/null || echo -e "\n000\n0")
    
    # Parse response
    body=$(echo "$response" | head -n -2)
    http_code=$(echo "$response" | tail -n 2 | head -n 1)
    time_total=$(echo "$response" | tail -n 1)
    
    # Check if request succeeded
    if [ "$http_code" = "000" ]; then
        print_status "FAIL" "$description - Connection failed"
        return 1
    fi
    
    # Check HTTP status code
    if [ "$http_code" = "$expected_status" ]; then
        print_status "PASS" "$description - HTTP $http_code (${time_total}s)"
    else
        print_status "FAIL" "$description - Expected HTTP $expected_status, got HTTP $http_code"
        echo "Response body: $body"
        return 1
    fi
    
    # Validate JSON response
    if ! echo "$body" | jq . >/dev/null 2>&1; then
        print_status "FAIL" "$description - Invalid JSON response"
        echo "Response body: $body"
        return 1
    fi
    
    print_status "PASS" "$description - Valid JSON response"
    
    # Parse and validate response structure based on endpoint
    case $endpoint in
        "/health")
            validate_health_response "$body" "$description"
            ;;
        "/health/readiness")
            validate_readiness_response "$body" "$description"
            ;;
        "/health/liveness")
            validate_liveness_response "$body" "$description"
            ;;
    esac
}

# Function to validate main health endpoint response
validate_health_response() {
    local body=$1
    local description=$2
    
    # Check required fields
    local status=$(echo "$body" | jq -r '.status // empty')
    local service=$(echo "$body" | jq -r '.service // empty')
    local checks=$(echo "$body" | jq -r '.checks // empty')
    
    if [ "$status" != "healthy" ] && [ "$status" != "unhealthy" ]; then
        print_status "FAIL" "$description - Invalid status field: $status"
        return 1
    fi
    
    if [ "$service" != "ai-svc" ]; then
        print_status "FAIL" "$description - Invalid service field: $service"
        return 1
    fi
    
    if [ "$checks" = "empty" ]; then
        print_status "FAIL" "$description - Missing checks field"
        return 1
    fi
    
    # Check individual health checks
    local components=("database" "redis" "ai_service" "system")
    for component in "${components[@]}"; do
        local component_status=$(echo "$body" | jq -r ".checks.$component.status // empty")
        if [ "$component_status" = "empty" ]; then
            print_status "WARN" "$description - Missing $component health check"
        else
            print_status "PASS" "$description - $component status: $component_status"
        fi
    done
}

# Function to validate readiness endpoint response
validate_readiness_response() {
    local body=$1
    local description=$2
    
    local status=$(echo "$body" | jq -r '.status // empty')
    local service=$(echo "$body" | jq -r '.service // empty')
    
    if [ "$status" != "ready" ] && [ "$status" != "not_ready" ]; then
        print_status "FAIL" "$description - Invalid status field: $status"
        return 1
    fi
    
    if [ "$service" != "ai-svc" ]; then
        print_status "FAIL" "$description - Invalid service field: $service"
        return 1
    fi
    
    print_status "PASS" "$description - Readiness status: $status"
}

# Function to validate liveness endpoint response
validate_liveness_response() {
    local body=$1
    local description=$2
    
    local status=$(echo "$body" | jq -r '.status // empty')
    local service=$(echo "$body" | jq -r '.service // empty')
    local timestamp=$(echo "$body" | jq -r '.timestamp // empty')
    
    if [ "$status" != "alive" ]; then
        print_status "FAIL" "$description - Invalid status field: $status"
        return 1
    fi
    
    if [ "$service" != "ai-svc" ]; then
        print_status "FAIL" "$description - Invalid service field: $service"
        return 1
    fi
    
    if [ "$timestamp" = "empty" ]; then
        print_status "FAIL" "$description - Missing timestamp field"
        return 1
    fi
    
    print_status "PASS" "$description - Liveness confirmed with timestamp: $timestamp"
}

# Function to test performance
test_performance() {
    print_status "INFO" "Running performance tests..."
    
    local endpoint="/health/liveness"
    local iterations=5
    local total_time=0
    
    for i in $(seq 1 $iterations); do
        local time_result=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$endpoint" 2>/dev/null || echo "0")
        total_time=$(echo "$total_time + $time_result" | bc -l 2>/dev/null || echo "$total_time")
    done
    
    if command -v bc >/dev/null 2>&1; then
        local avg_time=$(echo "scale=3; $total_time / $iterations" | bc -l)
        print_status "INFO" "Average response time over $iterations requests: ${avg_time}s"
        
        # Warn if average response time is too high
        if (( $(echo "$avg_time > 1.0" | bc -l) )); then
            print_status "WARN" "Average response time is high (>${avg_time}s)"
        else
            print_status "PASS" "Average response time is acceptable (<1s)"
        fi
    else
        print_status "WARN" "bc not available - skipping performance calculation"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}AI Service Health Check Test Suite${NC}"
    echo "=========================================="
    echo "Base URL: $BASE_URL"
    echo ""
    
    # Check if jq is available
    if ! command -v jq >/dev/null 2>&1; then
        print_status "FAIL" "jq is required but not installed. Please install jq to run this test."
        exit 1
    fi
    
    # Test service availability
    print_status "INFO" "Checking if service is accessible..."
    if ! curl -s --connect-timeout 5 "$BASE_URL/health/liveness" >/dev/null; then
        print_status "FAIL" "Service is not accessible at $BASE_URL"
        print_status "INFO" "Make sure the service is running: make run"
        exit 1
    fi
    
    print_status "PASS" "Service is accessible"
    echo ""
    
    # Test each endpoint
    test_endpoint "/health" "200" "Comprehensive health check"
    echo ""
    
    test_endpoint "/health/readiness" "200" "Readiness probe"
    echo ""
    
    test_endpoint "/health/liveness" "200" "Liveness probe"
    echo ""
    
    # Test performance
    test_performance
    echo ""
    
    # Summary
    echo "=========================================="
    if [ $FAILED -eq 0 ]; then
        print_status "PASS" "All tests passed! 🎉"
        exit 0
    else
        print_status "FAIL" "$FAILED test(s) failed"
        exit 1
    fi
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Health Check Test Suite for AI Service"
    echo ""
    echo "Usage: $0 [base_url]"
    echo ""
    echo "Arguments:"
    echo "  base_url    Base URL of the service (default: http://localhost:8081)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test local development server"
    echo "  $0 http://localhost:8081             # Test specific local instance"
    echo "  $0 https://ai-svc.example.com        # Test production instance"
    echo ""
    echo "Requirements:"
    echo "  - curl: For making HTTP requests"
    echo "  - jq: For parsing JSON responses"
    echo "  - bc: For performance calculations (optional)"
    exit 0
fi

main
