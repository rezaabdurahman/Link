# Kubernetes Access Configuration for Link Platform

This document outlines the Kubernetes access configuration for the Link platform, including RBAC setup, service accounts, and security policies.

## Table of Contents

1. [Overview](#overview)
2. [Namespaces](#namespaces)
3. [Service Accounts](#service-accounts)
4. [RBAC Configuration](#rbac-configuration)
5. [CI/CD Access](#cicd-access)
6. [Monitoring Access](#monitoring-access)
7. [Security Policies](#security-policies)
8. [Access Troubleshooting](#access-troubleshooting)

## Overview

The Link platform uses a least-privilege security model with dedicated service accounts and RBAC policies for each component. Access is granted based on the principle of least privilege.

### Security Principles

- **Least Privilege**: Each service account has only the minimum permissions required
- **Separation of Concerns**: Different environments and services use separate credentials
- **Zero Trust**: No implicit trust between components
- **Audit Trail**: All access and changes are logged

## Namespaces

The platform uses the following namespaces:

| Namespace | Purpose | Access Level |
|-----------|---------|--------------|
| `link-services` | Core application services | Restricted |
| `link-system` | Platform infrastructure | High Security |
| `monitoring` | Observability stack | Monitoring Team |
| `linkerd` | Service mesh | Platform Admin |
| `argocd` | GitOps controller | DevOps Team |
| `cert-manager` | Certificate management | Platform Admin |

## Service Accounts

### Core Application Service Accounts

Each microservice has its own service account with minimal permissions:

```yaml
# Example: User Service
apiVersion: v1
kind: ServiceAccount
metadata:
  name: user-svc
  namespace: link-services
automountServiceAccountToken: false  # Security best practice
```

### System Service Accounts

| Service Account | Namespace | Purpose |
|-----------------|-----------|---------|
| `link-migration` | `link-services` | Database migrations |
| `link-monitoring` | `monitoring` | Metrics collection |
| `link-backup` | `link-system` | Database backups |
| `argocd-application-controller` | `argocd` | GitOps deployments |

## RBAC Configuration

### Development Environment

```yaml
# Developer access to link-services namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: link-services
  name: link-developer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "describe"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "describe"]
```

### Production Environment

```yaml
# Production read-only access
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: link-services
  name: link-production-readonly
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

### CI/CD Service Account

```yaml
# CI/CD deployment permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: link-cicd-deployer
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps", "services"]
  verbs: ["get", "list", "create", "update", "patch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "patch"]
- apiGroups: ["argoproj.io"]
  resources: ["applications"]
  verbs: ["get", "list", "create", "update", "patch"]
```

## CI/CD Access

### GitHub Actions Setup

The CI/CD pipeline requires specific Kubernetes credentials:

#### Required Secrets

| Secret Name | Description | Scope |
|-------------|-------------|-------|
| `KUBECONFIG_DATA` | Base64 encoded kubeconfig | Repository |
| `KUBE_CLUSTER_CA` | Cluster CA certificate | Organization |
| `KUBE_TOKEN` | Service account token | Repository |

#### Setup Commands

```bash
# Create CI/CD service account
kubectl create serviceaccount link-cicd -n link-system

# Create cluster role binding
kubectl create clusterrolebinding link-cicd-binding \
  --clusterrole=link-cicd-deployer \
  --serviceaccount=link-system:link-cicd

# Get service account token (Kubernetes 1.24+)
kubectl create token link-cicd -n link-system --duration=87600h
```

#### Kubeconfig Generation

```yaml
# .github/workflows/setup-kube-access.yml
name: Setup Kubernetes Access
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string

jobs:
  setup-kube-access:
    runs-on: ubuntu-latest
    steps:
    - name: Configure kubectl
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBECONFIG_DATA }}" | base64 -d > ~/.kube/config
        kubectl config set-context --current --namespace=link-services
        
    - name: Verify access
      run: |
        kubectl auth can-i create deployments -n link-services
        kubectl auth can-i get pods -n link-services
```

## Monitoring Access

### Prometheus Service Account

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus-scraper
rules:
- apiGroups: [""]
  resources: ["nodes", "services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch"]
```

### Grafana Service Account

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: grafana
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: monitoring
  name: grafana-reader
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
```

## Security Policies

### Pod Security Standards

```yaml
# Namespace-level Pod Security Standard
apiVersion: v1
kind: Namespace
metadata:
  name: link-services
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Network Policies

```yaml
# Default deny-all network policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: link-services
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

```yaml
# Allow communication between services
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-service-communication
  namespace: link-services
spec:
  podSelector:
    matchLabels:
      part-of: link-platform
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: link-services
    - namespaceSelector:
        matchLabels:
          name: linkerd
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: link-services
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

### Security Context Policies

All containers must run with the following security context:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 65534  # nobody user
  capabilities:
    drop:
      - ALL
```

## Access Troubleshooting

### Common Issues

#### 1. ImagePullBackOff

**Symptoms**: Pods stuck in `ImagePullBackOff` state

**Diagnosis**:
```bash
kubectl describe pod <pod-name> -n link-services
kubectl get events -n link-services --sort-by=.metadata.creationTimestamp
```

**Solutions**:
- Verify image exists in registry
- Check image pull secrets
- Verify registry credentials

#### 2. RBAC Permission Denied

**Symptoms**: `error validating data: the server doesn't allow access`

**Diagnosis**:
```bash
kubectl auth can-i <verb> <resource> -n <namespace> --as=system:serviceaccount:<namespace>:<serviceaccount>
kubectl describe role,rolebinding,clusterrole,clusterrolebinding -n <namespace>
```

**Solutions**:
- Review and update RBAC policies
- Check service account bindings
- Verify namespace access

#### 3. Network Policy Blocking Communication

**Symptoms**: Services can't communicate despite correct configuration

**Diagnosis**:
```bash
kubectl get networkpolicies -A
kubectl describe networkpolicy <policy-name> -n <namespace>
```

**Solutions**:
- Review network policy selectors
- Check port and protocol specifications
- Verify namespace labels

### Debug Commands

```bash
# Check service account permissions
kubectl auth can-i --list --as=system:serviceaccount:link-services:user-svc

# View effective RBAC for a service account
kubectl describe clusterrolebindings,rolebindings --all-namespaces | grep -i user-svc

# Check network connectivity
kubectl exec -it <pod-name> -n link-services -- nc -zv <service-name> <port>

# View security context
kubectl get pod <pod-name> -n link-services -o jsonpath='{.spec.securityContext}'

# Check resource quotas
kubectl describe resourcequota -n link-services

# View pod security context
kubectl get pod <pod-name> -n link-services -o jsonpath='{.spec.containers[*].securityContext}'
```

### Monitoring Access Issues

Set up alerts for common access issues:

```yaml
# Prometheus alert for RBAC failures
- alert: RBACFailures
  expr: increase(apiserver_audit_total{verb="create",objectRef_resource="*",user!~"system:.*"}[5m]) > 10
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High number of RBAC failures detected"
    description: "{{ $value }} RBAC failures in the last 5 minutes"

# Alert for ImagePullBackOff
- alert: ImagePullErrors
  expr: kube_pod_container_status_waiting_reason{reason="ImagePullBackOff"} > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Pod stuck in ImagePullBackOff"
    description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is stuck pulling image"
```

## Environment-Specific Configurations

### Development

- More permissive RBAC for debugging
- Direct kubectl access for developers
- Relaxed security policies for testing

### Staging

- Production-like RBAC with some debug access
- CI/CD automated deployments only
- Network policies enforced

### Production

- Strict least-privilege RBAC
- No direct developer access
- All changes via GitOps
- Full security policy enforcement
- Comprehensive audit logging

## Best Practices

1. **Regular Access Reviews**: Quarterly review of all service accounts and permissions
2. **Rotate Credentials**: Regular rotation of service account tokens
3. **Audit Logging**: Enable and monitor Kubernetes audit logs
4. **Secrets Management**: Use external secret management (AWS Secrets Manager, HashiCorp Vault)
5. **Network Segmentation**: Use network policies to segment traffic
6. **Image Security**: Scan all container images for vulnerabilities
7. **Resource Limits**: Set appropriate resource requests and limits
8. **Monitoring**: Monitor all access patterns and failures

## References

- [Kubernetes RBAC Documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Linkerd Security](https://linkerd.io/2.14/features/automatic-mtls/)
- [ArgoCD RBAC](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)