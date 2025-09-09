#!/bin/bash
# Unified Monitoring Stack Control Script
# Manages monitoring profiles and components with automatic environment detection
# Supports both Docker Compose (development) and Kubernetes (production)

set -e

# Load service registry
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PROJECT_ROOT/scripts/services.conf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$PROJECT_ROOT/monitoring"
K8S_DIR="$PROJECT_ROOT/k8s"
BACKUP_DIR="$PROJECT_ROOT/backups/monitoring"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

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

# Environment detection
detect_environment() {
    if kubectl cluster-info >/dev/null 2>&1; then
        echo "kubernetes"
    elif command -v docker-compose >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/backend/docker-compose.yml" ]; then
        echo "docker-compose"
    else
        echo "unknown"
    fi
}

# Check prerequisites for each environment
check_prerequisites() {
    local env=$1
    
    case "$env" in
        kubernetes)
            if ! command -v kubectl >/dev/null 2>&1; then
                log_error "kubectl not found. Please install kubectl for Kubernetes operations."
                exit 1
            fi
            
            if ! kubectl cluster-info >/dev/null 2>&1; then
                log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
                exit 1
            fi
            ;;
        docker-compose)
            if ! command -v docker-compose >/dev/null 2>&1; then
                log_error "docker-compose not found. Please install Docker Compose."
                exit 1
            fi
            
            if ! docker info >/dev/null 2>&1; then
                log_error "Docker daemon not running. Please start Docker."
                exit 1
            fi
            ;;
        *)
            log_error "Unknown environment. Cannot proceed without Docker Compose or Kubernetes."
            exit 1
            ;;
    esac
}

# Docker Compose monitoring operations
docker_compose_start() {
    local profile=${1:-development}
    
    log_info "Starting monitoring stack with $profile profile (Docker Compose)..."
    
    cd "$MONITORING_DIR"
    
    # Configure profile-specific settings
    configure_docker_profile "$profile"
    
    # Start monitoring services
    docker-compose -f docker-compose.monitoring.yml up -d
    
    log_success "Monitoring stack started successfully"
    log_info "Access points:"
    log_info "  - Grafana: http://localhost:3000"
    log_info "  - Prometheus: http://localhost:9090"
    log_info "  - AlertManager: http://localhost:9093"
}

docker_compose_stop() {
    log_info "Stopping monitoring stack (Docker Compose)..."
    
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.monitoring.yml down
    
    log_success "Monitoring stack stopped"
}

docker_compose_status() {
    log_info "Monitoring stack status (Docker Compose):"
    
    cd "$MONITORING_DIR"
    if [ -f docker-compose.monitoring.yml ]; then
        docker-compose -f docker-compose.monitoring.yml ps
    else
        log_warning "Docker Compose monitoring configuration not found"
    fi
}

docker_compose_logs() {
    local service=${1:-}
    
    cd "$MONITORING_DIR"
    if [ -n "$service" ]; then
        log_info "Showing logs for $service..."
        docker-compose -f docker-compose.monitoring.yml logs -f "$service"
    else
        log_info "Showing logs for all monitoring services..."
        docker-compose -f docker-compose.monitoring.yml logs -f
    fi
}

# Kubernetes monitoring operations
k8s_start() {
    local profile=${1:-production}
    
    log_info "Starting monitoring stack with $profile profile (Kubernetes)..."
    
    # Configure profile-specific settings
    configure_k8s_profile "$profile"
    
    # Apply monitoring manifests
    if [ -f "$K8S_DIR/argocd/monitoring-apps.yaml" ]; then
        kubectl apply -f "$K8S_DIR/argocd/monitoring-apps.yaml"
        log_success "ArgoCD monitoring applications deployed"
    else
        log_warning "ArgoCD monitoring configuration not found, applying direct manifests"
        kubectl apply -f "$K8S_DIR/monitoring/"
    fi
    
    # Wait for deployments to be ready
    log_info "Waiting for monitoring services to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment -l app.kubernetes.io/component=monitoring
    
    log_success "Monitoring stack started successfully"
}

k8s_stop() {
    log_info "Stopping monitoring stack (Kubernetes)..."
    
    if [ -f "$K8S_DIR/argocd/monitoring-apps.yaml" ]; then
        kubectl delete -f "$K8S_DIR/argocd/monitoring-apps.yaml"
    else
        kubectl delete -f "$K8S_DIR/monitoring/"
    fi
    
    log_success "Monitoring stack stopped"
}

k8s_status() {
    log_info "Monitoring stack status (Kubernetes):"
    
    # Check monitoring namespace
    if kubectl get namespace monitoring >/dev/null 2>&1; then
        echo ""
        log_info "Monitoring Pods:"
        kubectl get pods -n monitoring
        
        echo ""
        log_info "Monitoring Services:"
        kubectl get services -n monitoring
        
        echo ""
        log_info "Monitoring Ingresses:"
        kubectl get ingresses -n monitoring 2>/dev/null || log_info "No ingresses configured"
    else
        log_warning "Monitoring namespace not found"
    fi
}

k8s_logs() {
    local service=${1:-}
    
    if [ -n "$service" ]; then
        log_info "Showing logs for $service in Kubernetes..."
        kubectl logs -f -l app="$service" -n monitoring
    else
        log_info "Available monitoring services:"
        kubectl get pods -n monitoring -o jsonpath='{range .items[*]}{.metadata.labels.app}{"\n"}{end}' | sort | uniq
    fi
}

