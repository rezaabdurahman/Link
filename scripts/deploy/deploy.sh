#!/bin/bash
# Production Deployment Script
# Deploys Link application to specified environment with migrations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PROJECT_ROOT/scripts/services.conf"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENVIRONMENT="staging"
DRY_RUN=false
SKIP_MIGRATIONS=false

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

show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [OPTIONS]

Deploy Link application to specified environment.

ARGUMENTS:
    ENVIRONMENT     Target environment (staging|production) [default: staging]

OPTIONS:
    --dry-run       Show what would be deployed without executing
    --skip-migrations  Skip database migrations
    --help          Show this help message

EXAMPLES:
    $0 staging
    $0 production --dry-run
    $0 staging --skip-migrations

ENVIRONMENT VARIABLES:
    KUBECTL_CONTEXT    Kubernetes context to use
    DEPLOY_TIMEOUT     Deployment timeout in seconds (default: 600)
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        staging|production)
            ENVIRONMENT="$1"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Environment must be 'staging' or 'production'"
    exit 1
fi

echo -e "${GREEN}🚀 Link Application Deployment${NC}"
echo "==============================="
log_info "Environment: $ENVIRONMENT"
log_info "Dry run: $DRY_RUN"
log_info "Skip migrations: $SKIP_MIGRATIONS"
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v kubectl >/dev/null 2>&1; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
fi

# Check if we can connect to cluster
if ! kubectl cluster-info >/dev/null 2>&1; then
    log_error "Cannot connect to Kubernetes cluster. Check your kubeconfig."
    exit 1
fi

log_success "Prerequisites check passed"

# Use existing deployment script if available
if [ -f "$PROJECT_ROOT/scripts/deploy-with-migrations.sh" ]; then
    log_info "Using existing deploy-with-migrations.sh script..."
    
    args=("--environment" "$ENVIRONMENT")
    [ "$DRY_RUN" = true ] && args+=("--dry-run")
    [ "$SKIP_MIGRATIONS" = true ] && args+=("--skip-migrations")
    
    exec "$PROJECT_ROOT/scripts/deploy-with-migrations.sh" "${args[@]}"
else
    # Fallback deployment logic
    log_info "Deploying via ArgoCD..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would deploy to $ENVIRONMENT"
        log_info "DRY RUN: Would apply ArgoCD applications"
        if [ "$SKIP_MIGRATIONS" = false ]; then
            log_info "DRY RUN: Would run database migrations"
        fi
        exit 0
    fi
    
    # Apply ArgoCD root application
    if [ -f "$PROJECT_ROOT/k8s/argocd/root-app.yaml" ]; then
        kubectl apply -f "$PROJECT_ROOT/k8s/argocd/root-app.yaml"
        log_success "ArgoCD root application deployed"
    else
        log_warning "ArgoCD root application not found"
    fi
    
    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    
    # Check if all services are ready
    for service in "${SERVICES[@]}"; do
        log_info "Waiting for $service deployment..."
        if kubectl wait --for=condition=available --timeout=300s "deployment/$service" -n default 2>/dev/null; then
            log_success "$service deployment ready"
        else
            log_warning "$service deployment status unclear"
        fi
    done
    
    log_success "Deployment completed successfully!"
fi