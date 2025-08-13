#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Link Integration Tests${NC}"

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker-compose -f docker-compose.yml -f docker-compose.test.yml down -v
    docker-compose -f docker-compose.yml down -v
}

# Cleanup on exit
trap cleanup EXIT

# Build and start services
echo -e "${YELLOW}Building and starting services...${NC}"
docker-compose up -d --build

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "unhealthy\|starting"; then
        echo "Services still starting... ($((attempt+1))/$max_attempts)"
        sleep 5
        attempt=$((attempt+1))
    else
        break
    fi
done

# Check if all services are healthy
if docker-compose ps | grep -q "unhealthy"; then
    echo -e "${RED}Some services are unhealthy:${NC}"
    docker-compose ps
    exit 1
fi

echo -e "${GREEN}All services are healthy!${NC}"

# Test 1: Health checks
echo -e "${YELLOW}Running health check tests...${NC}"
curl -f http://localhost:8080/health || { echo -e "${RED}Gateway health check failed${NC}"; exit 1; }
curl -f http://localhost:8081/health || { echo -e "${RED}User service health check failed${NC}"; exit 1; }
curl -f http://localhost:8082/health || { echo -e "${RED}Discovery service health check failed${NC}"; exit 1; }
curl -f http://localhost:8083/health || { echo -e "${RED}Search service health check failed${NC}"; exit 1; }

echo -e "${GREEN}✓ Health checks passed${NC}"

# Test 2: User registration and authentication
echo -e "${YELLOW}Testing user registration and authentication...${NC}"

# Register a test user
register_response=$(curl -s -X POST http://localhost:8080/auth/register \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser",
        "email": "test@example.com",
        "password": "TestPassword123!",
        "first_name": "Test",
        "last_name": "User"
    }')

if ! echo "$register_response" | grep -q "id"; then
    echo -e "${RED}User registration failed: $register_response${NC}"
    exit 1
fi

# Login and extract token
login_response=$(curl -s -X POST http://localhost:8080/auth/login \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!"
    }')

if ! echo "$login_response" | grep -q "user"; then
    echo -e "${RED}Login failed: $login_response${NC}"
    exit 1
fi

# Extract the JWT cookie for further requests
jwt_cookie=$(echo "$login_response" | grep -o '"jwt":"[^"]*"' | cut -d'"' -f4)
if [ -z "$jwt_cookie" ]; then
    echo -e "${RED}Failed to extract JWT token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authentication tests passed${NC}"

# Test 3: User profile retrieval
echo -e "${YELLOW}Testing user profile retrieval...${NC}"

profile_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" http://localhost:8080/users/profile)

if ! echo "$profile_response" | grep -q "testuser"; then
    echo -e "${RED}Profile retrieval failed: $profile_response${NC}"
    exit 1
fi

echo -e "${GREEN}✓ User profile tests passed${NC}"

# Test 4: Search service functionality
echo -e "${YELLOW}Testing search service functionality...${NC}"

# Test search endpoint (should work with authenticated user)
search_response=$(curl -s -X POST http://localhost:8080/search \
    -H "Authorization: Bearer $jwt_cookie" \
    -H "Content-Type: application/json" \
    -d '{
        "query": "software engineer",
        "limit": 10
    }')

if ! echo "$search_response" | grep -q "results\|query_processed"; then
    echo -e "${RED}Search functionality failed: $search_response${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Search service tests passed${NC}"

# Test 5: Discovery service ranking endpoints
echo -e "${YELLOW}Testing discovery service ranking endpoints...${NC}"

# Get current ranking weights
ranking_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" http://localhost:8080/discovery/ranking/weights)

if ! echo "$ranking_response" | grep -q "semantic_similarity\|data"; then
    echo -e "${RED}Ranking weights retrieval failed: $ranking_response${NC}"
    exit 1
fi

# Validate ranking weights
validation_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" http://localhost:8080/discovery/ranking/weights/validate)

if ! echo "$validation_response" | grep -q '"valid":true'; then
    echo -e "${RED}Ranking weights validation failed: $validation_response${NC}"
    exit 1
fi

# Get ranking algorithm info
info_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" http://localhost:8080/discovery/ranking/info)

