#!/bin/bash
# Kubernetes Monitoring Stack Control Script
# Manages monitoring profiles and ArgoCD applications for cost optimization
# Usage: ./scripts/k8s-monitoring-control.sh [profile] [options]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_ROOT/k8s"
MONITORING_PROFILES="$K8S_DIR/monitoring-profiles.env"
ARGOCD_MONITORING_APPS="$K8S_DIR/argocd/monitoring-apps.yaml"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check kubectl availability
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl to manage Kubernetes resources."
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
}

# Function to check ArgoCD availability
check_argocd() {
    if ! kubectl get namespace argocd &> /dev/null; then
        print_error "ArgoCD namespace not found. Please ensure ArgoCD is installed."
        exit 1
    fi
}

# Function to load and apply monitoring profile
apply_k8s_profile() {
    local profile="$1"
    
    print_status "Applying Kubernetes monitoring profile: $profile"
    
    # Load profile configuration
    if [[ ! -f "$MONITORING_PROFILES" ]]; then
        print_error "Monitoring profiles configuration not found: $MONITORING_PROFILES"
        exit 1
    fi
    
    # Source the profile configuration
    source "$MONITORING_PROFILES"
    
    # Set profile-specific environment variables
    case "$profile" in
        "minimal")
            export MONITORING_PROFILE="minimal"
            export PROMETHEUS_STORAGE="$MINIMAL_PROMETHEUS_STORAGE"
            export PROMETHEUS_RETENTION="$MINIMAL_PROMETHEUS_RETENTION"
            export PROMETHEUS_MEMORY="$MINIMAL_PROMETHEUS_MEMORY"
            export PROMETHEUS_CPU="$MINIMAL_PROMETHEUS_CPU"
            export PROMETHEUS_MEMORY_LIMIT="$MINIMAL_PROMETHEUS_MEMORY_LIMIT"
            export PROMETHEUS_CPU_LIMIT="$MINIMAL_PROMETHEUS_CPU_LIMIT"
            export GRAFANA_STORAGE="$MINIMAL_GRAFANA_STORAGE"
            export GRAFANA_MEMORY="$MINIMAL_GRAFANA_MEMORY"
            export GRAFANA_CPU="$MINIMAL_GRAFANA_CPU"
            export GRAFANA_MEMORY_LIMIT="$MINIMAL_GRAFANA_MEMORY_LIMIT"
            export GRAFANA_CPU_LIMIT="$MINIMAL_GRAFANA_CPU_LIMIT"
            export LOKI_ENABLED=false
            export JAEGER_ENABLED=false
            ;;
        "standard")
            export MONITORING_PROFILE="standard"
            export PROMETHEUS_STORAGE="$STANDARD_PROMETHEUS_STORAGE"
            export PROMETHEUS_RETENTION="$STANDARD_PROMETHEUS_RETENTION"
            export PROMETHEUS_MEMORY="$STANDARD_PROMETHEUS_MEMORY"
            export PROMETHEUS_CPU="$STANDARD_PROMETHEUS_CPU"
            export PROMETHEUS_MEMORY_LIMIT="$STANDARD_PROMETHEUS_MEMORY_LIMIT"
            export PROMETHEUS_CPU_LIMIT="$STANDARD_PROMETHEUS_CPU_LIMIT"
            export GRAFANA_STORAGE="$STANDARD_GRAFANA_STORAGE"
            export GRAFANA_MEMORY="$STANDARD_GRAFANA_MEMORY"
            export GRAFANA_CPU="$STANDARD_GRAFANA_CPU"
            export GRAFANA_MEMORY_LIMIT="$STANDARD_GRAFANA_MEMORY_LIMIT"
            export GRAFANA_CPU_LIMIT="$STANDARD_GRAFANA_CPU_LIMIT"
            export LOKI_ENABLED=true
            export LOKI_STORAGE="$STANDARD_LOKI_STORAGE"
            export LOKI_RETENTION="$STANDARD_LOKI_RETENTION"
            export LOKI_MEMORY="$STANDARD_LOKI_MEMORY"
            export LOKI_CPU="$STANDARD_LOKI_CPU"
            export LOKI_MEMORY_LIMIT="$STANDARD_LOKI_MEMORY_LIMIT"
            export LOKI_CPU_LIMIT="$STANDARD_LOKI_CPU_LIMIT"
            export LOKI_INGESTION_RATE="$STANDARD_LOKI_INGESTION_RATE"
            export LOKI_BURST_SIZE="$STANDARD_LOKI_BURST_SIZE"
            export JAEGER_ENABLED=true
            export JAEGER_STORAGE="$STANDARD_JAEGER_STORAGE"
            export JAEGER_ES_MEMORY="$STANDARD_JAEGER_ES_MEMORY"
            export JAEGER_ES_CPU="$STANDARD_JAEGER_ES_CPU"
            export JAEGER_ES_MEMORY_LIMIT="$STANDARD_JAEGER_ES_MEMORY_LIMIT"
            export JAEGER_ES_CPU_LIMIT="$STANDARD_JAEGER_ES_CPU_LIMIT"
            ;;
        "full")
            export MONITORING_PROFILE="full"
            export PROMETHEUS_STORAGE="$FULL_PROMETHEUS_STORAGE"
            export PROMETHEUS_RETENTION="$FULL_PROMETHEUS_RETENTION"
            export PROMETHEUS_MEMORY="$FULL_PROMETHEUS_MEMORY"
            export PROMETHEUS_CPU="$FULL_PROMETHEUS_CPU"
            export PROMETHEUS_MEMORY_LIMIT="$FULL_PROMETHEUS_MEMORY_LIMIT"
            export PROMETHEUS_CPU_LIMIT="$FULL_PROMETHEUS_CPU_LIMIT"
            export GRAFANA_STORAGE="$FULL_GRAFANA_STORAGE"
            export GRAFANA_MEMORY="$FULL_GRAFANA_MEMORY"
            export GRAFANA_CPU="$FULL_GRAFANA_CPU"
            export GRAFANA_MEMORY_LIMIT="$FULL_GRAFANA_MEMORY_LIMIT"
            export GRAFANA_CPU_LIMIT="$FULL_GRAFANA_CPU_LIMIT"
            export LOKI_ENABLED=true
            export LOKI_STORAGE="$FULL_LOKI_STORAGE"
            export LOKI_RETENTION="$FULL_LOKI_RETENTION"
            export LOKI_MEMORY="$FULL_LOKI_MEMORY"
            export LOKI_CPU="$FULL_LOKI_CPU"
            export LOKI_MEMORY_LIMIT="$FULL_LOKI_MEMORY_LIMIT"
            export LOKI_CPU_LIMIT="$FULL_LOKI_CPU_LIMIT"
            export LOKI_INGESTION_RATE="$FULL_LOKI_INGESTION_RATE"
            export LOKI_BURST_SIZE="$FULL_LOKI_BURST_SIZE"
            export JAEGER_ENABLED=true
            export JAEGER_STORAGE="$FULL_JAEGER_STORAGE"
            export JAEGER_ES_MEMORY="$FULL_JAEGER_ES_MEMORY"
            export JAEGER_ES_CPU="$FULL_JAEGER_ES_CPU"
            export JAEGER_ES_MEMORY_LIMIT="$FULL_JAEGER_ES_MEMORY_LIMIT"
            export JAEGER_ES_CPU_LIMIT="$FULL_JAEGER_ES_CPU_LIMIT"
            ;;
        *)
            print_error "Unknown profile: $profile"
            print_error "Available profiles: minimal, standard, full"
            exit 1
            ;;
    esac
    
    # Apply the monitoring applications
    print_status "Applying ArgoCD monitoring applications with $profile profile..."
    
    # Process and apply the monitoring apps YAML with environment variable substitution
    envsubst < "$ARGOCD_MONITORING_APPS" | kubectl apply -f -
    
    # Conditionally delete Loki and Jaeger apps if disabled
    if [[ "$LOKI_ENABLED" == "false" ]]; then
        print_status "Disabling Loki stack for $profile profile..."
        kubectl delete application loki-stack -n argocd --ignore-not-found=true
    fi
    
    if [[ "$JAEGER_ENABLED" == "false" ]]; then
        print_status "Disabling Jaeger tracing for $profile profile..."
        kubectl delete application jaeger-tracing -n argocd --ignore-not-found=true
    fi
    
    print_success "Monitoring profile '$profile' applied successfully to Kubernetes cluster"
    
    # Show status
    show_k8s_status
}

