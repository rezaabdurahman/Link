#!/bin/bash

# ArgoCD Health Check and Status Script
# Usage: ./argocd-health-check.sh [options]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ARGOCD_SERVER="${ARGOCD_SERVER:-}"
ARGOCD_USERNAME="${ARGOCD_USERNAME:-admin}"
ARGOCD_PASSWORD="${ARGOCD_PASSWORD:-}"
OUTPUT_FORMAT="table" # table, json, yaml
WATCH_MODE=false
WATCH_INTERVAL=30

# Application categories
INFRASTRUCTURE_APPS=(
    "link-prerequisites"
    "external-secrets-operator"
    "cert-manager"
    "ingress-nginx"
    "postgres-ha-operator"
    "postgres-ha-cluster"
    "postgres-ha-pgbouncer"
    "redis-cluster-ha"
    "redis-sentinel-ha"
    "qdrant-cluster"
    "qdrant-backup"
    "linkerd-config"
    "linkerd-monitoring"
)

MONITORING_APPS=(
    "prometheus-stack"
    "loki-stack"
    "jaeger-tracing"
    "custom-dashboards"
    "alert-rules"
)

MICROSERVICE_APPS=(
    "user-svc"
    "chat-svc"
    "ai-svc"
    "discovery-svc"
    "search-svc"
    "api-gateway"
)

APPLICATION_APPS=(
    "link-app-dev"
    "link-app-staging"
    "link-app-production"
    "link-frontend"
)

# Helper functions
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

log_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

usage() {
    echo "ArgoCD Health Check and Status Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -s, --server <url>     ArgoCD server URL"
    echo "  -u, --username <user>  ArgoCD username (default: admin)"
    echo "  -p, --password <pass>  ArgoCD password"
    echo "  -f, --format <format>  Output format (table|json|yaml, default: table)"
    echo "  -w, --watch           Watch mode (refresh every 30 seconds)"
    echo "  -i, --interval <sec>  Watch interval in seconds (default: 30)"
    echo "  -c, --category <cat>  Check specific category (infra|monitoring|microservices|apps|all)"
    echo "  --summary             Show only summary statistics"
    echo "  --unhealthy-only      Show only unhealthy applications"
    echo "  --export <file>       Export report to file"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ARGOCD_SERVER         ArgoCD server URL"
    echo "  ARGOCD_USERNAME       ArgoCD username"
    echo "  ARGOCD_PASSWORD       ArgoCD password"
    echo ""
    echo "Examples:"
    echo "  $0 --server https://argocd.example.com --username admin"
    echo "  $0 --category infra --format json"
    echo "  $0 --watch --interval 60"
    echo "  $0 --unhealthy-only --export health-report.json"
}

check_dependencies() {
    local missing_deps=()
    
    if ! command -v argocd &> /dev/null; then
        missing_deps+=("argocd")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        echo "To install ArgoCD CLI:"
        echo "  curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64"
        echo "  chmod +x argocd"
        echo "  sudo mv argocd /usr/local/bin/"
        echo ""
        echo "To install jq:"
        echo "  sudo apt-get install jq  # Ubuntu/Debian"
        echo "  sudo yum install jq     # RHEL/CentOS"
        echo "  brew install jq         # macOS"
        exit 1
    fi
}

login_to_argocd() {
    if [ -z "$ARGOCD_SERVER" ]; then
        log_error "ArgoCD server not specified. Use --server option or ARGOCD_SERVER env var."
        exit 1
    fi
    
    if [ -z "$ARGOCD_PASSWORD" ]; then
        read -s -p "Enter ArgoCD password: " ARGOCD_PASSWORD
        echo
    fi
    
    log_info "Logging into ArgoCD server: $ARGOCD_SERVER"
    
    if argocd login "$ARGOCD_SERVER" --username "$ARGOCD_USERNAME" --password "$ARGOCD_PASSWORD" --insecure >/dev/null 2>&1; then
        log_success "Successfully logged into ArgoCD"
    else
        log_error "Failed to login to ArgoCD"
        exit 1
    fi
}

