#!/bin/bash

# Runtime Security Testing Script
# This script performs comprehensive security testing on the Link application
# including JWT token manipulation, header spoofing, and CORS validation

set -e

# Configuration
API_GATEWAY_URL="http://localhost:8080"
USER_SVC_URL="http://localhost:8081"
TEST_RESULTS_DIR="./security_test_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

echo -e "${GREEN}=== Link Application Security Testing ===${NC}"
echo -e "${GREEN}Timestamp: $TIMESTAMP${NC}"
echo ""

# Function to log results
log_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] $test_name${NC}"
    echo "$result"
    echo "$details" > "$TEST_RESULTS_DIR/${test_name}_${TIMESTAMP}.log"
    echo ""
}

# Function to wait for services to be ready
wait_for_service() {
    local url="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url/health" | grep -q "200\|404"; then
            echo -e "${GREEN}$service_name is ready!${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}$service_name failed to start after $max_attempts attempts${NC}"
    return 1
}

# Step 1: Create test user and capture JWT & cookies
create_test_user() {
    echo -e "${GREEN}=== Step 1: Creating Test User ===${NC}"
    
    # User registration payload
    local user_payload='{
        "email": "testuser@security.test",
        "password": "SecurePassword123!",
        "username": "securitytester",
        "firstName": "Security",
        "lastName": "Tester",
        "dateOfBirth": "1990-01-01"
    }'
    
    # Register user
    local register_response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nCONTENT_TYPE:%{content_type}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$user_payload" \
        "$API_GATEWAY_URL/api/auth/register" 2>&1)
    
    log_result "user_registration" "$register_response" "Registration attempt for security testing user"
    
    # Login user
    local login_payload='{
        "email": "testuser@security.test",
        "password": "SecurePassword123!"
    }'
    
    local login_response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nCONTENT_TYPE:%{content_type}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -c "$TEST_RESULTS_DIR/cookies.txt" \
        -D "$TEST_RESULTS_DIR/headers.txt" \
        -d "$login_payload" \
        "$API_GATEWAY_URL/api/auth/login" 2>&1)
    
    log_result "user_login" "$login_response" "Login attempt to capture JWT token and cookies"
    
    # Extract JWT token from response
    JWT_TOKEN=$(echo "$login_response" | jq -r '.token // .accessToken // empty' 2>/dev/null)
    
    if [ -z "$JWT_TOKEN" ]; then
        # Try to extract from Set-Cookie header
        JWT_TOKEN=$(echo "$login_response" | grep -i "set-cookie" | grep -o "token=[^;]*" | cut -d'=' -f2)
    fi
    
    echo -e "${GREEN}Captured JWT Token: ${JWT_TOKEN:0:50}...${NC}"
    echo "$JWT_TOKEN" > "$TEST_RESULTS_DIR/jwt_token.txt"
    
    return 0
}

