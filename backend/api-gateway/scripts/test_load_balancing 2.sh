#!/bin/bash

# Load Balancing Test Script for Enhanced API Gateway
# This script tests the round-robin load balancing across service instances

set -e

# Configuration
API_GATEWAY_URL="http://localhost:8080"
TEST_ITERATIONS=12
SERVICES=("user-svc" "chat-svc" "location-svc")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing Enhanced API Gateway Load Balancing${NC}"
echo "================================================="
echo ""

# Function to test service health endpoint
test_health() {
    local service=$1
    echo -e "${YELLOW}Testing ${service} health endpoint...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" "${API_GATEWAY_URL}/${service}/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ $http_code -eq 200 ]]; then
        echo -e "${GREEN}✓ ${service} health check passed${NC}"
        instance_id=$(echo "$body" | jq -r '.instance_id // "unknown"' 2>/dev/null || echo "unknown")
        echo "  Instance: $instance_id"
    else
        echo -e "${RED}✗ ${service} health check failed (HTTP $http_code)${NC}"
        echo "  Response: $body"
    fi
    echo ""
}

# Function to test load balancing distribution
test_load_balancing() {
    local service=$1
    echo -e "${YELLOW}Testing ${service} load balancing distribution...${NC}"
    
    declare -A instance_counts
    total_requests=0
    successful_requests=0
    
    for ((i=1; i<=TEST_ITERATIONS; i++)); do
        # Make request to service endpoint
        response=$(curl -s -w "\n%{http_code}\n%{header_x_proxy_instance}" \
                       "${API_GATEWAY_URL}/${service}/health" 2>/dev/null || echo -e "\nerror\nunknown")
        
        http_code=$(echo "$response" | sed -n '2p')
        instance_header=$(echo "$response" | sed -n '3p')
        
        total_requests=$((total_requests + 1))
        
        if [[ $http_code -eq 200 ]]; then
            successful_requests=$((successful_requests + 1))
            
            # Extract instance ID from response header or body
            if [[ -n "$instance_header" && "$instance_header" != "unknown" ]]; then
                instance_id="$instance_header"
            else
                # Try to extract from response body
                body=$(echo "$response" | sed '2,3d')
                instance_id=$(echo "$body" | jq -r '.instance_id // "unknown"' 2>/dev/null || echo "unknown")
            fi
            
            instance_counts["$instance_id"]=$((${instance_counts["$instance_id"]} + 1))
            
            echo -n "."
        else
            echo -n "✗"
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    echo ""
    echo ""
    
    # Display results
    echo "Results for ${service}:"
    echo "  Total requests: $total_requests"
    echo "  Successful requests: $successful_requests"
    echo "  Success rate: $(echo "scale=2; $successful_requests * 100 / $total_requests" | bc -l)%"
    echo ""
    
    echo "Instance distribution:"
    for instance in "${!instance_counts[@]}"; do
        count=${instance_counts[$instance]}
        percentage=$(echo "scale=1; $count * 100 / $successful_requests" | bc -l)
        echo "  $instance: $count requests (${percentage}%)"
    done
    
    # Check if distribution is reasonably balanced
    if [[ ${#instance_counts[@]} -gt 1 ]]; then
        max_count=0
        min_count=$successful_requests
        for count in "${instance_counts[@]}"; do
            if [[ $count -gt $max_count ]]; then
                max_count=$count
            fi
            if [[ $count -lt $min_count ]]; then
                min_count=$count
            fi
        done
        
        imbalance_ratio=$(echo "scale=2; ($max_count - $min_count) * 100 / $successful_requests" | bc -l)
        if (( $(echo "$imbalance_ratio < 30" | bc -l) )); then
            echo -e "  ${GREEN}✓ Load balancing appears well-distributed${NC}"
        else
            echo -e "  ${YELLOW}⚠ Load balancing may be imbalanced (${imbalance_ratio}% variance)${NC}"
        fi
    else
        echo -e "  ${RED}✗ Only one instance responded - load balancing not working${NC}"
    fi
    
    echo ""
}

# Function to test circuit breaker functionality
test_circuit_breaker() {
    local service=$1
    echo -e "${YELLOW}Testing ${service} circuit breaker behavior...${NC}"
    
    # Make several rapid requests to trigger potential circuit breaker
    echo "Making rapid requests to test circuit breaker..."
    for ((i=1; i<=20; i++)); do
        response=$(curl -s -w "%{http_code}" "${API_GATEWAY_URL}/${service}/health" -m 1 || echo "timeout")
        echo -n "$response "
        sleep 0.05
    done
    echo ""
    echo ""
}

# Function to test API Gateway health endpoint
test_gateway_health() {
    echo -e "${YELLOW}Testing API Gateway health endpoint...${NC}"
    
    response=$(curl -s "${API_GATEWAY_URL}/health")
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓ API Gateway health endpoint accessible${NC}"
        echo "Response: $response" | jq '.' 2>/dev/null || echo "$response"
    else
        echo -e "${RED}✗ API Gateway health endpoint failed${NC}"
    fi
    echo ""
}

# Function to test metrics endpoint
test_metrics() {
    echo -e "${YELLOW}Testing API Gateway metrics endpoint...${NC}"
    
    response=$(curl -s "${API_GATEWAY_URL}/metrics")
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓ Metrics endpoint accessible${NC}"
        # Count different metric types
        proxy_requests=$(echo "$response" | grep -c "proxy_requests_total" || echo "0")
        circuit_breaker_metrics=$(echo "$response" | grep -c "proxy_circuit_breaker_state" || echo "0")
        instances_metrics=$(echo "$response" | grep -c "proxy_instances_available" || echo "0")
        
        echo "  Proxy request metrics: $proxy_requests"
        echo "  Circuit breaker metrics: $circuit_breaker_metrics"
        echo "  Instance availability metrics: $instances_metrics"
    else
        echo -e "${RED}✗ Metrics endpoint failed${NC}"
    fi
    echo ""
}

# Main test execution
main() {
    echo "Starting comprehensive load balancing tests..."
    echo ""
    
    # Check if API Gateway is running
    if ! curl -s "${API_GATEWAY_URL}/health" > /dev/null; then
        echo -e "${RED}✗ API Gateway is not accessible at ${API_GATEWAY_URL}${NC}"
        echo "Please ensure the API Gateway is running with:"
        echo "  docker-compose -f docker-compose.multi-instance.yml up -d"
        exit 1
    fi
    
    # Test gateway health
    test_gateway_health
    
    # Test metrics endpoint
    test_metrics
    
    # Test each service
    for service in "${SERVICES[@]}"; do
        echo -e "${BLUE}--- Testing ${service} ---${NC}"
        test_health "$service"
        test_load_balancing "$service"
        test_circuit_breaker "$service"
        echo -e "${BLUE}${'─'${#service}//[[:graph:]]/─}${'─────────────'}${NC}"
        echo ""
    done
    
    # Final summary
    echo -e "${GREEN}🎉 Load balancing tests completed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check Prometheus metrics at http://localhost:9090"
    echo "2. View Grafana dashboards at http://localhost:3001 (admin/admin)"
    echo "3. Monitor logs: docker-compose -f docker-compose.multi-instance.yml logs -f api-gateway"
}

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}jq is not installed - JSON parsing will be limited${NC}"
fi

if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}bc is not installed - percentage calculations will be limited${NC}"
fi

# Run main function
main "$@"
