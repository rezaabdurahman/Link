# RBAC Implementation for Link Backend (Updated IAM Architecture)

## Overview
This document outlines the Role-Based Access Control (RBAC) system for Link's three-tier authentication architecture. The system separates app users, company employees, and service accounts into distinct authentication domains.

## ⚠️ IMPORTANT: Three Separate Authentication Systems

This implementation follows Link's clean IAM architecture with **strict separation** between:

1. **App Users (B2C)**: Community members using the social app
2. **Company Employees (B2E)**: Team members managing infrastructure  
3. **Service Accounts (M2M)**: Microservices communicating internally

**CRITICAL**: These systems DO NOT overlap. App users cannot access infrastructure. Employees cannot use app credentials. Services are isolated to internal networks.

## 1. App User RBAC (Content-Focused)

### Database Schema
The app user RBAC system uses these tables in the `user-svc` database:

1. **`roles`** - App user roles only (user, premium_user, community_moderator, banned)
2. **`permissions`** - Content permissions (messages.moderate, users.read, etc.)
3. **`role_permissions`** - Junction table mapping roles to permissions
4. **`user_roles`** - Junction table mapping users to roles with metadata

### App User Roles (Cleaned Up ✅)
- **`user`**: Standard social app user with basic features
- **`premium_user`**: Paying subscriber with enhanced features
- **`community_moderator`**: Volunteer content moderator (NOT company employee)
- **`banned`**: User who violated community guidelines

### App User Permissions (Content-Only ✅)
- **User Management**: `users.read`, `users.update` (own profile only)
- **Messaging**: `messages.create`, `messages.read`
- **Discovery**: `discovery.search`, `discovery.advanced_filters`
- **Content Moderation**: `messages.moderate`, `messages.delete_any` (community moderators only)

### ❌ Removed Infrastructure Permissions
These permissions were **removed** from the app user system in migration 010:
- ❌ `admin.system` (system configuration - employee only)
- ❌ `admin.roles` (role management - employee only)
- ❌ `admin.analytics` (system analytics - employee only)
- ❌ `services.configure` (service configuration - employee only)

### App User Authentication Flow
```go
// Generate JWT for app users
jwtService := auth.NewJWTService(userJWTConfig) // Separate config from service JWT
roles := user.GetRoleNames()           // ["community_moderator", "user"]
permissions := user.GetContentPermissions() // ["users.read", "messages.moderate"]

token, err := jwtService.GenerateAccessToken(
    user.ID, 
    user.Email, 
    user.Username,
    roles,
    permissions,
)
```

### App User Route Protection
```go
// Community moderation endpoints (NOT system admin)
router.POST("/moderate/messages/:id", 
    authMiddleware,
    RequireRole("community_moderator"),
    messageHandler.ModerateMessage,
)

// No infrastructure access for any app user
// These endpoints should NOT exist for app users:
// ❌ router.GET("/admin/system/config", ...)
// ❌ router.POST("/admin/deploy", ...)
```

## 2. Employee Access (Infrastructure-Focused)

### AWS IAM Integration
Employees access infrastructure through AWS IAM, **NOT** the app user database.

### Employee Roles
- **`link-developer`**: Read-only production access, full staging access
- **`link-devops`**: Full infrastructure access, emergency production access
- **`link-support`**: Read-only user logs, no infrastructure access

### Employee Authentication
```bash
# Employee login via AWS SSO
aws sso login --profile link-dev

# Access Kubernetes cluster
aws eks update-kubeconfig --region us-west-2 --name link-cluster
kubectl auth can-i get pods --namespace=link-services
```

### Employee Permissions (AWS IAM Policies)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "logs:GetLogEvents", 
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

## 3. Service Account RBAC (API-Focused)

### Service Account Table
```sql
CREATE TABLE service_accounts (
    id UUID PRIMARY KEY,
    client_id VARCHAR NOT NULL UNIQUE,
    client_secret_hash VARCHAR NOT NULL,
    service_name VARCHAR NOT NULL,
    permissions TEXT[] -- API-specific permissions
);
```

