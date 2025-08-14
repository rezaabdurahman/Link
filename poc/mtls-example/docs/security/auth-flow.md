# Authentication and Authorization Flow

## 1. JWT Issuance in User Service

- JWT tokens are issued in the User Service (`backend/user-svc/internal/auth/jwt_service.go`) when a user registers or logs in.
- The `JWTService.GenerateAccessToken` method creates a JWT Signed with HS256 and includes claims: UserID, Email, Username along with standard registered claims.
- Tokens have a TTL of 1 hour by default and are tagged for audience "link-app".
- Tokens are returned from the User Service's auth handler during login and registration (`internal/auth/handler.go`).
- Session tokens and refresh tokens are also managed, including HTTP-only cookies for sessions.

## 2. JWT Validation in API Gateway Middleware

- The API Gateway validates JWT tokens in the `AuthMiddleware` (`backend/api-gateway/internal/middleware/auth.go`).
- Tokens are extracted either from the `Authorization: Bearer <token>` header or from an HTTP cookie named `link_auth`.
- If a token is missing or invalid, the gateway returns `401 Unauthorized`.
- Valid tokens' claims are extracted to identify user context.

## 3. Gateway-Injected Identity Headers

The gateway injects the following identity headers into proxied backend service requests to propagate user identity:

| Header       | Description                   |
|--------------|-------------------------------|
| `X-User-ID`  | The user's UUID from the JWT  |
| `X-User-Email`| User's email from the JWT     |
| `X-User-Name`| User's username from the JWT  |

These headers enable downstream services to identify the authenticated user without re-validating the JWT.

## 4. Downstream Service Behavior

- Downstream services generally consume these identity HTTP headers for authorization and personalization.
- The services rely on the gateway to validate tokens; they do not usually re-validate JWT themselves.
- For example, the User Service and Chat Service consume these headers to identify requests.
- This design reduces computational overhead and centralizes authentication at the gateway.

## 5. Security Risks and Considerations

- **Header Spoofing:** Without cryptographic protection such as mTLS or signed headers, malicious clients could spoof identity headers when bypassing the API Gateway, leading to privilege escalation.
- **Lack of Token Re-validation:** Services trust the gateway to have performed authentication; if the gateway is compromised, identity claims can be spoofed to downstream services.
- **Mitigations:**
  - Use mutual TLS (mTLS) for service-to-service authentication to ensure requests originate from the trusted gateway.
  - Use signed headers or request signing to verify authenticity.
  - Deploy network policies and zero-trust networking to prevent direct access to services bypassing the gateway.

## 6. Summary

- The User Service is the sole issuer of JWT tokens.
- The API Gateway performs strict JWT validation and propagates identity to other services via HTTP headers.
- Downstream services trust the gateway for authentication and utilize the identity headers accordingly.
- While efficient, this approach requires secure network and transport controls to prevent header spoofing attacks.

## Related Security Implementation

A complete mutual TLS (mTLS) proof-of-concept implementation is available in the `poc/mtls-example/` directory, demonstrating how to secure service-to-service communication to prevent header spoofing attacks. This implementation includes:

- Certificate generation and management
- mTLS-enabled gateway and service components
- Docker Compose configuration for secure deployment
- Comprehensive testing and validation scripts
- Documentation for production deployment considerations

See `poc/mtls-example/README.md` for detailed implementation guidance.
