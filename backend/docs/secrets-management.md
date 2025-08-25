# Secrets Management Integration

This document explains how Link services handle secrets across different environments using a unified secrets management system.

## Overview

The Link project uses an environment-aware secrets management approach:

- **Local/Test**: Uses `.env` files and environment variables for simplicity
- **Development**: Can use either environment variables or Kubernetes secrets  
- **Staging/Production**: Uses AWS Secrets Manager via External Secrets Operator

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Local/Test    │    │   Development   │    │   Production    │
│                 │    │                 │    │                 │
│  .env files     │    │  K8s Secrets    │    │ AWS Secrets     │
│  Environment    │    │  Environment    │    │ Manager +       │
│  Variables      │    │  Variables      │    │ External        │
│                 │    │                 │    │ Secrets Op      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Secrets Client │
                    │  (Go Library)   │
                    │  Auto-detects   │
                    │  Environment    │
                    └─────────────────┘
```

## Environment Detection

The secrets client automatically detects the environment based on:

1. `ENVIRONMENT` variable (`local`, `development`, `staging`, `production`)
2. `KUBERNETES_SERVICE_HOST` presence (indicates K8s environment)
3. AWS credentials availability (indicates AWS environment)

## Implementation

### 1. Service Integration

Each service initializes secrets management at startup:

```go
// In main.go
func main() {
    // Initialize secrets management
    if err := config.InitSecrets(); err != nil {
        log.Printf("Warning: Failed to initialize secrets management: %v", err)
        log.Println("Continuing with environment variables...")
    }
    defer config.CloseSecrets()
    
    // ... rest of service initialization
}
```

### 2. Secret Retrieval

Services use environment-aware helper functions:

```go
// In config/secrets.go
func GetDatabasePassword() string {
    return GetSecret("DB_PASSWORD", "linkpass")
}

func GetJWTSecret() string {
    return GetSecret("JWT_SECRET", "dev-secret-key-change-in-production")
}

func GetSecret(key string, defaultValue string) string {
    environment := getEnv("ENVIRONMENT", "local")
    
    // Local/test: use environment variables
    if environment == "local" || environment == "test" {
        if value := os.Getenv(key); value != "" {
            return value
        }
        return defaultValue
    }
    
    // Production: use secrets manager
    if globalSecretsConfig != nil {
        if value, err := globalSecretsConfig.manager.GetSecret(key); err == nil && value != "" {
            return value
        }
    }
    
    // Fallback to environment variable
    if value := os.Getenv(key); value != "" {
        return value
    }
    
    return defaultValue
}
```

## Secret Configuration by Environment

### Local Development

**File**: `.env` in service directory or root

```bash
# Database
DB_PASSWORD=linkpass

# JWT
JWT_SECRET=dev-secret-key-change-in-production

# Redis
REDIS_PASSWORD=

# AWS KMS (for PII encryption)
AWS_KMS_KEY_ID=

# OpenAI
OPENAI_API_KEY=your_openai_key_here

# Sentry
SENTRY_DSN=your_sentry_dsn_here
```

**Benefits**:
- Simple developer setup
- No external dependencies
- Version controlled (in `.env.example`)
- Quick iteration

### Kubernetes Development

**File**: `k8s/dev-secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: link-secrets
  namespace: development
type: Opaque
data:
  DB_PASSWORD: bGlua3Bhc3M=  # base64 encoded
  JWT_SECRET: ZGV2LXNlY3JldC1rZXk=
  REDIS_PASSWORD: ""
  AWS_KMS_KEY_ID: ""
  OPENAI_API_KEY: eW91cl9vcGVuYWlfa2V5
  SENTRY_DSN: eW91cl9zZW50cnlfZHNu
```

**Benefits**:
- K8s-native secret management
- Environment isolation
- RBAC control
- Automatic mounting

### Production (AWS Secrets Manager)

**Secrets Structure in AWS**:

```
link-app/database
{
  "postgres_password": "prod-secure-password"
}

link-app/auth  
{
  "jwt_secret": "prod-jwt-secret-256-bit-key"
}

link-app/service-jwt
{
  "service_jwt_secret": "prod-service-jwt-secret-512-bit-key-separate-from-user-jwt"
}

link-app/encryption
{
  "kms_key_id": "arn:aws:kms:us-west-2:123456789012:key/uuid"
}

link-app/ai
{
  "openai_api_key": "sk-prod-openai-key"
}

link-app/monitoring
{
  "sentry_dsn": "https://prod-sentry-dsn@sentry.io/project"
}

link-app/service-auth/api-gateway
{
  "client_id": "api-gateway",
  "client_secret": "secure-generated-secret-for-api-gateway"
}

link-app/service-auth/user-svc
{
  "client_id": "user-svc",
  "client_secret": "secure-generated-secret-for-user-svc"
}

link-app/service-auth/chat-svc
{
  "client_id": "chat-svc",
  "client_secret": "secure-generated-secret-for-chat-svc"
}

link-app/service-auth/discovery-svc
{
  "client_id": "discovery-svc",
  "client_secret": "secure-generated-secret-for-discovery-svc"
}