### Service Roles
- **`api-gateway`**: Route requests, validate tokens
- **`user-svc`**: User management, authentication
- **`chat-svc`**: Messaging, notifications
- **`discovery-svc`**: User discovery, matching

### Service Authentication
```go
// Service-to-service authentication (separate JWT secret)
serviceJWTConfig := config.ServiceJWTConfig{
    Secret: os.Getenv("SERVICE_JWT_SECRET"), // Different from user JWT secret
    Issuer: "link-service-auth",
    Audience: "link-internal-services",
}

token, err := serviceJWTService.GenerateServiceToken(
    serviceID,
    serviceName,
    servicePermissions,
)
```

## Migration 010: IAM Cleanup ✅

### What Was Changed
```sql
-- 1. Renamed misleading admin role
UPDATE roles 
SET name = 'community_moderator', 
    description = 'Community volunteer who can moderate user content'
WHERE name = 'admin';

-- 2. Removed employee/infrastructure permissions
DELETE FROM permissions WHERE name IN (
    'admin.system',          -- System configuration
    'admin.roles',           -- Role management  
    'admin.analytics',       -- System analytics
    'services.configure',    -- Service configuration
    'services.deploy',       -- Deployment
    'services.health_check', -- Internal monitoring
    'services.metrics'       -- Internal metrics
);

-- 3. Added banned role for community guidelines violations
INSERT INTO roles (name, description, is_system) VALUES 
    ('banned', 'Banned user with no access to app features', true);
```

### Code Updates ✅
Updated all references in:
- `backend/api-gateway/internal/middleware/rbac.go`
- `backend/api-gateway/internal/middleware/auth.go`
- `backend/api-gateway/internal/middleware/*_test.go`

Functions renamed:
- ❌ `IsAdmin()` → ✅ `IsCommunityModerator()`
- ❌ `RequireAdmin()` → ✅ `RequireCommunityModerator()`

## Security Boundaries

### Strict Separation ✅
```go
// App User JWT (Content Access)
{
  "sub": "user-123",
  "roles": ["community_moderator"],
  "permissions": ["messages.moderate", "users.read"],
  "iss": "link-user-service",
  "aud": "link-mobile-app"
}

// Service JWT (Internal API Access) 
{
  "sub": "api-gateway",
  "permissions": ["users.validate", "services.route"],
  "iss": "link-service-auth", 
  "aud": "link-internal-services"
}

// Employee Access (AWS IAM - No JWT)
# Uses AWS STS tokens with IAM policies
# No presence in app database
```

### Token Isolation
- **User JWT Secret**: For app user authentication
- **Service JWT Secret**: For service-to-service communication (different secret)
- **Employee Access**: AWS IAM/STS tokens (no custom JWT)

## Updated Usage Examples

### 1. App User Route Protection (Content Only)
```go
// Community moderation (content-focused)
router.DELETE("/messages/:id",
    authMiddleware, 
    RequireRole("community_moderator"),
    messageHandler.DeleteInappropriateMessage,
)

// Premium features
router.GET("/discovery/advanced",
    authMiddleware,
    RequireRole("premium_user"),
    discoveryHandler.AdvancedSearch,
)

// ❌ REMOVED: No infrastructure endpoints for app users
// router.GET("/admin/system/logs", ...) // This should NOT exist
```

### 2. Employee Infrastructure Access
```bash
# Developers: Read-only production access
kubectl get pods -n link-services
aws logs tail /aws/link/api-gateway --follow

# DevOps: Full infrastructure access
kubectl scale deployment api-gateway --replicas=3
aws rds modify-db-instance --db-instance-identifier link-prod --allocated-storage 200
```

### 3. Service Communication
```go
// Service validates its own JWT
func validateServiceToken(token string) (*ServiceClaims, error) {
    claims := &ServiceClaims{}
    _, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
        return []byte(serviceJWTSecret), nil // Different secret
    })
    return claims, err
}
```

## Rate Limiting by User Type

### App Users (Content-Based)
```go
rateLimits := map[string]int{
    "community_moderator": 1000,  // Higher limit for moderation work
    "premium_user":        200,   // Enhanced limits for subscribers
    "user":               100,   // Standard rate limit
    "banned":               0,   // No access
}
```