# Function to show Kubernetes monitoring status
show_k8s_status() {
    print_status "Kubernetes monitoring stack status:"
    
    echo ""
    print_status "ArgoCD Applications:"
    kubectl get applications -n argocd -l app.kubernetes.io/part-of=link-monitoring -o wide
    
    echo ""
    print_status "Monitoring Namespace Resources:"
    kubectl get all -n monitoring 2>/dev/null || print_warning "Monitoring namespace not found or empty"
    
    echo ""
    print_status "Resource Usage Summary:"
    kubectl top pods -n monitoring 2>/dev/null || print_warning "Metrics server not available for resource usage"
}

# Function to show profile comparison
show_profiles() {
    echo ""
    echo "Kubernetes Monitoring Profiles:"
    echo "==============================="
    echo ""
    
    echo -e "${BLUE}MINIMAL${NC} - Core metrics only (70% cost reduction)"
    echo "  ✓ Prometheus (10Gi, 3d retention, 1Gi RAM)"
    echo "  ✓ Grafana (5Gi, 256Mi RAM)"
    echo "  ✗ Loki (disabled)"
    echo "  ✗ Jaeger (disabled)"
    echo "  💰 ~$50/month estimated cost"
    echo ""
    
    echo -e "${YELLOW}STANDARD${NC} - Balanced monitoring (40% cost reduction)"
    echo "  ✓ Prometheus (20Gi, 7d retention, 2Gi RAM)"
    echo "  ✓ Grafana (10Gi, 512Mi RAM)"
    echo "  ✓ Loki (30Gi, 3d retention, 1Gi RAM)"
    echo "  ✓ Jaeger (20Gi, 1Gi RAM)"
    echo "  💰 ~$120/month estimated cost"
    echo ""
    
    echo -e "${GREEN}FULL${NC} - Complete observability (optimized)"
    echo "  ✓ Prometheus (50Gi, 14d retention, 4Gi RAM)"
    echo "  ✓ Grafana (15Gi, 1Gi RAM)"
    echo "  ✓ Loki (100Gi, 5d retention, 2Gi RAM)"
    echo "  ✓ Jaeger (30Gi, 2Gi RAM)"
    echo "  💰 ~$200/month estimated cost"
    echo ""
}