link-app/service-auth/ai-svc
{
  "client_id": "ai-svc",
  "client_secret": "secure-generated-secret-for-ai-svc"
}

link-app/service-auth/search-svc
{
  "client_id": "search-svc",
  "client_secret": "secure-generated-secret-for-search-svc"
}
```

**External Secrets Configuration**:

Already configured in `k8s/helm/link-app/templates/external-secrets.yaml`:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: link-app-secret-store
    kind: SecretStore
  target:
    name: database-secrets
    creationPolicy: Owner
  data:
    - secretKey: POSTGRES_PASSWORD
      remoteRef:
        key: link-app/database
        property: postgres_password
```

## Security Features

### 1. Secret Rotation

- **AWS Secrets Manager**: Automatic rotation supported
- **Client-side caching**: 15-minute cache with automatic refresh
- **Graceful degradation**: Falls back to cached values during rotation

### 2. Access Control

- **AWS IAM**: Service accounts with minimal permissions
- **K8s RBAC**: Pod-level secret access control
- **Network policies**: Restrict secret access to authorized pods

### 3. Encryption

- **At rest**: AWS KMS encryption for secrets
- **In transit**: TLS 1.3 for all secret retrieval
- **In memory**: Secrets cleared from memory after use

### 4. Audit & Monitoring

- **AWS CloudTrail**: All secret access logged
- **Application logs**: Secret retrieval failures logged (not values)
- **Metrics**: Secret cache hit/miss rates

## Deployment Workflows

### Local Development

```bash
# Copy environment template
cp .env.example .env

# Edit with your local values
vim .env

# Start services (uses .env automatically)
docker-compose up -d
```

### Development/Staging Deploy

```bash
# Deploy with Helm (uses K8s secrets)
helm upgrade --install link-app ./k8s/helm/link-app \
  -f values-dev.yaml \
  --namespace development
```

### Production Deploy

```bash
# Deploy with production secrets from AWS
helm upgrade --install link-app ./k8s/helm/link-app \
  -f values-prod.yaml \
  --namespace production
```

## Troubleshooting

### Secret Not Found

**Error**: `secret not found: JWT_SECRET`

**Solutions**:
1. Check environment variable is set: `echo $ENVIRONMENT`
2. Verify secret exists in AWS: `aws secretsmanager get-secret-value --secret-id link-app/auth`
3. Check K8s secret: `kubectl get secret link-secrets -o yaml`
4. Verify service account permissions

### AWS Secrets Manager Access Denied

**Error**: `failed to get secret from AWS: AccessDenied`

**Solutions**:
1. Check IAM role has `secretsmanager:GetSecretValue` permission
2. Verify service account annotation: `eks.amazonaws.com/role-arn`
3. Check OIDC provider configuration
4. Validate AWS region configuration

### Secret Cache Issues  

**Error**: Stale secret values after rotation

**Solutions**:
1. Restart pods to clear cache: `kubectl rollout restart deployment/user-svc`
2. Check refresh interval: Default is 5 minutes
3. Force refresh: Set `SECRETS_CACHE_EXPIRATION=0` temporarily

### Local Development Issues

**Error**: Service fails to start with secrets

**Solutions**:
1. Check `.env` file exists and has correct format
2. Verify `ENVIRONMENT=local` is set
3. Check file permissions: `chmod 600 .env`
4. Validate no special characters in secret values

## Best Practices

### 1. Secret Naming

- Use consistent naming across environments
- Follow format: `SERVICE_COMPONENT_TYPE` (e.g., `DB_PASSWORD`)
- Use UPPER_CASE for environment variables

### 2. Default Values

- Always provide safe defaults for local development
- Use placeholder values that clearly indicate they need changing
- Never commit production secrets to version control

### 3. Secret Rotation

- Implement secret rotation for production
- Test rotation process in staging first
- Monitor applications during rotation

### 4. Access Control

- Follow principle of least privilege
- Use separate AWS accounts for different environments
- Regularly audit secret access permissions

### 5. Monitoring

- Monitor secret access failures
- Alert on unusual access patterns
- Track secret age and rotation status

## Migration Guide

### From Environment Variables

1. **Identify secrets**: List all environment variables containing sensitive data
2. **Create AWS secrets**: Upload to AWS Secrets Manager with proper structure
3. **Update Helm values**: Configure External Secrets mapping
4. **Deploy gradually**: Roll out environment by environment
5. **Remove old secrets**: Clean up environment variables after migration

### Testing Secret Integration

```bash
# Test local environment
ENVIRONMENT=local go run ./cmd/service/main.go

# Test with K8s secrets (requires K8s cluster)
ENVIRONMENT=development KUBERNETES_SERVICE_HOST=localhost go run ./cmd/service/main.go

# Test with AWS Secrets Manager (requires AWS credentials)
ENVIRONMENT=production AWS_REGION=us-west-2 go run ./cmd/service/main.go
```

## Related Documentation

- [AWS Secrets Manager Configuration](./aws-secrets-setup.md)
- [Kubernetes Secrets Best Practices](./k8s-secrets.md) 
- [External Secrets Operator Setup](./external-secrets.md)
- [Service Security Guidelines](./security.md)