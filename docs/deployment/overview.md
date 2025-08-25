# Link Platform Deployment Guide

This guide provides comprehensive instructions for deploying the Link social platform across different environments.

## 🏗️ Architecture Overview

### Environment Strategy
- **Local Development**: Docker Compose + LocalStack
- **Development/Staging**: Kubernetes + Helm Charts  
- **Production**: Kubernetes + Helm Charts + GitOps (ArgoCD)

### Secret Management Strategy
- **Local**: `.env.local` files + LocalStack
- **Dev/Staging**: Kubernetes secrets + AWS Secrets Manager (dev keys)
- **Production**: External Secrets Operator + AWS Secrets Manager

## 🚀 Quick Start

### Local Development
```bash
# 1. Initial setup (one-time)
cd backend
./scripts/dev-workflow.sh setup

# 2. Start all services
./scripts/dev-workflow.sh start

# 3. Start individual service
./scripts/dev-workflow.sh start user-svc
```

### Production Deployment
```bash
# 1. Validate configuration
./scripts/validate-k8s-deployment.sh

# 2. Build and push images
make build-all && make push-all

# 3. Deploy ArgoCD root application
kubectl apply -f k8s/argocd/root-app.yaml
```

## 📋 Deployment Environments

### Local Development (Docker Compose)
- **Purpose**: Individual developer workstations
- **Infrastructure**: Docker Compose + LocalStack
- **Security**: Weak passwords, debug endpoints enabled
- **Resources**: Minimal resource allocation

### Development/Staging (Kubernetes)
- **Purpose**: Integration testing and pre-production validation
- **Infrastructure**: Kubernetes + Helm Charts
- **Security**: Real AWS KMS with development keys
- **Resources**: Moderate resource allocation

### Production (Kubernetes + GitOps)
- **Purpose**: Live production environment
- **Infrastructure**: Kubernetes + Helm + ArgoCD
- **Security**: Production AWS KMS, strict security policies
- **Resources**: Full resource allocation with redundancy

## 🎯 Prerequisites

### Infrastructure Requirements
- **Kubernetes Cluster**: Version 1.24+ with at least 3 nodes
- **Storage**: Persistent volume provisioner (recommend GP3 for AWS)
- **Load Balancer**: Cloud provider load balancer or MetalLB
- **DNS**: Domain management capability
- **SSL Certificates**: cert-manager compatible certificate authority

### Required Cluster Components
- **ArgoCD**: GitOps continuous deployment
- **cert-manager**: TLS certificate management  
- **nginx-ingress**: Ingress controller
- **External Secrets Operator**: Secret management integration

### Development Tools
- `kubectl` - Kubernetes CLI
- `helm` - Helm package manager
- `docker` - Container runtime
- `argocd` CLI (optional, for ArgoCD management)

## 🔧 Environment-Specific Configurations

### Local Development
```bash
# Service-specific development
cd user-svc
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after changes
./scripts/dev-workflow.sh rebuild user-svc
```

Environment files structure:
```
backend/
├── .env                          # Shared infrastructure (dev)
├── .env.production               # Shared infrastructure (prod)
├── user-svc/
│   ├── .env.local               # Local development
│   ├── .env.development         # Staging deployment
│   └── .env.production          # Production deployment
└── [other-services]/...
```

### Kubernetes Deployment
```bash
cd k8s/helm/link-app

# Development deployment
helm install link-app-dev . -f values-dev.yaml -n link-dev --create-namespace

# Staging deployment  
helm install link-app-staging . -f values.yaml -n link-staging --create-namespace

# Production deployment
helm install link-app-prod . -f values-prod.yaml -n link-production --create-namespace
```

## 🔒 Secret Management

### AWS Secrets Manager Setup
```bash
# Create production secrets
aws secretsmanager create-secret --name "link-app/database" \
  --secret-string '{"postgres_password":"STRONG_PRODUCTION_PASSWORD"}'

aws secretsmanager create-secret --name "link-app/auth" \
  --secret-string '{"jwt_secret":"STRONG_JWT_SECRET_64_CHARS_MINIMUM"}'

aws secretsmanager create-secret --name "link-app/encryption" \
  --secret-string '{"kms_key_id":"arn:aws:kms:us-west-2:ACCOUNT:key/KEY-ID"}'
```

### External Secrets Configuration
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

## 📊 Deployment Order (Production)

The applications deploy via ArgoCD sync waves:

```
Wave -2: Prerequisites (namespaces, secrets, RBAC)
Wave -1: Database migrations
Wave  0: Infrastructure (Redis, Qdrant, PgBouncer)  
Wave  1: PostgreSQL cluster
Wave  2: Backend microservices
Wave  3: API Gateway
Wave  4: Frontend application
```

## 🔐 Security Considerations

### Network Security
- All inter-service communication uses mTLS via Linkerd
- Network policies implement default-deny with specific allow rules
- Ingress traffic protected by rate limiting and security headers

### Access Control
- RBAC policies implement least-privilege access
- Service accounts have minimal required permissions
- Secrets managed via External Secrets Operator

### Pod Security
- All containers run as non-root
- Read-only root filesystem enforced
- Security contexts drop all capabilities
- Pod Security Standards enforced at namespace level

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Production
on:
  push:
    tags: ['v*']
jobs:
  deploy:
    steps:
    - name: Update image tags
      run: |
        yq eval '.image.tag = "${{ github.ref_name }}"' -i k8s/helm/link-app/values-prod.yaml
    - name: Commit updated tags
      run: |
        git commit -am "Update production image tags to ${{ github.ref_name }}"
        git push
    # ArgoCD will automatically detect and sync the changes
```

## 🚨 Troubleshooting

### Common Issues

#### Local Development
- **LocalStack not ready**: Wait longer or restart LocalStack
- **Database connection failed**: Check PostgreSQL is running and healthy
- **Service can't find other services**: Ensure shared network exists

#### Kubernetes
- **ArgoCD Application Stuck**: Check application details and force refresh
- **Pod ImagePullBackOff**: Verify image availability and pull secrets
- **Database Connection Issues**: Check PgBouncer and PostgreSQL cluster status

### Debug Commands
```bash
# Local development
./scripts/dev-workflow.sh status
./scripts/dev-workflow.sh logs
./scripts/dev-workflow.sh clean && ./scripts/dev-workflow.sh setup

# Kubernetes
kubectl get pods -n link-services
kubectl describe pod <pod-name> -n link-services
kubectl logs deployment/<service-name> -n link-services
```

## 📚 Best Practices

### ✅ Docker Compose
- Service-specific compose files
- Shared infrastructure components
- External networks for service communication
- Health checks for all services

### ✅ Kubernetes
- Helm charts for configuration templating
- Environment-specific values files
- External secret management
- Resource limits and requests
- Network and security policies

### ✅ Security
- No secrets committed to code
- External secret management for all environments
- Environment separation and isolation
- Least privilege access controls

### ✅ Development Experience
- One-command setup and deployment
- Service isolation for focused development
- Fast feedback loops with live reload
- Consistent environments across team

## 📞 Support

For detailed deployment procedures, see:
- [Docker Compose Deployment](docker-compose.md)
- [Kubernetes Deployment](kubernetes.md)
- [CI/CD Pipeline Setup](ci-cd.md)

For troubleshooting, see [Operations Documentation](../operations/troubleshooting.md).