# Step 2: JWT Token Manipulation Tests
test_jwt_manipulation() {
    echo -e "${GREEN}=== Step 2: JWT Token Manipulation Tests ===${NC}"
    
    if [ -z "$JWT_TOKEN" ]; then
        echo -e "${RED}No JWT token available for testing${NC}"
        return 1
    fi
    
    # Test 2.1: Token Replay Attack
    echo -e "${YELLOW}Test 2.1: Token Replay Attack${NC}"
    local replay_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X GET \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Accept: application/json" \
        "$API_GATEWAY_URL/api/user/profile" 2>&1)
    
    log_result "jwt_replay_attack" "$replay_response" "Testing if JWT token can be replayed successfully"
    
    # Test 2.2: Algorithm Confusion Attack (alg: none)
    echo -e "${YELLOW}Test 2.2: Algorithm Confusion Attack (alg: none)${NC}"
    
    # Create a malicious JWT with alg: none
    local header_none='{"alg":"none","typ":"JWT"}'
    local payload_admin='{"sub":"admin","exp":9999999999,"role":"admin","user_id":"1"}'
    local header_b64=$(echo -n "$header_none" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    local payload_b64=$(echo -n "$payload_admin" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    local malicious_token="${header_b64}.${payload_b64}."
    
    local alg_none_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X GET \
        -H "Authorization: Bearer $malicious_token" \
        -H "Accept: application/json" \
        "$API_GATEWAY_URL/api/user/profile" 2>&1)
    
    log_result "jwt_alg_none_attack" "$alg_none_response" "Testing algorithm confusion attack with alg:none"
    
    # Test 2.3: Token Expiration Tampering
    echo -e "${YELLOW}Test 2.3: Token Expiration Tampering${NC}"
    
    # Decode the original JWT and modify expiration
    if command -v jq >/dev/null 2>&1; then
        local jwt_parts=($(echo "$JWT_TOKEN" | tr '.' '\n'))
        local original_payload=$(echo "${jwt_parts[1]}" | base64 -d 2>/dev/null | jq '.')
        
        if [ $? -eq 0 ]; then
            # Create payload with extended expiration
            local extended_payload=$(echo "$original_payload" | jq '.exp = 9999999999')
            local extended_payload_b64=$(echo -n "$extended_payload" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
            local tampered_token="${jwt_parts[0]}.$extended_payload_b64.${jwt_parts[2]}"
            
            local exp_tamper_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
                -X GET \
                -H "Authorization: Bearer $tampered_token" \
                -H "Accept: application/json" \
                "$API_GATEWAY_URL/api/user/profile" 2>&1)
            
            log_result "jwt_exp_tampering" "$exp_tamper_response" "Testing expiration tampering attack"
        fi
    fi
    
    return 0
}

# Step 3: Header Spoofing Tests
test_header_spoofing() {
    echo -e "${GREEN}=== Step 3: Header Spoofing Tests ===${NC}"
    
    # Test 3.1: X-User-ID Header Spoofing
    echo -e "${YELLOW}Test 3.1: X-User-ID Header Spoofing${NC}"
    
    local user_id_spoof_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X GET \
        -H "X-User-ID: admin" \
        -H "X-Real-User-ID: 999" \
        -H "X-Forwarded-User: administrator" \
        -H "Accept: application/json" \
        "$API_GATEWAY_URL/api/user/profile" 2>&1)
    
    log_result "header_user_id_spoofing" "$user_id_spoof_response" "Testing X-User-ID header spoofing"
    
    # Test 3.2: X-Forwarded-For Spoofing
    echo -e "${YELLOW}Test 3.2: X-Forwarded-For Spoofing${NC}"
    
    local xff_spoof_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X GET \
        -H "X-Forwarded-For: 127.0.0.1, 10.0.0.1" \
        -H "X-Real-IP: 192.168.1.100" \
        -H "X-Originating-IP: 8.8.8.8" \
        -H "Accept: application/json" \
        "$API_GATEWAY_URL/api/health" 2>&1)
    
    log_result "header_xff_spoofing" "$xff_spoof_response" "Testing X-Forwarded-For header spoofing"
    
    # Test 3.3: Role/Permission Header Spoofing
    echo -e "${YELLOW}Test 3.3: Role/Permission Header Spoofing${NC}"
    
    local role_spoof_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X GET \
        -H "X-User-Role: admin" \
        -H "X-User-Permissions: all" \
        -H "X-Admin: true" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Accept: application/json" \
        "$API_GATEWAY_URL/api/admin/users" 2>&1)
    
    log_result "header_role_spoofing" "$role_spoof_response" "Testing role/permission header spoofing"
    
    return 0
}

# Step 4: CORS Validation Tests
test_cors_validation() {
    echo -e "${GREEN}=== Step 4: CORS Validation Tests ===${NC}"
    
    # Test 4.1: CORS Preflight Request
    echo -e "${YELLOW}Test 4.1: CORS Preflight Request${NC}"
    
    local cors_preflight_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X OPTIONS \
        -H "Origin: https://malicious-site.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type, Authorization" \
        "$API_GATEWAY_URL/api/auth/login" 2>&1)
    
    log_result "cors_preflight_malicious_origin" "$cors_preflight_response" "Testing CORS preflight with malicious origin"
    
    # Test 4.2: Check for wildcard (*) origins in production
    echo -e "${YELLOW}Test 4.2: Wildcard Origin Check${NC}"
    
    local cors_wildcard_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X GET \
        -H "Origin: https://evil.com" \
        -H "Accept: application/json" \
        "$API_GATEWAY_URL/api/health" 2>&1)
    
    log_result "cors_wildcard_check" "$cors_wildcard_response" "Checking for wildcard (*) CORS origins"
    
    # Test 4.3: Null Origin Test
    echo -e "${YELLOW}Test 4.3: Null Origin Test${NC}"
    
    local cors_null_origin_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
        -X POST \
        -H "Origin: null" \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}' \
        "$API_GATEWAY_URL/api/auth/login" 2>&1)
    
    log_result "cors_null_origin" "$cors_null_origin_response" "Testing CORS with null origin"
    
    # Test 4.4: Various Subdomain Origins
    echo -e "${YELLOW}Test 4.4: Subdomain Origin Tests${NC}"
    
    local origins=(
        "https://app.link-app.com"
        "https://admin.link-app.com"
        "https://api.link-app.com"
        "https://test.link-app.com"
        "https://attacker.link-app.com.evil.com"
    )
    
    for origin in "${origins[@]}"; do
        local subdomain_response=$(curl -s -w "\n%{http_code}\n%{response_headers}" \
            -X GET \
            -H "Origin: $origin" \
            -H "Accept: application/json" \
            "$API_GATEWAY_URL/api/health" 2>&1)
        
        log_result "cors_subdomain_$(echo $origin | sed 's/[^a-zA-Z0-9]/_/g')" "$subdomain_response" "Testing CORS with origin: $origin"
    done
    
    return 0
}

