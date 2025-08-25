# Link App Deployment Strategies

This document outlines the advanced deployment strategies implemented in the Link application, focusing on rolling updates, canary deployments, and progressive delivery.

## Overview

The Link application uses a multi-layered deployment strategy that ensures zero-downtime deployments, automated rollbacks, and progressive delivery capabilities. Our deployment pipeline leverages:

- **Rolling Updates** with Pod Disruption Budgets for high availability
- **Canary Deployments** with Flagger for automated promotion/rollback
- **Feature Flags** for fine-grained deployment control
- **Progressive Delivery** with GitOps workflows
- **Comprehensive Monitoring** with Prometheus and Grafana

## Deployment Strategies

### Choosing Your Deployment Strategy

Each service in the Link application can use either **rolling updates** or **canary deployments**. The choice is configured per service in the Helm values:

```yaml
services:
  userSvc:
    deploymentStrategy: "rolling"  # or "canary"
  apiGateway:
    deploymentStrategy: "canary"   # or "rolling"
```

#### When to Use Rolling Updates

- **Low-risk changes**: Configuration updates, dependency updates
- **Internal services**: Services not directly exposed to users
- **Fast rollbacks needed**: When you need immediate rollback capability
- **Resource constraints**: When you can't afford additional resource overhead

#### When to Use Canary Deployments

- **High-risk changes**: Major feature releases, API changes
- **User-facing services**: API Gateway, Frontend services
- **Performance validation**: When you need to validate performance under real load
- **Gradual rollouts**: When you want to limit blast radius of issues

### 1. Rolling Updates

Rolling updates are the default deployment strategy, ensuring zero-downtime deployments by gradually replacing old pods with new ones.

#### Rolling Update Configuration

```yaml
# Enhanced rolling update strategy
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

#### Pod Disruption Budgets

Pod Disruption Budgets (PDBs) ensure minimum availability during cluster maintenance and updates:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: user-svc-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: user-svc
```

#### Health Probes

Optimized health probes for faster deployments:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: http
  initialDelaySeconds: 15
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready  
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### 2. Canary Deployments

Automated canary deployments with Flagger provide traffic-based validation before full rollout.

#### Architecture

1. **Flagger Controller** monitors deployment changes
2. **Traffic Splitting** gradually shifts traffic to canary version
3. **Metrics Analysis** validates performance against thresholds
4. **Automated Promotion/Rollback** based on success criteria

#### Canary Configuration

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: user-svc-canary
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-svc
  service:
    port: 8081
    targetPort: http
  analysis:
    interval: 1m
    iterations: 10
    maxWeight: 50
    stepWeight: 5
    threshold: 5
    metrics:
    - name: success-rate
      thresholdRange:
        min: 99
    - name: request-duration
      thresholdRange:
        max: 500
```

#### Traffic Progression

```text
Initial: 100% stable, 0% canary
Step 1:  95% stable, 5% canary
Step 2:  90% stable, 10% canary
...
Final:   50% stable, 50% canary
Promote: 0% stable, 100% canary (new stable)
```

#### Success Metrics

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Success Rate | ≥99% | HTTP 2xx/3xx response rate |
| Request Duration P99 | ≤500ms | 99th percentile latency |
| Error Rate | ≤1% | HTTP 5xx response rate |
| Linkerd Success Rate | ≥99% | Service mesh success rate |

### 3. Feature Flags Integration

Feature flags provide fine-grained control over deployment behavior and enable rapid rollbacks.

#### Feature Flag Configuration

```yaml
featureFlags:
  enabled: true
  canaryDeployment:
    enabled: true
    autoPromote: true
    maxWeight: 50
  services:
    userSvc:
      canaryEnabled: true
  autoRollback:
    enabled: true
    errorThreshold: 5
    latencyThreshold: 1000
```

#### Service-Level Control

Each service can have independent canary deployment settings:

```bash
# Enable canary for specific service
kubectl patch configmap link-app-feature-flags \
  -p '{"data":{"userSvc.canary.enabled":"true"}}'

# Disable auto-promotion globally
kubectl patch configmap link-app-feature-flags \
  -p '{"data":{"canary.autoPromote":"false"}}'
```

### 4. Progressive Delivery Workflow

GitOps-based progressive delivery with staged environments and automated validation.

#### Workflow Stages

1. **Pre-deployment Checks**
   - Code quality validation
   - Security scanning
   - Kubernetes manifest validation

2. **Staging Deployment**
   - Automatic canary deployment
   - Automated testing and validation
   - Metrics collection

3. **Production Deployment**
   - Manual approval required
   - Conservative canary settings
   - Extended monitoring period

#### Environment-Specific Settings

| Environment | Auto-Promote | Step Weight | Max Weight | Iterations |
|-------------|--------------|-------------|------------|------------|
| Staging     | ✅ Yes       | 10%        | 50%        | 10         |
| Production  | ❌ No        | 5%         | 25%        | 20         |

## Monitoring and Observability

### Deployment Dashboards

Grafana dashboards provide real-time visibility into deployment health:

- **Overall Success Rate**: Aggregate success rate across all services
- **Request Latency**: P95/P99 latency metrics
- **Canary Traffic Weight**: Current traffic distribution
- **Service-Level Metrics**: Per-service success rates and latency

### Automated Alerts

Prometheus alerts trigger automatic rollbacks:

```yaml
- alert: CanaryHighErrorRate
  expr: |
    (sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
    / sum(rate(http_requests_total[5m])) by (service)) * 100 > 5
  for: 1m
