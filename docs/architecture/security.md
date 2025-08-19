# Link App - Architecture & Data-Flow Security Diagram

## Overview
This sequence diagram illustrates the authentication flow and trust boundaries in the Link App architecture, highlighting security gaps where additional authentication mechanisms (mTLS, service tokens) are absent.

## Trust Zones
- **🌐 Public Internet**: Browser clients (untrusted)
- **🛡️ DMZ**: API Gateway (first line of defense)
- **🔒 Internal Services**: User-svc, Chat-svc, Location-svc (trusted internal network)
- **🗄️ Data Layer**: PostgreSQL, Redis (most trusted, internal only)

## Security Sequence Diagram

```mermaid
sequenceDiagram
    participant B as Browser<br/>🌐 Public Internet
    participant G as API Gateway<br/>🛡️ DMZ
    participant U as User Service<br/>🔒 Internal
    participant P as PostgreSQL<br/>🗄️ Data Layer
    participant R as Redis<br/>🗄️ Data Layer
    
    Note over B,R: ❗️ TRUST BOUNDARY: Public → DMZ
    B->>+G: POST /auth/login<br/>{"email":"user@example.com", "password":"****"}
    Note right of B: Headers: Content-Type, Origin<br/>Credentials: include
    
    Note over G,U: ⚠️ SECURITY GAP: No mTLS/Service Token
    G->>+U: POST /api/v1/login<br/>Forward request body
    Note right of G: Headers: X-User-ID (absent), Content-Type<br/>⚠️ Plain HTTP communication
    
    Note over U,P: ❗️ TRUST BOUNDARY: Service → Database
    U->>+P: SELECT * FROM users WHERE email = $1
    Note right of U: Connection: PostgreSQL protocol<br/>✅ Connection pooling, SSL optional
    P-->>-U: User record with hashed password
    
    U->>U: bcrypt.CompareHashAndPassword()<br/>JWT Generation (HS256)
    Note right of U: JWT Claims: {user_id, email, username}<br/>Secret: Shared between Gateway & User-svc
    
    Note over U,R: ❗️ TRUST BOUNDARY: Service → Cache
    U->>+R: SET session:{jwt_id} {user_data} EX 3600
    Note right of U: ⚠️ Session data stored in plaintext<br/>TTL: 1 hour
    R-->>-U: OK
    
    U-->>-G: 200 OK<br/>{"user": {...}, "token": "eyJ...", "expires_at": "..."}
    Note left of U: ⚠️ JWT in response body<br/>No secure headers validation
    
    Note over B,G: ❗️ TRUST BOUNDARY: DMZ → Public
    G->>G: Set-Cookie: link_auth=eyJ...<br/>HttpOnly; Secure; SameSite=Lax
    G-->>-B: 200 OK + Set-Cookie<br/>{"user": {...}, "message": "Login successful"}
    Note left of G: ✅ Secure cookie attributes<br/>⚠️ JWT also in response body
    
    Note over B,R: === Subsequent Authenticated Request ===
    
    B->>+G: GET /users/profile
    Note right of B: Cookie: link_auth=eyJ...<br/>Headers: Authorization (optional)
    
    G->>G: Extract JWT from cookie/header<br/>Validate signature & expiry
    Note right of G: ✅ JWT validation using shared secret<br/>Claims extraction: user_id, email
    
    Note over G,U: ⚠️ SECURITY GAP: No mTLS/Service Token
    G->>+U: GET /api/v1/profile
    Note right of G: Headers: X-User-ID, X-User-Email, X-User-Name<br/>⚠️ Trusted headers without verification
    
    U->>U: Extract user context from headers<br/>(No validation of header authenticity)
    Note right of U: ⚠️ CRITICAL: Headers trusted blindly<br/>Potential for header injection attacks
    
    Note over U,P: Service → Database Query
    U->>+P: SELECT * FROM users WHERE id = $1
    P-->>-U: User profile data
    
    U-->>-G: 200 OK<br/>{"id": "...", "username": "...", ...}
    G-->>-B: 200 OK<br/>User profile response
```

## Security Analysis & Risk Assessment

