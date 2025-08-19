# Security Testing Attack Scenarios - HTTP Transcripts

This document contains example HTTP transcripts for each attack scenario that would be tested in the runtime security assessment.

## 1. User Registration and Authentication

### 1.1 User Registration Request

```http
POST /api/auth/register HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Accept: application/json

{
  "email": "testuser@security.test",
  "password": "SecurePassword123!",
  "username": "securitytester",
  "firstName": "Security",
  "lastName": "Tester",
  "dateOfBirth": "1990-01-01"
}
```

**Expected Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict

{
  "message": "User created successfully",
  "userId": "user_12345"
}
```

### 1.2 User Login Request

```http
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Accept: application/json

{
  "email": "testuser@security.test",
  "password": "SecurePassword123!"
}
```

**Expected Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1IiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE2NDA5OTg4MDB9.signature",
  "user": {
    "id": "user_12345",
    "email": "testuser@security.test",
    "username": "securitytester"
  }
}
```

## 2. JWT Token Manipulation Attacks

### 2.1 Token Replay Attack

```http
GET /api/user/profile HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1IiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE2NDA5OTg4MDB9.signature
Accept: application/json
```

**Expected Secure Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "user_12345",
  "email": "testuser@security.test",
  "username": "securitytester"
}
```

**Vulnerability Indicators:**
- ❌ Token accepted after logout
- ❌ Token works from different IP/device without validation

### 2.2 Algorithm Confusion Attack (alg: none)

```http
GET /api/user/profile HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OSwicm9sZSI6ImFkbWluIiwidXNlcl9pZCI6IjEifQ.
Accept: application/json
```

**Token Breakdown:**
- Header: `{"alg":"none","typ":"JWT"}`
- Payload: `{"sub":"admin","exp":9999999999,"role":"admin","user_id":"1"}`
- Signature: (empty)

**Expected Secure Response:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid token algorithm",
  "message": "Algorithm 'none' is not allowed"
}
```

**Vulnerability Indicators:**
- ❌ HTTP 200 response (token accepted)
- ❌ Admin access granted

### 2.3 Token Expiration Tampering

```http
GET /api/user/profile HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1IiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjk5OTk5OTk5OTl9.invalid_signature
Accept: application/json
```

**Expected Secure Response:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid token signature",
  "message": "Token has been tampered with"
}
```

## 3. Header Spoofing Attacks

### 3.1 X-User-ID Header Spoofing

```http
GET /api/user/profile HTTP/1.1
Host: localhost:8080
X-User-ID: admin
X-Real-User-ID: 999
X-Forwarded-User: administrator
Accept: application/json
```

**Expected Secure Response:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Authentication required",
  "message": "Valid JWT token required"
}
```

**Vulnerability Indicators:**
- ❌ HTTP 200 response without JWT token
- ❌ Admin data returned based on headers alone

### 3.2 X-Forwarded-For Spoofing

```http
GET /api/health HTTP/1.1
Host: localhost:8080
X-Forwarded-For: 127.0.0.1, 10.0.0.1
X-Real-IP: 192.168.1.100
X-Originating-IP: 8.8.8.8
Accept: application/json
```

**Analysis Points:**
- Check if rate limiting can be bypassed by IP spoofing
- Verify if geolocation restrictions are enforced properly
- Ensure audit logs capture actual client IP

### 3.3 Role/Permission Header Spoofing

```http
GET /api/admin/users HTTP/1.1
Host: localhost:8080
X-User-Role: admin
X-User-Permissions: all
X-Admin: true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1In0.signature
Accept: application/json
```

**Expected Secure Response:**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Insufficient permissions",
  "message": "Admin access required"
}
```

## 4. CORS Validation Tests

### 4.1 CORS Preflight with Malicious Origin

```http
OPTIONS /api/auth/login HTTP/1.1
Host: localhost:8080
Origin: https://malicious-site.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

**Expected Secure Response:**
```http
HTTP/1.1 403 Forbidden
Access-Control-Allow-Origin: (not present)

{
  "error": "CORS policy violation"
}
```

**Vulnerability Indicators:**
- ❌ `Access-Control-Allow-Origin: *`
- ❌ `Access-Control-Allow-Origin: https://malicious-site.com`

### 4.2 Wildcard Origin Check

```http
GET /api/health HTTP/1.1
Host: localhost:8080
Origin: https://evil.com
Accept: application/json
```

**Expected Secure Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
(No CORS headers for disallowed origin)

{
  "status": "healthy"
}
```

**Vulnerability Indicators:**
- ❌ `Access-Control-Allow-Origin: *` in production
- ❌ CORS headers present for untrusted origins

### 4.3 Null Origin Test

```http
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Origin: null
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password"
}
```

**Expected Secure Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
(No Access-Control-Allow-Origin header)

{
  "error": "Invalid credentials"
}
```

### 4.4 Subdomain Origin Tests

```http
GET /api/health HTTP/1.1
Host: localhost:8080
Origin: https://attacker.link-app.com.evil.com
Accept: application/json
```

**Analysis:**
- Test various subdomain patterns
- Check for subdomain validation bypass
- Verify proper origin parsing

## 5. Rate Limiting Tests

### 5.1 Rapid Login Attempts

```bash
# 20 rapid requests to test rate limiting
for i in {1..20}; do
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    "http://localhost:8080/api/auth/login"
done
```

**Expected Pattern:**
```
Requests 1-5: HTTP 401 (Invalid credentials)
Requests 6-20: HTTP 429 (Too Many Requests)
```

**Vulnerability Indicators:**
- ❌ All requests return HTTP 401 (no rate limiting)
- ❌ Rate limiting not implemented

## 6. SQL Injection Tests

### 6.1 Header-based SQL Injection

```http
GET /api/user/profile HTTP/1.1
Host: localhost:8080
X-User-ID: '; DROP TABLE users; --
Accept: application/json
```

```http
GET /api/user/profile HTTP/1.1
Host: localhost:8080
X-User-ID: ' OR '1'='1
Accept: application/json
```

**Expected Secure Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid header format"
}
```

## Security Assessment Criteria

### ✅ Secure Implementation Indicators

1. **JWT Security:**
   - Proper signature validation
   - Algorithm whitelist (no "none" allowed)
   - Expiration enforcement
   - Token blacklist on logout

2. **Header Security:**
   - Authentication via JWT only
   - No trust in client headers for auth
   - Proper input validation

3. **CORS Security:**
   - Explicit origin whitelist
   - No wildcard in production
   - Proper preflight handling

4. **Rate Limiting:**
   - Progressive backoff
   - IP-based limiting
   - Different limits per endpoint

### ❌ Vulnerability Indicators

1. **Critical Vulnerabilities:**
   - Authentication bypass via headers
   - JWT algorithm confusion accepted
   - CORS wildcard in production
   - No rate limiting

2. **High Risk:**
   - Token replay after logout
   - SQL injection via headers
   - Excessive CORS permissions

3. **Medium Risk:**
   - Information disclosure
   - Weak rate limiting
   - Missing security headers

## Test Environment Cleanup

After testing, ensure to:
1. Stop docker-compose services: `docker-compose down`
2. Clean up test databases
3. Remove test user accounts
4. Clear any cached tokens
5. Review logs for test artifacts

## Reporting

All test results should include:
- Full HTTP request/response transcripts
- Vulnerability severity assessment
- Remediation recommendations
- Compliance with security standards (OWASP, etc.)
