#!/bin/bash
# PostgreSQL HA Deployment Script
# This script provides a simple way to deploy PostgreSQL HA via CI/CD or manually

set -euo pipefail

# Configuration
ENVIRONMENT="${ENVIRONMENT:-staging}"
ACTION="${ACTION:-deploy}"
NAMESPACE="${NAMESPACE:-link-services}"
OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-cnpg-system}"
TIMEOUT="${TIMEOUT:-600}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
PostgreSQL HA Deployment Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Deployment environment (staging|production) [default: staging]
    -a, --action ACTION      Action to perform (deploy|upgrade|verify|rollback) [default: deploy]
    -n, --namespace NS       Kubernetes namespace [default: link-services]
    -t, --timeout SECONDS   Deployment timeout in seconds [default: 600]
    -h, --help              Show this help message

ENVIRONMENT VARIABLES:
    KUBECONFIG              Path to kubectl configuration
    AWS_ACCESS_KEY_ID       AWS access key for S3 backup
    AWS_SECRET_ACCESS_KEY   AWS secret key for S3 backup
    
EXAMPLES:
    # Deploy to staging
    $0 --environment staging --action deploy
    
    # Upgrade production cluster
    $0 --environment production --action upgrade
    
    # Verify cluster health
    $0 --environment production --action verify
    
    # Use Helm deployment method
    DEPLOYMENT_METHOD=helm $0 --environment staging
    
    # Use ArgoCD deployment method  
    DEPLOYMENT_METHOD=argocd $0 --environment production

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -a|--action)
                ACTION="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required but not installed"
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl cannot connect to cluster"
        exit 1
    fi
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        log_error "Environment must be 'staging' or 'production'"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -d "k8s/cloudnative-pg" ]]; then
        log_error "k8s/cloudnative-pg directory not found. Run from repository root."
        exit 1
    fi
    
    log_success "Prerequisites validated"
}

# Check cluster health
check_cluster_health() {
    log_info "Checking existing cluster health..."
    
    if kubectl get cluster postgres-cluster -n "$NAMESPACE" &>/dev/null; then
        local status=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        local instances=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.instances}')
        local ready=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.readyInstances}')
        local primary=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.currentPrimary}')
        
        log_info "Cluster status: $status"
        log_info "Instances: $ready/$instances ready"
        log_info "Current primary: $primary"
        
        if [[ "$status" != "Cluster in healthy state" && "$ready" != "$instances" ]]; then
            log_warning "Cluster is not in optimal health"
            return 1
        fi
    else
        log_info "No existing cluster found - fresh deployment"
    fi
    
    return 0
}

# Deploy via raw manifests
deploy_manifests() {
    log_info "Deploying PostgreSQL HA via raw manifests..."
    
    # 1. Install/upgrade operator
    log_info "Installing CloudNativePG operator..."
    kubectl apply -f k8s/cloudnative-pg/00-operator-install.yaml
    kubectl wait --for=condition=Available deployment/cnpg-controller-manager -n "$OPERATOR_NAMESPACE" --timeout="${TIMEOUT}s"
    
    # 2. Apply backup credentials
    log_info "Applying backup configuration..."
    kubectl apply -f k8s/cloudnative-pg/02-backup-configuration.yaml
    
    # 3. Deploy cluster
    log_info "Deploying PostgreSQL cluster..."
    kubectl apply -f k8s/cloudnative-pg/01-postgres-cluster.yaml
    
    # 4. Wait for cluster readiness
    log_info "Waiting for cluster to be ready (timeout: ${TIMEOUT}s)..."
    kubectl wait --for=condition=Ready cluster/postgres-cluster -n "$NAMESPACE" --timeout="${TIMEOUT}s"
    
    # 5. Apply monitoring
    log_info "Deploying monitoring configuration..."
    kubectl apply -f k8s/cloudnative-pg/03-monitoring.yaml
    
    # 6. Update PgBouncer
    log_info "Updating PgBouncer configuration..."
    kubectl apply -f k8s/pgbouncer-configmap.yaml
    kubectl rollout status deployment/pgbouncer -n "$NAMESPACE" --timeout="${TIMEOUT}s" || true
    
    log_success "PostgreSQL HA deployment completed via manifests"
}

# Deploy via Helm
deploy_helm() {
    log_info "Deploying PostgreSQL HA via Helm..."
    
    if ! command -v helm &> /dev/null; then
        log_error "Helm is required but not installed"
        exit 1
    fi
    
    # Determine values file based on environment
    local values_file="k8s/helm/postgres-ha/values.yaml"
    if [[ -f "k8s/helm/postgres-ha/values-${ENVIRONMENT}.yaml" ]]; then
        values_file="k8s/helm/postgres-ha/values-${ENVIRONMENT}.yaml"
    fi
    
    log_info "Using values file: $values_file"
    
    # Install/upgrade the chart
    helm upgrade --install postgres-ha k8s/helm/postgres-ha \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values "$values_file" \
        --set global.environment="$ENVIRONMENT" \
        --timeout "${TIMEOUT}s" \
        --wait \
        --atomic
    
    log_success "PostgreSQL HA deployment completed via Helm"
}

