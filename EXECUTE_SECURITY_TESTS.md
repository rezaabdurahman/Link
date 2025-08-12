# How to Execute Security Tests Against Running Docker Environment

This document provides step-by-step instructions for executing the security tests against a running Link application Docker environment.

## Prerequisites

1. **Docker and Docker Compose** installed and running
2. **Link application** codebase with docker-compose.yml
3. **curl** command-line tool
4. **jq** for JSON processing (optional but recommended)

## Step 1: Start the Docker Environment

```bash
# Navigate to the Link project directory
cd /path/to/Link

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                    STATUS
link_api_gateway       Up
link_postgres          Up (healthy)
link_redis             Up (healthy)
link_user_svc          Up
link_location_svc      Up
link_discovery_svc     Up
link_chat_svc          Up
link_ai_svc           Up
link_stories_svc      Up
link_opportunities_svc Up
link_frontend         Up
```

## Step 2: Execute Individual Attack Scenarios

### Test 1: User Registration and Login

```bash
# Test user registration
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "testuser@security.test",
    "password": "SecurePassword123!",
    "username": "securitytester",
    "firstName": "Security",
    "lastName": "Tester",
    "dateOfBirth": "1990-01-01"
  }' \
  http://localhost:8080/api/auth/register

# Test user login and capture JWT token
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "testuser@security.test",
    "password": "SecurePassword123!"
  }' \
  http://localhost:8080/api/auth/login)

# Extract JWT token
JWT_TOKEN=$(echo "$RESPONSE" | jq -r '.token // .accessToken // empty')
echo "JWT Token: $JWT_TOKEN"
```

### Test 2: JWT Algorithm Confusion Attack

```bash
# Create malicious JWT with alg: none
MALICIOUS_HEADER='{"alg":"none","typ":"JWT"}'
MALICIOUS_PAYLOAD='{"sub":"admin","exp":9999999999,"role":"admin","user_id":"1"}'
HEADER_B64=$(echo -n "$MALICIOUS_HEADER" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
PAYLOAD_B64=$(echo -n "$MALICIOUS_PAYLOAD" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
MALICIOUS_TOKEN="${HEADER_B64}.${PAYLOAD_B64}."

# Test the malicious token
curl -v -X GET \
  -H "Authorization: Bearer $MALICIOUS_TOKEN" \
  -H "Accept: application/json" \
  http://localhost:8080/api/user/profile
```

**Expected Secure Response:** HTTP 401 with error message about invalid algorithm

### Test 3: Header Spoofing Attack

```bash
# Test authentication bypass via headers
curl -v -X GET \
  -H "X-User-ID: admin" \
  -H "X-Real-User-ID: 999" \
  -H "X-Forwarded-User: administrator" \
  -H "Accept: application/json" \
  http://localhost:8080/api/user/profile
```

**Expected Secure Response:** HTTP 401 - Authentication required

### Test 4: CORS Policy Testing

```bash
# Test CORS with malicious origin
curl -v -X OPTIONS \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  http://localhost:8080/api/auth/login

# Check if wildcard origins are allowed
curl -v -X GET \
  -H "Origin: https://evil.com" \
  -H "Accept: application/json" \
  http://localhost:8080/api/health
```

**Look for in Response Headers:**
- ❌ `Access-Control-Allow-Origin: *` (indicates vulnerability)
- ✅ No CORS headers for untrusted origins (secure)

### Test 5: Rate Limiting

```bash
# Execute rapid requests to test rate limiting
for i in {1..20}; do
  echo "Request $i:"
  curl -s -w "HTTP %{http_code}\n" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    http://localhost:8080/api/auth/login
  sleep 0.1
done
```

**Expected Pattern:**
- First 5-10 requests: HTTP 401 (Invalid credentials)
- Subsequent requests: HTTP 429 (Too Many Requests)

### Test 6: SQL Injection in Headers

```bash
# Test various SQL injection payloads in headers
SQL_PAYLOADS=(
  "'; DROP TABLE users; --"
  "' OR '1'='1"
  "admin'/*"
  "' UNION SELECT * FROM users --"
)

for payload in "${SQL_PAYLOADS[@]}"; do
  echo "Testing payload: $payload"
  curl -v -X GET \
    -H "X-User-ID: $payload" \
    -H "Accept: application/json" \
    http://localhost:8080/api/user/profile
  echo "---"
done
```

**Expected Secure Response:** HTTP 400 - Bad Request or proper input sanitization

## Step 3: Automated Testing Script

Use the provided security testing script to execute all tests:

```bash
# Make sure Docker is running and services are up
docker-compose up -d

# Wait for services to be ready
sleep 30

# Run the comprehensive security tests
./security_tests_simple.sh

# Or use the curl-based version if available
./security_tests.sh
```

## Step 4: Results Analysis

After running tests, analyze the results:

### ✅ Secure Implementation Signs

1. **JWT Tests:**
   - Algorithm confusion attack returns HTTP 401
   - Token tampering returns HTTP 401
   - Proper signature validation

2. **Authentication Tests:**
   - Header spoofing returns HTTP 401
   - JWT token required for authentication

3. **CORS Tests:**
   - No `Access-Control-Allow-Origin: *` in production
   - Untrusted origins rejected

4. **Rate Limiting:**
   - HTTP 429 after threshold exceeded
   - Progressive backoff implemented

### ❌ Vulnerability Indicators

1. **Critical Issues:**
   - Algorithm confusion attack succeeds (HTTP 200)
   - Authentication bypass via headers (HTTP 200)
   - CORS wildcard in production

2. **High Risk:**
   - SQL injection successful
   - No rate limiting (all requests return same code)
   - Token replay after logout

## Step 5: Documentation

Document all test results with:

1. **HTTP Request/Response Pairs:**
   ```
   Request:
   GET /api/user/profile HTTP/1.1
   Authorization: Bearer <malicious_token>
   
   Response:
   HTTP/1.1 401 Unauthorized
   {"error": "Invalid token algorithm"}
   ```

2. **Vulnerability Assessment:**
   - Severity level (Critical/High/Medium/Low)
   - Impact description
   - Remediation steps

3. **Evidence Collection:**
   - Screenshots of responses
   - Log file excerpts
   - Network traffic captures

## Step 6: Environment Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes if needed (caution: destroys data)
docker-compose down -v

# Clean up test artifacts
rm -rf security_test_results/
```

## Additional Testing Considerations

### Production Environment Testing

1. **Use separate test environment** - Never test against production
2. **Coordinate with team** - Ensure testing doesn't affect other work
3. **Monitor logs** - Watch for security alerts during testing
4. **Test timing** - Avoid peak usage times

### Extended Testing Scenarios

1. **Session Management:**
   - Test session timeout
   - Test concurrent sessions
   - Test session fixation

2. **Input Validation:**
   - XSS payloads in all inputs
   - Path traversal attempts
   - File upload security

3. **Business Logic:**
   - Race conditions
   - Transaction replay
   - Authorization bypass

## Reporting Template

Use this template for documenting findings:

```markdown
# Security Test Result

**Test:** JWT Algorithm Confusion
**Date:** YYYY-MM-DD
**Tester:** [Name]

## Request
[HTTP request details]

## Response
[HTTP response details]

## Assessment
- **Status:** PASS/FAIL
- **Severity:** Critical/High/Medium/Low
- **Impact:** [Description]

## Remediation
[Steps to fix the issue]
```

This comprehensive approach ensures thorough security testing of the Link application's runtime behavior, covering all major attack vectors and providing clear documentation for remediation efforts.