get_application_status() {
    local app_name="$1"
    local status_json
    
    if status_json=$(argocd app get "$app_name" -o json 2>/dev/null); then
        local health=$(echo "$status_json" | jq -r '.status.health.status // "Unknown"')
        local sync=$(echo "$status_json" | jq -r '.status.sync.status // "Unknown"')
        local revision=$(echo "$status_json" | jq -r '.status.sync.revision[0:7] // "Unknown"')
        local operation=$(echo "$status_json" | jq -r '.status.operationState.phase // "None"')
        local message=$(echo "$status_json" | jq -r '.status.health.message // ""' | cut -c1-50)
        
        echo "$app_name|$health|$sync|$revision|$operation|$message"
    else
        echo "$app_name|NotFound|NotFound|Unknown|None|Application not found"
    fi
}

format_health_status() {
    local health="$1"
    case "$health" in
        "Healthy")
            echo -e "${GREEN}✅ $health${NC}"
            ;;
        "Progressing")
            echo -e "${YELLOW}⏳ $health${NC}"
            ;;
        "Degraded")
            echo -e "${RED}❌ $health${NC}"
            ;;
        "Suspended")
            echo -e "${PURPLE}⏸️  $health${NC}"
            ;;
        "Missing")
            echo -e "${RED}❓ $health${NC}"
            ;;
        "Unknown"|"NotFound")
            echo -e "${CYAN}❔ $health${NC}"
            ;;
        *)
            echo "$health"
            ;;
    esac
}

format_sync_status() {
    local sync="$1"
    case "$sync" in
        "Synced")
            echo -e "${GREEN}✅ $sync${NC}"
            ;;
        "OutOfSync")
            echo -e "${YELLOW}⚠️  $sync${NC}"
            ;;
        "Unknown"|"NotFound")
            echo -e "${CYAN}❔ $sync${NC}"
            ;;
        *)
            echo "$sync"
            ;;
    esac
}

generate_summary() {
    local category="$1"
    local -n apps_ref=$2
    local total=0
    local healthy=0
    local degraded=0
    local progressing=0
    local synced=0
    local out_of_sync=0
    
    for app in "${apps_ref[@]}"; do
        local status=$(get_application_status "$app")
        IFS='|' read -r name health sync revision operation message <<< "$status"
        
        ((total++))
        
        case "$health" in
            "Healthy") ((healthy++)) ;;
            "Degraded") ((degraded++)) ;;
            "Progressing") ((progressing++)) ;;
        esac
        
        case "$sync" in
            "Synced") ((synced++)) ;;
            "OutOfSync") ((out_of_sync++)) ;;
        esac
    done
    
    echo ""
    log_header "$category Summary"
    echo "Total Applications: $total"
    echo -e "Health Status:"
    echo -e "  ${GREEN}Healthy:${NC}     $healthy"
    echo -e "  ${YELLOW}Progressing:${NC} $progressing"
    echo -e "  ${RED}Degraded:${NC}    $degraded"
    echo -e "  ${CYAN}Other:${NC}       $((total - healthy - progressing - degraded))"
    echo ""
    echo -e "Sync Status:"
    echo -e "  ${GREEN}Synced:${NC}      $synced"
    echo -e "  ${YELLOW}OutOfSync:${NC}   $out_of_sync"
    echo -e "  ${CYAN}Other:${NC}        $((total - synced - out_of_sync))"
    echo ""
}

display_applications() {
    local category="$1"
    local -n apps_ref=$2
    local show_unhealthy_only="${3:-false}"
    
    if [ "$OUTPUT_FORMAT" = "table" ]; then
        log_header "$category Applications"
        printf "%-20s %-12s %-12s %-10s %-12s %-30s\n" "Application" "Health" "Sync" "Revision" "Operation" "Message"
        printf "%-20s %-12s %-12s %-10s %-12s %-30s\n" "----------" "------" "----" "--------" "---------" "-------"
    fi
    
    for app in "${apps_ref[@]}"; do
        local status=$(get_application_status "$app")
        IFS='|' read -r name health sync revision operation message <<< "$status"
        
        # Skip healthy apps if showing unhealthy only
        if [ "$show_unhealthy_only" = "true" ] && [ "$health" = "Healthy" ] && [ "$sync" = "Synced" ]; then
            continue
        fi
        
        case "$OUTPUT_FORMAT" in
            "table")
                printf "%-20s %-12s %-12s %-10s %-12s %-30s\n" \
                    "$name" \
                    "$(format_health_status "$health")" \
                    "$(format_sync_status "$sync")" \
                    "$revision" \
                    "$operation" \
                    "$message"
                ;;
            "json")
                jq -n \
                    --arg name "$name" \
                    --arg health "$health" \
                    --arg sync "$sync" \
                    --arg revision "$revision" \
                    --arg operation "$operation" \
                    --arg message "$message" \
                    '{name: $name, health: $health, sync: $sync, revision: $revision, operation: $operation, message: $message}'
                ;;
            "yaml")
                echo "- name: $name"
                echo "  health: $health"
                echo "  sync: $sync"
                echo "  revision: $revision"
                echo "  operation: $operation"
                echo "  message: $message"
                ;;
        esac
    done
    
    if [ "$OUTPUT_FORMAT" = "table" ]; then
        echo ""
    fi
}

