# Link Platform ArgoCD Applications

This directory contains ArgoCD applications for the complete Link social platform deployment using GitOps principles.

## Overview

The ArgoCD implementation follows the **App-of-Apps pattern** with a root application that manages all platform components through dependency-ordered sync waves.

## Architecture

```
link-platform (Root App)
├── prerequisites-app.yaml      # Sync Wave -2: Namespaces, Secrets, RBAC
├── postgres-ha-operator-app.yaml  # Sync Wave -1: Database operator & HA cluster
├── infrastructure-apps.yaml    # Sync Wave 0: Redis, Qdrant, Linkerd
├── monitoring-apps.yaml        # Sync Wave 1: Prometheus, Grafana, Loki, Jaeger
├── microservices-apps.yaml     # Sync Wave 2: Backend Go services
└── link-helm-app.yaml          # Sync Wave 3: Frontend & multi-env deployments
```

## Applications Included

### 🔧 Prerequisites (`prerequisites-app.yaml`)
- **link-prerequisites**: Namespaces, secrets, ServiceAccounts, RBAC
- **external-secrets-operator**: External secrets management (AWS/GCP/Azure)
- **cert-manager**: Automatic TLS certificate management with Let's Encrypt
- **ingress-nginx**: High-availability NGINX ingress controller with autoscaling

### 🗄️ Database (`postgres-ha-operator-app.yaml`)
- **postgres-ha-operator**: CloudNativePG operator installation
- **postgres-ha-cluster**: PostgreSQL HA cluster (3 instances)
- **postgres-ha-pgbouncer**: Connection pooling layer
- **postgres-ha-project**: AppProject for PostgreSQL resources

### 🏗️ Infrastructure (`infrastructure-apps.yaml`)
- **redis-cluster-ha**: Redis cluster (6 nodes: 3 masters + 3 replicas)
- **redis-sentinel-ha**: Redis Sentinel for failover management
- **qdrant-cluster**: Vector database for search & AI embeddings
- **qdrant-backup**: Automated backup jobs for Qdrant
- **linkerd-config**: Service mesh configuration with mTLS
- **linkerd-monitoring**: Linkerd observability stack

### 📊 Monitoring (`monitoring-apps.yaml`)
- **prometheus-stack**: Prometheus + Grafana + AlertManager with 30-day retention
- **loki-stack**: Log aggregation with Loki + Promtail (7-day retention)
- **jaeger-tracing**: Distributed tracing with Elasticsearch backend
- **custom-dashboards**: Link-specific Grafana dashboards
- **alert-rules**: Custom Prometheus alerting rules

### 🚀 Microservices (`microservices-apps.yaml`)
- **user-svc**: User management & authentication service
- **chat-svc**: Real-time messaging with WebSocket support
- **ai-svc**: AI conversation summarization (OpenAI integration)
- **discovery-svc**: User discovery & availability tracking
- **search-svc**: Vector search & semantic recommendations
- **api-gateway**: Central API gateway with JWT auth & rate limiting

### 🎯 Applications (`link-helm-app.yaml`)
- **link-app-dev**: Development environment (1 replica, minimal resources)
- **link-app-staging**: Staging environment (2 replicas, production-like)
- **link-app-production**: Production environment (3+ replicas, HA + autoscaling)
- **link-frontend**: React frontend with TypeScript & Tailwind CSS

### 🎛️ Root App (`root-app.yaml`)
- **link-platform**: App-of-Apps managing all platform components
- **argocd-config**: ArgoCD self-management with GitHub OAuth & RBAC
- **Notifications**: Slack integration for deployment events

## Deployment Order (Sync Waves)

```
-2: Prerequisites (namespaces, secrets, ingress, cert-manager)
-1: Database operators & External secrets
 0: Infrastructure (Redis, Qdrant, Linkerd)
 1: Monitoring stack (Prometheus, Loki, Jaeger)
 2: Backend microservices (Go services)
 3: Frontend applications & multi-environment deployments
 4: API Gateway (after all services are ready)
```

## Getting Started

### 1. Install ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 2. Deploy Root Application
```bash
kubectl apply -f k8s/argocd/root-app.yaml
```

### 3. Access ArgoCD UI
```bash
# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080
```

## Configuration

### Repository Settings
All applications are configured to use: `https://github.com/RezaAbdurahman/Link.git`

### Environment-Specific Deployments
- **Development**: `link-app-dev` - Single replica, minimal resources
- **Staging**: `link-app-staging` - 2 replicas, production-like configuration  
- **Production**: `link-app-production` - 3+ replicas, manual sync required

### RBAC & Teams
- `link-platform-team`: Full admin access to all applications
- `link-sre-team`: Admin access to infrastructure & monitoring
- `link-dev-team`: Developer access to dev/staging environments
- `link-release-team`: Production deployment access

## Monitoring & Observability

### Sync Status Monitoring
- **Prometheus**: Application sync metrics collected automatically
- **Grafana**: ArgoCD dashboard for GitOps health monitoring
- **Slack**: Notifications for successful/failed deployments

### Application Health Checks
- Custom health checks for databases and stateful services
- Readiness probes for all microservices
- Dependency ordering ensures proper startup sequence

## Security Features

### Secrets Management
- External Secrets Operator for cloud secret stores
- Kubernetes secrets for sensitive configuration
- No secrets committed to Git repository

### Network Security
- Linkerd service mesh with automatic mTLS
- NetworkPolicies for service-to-service communication
- Ingress TLS termination with cert-manager

### RBAC
- Kubernetes RBAC for service accounts
- ArgoCD RBAC with GitHub team integration
- Least-privilege access for all components

## Troubleshooting

### Common Issues

1. **Sync Wave Dependencies**: Ensure prerequisites deploy before dependent services
2. **Resource Limits**: Check that cluster has sufficient CPU/memory for all replicas
3. **PVC Storage**: Verify StorageClass availability for PostgreSQL, Prometheus, etc.
4. **Ingress**: Confirm LoadBalancer service gets external IP for ingress controller

### Debugging Commands
```bash
# Check application health
kubectl get applications -n argocd

# View sync status
argocd app get link-platform --grpc-web

# Check resource usage
kubectl top pods -A

# View application logs
kubectl logs -f deployment/user-svc -n link-services
```

## Customization

### Adding New Services
1. Create Kubernetes manifests or Helm charts
2. Add ArgoCD Application to appropriate file
3. Set correct sync wave for deployment order
4. Update root app to include new application

### Environment Configuration
1. Modify values files in `k8s/helm/link-app/`
2. Update Helm parameters in `link-helm-app.yaml`
3. Sync applications for changes to take effect

## Production Considerations

### High Availability
- All critical services have multiple replicas
- PostgreSQL cluster with automatic failover
- Redis Sentinel for cache high availability
- Ingress controller with 3+ replicas and autoscaling

### Backup Strategy
- PostgreSQL: Continuous WAL archiving + daily snapshots
- Qdrant: Daily vector database backups
- Prometheus: 30-day metric retention
- Application logs: 7-day retention in Loki

### Scaling
- HorizontalPodAutoscaler configured for production workloads
- Cluster autoscaling recommended for variable workloads
- Resource requests/limits set for proper scheduling

---

For more information, see the main [Link Platform Documentation](../../README.md).