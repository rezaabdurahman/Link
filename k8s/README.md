# Link Platform - Kubernetes Configuration

This directory contains all Kubernetes configurations for the Link social platform, organized for production-ready GitOps deployment using ArgoCD.

## 📁 Directory Structure

```
k8s/
├── README.md                    # This file
│
├── foundations/                 # Basic cluster prerequisites
│   ├── 00-prerequisites.yaml   # Namespaces, storage classes, CRDs
│   └── 01-secrets.yaml         # Base secrets and external secret operators
│
├── infrastructure/             # Infrastructure components
│   ├── cache/                  # Redis cluster configurations
│   │   ├── redis-cluster-ha.yaml
│   │   └── redis-sentinel-ha.yaml
│   ├── database/               # Database and connection pooling
│   │   ├── pgbouncer-configmap.yaml
│   │   ├── pgbouncer-deployment.yaml
│   │   └── pgbouncer-service.yaml
│   └── vector-db/              # Qdrant vector database
│       ├── qdrant-cluster.yaml
│       └── qdrant-backup-cronjob.yaml
│
├── application/                # Application deployments
│   └── helm/                   # Helm charts for microservices
│       └── link-app/           # Main application Helm chart
│           ├── Chart.yaml
│           ├── values.yaml     # Production values
│           ├── values-dev.yaml # Development overrides
│           ├── values-staging.yaml
│           ├── values-prod.yaml
│           └── templates/      # Service templates
│               ├── _helpers.tpl
│               ├── user-svc-deployment.yaml
│               ├── chat-svc-deployment.yaml
│               ├── ai-svc-deployment.yaml
│               ├── discovery-svc-deployment.yaml
│               ├── search-svc-deployment.yaml
│               ├── api-gateway-deployment.yaml
│               ├── frontend-deployment.yaml
│               └── external-secrets.yaml
│
├── security/                   # Security policies and access control
│   ├── README.md              # Detailed security documentation
│   ├── rbac.yaml              # Role-based access control
│   └── network-policies.yaml  # Network segmentation rules
│
├── standalone/                 # Non-Helm resources
│   └── migration-job.yaml     # Database migration jobs
│
├── argocd/                     # GitOps configuration
│   ├── README.md              # ArgoCD setup and usage
│   ├── root-app.yaml          # App-of-Apps pattern
│   ├── microservices-apps.yaml
│   ├── infrastructure-apps.yaml
│   ├── monitoring-apps.yaml
│   ├── database-migration-app.yaml
│   ├── link-helm-app.yaml
│   └── prerequisites-app.yaml
│
├── linkerd/                    # Service mesh configuration
│   ├── install-linkerd.sh
│   ├── configure-advanced-features.sh
│   ├── linkerd-production-config.yaml
│   ├── linkerd-monitoring.yaml
│   └── services-with-mtls.yaml
│
└── cloudnative-pg/            # PostgreSQL operator configuration
    ├── README.md
    ├── 00-operator-install.yaml
    ├── 01-postgres-cluster.yaml
    ├── 02-backup-configuration.yaml
    └── 03-monitoring.yaml
```

## 🚀 Key Features

### ✅ Production-Ready Configuration
- **High Availability**: Multi-replica deployments with HPA and PDB
- **Security**: RBAC, network policies, security contexts, non-root containers
- **Monitoring**: Prometheus metrics, Grafana dashboards, alerting
- **Service Mesh**: Linkerd with mTLS and traffic management

### ✅ GitOps with ArgoCD
- **App-of-Apps Pattern**: Centralized management of all applications
- **Sync Waves**: Proper dependency ordering for deployments
- **Multi-Environment**: Dev, staging, production with different configurations
- **Self-Healing**: Automatic drift detection and correction

### ✅ Clean Architecture
- **Single Configuration Source**: Eliminated duplicate manifests vs Helm confusion
- **Proper Separation**: Infrastructure, applications, and security clearly separated  
- **Namespace Consistency**: All resources use `link-services` namespace
- **Image Registry Standardization**: All images use `ghcr.io/rezaabdurahman` registry

## 🏗 Deployment Architecture

### Services
- **user-svc**: User management and authentication
- **chat-svc**: Real-time messaging with WebSocket support
- **ai-svc**: AI conversation summarization using OpenAI
- **discovery-svc**: User discovery and ranking algorithms  
- **search-svc**: Vector search using Qdrant embeddings
- **api-gateway**: Central API gateway with JWT auth and rate limiting
- **frontend**: React 18 + TypeScript SPA

