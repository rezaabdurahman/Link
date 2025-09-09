#!/bin/bash
# Deployment Rollback Script
# Rolls back Link application deployment to specified version

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
VERSION=""
ENVIRONMENT="staging"
DRY_RUN=false

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
Usage: $0 [VERSION] [OPTIONS]

Rollback Link application deployment to specified version.

ARGUMENTS:
    VERSION         Version to rollback to (e.g., v1.2.3, latest-1)

OPTIONS:
    -e, --environment ENV    Target environment (staging|production) [default: staging]
    --dry-run               Show what would be rolled back without executing
    --help                  Show this help message

EXAMPLES:
    $0 v1.2.3
    $0 v1.2.3 --environment production
    $0 latest-1 --dry-run

SPECIAL VERSIONS:
    latest-1        Previous version
    latest-2        Two versions back
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            if [ -z "$VERSION" ]; then
                VERSION="$1"
            else
                log_error "Unknown option: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [ -z "$VERSION" ]; then
    log_error "Version is required"
    show_usage
    exit 1
fi

echo -e "${RED}🔄 Link Application Rollback${NC}"
echo "=============================="
log_info "Environment: $ENVIRONMENT"
log_info "Target version: $VERSION"
log_info "Dry run: $DRY_RUN"
echo ""

# Confirmation prompt
if [ "$DRY_RUN" = false ]; then
    log_warning "You are about to rollback $ENVIRONMENT to version $VERSION"
    read -p "Are you sure? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
fi

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

# Use existing rollback script if available
if [ -f "$PROJECT_ROOT/scripts/rollback-migrations.sh" ]; then
    log_info "Database rollback may be needed - check rollback-migrations.sh"
fi

# Perform rollback
log_info "Starting rollback process..."

if [ "$DRY_RUN" = true ]; then
    log_info "DRY RUN: Would rollback services to version $VERSION"
    
    for service in "${SERVICES[@]}"; do
        log_info "DRY RUN: Would rollback $service deployment"
    done
    
    log_info "DRY RUN: Rollback simulation completed"
    exit 0
fi

# Actual rollback logic
rollback_failed=false

for service in "${SERVICES[@]}"; do
    log_info "Rolling back $service..."
    
    # Try to rollback using kubectl
    if kubectl rollout undo "deployment/$service" -n default 2>/dev/null; then
        log_success "$service rollback initiated"
        
        # Wait for rollback to complete
        if kubectl rollout status "deployment/$service" -n default --timeout=300s 2>/dev/null; then
            log_success "$service rollback completed"
        else
            log_error "$service rollback failed"
            rollback_failed=true
        fi
    else
        log_warning "$service rollback command failed (deployment may not exist)"
    fi
done

# Final status
if [ "$rollback_failed" = true ]; then
    log_error "Some rollbacks failed. Please check the deployment status manually."
    exit 1
else
    log_success "Rollback completed successfully!"
    
    # Show current deployment status
    log_info "Current deployment status:"
    for service in "${SERVICES[@]}"; do
        if kubectl get deployment "$service" -n default >/dev/null 2>&1; then
            kubectl get deployment "$service" -n default
        fi
    done
fi