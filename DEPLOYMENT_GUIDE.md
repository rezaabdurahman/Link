# Link Application Deployment Guide

This guide covers deployment strategies for different environments using best practices for microservices architecture.

## 🏗️ Architecture Overview

### Environment Strategy
- **Local Development**: Docker Compose + LocalStack
- **Development/Staging**: Kubernetes + Helm Charts  
- **Production**: Kubernetes + Helm Charts + External Secrets

### Secret Management Strategy
- **Local**: `.env.local` files + LocalStack
- **Dev/Staging**: Kubernetes secrets + AWS Secrets Manager (dev keys)
- **Production**: External Secrets Operator + AWS Secrets Manager

## 🚀 Local Development (Best Practice)

### Quick Start
```bash
# 1. Initial setup (one-time)
cd backend
./scripts/dev-workflow.sh setup

# 2. Start all services
./scripts/dev-workflow.sh start

# 3. Start individual service
./scripts/dev-workflow.sh start user-svc
```

### Service-Specific Development
```bash
# Work on user-svc only
cd user-svc
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after changes
./scripts/dev-workflow.sh rebuild user-svc
```

### Environment Files Structure
```
backend/
├── .env                          # Shared infrastructure (dev)
├── .env.production               # Shared infrastructure (prod)
├── user-svc/
│   ├── .env.local               # Local development
│   ├── .env.development         # Staging deployment
│   └── .env.production          # Production deployment
├── api-gateway/
│   ├── .env.local
│   ├── .env.development  
│   └── .env.production
└── [other-services]/...
```

## ☸️ Kubernetes Deployment (Production)

### Prerequisites
```bash
# Install required tools
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add external-secrets https://charts.external-secrets.io

# Install External Secrets Operator
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

### AWS Secrets Manager Setup
```bash
# Create production secrets
aws secretsmanager create-secret --name "link-app/database" \
  --description "Link App Database Credentials" \
  --secret-string '{"postgres_password":"STRONG_PRODUCTION_PASSWORD"}'

aws secretsmanager create-secret --name "link-app/auth" \
  --description "Link App Authentication" \
  --secret-string '{"jwt_secret":"STRONG_JWT_SECRET_64_CHARS_MINIMUM"}'

aws secretsmanager create-secret --name "link-app/encryption" \
  --description "Link App Encryption" \
  --secret-string '{"kms_key_id":"arn:aws:kms:us-west-2:ACCOUNT:key/KEY-ID"}'
```

### Deployment Commands
```bash
cd k8s/helm/link-app

# Development deployment
helm install link-app-dev . -f values-dev.yaml -n link-dev --create-namespace

# Staging deployment  
helm install link-app-staging . -f values.yaml -n link-staging --create-namespace

# Production deployment
helm install link-app-prod . -f values-prod.yaml -n link-production --create-namespace
```

### Update Deployment
```bash
# Update with new image tags
helm upgrade link-app-prod . -f values-prod.yaml \
  --set services.userSvc.image.tag=v1.2.0 \
  --set services.apiGateway.image.tag=v1.2.0 \
  -n link-production
```

## 🔒 Security Configuration

### Development
- LocalStack KMS (no real AWS needed)
- Weak passwords for local development
- Debug endpoints enabled

### Staging  
- Real AWS KMS with development keys
- Moderate security settings
- Debug endpoints enabled
- Reduced resource limits

### Production
- Production AWS KMS keys
- Strong security settings
- Debug endpoints disabled
- Full resource allocation
- Network policies enabled
- Pod security policies

## 🔐 Secret Management Examples

### Local (.env.local)
```bash
JWT_SECRET=local-dev-secret-32-chars-min
AWS_KMS_ENDPOINT=http://localhost:4566
```

### Kubernetes (External Secrets)
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: jwt-secrets
spec:
  secretStoreRef:
    name: link-app-secret-store
    kind: SecretStore
  data:
    - secretKey: JWT_SECRET
      remoteRef:
        key: link-app/auth
        property: jwt_secret
```

## 🌍 Environment-Specific Configurations

### Development
- Single replica
- Smaller resource limits
- Debug logging enabled
- Relaxed security policies
- Development domains

### Production  
- Multiple replicas (3+)
- Full resource allocation
- Info/warn logging only
- Strict security policies
- Production domains
- Backup strategies
- Monitoring enabled

## 📊 Monitoring and Observability

### Metrics
- Prometheus metrics from `/metrics` endpoints
- Service-specific dashboards
- Resource utilization monitoring

### Logging
- Structured JSON logging in production
- Centralized log aggregation
- Log retention policies

### Tracing
- Distributed tracing with Jaeger
- Request correlation IDs
- Performance monitoring

## 🚀 CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Deploy to Production
on:
  push:
    tags: ['v*']
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy with Helm
        run: |
          helm upgrade link-app-prod ./k8s/helm/link-app \
            -f values-prod.yaml \
            --set services.userSvc.image.tag=${{ github.ref_name }} \
            -n link-production
```

### Secrets in GitHub Actions
Use the existing `scripts/generate-secrets.sh` to generate secrets, then add them to GitHub Secrets:
- `JWT_SECRET`
- `POSTGRES_PASSWORD` 
- `AWS_KMS_KEY_ID`
- And others as generated

## 🛠️ Development Workflow

### Daily Development
```bash
# Start your service
./scripts/dev-workflow.sh start user-svc

# Make changes to code...

# Rebuild and test
./scripts/dev-workflow.sh rebuild user-svc
./scripts/dev-workflow.sh test user-svc

# View logs  
./scripts/dev-workflow.sh logs user-svc
```

### Adding New Services
1. Create `new-service/docker-compose.yml`
2. Create `new-service/.env.local`
3. Add to `k8s/helm/link-app/values.yaml`
4. Create deployment template in `templates/`

## 🐛 Troubleshooting

### Common Issues
1. **LocalStack not ready**: Wait longer or restart LocalStack
2. **Database connection failed**: Check PostgreSQL is running and healthy
3. **Service can't find other services**: Ensure shared network exists
4. **Secrets not found**: Check External Secrets Operator logs

### Debug Commands
```bash
# Check service status
./scripts/dev-workflow.sh status

# View all logs
./scripts/dev-workflow.sh logs

# Clean up and restart
./scripts/dev-workflow.sh clean
./scripts/dev-workflow.sh setup
```

## 📚 Best Practices Implemented

### ✅ Docker Compose
- Service-specific compose files
- Shared infrastructure
- External networks
- Health checks
- Proper build contexts

### ✅ Kubernetes
- Helm charts for templating
- Environment-specific values
- External Secrets Operator
- Resource limits and requests
- Network policies
- Pod security contexts

### ✅ Security
- No secrets in code
- External secret management  
- Environment separation
- Least privilege access
- Network isolation

### ✅ Development Experience
- One-command setup
- Service isolation
- Fast feedback loops
- Consistent environments
- Easy debugging