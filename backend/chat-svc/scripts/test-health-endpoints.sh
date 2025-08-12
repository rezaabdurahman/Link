#!/bin/bash

# Test script for health endpoints
# Usage: ./scripts/test-health-endpoints.sh [base_url]

BASE_URL=${1:-"http://localhost:8080"}

echo "🏥 Testing Health Endpoints for chat-svc"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Function to make request and format output
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo "📍 Testing $endpoint"
    echo "Description: $description"
    echo "URL: $BASE_URL$endpoint"
    echo "---"
    
    # Make the request and capture response
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nRESPONSE_TIME:%{time_total}" "$BASE_URL$endpoint")
    
    # Extract HTTP status and response time
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_time=$(echo "$response" | grep "RESPONSE_TIME:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/,$d')
    
    # Format the JSON response for better readability
    formatted_response=$(echo "$response_body" | python3 -m json.tool 2>/dev/null || echo "$response_body")
    
    echo "Status: $http_status"
    echo "Response Time: ${response_time}s"
    echo "Response:"
    echo "$formatted_response"
    
    # Add status interpretation
    case $http_status in
        200)
            echo "✅ SUCCESS - Service is healthy"
            ;;
        503)
            echo "⚠️  WARNING - Service is unhealthy/not ready"
            ;;
        404)
            echo "❌ ERROR - Endpoint not found (service may not be running)"
            ;;
        *)
            echo "❓ UNKNOWN - Unexpected status code"
            ;;
    esac
    
    echo ""
    echo "================================================"
    echo ""
}

# Test all health endpoints
echo "Starting health endpoint tests..."
echo ""

# 1. Comprehensive health check
test_endpoint "/health" "Comprehensive health check with DB & Redis connectivity"

# 2. Readiness probe
test_endpoint "/health/readiness" "Readiness probe - checks if service can accept traffic"

# 3. Liveness probe  
test_endpoint "/health/liveness" "Liveness probe - basic service availability check"

# Summary
echo "🏁 Health Endpoint Testing Complete"
echo ""
echo "📋 Summary:"
echo "- /health: Full health check with dependency verification"
echo "- /health/readiness: Traffic readiness check for load balancers"  
echo "- /health/liveness: Basic service liveness check for orchestrators"
echo ""
echo "💡 Tips:"
echo "- Use /health for monitoring and debugging"
echo "- Use /health/readiness for Kubernetes readiness probes"
echo "- Use /health/liveness for Kubernetes liveness probes"
echo "- 200 = healthy/ready/alive, 503 = unhealthy/not ready"
echo ""

# Optional: Continuous monitoring mode
if [[ "$2" == "--watch" ]]; then
    echo "🔄 Starting continuous monitoring (press Ctrl+C to stop)..."
    echo ""
    
    while true; do
        echo "$(date): Checking health..."
        curl -s "$BASE_URL/health" -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n"
        sleep 5
    done
fi
