# Secrets Management Guide

## Overview

The Link platform uses a comprehensive, environment-aware secrets management system that follows security best practices and industry standards.

## Architecture

```
Development: Hardcoded defaults → Services
Production: GitHub Secrets → AWS Secrets Manager → External Secrets Operator → Kubernetes Secrets → Services
```

## Secrets Categories

### 1. Application Secrets
**Location**: AWS Secrets Manager: `link-app/application`
**Kubernetes Secret**: `application-secrets`

- `JWT_SECRET` - Application-wide JWT signing key (64 chars)
- `DATA_ENCRYPTION_KEY` - Field-level encryption key (32 chars) 
- `SERVICE_AUTH_TOKEN` - Service-to-service authentication (32 chars)

### 2. Database Secrets
**Location**: AWS Secrets Manager: `link-app/database/postgres`
**Kubernetes Secret**: `postgres-service-passwords`, `postgres-admin-passwords`

- Per-service database passwords
- Admin credentials
- Replication passwords

### 3. API Keys
**Location**: AWS Secrets Manager: `link-app/api-keys`
**Kubernetes Secret**: `api-keys`

- `OPENAI_API_KEY` - OpenAI integration
- `QDRANT_API_KEY` - Vector database (optional)

## Environment Behavior

### Development (`ENVIRONMENT=local`)
- Uses hardcoded fallbacks from `backend/shared-libs/config/secrets.go`
- No external secrets required
- Developers can start immediately: `make dev-start`

**Example fallbacks**:
```go
JWT_SECRET: "dev-secret-key-change-in-production" 
DATA_ENCRYPTION_KEY: "dev-encryption-key-change-in-production"
DB_PASSWORD: "linkpass"
```

### Staging/Production
- Pulls from AWS Secrets Manager
- External Secrets Operator syncs to Kubernetes
- Automatic secret rotation enabled

## Setup Instructions

### 1. Initial Setup

#### Generate Secrets
```bash
# Generate all secrets for GitHub/AWS
./scripts/generate-secrets.sh

# Add DATA_ENCRYPTION_KEY to GitHub Secrets:
# Value: q7JfCEj/un6YZLJTeAIVrf5GkvSmg1kO83Q8sfSYqX8=
```

#### Deploy Secrets to AWS
```bash
# Via GitHub Actions workflow
GitHub → Actions → "Setup Production Secrets"

# Or run directly
./scripts/setup-application-secrets.sh production
./scripts/setup-api-keys-secrets.sh production  
./scripts/setup-database-secrets.sh production
```

#### Deploy Kubernetes Integration
```bash
# Deploy External Secrets configuration
kubectl apply -f k8s/secrets/link-secret-store.yaml
kubectl apply -f k8s/secrets/application-external-secrets.yaml
kubectl apply -f k8s/secrets/database-external-secrets.yaml

# Deploy services (will automatically get secrets)
helm upgrade --install link-app k8s/helm/link-app/
```

### 2. Development Setup

```bash
# Clone and start - just works!
git clone <repo>
make dev-setup
make dev-start
```

## Secret Rotation

### Automatic Rotation
- **Schedule**: Monthly on the 1st at 2 AM UTC
- **Workflow**: `.github/workflows/rotate-service-credentials.yml`
- **Scope**: All secrets (application + database)

### Manual Rotation
```bash
# Rotate specific secret type
./scripts/rotate-application-secrets.sh production --force

# Via GitHub Actions
GitHub → Actions → "Rotate Service Credentials"
Environment: production
Service: application-secrets
Force: true
```

### Rotation Features
- **Backup**: Automatic backup before rotation
- **Zero-downtime**: Rolling restart of services
- **Verification**: Health checks after rotation
- **Cleanup**: Keeps last 5 backups, removes older ones

## Security Features

### Encryption at Rest
- **AWS Secrets Manager**: Encrypted with AWS KMS
- **Kubernetes Secrets**: Base64 encoded (etcd encryption recommended)
- **Database**: Field-level encryption using `DATA_ENCRYPTION_KEY`

### Access Control
- **AWS**: IAM roles with least privilege
- **Kubernetes**: RBAC with service accounts
- **External Secrets**: IRSA (IAM Role for Service Account)

### Audit Trail
- **AWS CloudTrail**: All secret access logged
- **GitHub**: Workflow execution history
- **Kubernetes**: Event logs for secret updates

## Troubleshooting

### Common Issues

#### 1. External Secrets Not Syncing
```bash
# Check External Secrets Operator
kubectl get externalsecrets -n link-services
kubectl describe externalsecret application-secrets -n link-services

# Check SecretStore
kubectl get secretstore -n link-services
kubectl describe secretstore link-secret-store -n link-services
```

#### 2. Service Can't Access Secrets
```bash
# Check if secret exists
kubectl get secret application-secrets -n link-services

# Check service environment variables
kubectl exec deployment/user-svc -n link-services -- env | grep SECRET
```

#### 3. Rotation Failed
```bash
# Check rotation backup
aws secretsmanager list-secrets --filters '[{"Key":"tag-key","Values":["SecretType"]},{"Key":"tag-value","Values":["backup"]}]'

# Manual rollback if needed
aws secretsmanager restore-secret --secret-id link-app/application
```

### Monitoring

#### Key Metrics to Watch
- Secret age (should rotate monthly)
- External Secrets sync errors
- Service authentication failures
- Pod restart frequency after rotation

#### Alerts
- Secret rotation failures → PagerDuty
- External Secrets sync errors → Slack
- Authentication spikes → Grafana dashboard

## Best Practices

### ✅ Do
- Use the provided scripts for secret management
- Rotate secrets regularly (monthly minimum)
- Monitor secret age and usage
- Keep development defaults obvious (e.g., "INSECURE_DEV_KEY")
- Use External Secrets Operator for K8s integration

### ❌ Don't  
- Store secrets in GitHub (except for CI/CD flow)
- Commit `.env` files with real secrets
- Skip secret rotation
- Hardcode production secrets
- Share secrets via chat/email

## Migration Guide

### From Hardcoded to AWS Secrets Manager

1. **Audit current secrets**:
   ```bash
   grep -r "secret\|password\|key" backend/ --include="*.go"
   ```

2. **Add to AWS via script**:
   ```bash
   ./scripts/setup-application-secrets.sh production
   ```

3. **Update service code**:
   ```go
   // Before
   secret := "hardcoded-value"
   
   // After  
   secret := config.GetDataEncryptionKey()
   ```

4. **Deploy External Secrets**:
   ```bash
   kubectl apply -f k8s/secrets/application-external-secrets.yaml
   ```

5. **Verify and test**:
   ```bash
   kubectl get secrets -n link-services
   # Test application functionality
   ```

## Support

### Emergency Contacts
- **Platform Team**: #platform-team Slack
- **Security Team**: #security Slack  
- **On-call**: PagerDuty escalation

### Documentation
- AWS Secrets Manager: `docs/aws/secrets-manager.md`
- External Secrets Operator: `docs/kubernetes/external-secrets.md`
- Troubleshooting: `docs/troubleshooting/secrets.md`