### ✅ **Secure Elements**
1. **JWT Authentication**: Proper HMAC-SHA256 signing with shared secret
2. **Secure Cookies**: HttpOnly, Secure, SameSite attributes configured
3. **Password Hashing**: bcrypt implementation for password storage
4. **CORS Configuration**: Proper origin validation and credential handling
5. **Connection Pooling**: Database connections properly managed

### ⚠️ **Security Gaps & Missing Authentication**

#### **1. Service-to-Service Communication**
```
❌ MISSING: mTLS between Gateway ↔ Services
❌ MISSING: Service authentication tokens
❌ MISSING: Request signing/HMAC validation
```

**Risk**: Internal services trust all requests from Gateway without verification
**Attack Vector**: Compromised gateway can impersonate any user to internal services

#### **2. Header Injection Vulnerability**
```
⚠️ CRITICAL: User context headers (X-User-ID, X-User-Email) trusted without validation
⚠️ RISK: Direct header manipulation bypasses authentication
```

**Risk**: Malicious requests can spoof user identity via header manipulation
**Attack Vector**: `curl -H "X-User-ID: victim-uuid" http://internal-service/api`

#### **3. Database Security**
```
❌ MISSING: SSL/TLS enforcement for PostgreSQL connections
❌ MISSING: Database connection encryption
⚠️ OPTIONAL: Redis AUTH password not configured
```

**Risk**: Potential for database communication interception
**Attack Vector**: Network sniffing of database traffic

#### **4. Session Management**
```
⚠️ ISSUE: Redis sessions stored in plaintext
❌ MISSING: Session encryption at rest
❌ MISSING: Session invalidation on security events
```

### 🔒 **Recommended Security Improvements**

#### **Immediate Priority (High Risk)**

1. **Service Authentication**
   ```go
   // Add service-to-service token validation
   func ServiceAuthMiddleware() gin.HandlerFunc {
       return func(c *gin.Context) {
           serviceToken := c.GetHeader("X-Service-Token")
           if !validateServiceToken(serviceToken) {
               c.AbortWithStatus(401)
               return
           }
       }
   }
   ```

2. **Header Validation**
   ```go
   // Validate user headers against JWT claims
   func ValidateUserHeaders(claims *Claims, headers UserHeaders) error {
       if claims.UserID.String() != headers.UserID {
           return errors.New("header mismatch")
       }
       return nil
   }
   ```

#### **Medium Priority**

3. **Database Security**
   ```yaml
   # docker-compose.yml
   services:
     postgres:
       environment:
         POSTGRES_SSL_MODE: require
   ```

4. **Session Encryption**
   ```go
   // Encrypt session data before Redis storage
   encryptedSession := encrypt(sessionData, sessionKey)
   redis.Set(sessionID, encryptedSession)
   ```

#### **Long Term (Defense in Depth)**

5. **mTLS Implementation**
6. **Request Signing (HMAC)**
7. **Zero-Trust Network Architecture**
8. **Service Mesh (Istio/Linkerd)**

## Trust Boundary Analysis

### **Border 1: Public → DMZ (Browser → Gateway)**
- ✅ **Protected by**: JWT validation, CORS, Rate limiting
- ✅ **Authentication**: Bearer tokens + secure cookies
- ✅ **Transport**: HTTPS enforced

### **Border 2: DMZ → Internal (Gateway → Services)**  
- ❌ **Missing Protection**: No mutual authentication
- ❌ **Missing Transport Security**: Plain HTTP communication
- ⚠️ **Weak Authentication**: Trusted headers without validation

### **Border 3: Internal → Data (Services → DB/Cache)**
- ⚠️ **Partial Protection**: Connection pooling, credential-based auth
- ❌ **Missing Encryption**: Optional SSL for PostgreSQL
- ⚠️ **Redis**: No authentication configured

## Conclusion

The current architecture provides **strong perimeter security** at the browser-to-gateway boundary but has **significant security gaps** in service-to-service communication. The most critical vulnerability is the **trusted header injection** between Gateway and internal services, which could allow complete authentication bypass if the gateway is compromised.

**Priority Actions**:
1. Implement service-to-service authentication tokens
2. Add header validation against JWT claims  
3. Enable database connection encryption
4. Consider mTLS for internal communication