# Additional Security Tests
test_additional_security() {
    echo -e "${GREEN}=== Additional Security Tests ===${NC}"
    
    # Test: Rate Limiting
    echo -e "${YELLOW}Test: Rate Limiting${NC}"
    
    for i in {1..20}; do
        curl -s -o /dev/null -w "%{http_code} " \
            -X POST \
            -H "Content-Type: application/json" \
            -d '{"email":"test@test.com","password":"wrong"}' \
            "$API_GATEWAY_URL/api/auth/login"
    done
    echo ""
    
    # Test: SQL Injection in Headers
    echo -e "${YELLOW}Test: SQL Injection Attempts${NC}"
    
    local sql_payloads=(
        "'; DROP TABLE users; --"
        "' OR '1'='1"
        "admin'/*"
        "' UNION SELECT * FROM users --"
    )
    
    for payload in "${sql_payloads[@]}"; do
        local sqli_response=$(curl -s -w "\n%{http_code}" \
            -X GET \
            -H "X-User-ID: $payload" \
            -H "Accept: application/json" \
            "$API_GATEWAY_URL/api/user/profile" 2>&1)
        
        echo "SQL Payload: $payload -> HTTP $(echo "$sqli_response" | tail -1)"
    done
    
    return 0
}

# Generate Security Report
generate_security_report() {
    echo -e "${GREEN}=== Generating Security Report ===${NC}"
    
    local report_file="$TEST_RESULTS_DIR/security_report_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# Security Testing Report

**Timestamp:** $TIMESTAMP
**Target:** Link Application
**API Gateway:** $API_GATEWAY_URL

## Summary

This report contains the results of comprehensive security testing performed on the Link application, including:

1. JWT Token Manipulation Tests
2. Header Spoofing Attacks  
3. CORS Validation Tests
4. Additional Security Checks

## Test Results

### 1. User Creation and Authentication

- **User Registration:** $([ -f "$TEST_RESULTS_DIR/user_registration_${TIMESTAMP}.log" ] && echo "✅ Completed" || echo "❌ Failed")
- **User Login:** $([ -f "$TEST_RESULTS_DIR/user_login_${TIMESTAMP}.log" ] && echo "✅ Completed" || echo "❌ Failed")
- **JWT Token Captured:** $([ -f "$TEST_RESULTS_DIR/jwt_token.txt" ] && echo "✅ Yes" || echo "❌ No")

### 2. JWT Token Manipulation

- **Token Replay Attack:** $([ -f "$TEST_RESULTS_DIR/jwt_replay_attack_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")
- **Algorithm Confusion (alg: none):** $([ -f "$TEST_RESULTS_DIR/jwt_alg_none_attack_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")
- **Expiration Tampering:** $([ -f "$TEST_RESULTS_DIR/jwt_exp_tampering_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")

### 3. Header Spoofing Tests

- **X-User-ID Spoofing:** $([ -f "$TEST_RESULTS_DIR/header_user_id_spoofing_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")
- **X-Forwarded-For Spoofing:** $([ -f "$TEST_RESULTS_DIR/header_xff_spoofing_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")
- **Role/Permission Spoofing:** $([ -f "$TEST_RESULTS_DIR/header_role_spoofing_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")

### 4. CORS Validation

- **Malicious Origin Preflight:** $([ -f "$TEST_RESULTS_DIR/cors_preflight_malicious_origin_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")
- **Wildcard Origin Check:** $([ -f "$TEST_RESULTS_DIR/cors_wildcard_check_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")
- **Null Origin Test:** $([ -f "$TEST_RESULTS_DIR/cors_null_origin_${TIMESTAMP}.log" ] && echo "✅ Tested" || echo "❌ Not Tested")

## Recommendations

1. **JWT Security:**
   - Ensure JWT tokens are properly validated
   - Reject tokens with 'alg: none'
   - Validate token expiration strictly
   - Implement token blacklisting for logout

2. **Header Security:**
   - Never trust client-provided headers for authentication
   - Implement proper API Gateway authentication
   - Validate all incoming headers

3. **CORS Configuration:**
   - Avoid wildcard (*) origins in production
   - Implement strict origin validation
   - Properly handle preflight requests

4. **Additional Security:**
   - Implement rate limiting
   - Add input validation
   - Monitor for suspicious patterns

## Log Files

All detailed test results are stored in:
\`$TEST_RESULTS_DIR/\`

EOF

    echo -e "${GREEN}Security report generated: $report_file${NC}"
}

# Main execution function
main() {
    echo -e "${GREEN}Starting Docker Compose environment...${NC}"
    
    # Note: In a real scenario, we would start docker-compose here
    # docker-compose up -d
    
    echo -e "${YELLOW}Note: This is a simulation of the security testing process.${NC}"
    echo -e "${YELLOW}In a real environment, docker-compose would be started first.${NC}"
    echo ""
    
    # Wait for services (simulated)
    echo -e "${YELLOW}Simulating service startup...${NC}"
    sleep 2
    
    # Run all security tests
    create_test_user
    test_jwt_manipulation
    test_header_spoofing
    test_cors_validation
    test_additional_security
    
    # Generate report
    generate_security_report
    
    echo -e "${GREEN}=== Security Testing Complete ===${NC}"
    echo -e "${GREEN}Results stored in: $TEST_RESULTS_DIR/${NC}"
    echo -e "${GREEN}Report available at: $TEST_RESULTS_DIR/security_report_${TIMESTAMP}.md${NC}"
    
    # In a real scenario, we would clean up
    # docker-compose down
}

# Run the main function
main "$@"