# Deploy via ArgoCD
deploy_argocd() {
    log_info "Deploying PostgreSQL HA via ArgoCD..."
    
    if ! kubectl get crd applications.argoproj.io &>/dev/null; then
        log_error "ArgoCD is not installed in the cluster"
        exit 1
    fi
    
    # Apply ArgoCD applications
    kubectl apply -f k8s/argocd/postgres-ha-operator-app.yaml
    
    # Wait for applications to sync
    log_info "Waiting for ArgoCD applications to sync..."
    kubectl wait --for=condition=Synced application/postgres-ha-operator -n argocd --timeout="${TIMEOUT}s"
    kubectl wait --for=condition=Synced application/postgres-ha-cluster -n argocd --timeout="${TIMEOUT}s"
    kubectl wait --for=condition=Synced application/postgres-ha-pgbouncer -n argocd --timeout="${TIMEOUT}s"
    
    log_success "PostgreSQL HA deployment completed via ArgoCD"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying PostgreSQL HA deployment..."
    
    # Check cluster status
    if ! kubectl get cluster postgres-cluster -n "$NAMESPACE" &>/dev/null; then
        log_error "PostgreSQL cluster not found"
        return 1
    fi
    
    local status=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.phase}')
    local instances=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.instances}')
    local ready=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.readyInstances}')
    local primary=$(kubectl get cluster postgres-cluster -n "$NAMESPACE" -o jsonpath='{.status.currentPrimary}')
    
    log_info "Cluster verification:"
    log_info "  Status: $status"
    log_info "  Instances: $ready/$instances ready"
    log_info "  Primary: $primary"
    
    # Test connectivity
    log_info "Testing database connectivity..."
    if kubectl exec "$primary" -n "$NAMESPACE" -- psql -U linkuser -d linkdb -c "SELECT version();" &>/dev/null; then
        log_success "Database connectivity test passed"
    else
        log_error "Database connectivity test failed"
        return 1
    fi
    
    # Check replication
    log_info "Checking replication status..."
    local replication_count=$(kubectl exec "$primary" -n "$NAMESPACE" -- psql -U linkuser -d linkdb -tAc "SELECT count(*) FROM pg_stat_replication;")
    if [[ "$replication_count" -gt 0 ]]; then
        log_success "Replication is working ($replication_count replicas)"
    else
        log_warning "No active replication connections"
    fi
    
    # Check PgBouncer
    if kubectl get deployment pgbouncer -n "$NAMESPACE" &>/dev/null; then
        log_info "Testing PgBouncer connectivity..."
        if kubectl exec deployment/pgbouncer -n "$NAMESPACE" -- timeout 10 psql -h localhost -p 5432 -U linkuser -d linkdb -c "SELECT 1;" &>/dev/null; then
            log_success "PgBouncer connectivity test passed"
        else
            log_warning "PgBouncer connectivity test failed"
        fi
    fi
    
    # Check monitoring
    if kubectl get servicemonitor postgres-cluster-monitor -n "$NAMESPACE" &>/dev/null; then
        log_success "Monitoring configuration found"
    else
        log_warning "Monitoring configuration not found"
    fi
    
    log_success "Deployment verification completed"
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back PostgreSQL HA deployment..."
    
    # This is a simplified rollback - in production you'd want more sophisticated logic
    log_warning "Rollback functionality is basic - use with caution in production"
    
    if [[ "${DEPLOYMENT_METHOD:-manifests}" == "helm" ]]; then
        if command -v helm &> /dev/null; then
            helm rollback postgres-ha --namespace "$NAMESPACE"
        fi
    elif [[ "${DEPLOYMENT_METHOD:-manifests}" == "argocd" ]]; then
        log_info "For ArgoCD rollback, use ArgoCD UI or CLI to rollback applications"
    else
        log_warning "Manual rollback for raw manifests is not automated"
        log_info "Consider reverting to previous Git commit and re-running deployment"
    fi
}

# Main deployment function
main() {
    parse_args "$@"
    
    log_info "PostgreSQL HA Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"
    log_info "Namespace: $NAMESPACE"
    log_info "Deployment method: ${DEPLOYMENT_METHOD:-manifests}"
    
    validate_prerequisites
    
    case "$ACTION" in
        deploy|upgrade)
            if [[ "$ACTION" == "upgrade" ]]; then
                check_cluster_health || log_warning "Proceeding with upgrade despite health issues"
            fi
            
            case "${DEPLOYMENT_METHOD:-manifests}" in
                helm)
                    deploy_helm
                    ;;
                argocd)
                    deploy_argocd
                    ;;
                *)
                    deploy_manifests
                    ;;
            esac
            
            verify_deployment
            ;;
        verify)
            verify_deployment
            ;;
        rollback)
            rollback_deployment
            ;;
        *)
            log_error "Unknown action: $ACTION"
            show_help
            exit 1
            ;;
    esac
    
    log_success "PostgreSQL HA $ACTION completed successfully!"
}

# Run main function with all arguments
main "$@"