# Profile configuration functions
configure_docker_profile() {
    local profile=$1
    
    log_info "Configuring Docker Compose profile: $profile"
    
    # Create profile-specific environment file
    cat > "$MONITORING_DIR/.env.profile" <<EOF
# Monitoring Profile: $profile
MONITORING_PROFILE=$profile
RETENTION_TIME=$( [ "$profile" = "production" ] && echo "30d" || echo "7d" )
SCRAPE_INTERVAL=$( [ "$profile" = "development" ] && echo "30s" || echo "15s" )
EVALUATION_INTERVAL=$( [ "$profile" = "development" ] && echo "30s" || echo "15s" )
GRAFANA_ADMIN_PASSWORD=admin123
POSTGRES_PASSWORD=monitoring123
EOF
    
    log_success "Profile configuration created"
}

configure_k8s_profile() {
    local profile=$1
    
    log_info "Configuring Kubernetes profile: $profile"
    
    # Update monitoring profile ConfigMap
    if [ -f "$K8S_DIR/monitoring-profiles.env" ]; then
        kubectl create configmap monitoring-profile \
            --from-env-file="$K8S_DIR/monitoring-profiles.env" \
            --namespace=monitoring \
            --dry-run=client -o yaml | kubectl apply -f -
        
        log_success "Monitoring profile ConfigMap updated"
    else
        log_warning "Monitoring profiles configuration not found"
    fi
}

# Health check function
health_check() {
    local env=$1
    
    log_info "Running health check for monitoring stack..."
    
    case "$env" in
        docker-compose)
            # Check if containers are running
            cd "$MONITORING_DIR"
            if docker-compose -f docker-compose.monitoring.yml ps | grep -q "Up"; then
                log_success "Monitoring containers are running"
                
                # Check service endpoints
                check_endpoint "Grafana" "http://localhost:3000/api/health"
                check_endpoint "Prometheus" "http://localhost:9090/-/healthy"
                check_endpoint "AlertManager" "http://localhost:9093/-/healthy"
            else
                log_error "Monitoring containers are not running"
                return 1
            fi
            ;;
        kubernetes)
            # Check pod status
            if kubectl get pods -n monitoring --no-headers 2>/dev/null | grep -v Running | grep -v Completed; then
                log_warning "Some monitoring pods are not in Running state"
            else
                log_success "All monitoring pods are running"
            fi
            ;;
    esac
}

# Endpoint health check helper
check_endpoint() {
    local name=$1
    local url=$2
    
    if curl -sf "$url" >/dev/null 2>&1; then
        log_success "$name is healthy"
    else
        log_warning "$name health check failed"
    fi
}

# Backup function
backup_monitoring() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="$BACKUP_DIR/backup_$timestamp"
    
    log_info "Creating monitoring backup..."
    mkdir -p "$backup_path"
    
    # Backup configuration
    cp -r "$MONITORING_DIR" "$backup_path/"
    
    # Backup Grafana dashboards if available
    if command -v curl >/dev/null 2>&1; then
        mkdir -p "$backup_path/grafana_dashboards"
        # This would backup Grafana dashboards via API
        # curl commands would go here
    fi
    
    log_success "Backup created: $backup_path"
}

# Usage function
show_usage() {
    cat << EOF
Usage: $0 <command> [options]

Unified monitoring stack control with automatic environment detection.

COMMANDS:
    start [profile]     Start monitoring stack (development|staging|production)
    stop                Stop monitoring stack
    status              Show monitoring stack status
    logs [service]      Show logs for monitoring services
    health              Run health check
    backup              Backup monitoring configuration
    help                Show this help message

PROFILES:
    development         Light monitoring for local development
    staging             Full monitoring with shorter retention
    production          Full monitoring with long retention

EXAMPLES:
    $0 start                    # Start with auto-detected profile
    $0 start development        # Start with development profile
    $0 status                   # Show current status
    $0 logs grafana            # Show Grafana logs
    $0 health                   # Run health check

ENVIRONMENT:
    Automatically detects Docker Compose or Kubernetes environment
    - Docker Compose: Local development
    - Kubernetes: Staging/Production
EOF
}

# Main execution
main() {
    local command=${1:-help}
    local arg1=${2:-}
    
    # Detect environment
    local env=$(detect_environment)
    log_info "Detected environment: $env"
    
    # Check prerequisites
    check_prerequisites "$env"
    
    # Execute command based on environment
    case "$command" in
        start)
            case "$env" in
                docker-compose)
                    docker_compose_start "$arg1"
                    ;;
                kubernetes)
                    k8s_start "$arg1"
                    ;;
            esac
            ;;
        stop)
            case "$env" in
                docker-compose)
                    docker_compose_stop
                    ;;
                kubernetes)
                    k8s_stop
                    ;;
            esac
            ;;
        status)
            case "$env" in
                docker-compose)
                    docker_compose_status
                    ;;
                kubernetes)
                    k8s_status
                    ;;
            esac
            ;;
        logs)
            case "$env" in
                docker-compose)
                    docker_compose_logs "$arg1"
                    ;;
                kubernetes)
                    k8s_logs "$arg1"
                    ;;
            esac
            ;;
        health)
            health_check "$env"
            ;;
        backup)
            backup_monitoring
            ;;
        help|--help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"