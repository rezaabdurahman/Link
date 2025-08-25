# Kubernetes Deployment Guide

This guide provides detailed instructions for deploying Link platform to Kubernetes using GitOps with ArgoCD.

## 🎯 Prerequisites

### Infrastructure Requirements
- **Kubernetes Cluster**: Version 1.24+ with at least 3 nodes
- **Storage**: Persistent volume provisioner (recommend GP3 for AWS)
- **Load Balancer**: Cloud provider load balancer or MetalLB
- **DNS**: Domain management capability
- **SSL Certificates**: cert-manager compatible certificate authority

### Install Core Components

#### ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

#### cert-manager
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

#### nginx-ingress
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx
```

#### External Secrets Operator
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

## 🚀 Production Deployment Process

### Phase 1: Infrastructure Preparation

#### 1.1 Cluster Setup
```bash
# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Check storage classes
kubectl get storageclass
```

#### 1.2 Configure DNS
```bash
# Get load balancer IP
kubectl get svc -n ingress-nginx

# Configure DNS records:
# api.linkapp.com -> LoadBalancer IP
# linkapp.com -> LoadBalancer IP
# argocd.linkapp.com -> LoadBalancer IP
```

### Phase 2: Application Deployment

#### 2.1 Deploy Root Application
```bash
# Deploy the App-of-Apps pattern
kubectl apply -f k8s/argocd/root-app.yaml

# Verify ArgoCD can see the application
kubectl get applications -n argocd
```

#### 2.2 Monitor Deployment Progress
```bash
# Watch deployment sync waves
kubectl get applications -n argocd -w

# Check individual application status
argocd app get link-prerequisites
argocd app get postgres-ha-operator
argocd app get redis-cluster-ha
```

#### 2.3 Deployment Order Verification
The applications deploy in this order via sync waves:

```
Wave -2: Prerequisites (namespaces, secrets, RBAC)
Wave -1: Database migrations
Wave  0: Infrastructure (Redis, Qdrant, PgBouncer)  
Wave  1: PostgreSQL cluster
Wave  2: Backend microservices
Wave  3: API Gateway
Wave  4: Frontend application
```

### Phase 3: Verification and Testing

#### 3.1 Health Checks
```bash
# Check all pods are running
kubectl get pods -n link-services

# Verify services are accessible
kubectl get svc -n link-services

# Check ingress status
kubectl get ingress -n link-services
```

#### 3.2 Application Testing
```bash
# Test API Gateway health
curl https://api.linkapp.com/health

# Test frontend accessibility  
curl https://linkapp.com

# Check database connectivity
kubectl exec -it deployment/user-svc -n link-services -- wget -qO- localhost:8081/ready
```

#### 3.3 Monitoring Verification
```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check Grafana dashboards
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Visit http://localhost:3000
```

## 🔧 Environment-Specific Deployments

### Development Environment
```bash
# Deploy with development values
argocd app create link-app-dev \
  --repo https://github.com/RezaAbdurahman/Link.git \
  --path k8s/helm/link-app \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace link-dev \
  --values-file values-dev.yaml
```

### Staging Environment  
```bash
# Deploy with staging values
argocd app create link-app-staging \
  --repo https://github.com/RezaAbdurahman/Link.git \
  --path k8s/helm/link-app \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace link-staging \
  --values-file values-staging.yaml
```

### Production Environment
```bash
# Production requires manual sync for safety
argocd app create link-app-production \
  --repo https://github.com/RezaAbdurahman/Link.git \
  --path k8s/helm/link-app \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace link-services \
  --values-file values-prod.yaml \
  --sync-policy none  # Manual sync required
```

## 🚨 Troubleshooting

### ArgoCD Application Stuck in Progressing
```bash
# Check application details
argocd app get <app-name>

# Check for resource conflicts
kubectl describe application <app-name> -n argocd

# Force refresh
argocd app hard-refresh <app-name>
```

### Pod ImagePullBackOff
```bash
# Check image availability
docker pull ghcr.io/rezaabdurahman/link-user-svc:latest

# Verify image pull secrets
kubectl get secret -n link-services
kubectl describe secret <image-pull-secret>

# Check pod events
kubectl describe pod <pod-name> -n link-services
```

### Database Connection Issues
```bash
# Check PgBouncer status
kubectl logs deployment/pgbouncer -n link-services

# Test database connectivity
kubectl exec -it deployment/pgbouncer -n link-services -- psql -h postgres-cluster-rw -U linkuser -d linkdb

# Check PostgreSQL cluster status
kubectl get postgresql -n link-services
```

### Service Mesh Issues
```bash
# Check Linkerd status
linkerd check

# Verify proxy injection
kubectl get pods -n link-services -o wide
kubectl describe pod <pod-name> -n link-services

# Check mTLS status
linkerd viz stat deploy -n link-services
```

## 🔄 Recovery Procedures

### Rollback Deployment
```bash
# Via ArgoCD UI
argocd app rollback <app-name> <revision-id>

# Or via kubectl
kubectl rollout undo deployment/<deployment-name> -n link-services
```

### Database Emergency Rollback
```bash
# Suspend and execute rollback job
kubectl patch job link-migration-rollback-production -n link-services -p '{"spec":{"suspend":false}}'

# Monitor rollback progress
kubectl logs job/link-migration-rollback-production -n link-services -f
```

### Scale Down for Maintenance
```bash
# Scale all services to zero
kubectl scale deployment --all --replicas=0 -n link-services

# Scale specific service
kubectl scale deployment user-svc --replicas=0 -n link-services
```

## 📊 Monitoring and Observability

### Prometheus Metrics
- **Application Metrics**: Custom business metrics from each service
- **Infrastructure Metrics**: CPU, memory, disk, network
- **Database Metrics**: Connection pool, query performance
- **Service Mesh Metrics**: Request success rate, latency, mTLS status

### Grafana Dashboards
- **Link Platform Overview**: High-level platform health
- **Service Performance**: Individual service metrics
- **Infrastructure Health**: Cluster resource utilization
- **Database Monitoring**: PostgreSQL and Redis performance

### Alerting Rules
```yaml
# Critical alerts
- ServiceDown: Service unavailable for >5 minutes
- HighErrorRate: Error rate >5% for >5 minutes  
- DatabaseConnections: Connection pool utilization >80%
- DiskSpaceUsage: Disk usage >85%
```

## 🎉 Post-Deployment Checklist

### ✅ Application Health
- [ ] All pods running and ready
- [ ] Services accessible via ingress
- [ ] Health endpoints responding
- [ ] Database connections established

### ✅ Security Validation
- [ ] RBAC policies active
- [ ] Network policies enforced
- [ ] TLS certificates valid
- [ ] Secrets properly mounted

### ✅ Monitoring Setup
- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards displaying data
- [ ] Alerts configured and routing
- [ ] Log aggregation working

### ✅ Backup and Recovery
- [ ] Database backups configured
- [ ] Backup restoration tested
- [ ] Recovery procedures documented
- [ ] Emergency contacts updated

## 📞 Support and Maintenance

### Emergency Contacts
- **Platform Team**: team@linkapp.com  
- **SRE On-Call**: +1-XXX-XXX-XXXX
- **DevOps Slack**: #link-platform-alerts

### Maintenance Windows
- **Regular Updates**: Sundays 02:00-04:00 UTC
- **Emergency Patches**: As needed with minimal notice
- **Database Maintenance**: First Sunday of month 01:00-05:00 UTC