### Employees (Infrastructure)
```yaml
# AWS API rate limits managed by IAM policies
# Kubernetes rate limiting via admission controllers
```

### Services (Internal)
```go
// No external rate limiting - internal service mesh only
// Rate limiting handled by service mesh (Linkerd, Istio)
```

## Testing Updated Architecture

### App User Tests ✅
```bash
# Test community moderator permissions
cd backend/api-gateway && go test ./internal/middleware -run TestRequireCommunityModerator

# Test that app users cannot access infrastructure
# (These tests should fail/return 403)
curl -H "Authorization: Bearer $APP_USER_TOKEN" \
     http://api.link.com/admin/system/status
# Expected: 403 Forbidden or 404 Not Found
```

### Employee Access Tests
```bash
# Test AWS IAM integration
aws sts get-caller-identity
kubectl auth can-i get pods --namespace=link-services

# Test that employees cannot use app credentials
# (App user tokens should not work for infrastructure)
```

### Service Authentication Tests ✅
```bash
# Test service-to-service auth
curl -X POST http://user-svc:8081/api/v1/auth/service-token \
  -H "Content-Type: application/json" \
  -d '{"grant_type": "client_credentials", "client_id": "api-gateway"}'
```

## Database Migration Status

### Applied Migrations ✅
- `007_rbac_system.up.sql` - Original RBAC system
- `008_permission_audit_log.up.sql` - Audit logging
- `009_service_accounts.up.sql` - Service authentication
- `010_cleanup_user_roles.up.sql` - **NEW**: IAM cleanup

### Migration Commands
```bash
# Apply the cleanup migration
cd backend/user-svc
make migrate-up

# Verify changes
psql -d link_users -c "SELECT name, description FROM roles;"
# Should show: user, premium_user, community_moderator, banned
```

## Files Updated in IAM Cleanup

### Database
- ✅ `backend/user-svc/migrations/010_cleanup_user_roles.up.sql`
- ✅ `backend/user-svc/migrations/010_cleanup_user_roles.down.sql`

### Code Updates
- ✅ `backend/api-gateway/internal/middleware/rbac.go`
- ✅ `backend/api-gateway/internal/middleware/auth.go`
- ✅ `backend/api-gateway/internal/middleware/rbac_test.go`
- ✅ `backend/api-gateway/internal/middleware/auth_test.go`

### Documentation
- ✅ `docs/IAM_ARCHITECTURE.md` - Complete architecture overview
- ✅ `infrastructure/employee-access/README.md` - Employee access guide
- ✅ `k8s/access/rbac.yaml` - Updated Kubernetes RBAC

## Security Compliance

### Industry Standards ✅
- **SOC 2**: Proper access controls and audit trails
- **ISO 27001**: Information security management  
- **OWASP**: Protection against privilege escalation
- **Zero Trust**: No implicit trust between systems

### Audit Trail
- **App Users**: Application logs in user-svc database
- **Employees**: AWS CloudTrail for all infrastructure access
- **Services**: Application logs for inter-service communication

## Next Steps

1. **✅ Migration Applied**: Run migration 010 to clean up roles
2. **✅ Code Updated**: Update all admin references to community_moderator
3. **⏳ AWS IAM Setup**: Create employee IAM roles and SSO
4. **⏳ Testing**: Verify all three authentication systems work independently
5. **⏳ Documentation**: Update team training materials

## Emergency Procedures

### Break-Glass Access
```bash
# Emergency cluster access (DevOps only)
aws sts assume-role --role-arn arn:aws:iam::ACCOUNT:role/link-emergency-access
kubectl get pods -n link-services
```

### Incident Response
1. **Community Issues**: Use community_moderator role in app
2. **Infrastructure Issues**: Use employee AWS IAM access
3. **Service Issues**: Check service account credentials

## Summary

The Link RBAC system now implements proper separation between:
- **App users** with content-focused permissions
- **Employees** with infrastructure access via AWS IAM
- **Services** with API-focused internal communication

This architecture prevents privilege escalation, ensures proper audit trails, and follows industry security best practices.

**Key Achievement**: App users can no longer access infrastructure, and employees no longer need to use app user accounts for system management.