check_category() {
    local category="$1"
    local show_summary="${2:-false}"
    local show_unhealthy_only="${3:-false}"
    
    case "$category" in
        "infra"|"infrastructure")
            if [ "$show_summary" = "true" ]; then
                generate_summary "Infrastructure" INFRASTRUCTURE_APPS
            else
                display_applications "Infrastructure" INFRASTRUCTURE_APPS "$show_unhealthy_only"
            fi
            ;;
        "monitoring")
            if [ "$show_summary" = "true" ]; then
                generate_summary "Monitoring" MONITORING_APPS
            else
                display_applications "Monitoring" MONITORING_APPS "$show_unhealthy_only"
            fi
            ;;
        "microservices")
            if [ "$show_summary" = "true" ]; then
                generate_summary "Microservices" MICROSERVICE_APPS
            else
                display_applications "Microservices" MICROSERVICE_APPS "$show_unhealthy_only"
            fi
            ;;
        "apps"|"applications")
            if [ "$show_summary" = "true" ]; then
                generate_summary "Applications" APPLICATION_APPS
            else
                display_applications "Applications" APPLICATION_APPS "$show_unhealthy_only"
            fi
            ;;
        "all")
            check_category "infra" "$show_summary" "$show_unhealthy_only"
            check_category "monitoring" "$show_summary" "$show_unhealthy_only"
            check_category "microservices" "$show_summary" "$show_unhealthy_only"
            check_category "apps" "$show_summary" "$show_unhealthy_only"
            ;;
        *)
            log_error "Unknown category: $category"
            log_info "Available categories: infra, monitoring, microservices, apps, all"
            exit 1
            ;;
    esac
}

main() {
    local category="all"
    local show_summary=false
    local show_unhealthy_only=false
    local export_file=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--server)
                ARGOCD_SERVER="$2"
                shift 2
                ;;
            -u|--username)
                ARGOCD_USERNAME="$2"
                shift 2
                ;;
            -p|--password)
                ARGOCD_PASSWORD="$2"
                shift 2
                ;;
            -f|--format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            -w|--watch)
                WATCH_MODE=true
                shift
                ;;
            -i|--interval)
                WATCH_INTERVAL="$2"
                shift 2
                ;;
            -c|--category)
                category="$2"
                shift 2
                ;;
            --summary)
                show_summary=true
                shift
                ;;
            --unhealthy-only)
                show_unhealthy_only=true
                shift
                ;;
            --export)
                export_file="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Check dependencies
    check_dependencies
    
    # Login to ArgoCD
    login_to_argocd
    
    # Main execution
    if [ "$WATCH_MODE" = "true" ]; then
        log_info "Starting watch mode (refresh every ${WATCH_INTERVAL}s). Press Ctrl+C to exit."
        echo ""
        
        while true; do
            clear
            echo "$(date): ArgoCD Health Check - Watch Mode"
            echo ""
            
            check_category "$category" "$show_summary" "$show_unhealthy_only"
            
            sleep "$WATCH_INTERVAL"
        done
    else
        check_category "$category" "$show_summary" "$show_unhealthy_only"
        
        # Export to file if requested
        if [ -n "$export_file" ]; then
            log_info "Exporting report to: $export_file"
            check_category "$category" "$show_summary" "$show_unhealthy_only" > "$export_file"
            log_success "Report exported successfully"
        fi
    fi
}

# Handle interruption gracefully
trap 'echo -e "\n${YELLOW}Watch mode interrupted${NC}"; exit 0' INT

# Run main function with all arguments
main "$@"