# Function to estimate costs
estimate_costs() {
    local profile="${1:-standard}"
    
    print_status "Cost estimation for $profile profile:"
    
    source "$MONITORING_PROFILES"
    
    case "$profile" in
        "minimal")
            local storage_cost=$(echo "scale=2; ($MINIMAL_PROMETHEUS_STORAGE + $MINIMAL_GRAFANA_STORAGE) * 0.10 * 24 * 30 / 1000" | bc -l 2>/dev/null || echo "15")
            local compute_cost=$(echo "scale=2; (1 + 0.25) * 0.05 * 24 * 30" | bc -l 2>/dev/null || echo "45")
            ;;
        "standard")
            local storage_cost=$(echo "scale=2; ($STANDARD_PROMETHEUS_STORAGE + $STANDARD_GRAFANA_STORAGE + $STANDARD_LOKI_STORAGE + $STANDARD_JAEGER_STORAGE) * 0.10 * 24 * 30 / 1000" | bc -l 2>/dev/null || echo "60")
            local compute_cost=$(echo "scale=2; (2 + 0.5 + 1 + 1) * 0.05 * 24 * 30" | bc -l 2>/dev/null || echo "160")
            ;;
        "full")
            local storage_cost=$(echo "scale=2; ($FULL_PROMETHEUS_STORAGE + $FULL_GRAFANA_STORAGE + $FULL_LOKI_STORAGE + $FULL_JAEGER_STORAGE) * 0.10 * 24 * 30 / 1000" | bc -l 2>/dev/null || echo "140")
            local compute_cost=$(echo "scale=2; (4 + 1 + 2 + 2) * 0.05 * 24 * 30" | bc -l 2>/dev/null || echo "320")
            ;;
    esac
    
    local total_cost=$(echo "scale=2; $storage_cost + $compute_cost" | bc -l 2>/dev/null || echo "200")
    
    echo "  💾 Storage: ~$${storage_cost:-60}/month"
    echo "  💻 Compute: ~$${compute_cost:-140}/month"
    echo "  💰 Total: ~$${total_cost:-200}/month"
}

# Function to show usage
show_usage() {
    echo "Kubernetes Monitoring Stack Control Script"
    echo "=========================================="
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  minimal         Apply minimal monitoring profile (core only)"
    echo "  standard        Apply standard monitoring profile (balanced)"
    echo "  full            Apply full monitoring profile (everything)"
    echo "  status          Show current Kubernetes monitoring status"
    echo "  profiles        Show available profiles and features"
    echo "  costs [profile] Show estimated costs for profile"
    echo "  cleanup         Remove all monitoring applications"
    echo "  help            Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 minimal                    # Apply minimal profile"
    echo "  $0 standard                   # Apply standard profile"  
    echo "  $0 costs full                 # Show cost estimate for full profile"
    echo "  $0 status                     # Show current status"
    echo ""
    echo "REQUIREMENTS:"
    echo "  - kubectl with cluster access"
    echo "  - ArgoCD installed in cluster"
    echo "  - envsubst command (usually in gettext package)"
    echo ""
}

# Function to cleanup monitoring applications
cleanup_monitoring() {
    print_warning "This will remove all monitoring applications from the cluster."
    echo -n "Are you sure? (y/N): "
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_status "Removing monitoring applications..."
        kubectl delete applications -n argocd -l app.kubernetes.io/part-of=link-monitoring --ignore-not-found=true
        print_success "Monitoring applications removed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main execution logic
main() {
    local command="${1:-help}"
    
    # Check prerequisites for most commands
    case "$command" in
        "minimal"|"standard"|"full"|"status"|"cleanup")
            check_kubectl
            check_argocd
            ;;
        "profiles"|"costs"|"help")
            # These commands don't require cluster access
            ;;
    esac
    
    # Execute command
    case "$command" in
        "minimal"|"standard"|"full")
            apply_k8s_profile "$command"
            ;;
        "status")
            show_k8s_status
            ;;
        "profiles")
            show_profiles
            ;;
        "costs")
            estimate_costs "${2:-standard}"
            ;;
        "cleanup")
            cleanup_monitoring
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"