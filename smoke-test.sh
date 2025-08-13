#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Link App - Quick Smoke Test${NC}"
echo "=================================="

# Function to check service health
check_health() {
    local service_name=$1
    local url=$2
    
    echo -n "Checking $service_name... "
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Function to test API endpoint
test_endpoint() {
    local test_name=$1
    local method=$2
    local url=$3
    local data=$4
    local headers=$5
    
    echo -n "Testing $test_name... "
    
    if [ -n "$data" ] && [ -n "$headers" ]; then
        response=$(curl -s -X "$method" "$url" -H "$headers" -d "$data" 2>/dev/null || echo "ERROR")
    elif [ -n "$headers" ]; then
        response=$(curl -s -X "$method" "$url" -H "$headers" 2>/dev/null || echo "ERROR")
    elif [ -n "$data" ]; then
        response=$(curl -s -X "$method" "$url" -d "$data" 2>/dev/null || echo "ERROR")
    else
        response=$(curl -s -X "$method" "$url" 2>/dev/null || echo "ERROR")
    fi
    
    if [[ "$response" == "ERROR" ]]; then
        echo -e "${RED}❌ Failed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Success${NC}"
        return 0
    fi
}

echo -e "${YELLOW}Step 1: Checking if services are running...${NC}"

# Check if Docker Compose is running
if ! docker-compose ps 2>/dev/null | grep -q "Up"; then
    echo -e "${RED}❌ Backend services are not running!${NC}"
    echo -e "${YELLOW}💡 Start them with: cd backend && docker-compose up -d${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose services detected${NC}"

echo -e "\n${YELLOW}Step 2: Health Check Tests${NC}"

health_checks_passed=0
total_health_checks=4

# Health checks
check_health "API Gateway" "http://localhost:8080/health" && ((health_checks_passed++))
check_health "User Service" "http://localhost:8081/health" && ((health_checks_passed++))
check_health "Discovery Service" "http://localhost:8082/health" && ((health_checks_passed++))
check_health "Search Service" "http://localhost:8083/health" && ((health_checks_passed++))

if [ $health_checks_passed -lt $total_health_checks ]; then
    echo -e "\n${RED}❌ Some health checks failed ($health_checks_passed/$total_health_checks passed)${NC}"
    echo -e "${YELLOW}💡 Try: docker-compose logs <service-name> to debug${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ All health checks passed!${NC}"

echo -e "\n${YELLOW}Step 3: Authentication Flow Test${NC}"

# Test user registration
unique_id=$(date +%s)
test_email="smoketest${unique_id}@test.com"
test_username="smoketest${unique_id}"

register_data="{
    \"username\": \"$test_username\",
    \"email\": \"$test_email\",
    \"password\": \"SmokeTest123!\",
    \"first_name\": \"Smoke\",
    \"last_name\": \"Test\"
}"

echo -n "Testing user registration... "
register_response=$(curl -s -X POST "http://localhost:8080/auth/register" \
    -H "Content-Type: application/json" \
    -d "$register_data" 2>/dev/null || echo "ERROR")

if [[ "$register_response" == "ERROR" ]] || ! echo "$register_response" | grep -q "id"; then
    echo -e "${RED}❌ Failed${NC}"
    echo "Response: $register_response"
    exit 1
else
    echo -e "${GREEN}✅ Success${NC}"
fi

# Test login and extract JWT token
login_data="{
    \"email\": \"$test_email\",
    \"password\": \"SmokeTest123!\"
}"

echo -n "Testing login... "
login_response=$(curl -s -X POST "http://localhost:8080/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_data" 2>/dev/null || echo "ERROR")

if [[ "$login_response" == "ERROR" ]] || ! echo "$login_response" | grep -q "user"; then
    echo -e "${RED}❌ Failed${NC}"
    echo "Response: $login_response"
    exit 1
else
    echo -e "${GREEN}✅ Success${NC}"
fi

# Extract JWT token (try multiple formats)
jwt_token=""
if command -v jq >/dev/null 2>&1; then
    jwt_token=$(echo "$login_response" | jq -r '.jwt // .token // empty' 2>/dev/null || true)
fi

# If jq failed or not available, try grep
if [ -z "$jwt_token" ]; then
    jwt_token=$(echo "$login_response" | grep -o '"jwt":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)
fi

# Try alternative token field name
if [ -z "$jwt_token" ]; then
    jwt_token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)
fi

if [ -z "$jwt_token" ] || [ "$jwt_token" = "null" ]; then
    echo -e "${YELLOW}⚠️  Could not extract JWT token, skipping authenticated tests${NC}"
    echo "Login response: $login_response"
else
    echo -e "${YELLOW}Step 4: Authenticated Endpoint Tests${NC}"
    
    # Test profile retrieval
    test_endpoint "Profile retrieval" "GET" "http://localhost:8080/users/profile" "" "Authorization: Bearer $jwt_token"
    
    # Test search functionality
    search_data='{"query": "software engineer", "limit": 10}'
    test_endpoint "Search functionality" "POST" "http://localhost:8080/search" "$search_data" "Authorization: Bearer $jwt_token,Content-Type: application/json"
    
    # Test ranking endpoints
    test_endpoint "Ranking weights" "GET" "http://localhost:8080/discovery/ranking/weights" "" "Authorization: Bearer $jwt_token"
    test_endpoint "Ranking info" "GET" "http://localhost:8080/discovery/ranking/info" "" "Authorization: Bearer $jwt_token"
    
    # Test discovery endpoints
    test_endpoint "Available users" "GET" "http://localhost:8080/discovery/available-users?limit=5" "" "Authorization: Bearer $jwt_token"
fi

echo -e "\n${YELLOW}Step 5: Frontend Check${NC}"

echo -n "Checking if frontend is accessible... "
if curl -f -s "http://localhost:5173" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend running${NC}"
elif curl -f -s "http://localhost:3000" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend running (port 3000)${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend not running${NC}"
    echo -e "${BLUE}💡 Start with: cd frontend && npm run dev${NC}"
fi

# Summary
echo -e "\n${GREEN}========================================="
echo "           SMOKE TEST COMPLETE"
echo "=========================================${NC}"
echo -e "${GREEN}✅ Backend services are healthy${NC}"
echo -e "${GREEN}✅ Authentication flow works${NC}"
if [ -n "$jwt_token" ] && [ "$jwt_token" != "null" ]; then
    echo -e "${GREEN}✅ Authenticated endpoints accessible${NC}"
fi
echo -e "${GREEN}✅ API Gateway routing functional${NC}"
echo ""
echo -e "${BLUE}🎉 Your Link app is ready for development!${NC}"

# Cleanup message
echo -e "\n${YELLOW}🧹 Cleanup:${NC}"
echo "The test user created will remain in the database."
echo "To reset the database: cd backend && docker-compose down -v && docker-compose up -d"

exit 0