```

### Key Metrics

- **Deployment Success Rate**: Percentage of successful deployments
- **Mean Time to Deploy (MTTD)**: Average deployment duration
- **Mean Time to Recovery (MTTR)**: Average rollback time
- **Canary Success Rate**: Percentage of successful canary promotions

## Rollback Strategies

### Automated Rollback Triggers

- **Error Rate**: >5% HTTP 5xx responses
- **Latency**: P99 >1000ms
- **Success Rate**: <95% successful requests
- **Resource Usage**: >90% memory/CPU utilization

### Manual Rollback

```bash
# Immediate rollback
kubectl patch canary user-svc-canary \
  --type='merge' \
  -p='{"spec":{"analysis":{"skipAnalysis":true}}}'

# Rollback deployment
kubectl rollout undo deployment/user-svc
```

## Best Practices

### Deployment Configuration

1. **Resource Limits**: Always set resource requests and limits
2. **Health Probes**: Implement comprehensive health checks
3. **Graceful Shutdown**: Handle SIGTERM signals properly
4. **Database Migrations**: Use forward-compatible migrations

### Canary Configuration

1. **Conservative Settings**: Start with small traffic percentages
2. **Comprehensive Metrics**: Monitor multiple success criteria
3. **Timeout Settings**: Set appropriate analysis intervals
4. **Load Testing**: Include synthetic traffic during analysis

### Monitoring

1. **Service Level Objectives (SLOs)**: Define clear success criteria
2. **Alert Fatigue**: Tune alert thresholds to reduce noise
3. **Dashboard Organization**: Group related metrics logically
4. **Retention Policies**: Configure appropriate data retention

## Troubleshooting

### Common Issues

#### Canary Stuck in Analysis Phase

```bash
# Check canary status
kubectl describe canary user-svc-canary

# Check Flagger logs
kubectl logs -n flagger-system deployment/flagger

# Check metrics availability
kubectl exec -it -n flagger-system deployment/flagger -- \
  wget -qO- http://prometheus.monitoring:9090/api/v1/query?query=up
```

#### Failed Deployment Rollback

```bash
# Check deployment history
kubectl rollout history deployment/user-svc

# Manual rollback to previous version
kubectl rollout undo deployment/user-svc --to-revision=2

# Verify rollback success
kubectl rollout status deployment/user-svc
```

#### Metrics Not Available

```bash
# Check ServiceMonitor configuration
kubectl get servicemonitor user-svc-metrics -o yaml

# Verify Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets
```

### Debug Commands

```bash
# Check Flagger canary analysis
kubectl get canaries --all-namespaces

# View canary events
kubectl get events --sort-by='.lastTimestamp' | grep -i canary

# Check Linkerd metrics
linkerd stat deploy

# Test service connectivity
kubectl run curl-test --image=curlimages/curl:latest --rm -it --restart=Never -- \
  curl -v http://user-svc.default.svc.cluster.local:8081/health
```

## Security Considerations

### Network Policies

Canary deployments respect existing network policies:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: user-svc-network-policy
spec:
  podSelector:
    matchLabels:
      app: user-svc
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
```

### RBAC Configuration

Service accounts have minimal required permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: flagger-canary
rules:
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list", "create", "update", "patch"]
- apiGroups: ["apps"]  
  resources: ["deployments"]
  verbs: ["get", "list", "update", "patch"]
```

## Performance Impact

### Resource Overhead

| Component | CPU | Memory | Description |
|-----------|-----|--------|-------------|
| Flagger | 10-100m | 32-128Mi | Canary controller |
| LoadTester | 10-50m | 32Mi | Traffic generator |
| Canary Pods | +50% | +50% | Temporary overhead during analysis |

### Network Overhead

- **Linkerd Proxy**: ~5ms latency overhead
- **Traffic Splitting**: Minimal routing overhead
- **Metrics Collection**: ~1% CPU overhead per pod

## Migration Guide

### Enabling Canary Deployments

1. **Install Flagger**:
   ```bash
   kubectl apply -f k8s/flagger/flagger-install.yaml
   ```

2. **Deploy Metric Templates**:
   ```bash
   kubectl apply -f k8s/flagger/metric-templates.yaml
   ```

3. **Update Helm Values**:
   ```yaml
   canary:
     enabled: true
   ```

4. **Apply Canary Configurations**:
   ```bash
   helm upgrade link-app k8s/helm/link-app/ \
     --set canary.enabled=true
   ```

### Rolling Back to Standard Deployments

1. **Disable Canary**:
   ```bash
   helm upgrade link-app k8s/helm/link-app/ \
     --set canary.enabled=false
   ```

2. **Remove Canary Resources**:
   ```bash
   kubectl delete canary --all
   ```

## Support and Maintenance

### Regular Tasks

1. **Weekly**: Review canary success rates and adjust thresholds
2. **Monthly**: Update Flagger and related components
3. **Quarterly**: Review and optimize deployment strategies

### Monitoring Health

- **Flagger Controller**: Monitor logs for errors
- **Prometheus Metrics**: Ensure metrics collection is working
- **Canary Success Rate**: Track deployment success trends
- **Resource Usage**: Monitor controller resource consumption

### Updates and Upgrades

```bash
# Update Flagger
helm repo update flagger
helm upgrade flagger flagger/flagger -n flagger-system

# Update metric templates
kubectl apply -f k8s/flagger/metric-templates.yaml

# Validate configuration
flagger version
kubectl get canaries --all-namespaces
```

---

For additional support or questions about deployment strategies, please consult the platform team or create an issue in the repository.