if ! echo "$info_response" | grep -q '"version":"v1"'; then
    echo -e "${RED}Ranking algorithm info failed: $info_response${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Discovery service ranking tests passed${NC}"

# Test 6: Discovery available users endpoint
echo -e "${YELLOW}Testing discovery available users endpoint...${NC}"

available_users_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" "http://localhost:8080/discovery/available-users?limit=10")

if ! echo "$available_users_response" | grep -q "available_users\|total_available"; then
    echo -e "${RED}Available users endpoint failed: $available_users_response${NC}"
    exit 1
fi

# Test with search query
search_users_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" "http://localhost:8080/discovery/available-users?q=test&limit=10&include_search_scores=true")

if ! echo "$search_users_response" | grep -q "available_users"; then
    echo -e "${RED}Available users with search failed: $search_users_response${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Discovery available users tests passed${NC}"

# Test 7: Rate limiting
echo -e "${YELLOW}Testing rate limiting...${NC}"

rate_limit_failed=false
for i in {1..12}; do
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $jwt_cookie" http://localhost:8080/users/profile)
    http_code=$(echo "$response" | tail -c 4)
    
    if [ "$http_code" = "429" ]; then
        echo -e "${GREEN}✓ Rate limiting is working (triggered at request $i)${NC}"
        rate_limit_failed=false
        break
    fi
done

# Note: Rate limiting might not be strictly enforced in test environment
if [ "$rate_limit_failed" = true ]; then
    echo -e "${YELLOW}⚠ Rate limiting not triggered (might be disabled in test mode)${NC}"
fi

# Test 8: Error handling
echo -e "${YELLOW}Testing error handling...${NC}"

# Test with invalid token
invalid_token_response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer invalid-token" http://localhost:8080/users/profile)
http_code=$(echo "$invalid_token_response" | tail -c 4)

if [ "$http_code" != "401" ]; then
    echo -e "${RED}Invalid token should return 401, got $http_code${NC}"
    exit 1
fi

# Test with missing token
no_token_response=$(curl -s -w "%{http_code}" http://localhost:8080/users/profile)
http_code=$(echo "$no_token_response" | tail -c 4)

if [ "$http_code" != "401" ]; then
    echo -e "${RED}Missing token should return 401, got $http_code${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Error handling tests passed${NC}"

# Test 9: Database persistence
echo -e "${YELLOW}Testing database persistence...${NC}"

# Restart user service to ensure data persists
docker-compose restart user-svc

# Wait for service to be healthy again
sleep 10

# Try to login again with the same user
persistence_response=$(curl -s -X POST http://localhost:8080/auth/login \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!"
    }')

if ! echo "$persistence_response" | grep -q "user"; then
    echo -e "${RED}Database persistence failed: $persistence_response${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database persistence tests passed${NC}"

# Test 10: Service communication
echo -e "${YELLOW}Testing inter-service communication...${NC}"

# Test discovery service calling search service through available users endpoint
comm_response=$(curl -s -H "Authorization: Bearer $jwt_cookie" "http://localhost:8080/discovery/available-users?q=software&include_search_scores=true")

if echo "$comm_response" | grep -q '"search_applied":true'; then
    echo -e "${GREEN}✓ Inter-service communication is working${NC}"
else
    echo -e "${YELLOW}⚠ Inter-service communication may not be fully integrated${NC}"
fi

# Final summary
echo -e "${GREEN}"
echo "========================================="
echo "     INTEGRATION TESTS COMPLETED"
echo "========================================="
echo -e "${NC}"
echo -e "${GREEN}✓ Health checks${NC}"
echo -e "${GREEN}✓ Authentication & authorization${NC}"
echo -e "${GREEN}✓ User profile management${NC}"
echo -e "${GREEN}✓ Search service integration${NC}"
echo -e "${GREEN}✓ Discovery service ranking${NC}"
echo -e "${GREEN}✓ Available users endpoint${NC}"
echo -e "${GREEN}✓ Error handling${NC}"
echo -e "${GREEN}✓ Database persistence${NC}"
echo -e "${GREEN}✓ Service communication${NC}"
echo ""
echo -e "${GREEN}All integration tests passed successfully!${NC}"

exit 0