### Infrastructure
- **PostgreSQL**: CloudNative-PG operator with HA cluster
- **PgBouncer**: Connection pooling for database efficiency
- **Redis**: Sentinel HA cluster for caching and sessions
- **Qdrant**: Vector database for semantic search
- **Linkerd**: Service mesh with automatic mTLS

### Monitoring & Observability
- **Prometheus**: Metrics collection from all services
- **Grafana**: Dashboards and alerting
- **Loki**: Log aggregation and analysis
- **Jaeger**: Distributed tracing for performance monitoring

## 🔒 Security Features

### Network Security
- **Default Deny**: All traffic blocked by default
- **Microsegmentation**: Service-specific network policies
- **mTLS**: Automatic mutual TLS via Linkerd
- **Ingress Protection**: Rate limiting and security headers

### Access Control
- **RBAC**: Least-privilege access control
- **Service Accounts**: Dedicated accounts per service
- **Pod Security**: Restricted pod security standards
- **Secrets Management**: External Secrets Operator integration

## 📊 Operations

### Database Management
- **Zero-Downtime Migrations**: Safe schema changes with health checks
- **Connection Pooling**: PgBouncer for efficient database connections
- **Backup & Recovery**: Automated backups with point-in-time recovery
- **Monitoring**: Database performance and connection monitoring

### Scaling & Performance
- **Horizontal Pod Autoscaling**: CPU and memory-based scaling
- **Resource Management**: Proper requests and limits
- **Connection Pooling**: Optimized database connection management
- **Caching Strategy**: Redis for session and application caching

## 🌍 Multi-Environment Support

### Development (`values-dev.yaml`)
- Single replicas for resource efficiency
- Debug logging enabled
- Relaxed security policies for development
- Local domain: `dev.linkapp.com`

### Staging (`values-staging.yaml`)  
- 2 replicas for basic HA testing
- Production-like configuration
- Automated deployments
- Staging domain: `staging.linkapp.com`

### Production (`values-prod.yaml`)
- 3+ replicas with autoscaling (3-10 pods)
- Strict security and resource limits
- Manual approval for changes
- Production domains: `linkapp.com`, `api.linkapp.com`

## 🔄 Deployment Process

### GitOps Flow
1. **Code Changes**: Push to GitHub repository
2. **CI/CD Pipeline**: Build and push container images
3. **ArgoCD Sync**: Automatic deployment to staging
4. **Manual Approval**: Production deployments require approval
5. **Health Checks**: Automated verification of deployments

### Migration Process
1. **Pre-Migration**: Database connectivity and space checks
2. **Zero-Downtime Execution**: Schema changes without service interruption
3. **Post-Migration**: Integrity verification and rollback capability
4. **Monitoring**: Migration status and performance tracking

## 🛠 Maintenance Tasks

### Regular Operations
- **Image Updates**: Automated via CI/CD pipeline
- **Certificate Renewal**: Automated via cert-manager
- **Backup Verification**: Regular restore testing
- **Security Updates**: Regular vulnerability scanning and patching

### Monitoring Alerts
- **Service Health**: Application and infrastructure health monitoring
- **Resource Usage**: CPU, memory, and storage alerts
- **Security Events**: RBAC failures and security violations
- **Performance**: Response time and error rate monitoring

## 📚 Documentation References

- [Access Control Documentation](./access/README.md)
- [ArgoCD Setup Guide](./argocd/README.md)  
- [CloudNative-PG Guide](./cloudnative-pg/README.md)
- [Linkerd Service Mesh Setup](./linkerd/)

## 🚨 Emergency Procedures

### Rollback Process
1. **ArgoCD Rollback**: Use ArgoCD UI to rollback to previous revision
2. **Database Rollback**: Use migration rollback job (suspended by default)
3. **Traffic Switching**: Use Linkerd traffic splits for gradual rollback

### Incident Response
1. **Monitoring Alerts**: Automated alerts via Slack/PagerDuty
2. **Access**: Emergency access procedures documented in [access/README.md](./access/README.md)
3. **Debugging**: kubectl access for authorized personnel
4. **Communication**: Incident response channels and procedures

---

## ⚡ Quick Start

1. **Prerequisites**: Ensure cluster has ArgoCD, cert-manager, and ingress-nginx
2. **Apply Root App**: `kubectl apply -f argocd/root-app.yaml`
3. **Monitor Deployment**: Use ArgoCD UI to track application sync status
4. **Verify Services**: Check health endpoints and metrics

For detailed setup instructions, see the individual README files in each directory.