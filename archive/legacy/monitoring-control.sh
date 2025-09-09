#!/bin/bash
# Monitoring Stack Control Script
# Provides easy management of monitoring profiles and components
# Usage: ./scripts/monitoring-control.sh [profile] [options]

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
MONITORING_DIR="$PROJECT_ROOT/monitoring"
PROFILES_FILE="$MONITORING_DIR/.env.profiles"
DOCKER_COMPOSE_FILE="$MONITORING_DIR/docker-compose.monitoring.yml"
BACKUP_DIR="$PROJECT_ROOT/backups/monitoring"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

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

# Function to configure profile-specific configuration files
configure_profile_files() {
    local profile="$1"
    
    print_status "Configuring $profile profile settings..."
    
    # Configure Prometheus settings
    case "$profile" in
        "minimal")
            if [[ -f "prometheus/minimal-prometheus.yml" ]]; then
                cp "prometheus/minimal-prometheus.yml" "prometheus/prometheus.yml"
            fi
            if [[ -f "loki/minimal-config.yaml" ]]; then
                cp "loki/minimal-config.yaml" "loki/local-config.yaml"
            fi
            ;;
        "standard")
            if [[ -f "prometheus/standard-prometheus.yml" ]]; then
                cp "prometheus/standard-prometheus.yml" "prometheus/prometheus.yml"
            fi
            if [[ -f "loki/standard-config.yaml" ]]; then
                cp "loki/standard-config.yaml" "loki/local-config.yaml"
            fi
            ;;
        "full")
            # Use original configs (assuming they are already optimized for full)
            if [[ -f "prometheus/prometheus.yml.original" ]]; then
                cp "prometheus/prometheus.yml.original" "prometheus/prometheus.yml"
            fi
            if [[ -f "loki/local-config.yaml.original" ]]; then
                cp "loki/local-config.yaml.original" "loki/local-config.yaml"
            fi
            ;;
        "custom")
            # For custom profile, use standard as base and let environment variables override
            if [[ -f "prometheus/standard-prometheus.yml" ]]; then
                cp "prometheus/standard-prometheus.yml" "prometheus/prometheus.yml"
            fi
            if [[ -f "loki/standard-config.yaml" ]]; then
                cp "loki/standard-config.yaml" "loki/local-config.yaml"
            fi
            ;;
    esac
}

# Function to load profile configuration
load_profile() {
    local profile="$1"
    
    if [[ ! -f "$PROFILES_FILE" ]]; then
        print_error "Profile configuration file not found: $PROFILES_FILE"
        exit 1
    fi
    
    # Source the profiles file
    source "$PROFILES_FILE"
    
    # Set the monitoring profile
    export MONITORING_PROFILE="$profile"
    
    # Load profile-specific variables
    case "$profile" in
        "minimal")
            export PROMETHEUS_ENABLED="$MINIMAL_PROMETHEUS_ENABLED"
            export GRAFANA_ENABLED="$MINIMAL_GRAFANA_ENABLED"
            export NODE_EXPORTER_ENABLED="$MINIMAL_NODE_EXPORTER_ENABLED"
            export CADVISOR_ENABLED="$MINIMAL_CADVISOR_ENABLED"
            export LOKI_ENABLED="$MINIMAL_LOKI_ENABLED"
            export PROMTAIL_ENABLED="$MINIMAL_PROMTAIL_ENABLED"
            export JAEGER_ENABLED="$MINIMAL_JAEGER_ENABLED"
            export ALERTMANAGER_ENABLED="$MINIMAL_ALERTMANAGER_ENABLED"
            export REDIS_EXPORTER_ENABLED="$MINIMAL_REDIS_EXPORTER_ENABLED"
            export POSTGRES_EXPORTER_ENABLED="$MINIMAL_POSTGRES_EXPORTER_ENABLED"
            export BLACKBOX_EXPORTER_ENABLED="$MINIMAL_BLACKBOX_EXPORTER_ENABLED"
            export PROMETHEUS_RETENTION="$MINIMAL_PROMETHEUS_RETENTION"
            export LOKI_RETENTION="$MINIMAL_LOKI_RETENTION"
            export JAEGER_SAMPLING="$MINIMAL_JAEGER_SAMPLING"
            ;;
        "standard")
            export PROMETHEUS_ENABLED="$STANDARD_PROMETHEUS_ENABLED"
            export GRAFANA_ENABLED="$STANDARD_GRAFANA_ENABLED"
            export NODE_EXPORTER_ENABLED="$STANDARD_NODE_EXPORTER_ENABLED"
            export CADVISOR_ENABLED="$STANDARD_CADVISOR_ENABLED"
            export LOKI_ENABLED="$STANDARD_LOKI_ENABLED"
            export PROMTAIL_ENABLED="$STANDARD_PROMTAIL_ENABLED"
            export JAEGER_ENABLED="$STANDARD_JAEGER_ENABLED"
            export ALERTMANAGER_ENABLED="$STANDARD_ALERTMANAGER_ENABLED"
            export REDIS_EXPORTER_ENABLED="$STANDARD_REDIS_EXPORTER_ENABLED"
            export POSTGRES_EXPORTER_ENABLED="$STANDARD_POSTGRES_EXPORTER_ENABLED"
            export BLACKBOX_EXPORTER_ENABLED="$STANDARD_BLACKBOX_EXPORTER_ENABLED"
            export PROMETHEUS_RETENTION="$STANDARD_PROMETHEUS_RETENTION"
            export LOKI_RETENTION="$STANDARD_LOKI_RETENTION"
            export JAEGER_SAMPLING="$STANDARD_JAEGER_SAMPLING"
            ;;
        "full")
            export PROMETHEUS_ENABLED="$FULL_PROMETHEUS_ENABLED"
            export GRAFANA_ENABLED="$FULL_GRAFANA_ENABLED"
            export NODE_EXPORTER_ENABLED="$FULL_NODE_EXPORTER_ENABLED"
            export CADVISOR_ENABLED="$FULL_CADVISOR_ENABLED"
            export LOKI_ENABLED="$FULL_LOKI_ENABLED"
            export PROMTAIL_ENABLED="$FULL_PROMTAIL_ENABLED"
            export JAEGER_ENABLED="$FULL_JAEGER_ENABLED"
            export ALERTMANAGER_ENABLED="$FULL_ALERTMANAGER_ENABLED"
            export REDIS_EXPORTER_ENABLED="$FULL_REDIS_EXPORTER_ENABLED"
            export POSTGRES_EXPORTER_ENABLED="$FULL_POSTGRES_EXPORTER_ENABLED"
            export BLACKBOX_EXPORTER_ENABLED="$FULL_BLACKBOX_EXPORTER_ENABLED"
            export PROMETHEUS_RETENTION="$FULL_PROMETHEUS_RETENTION"
            export LOKI_RETENTION="$FULL_LOKI_RETENTION"
            export JAEGER_SAMPLING="$FULL_JAEGER_SAMPLING"
            ;;
        "custom")
            export PROMETHEUS_ENABLED="$CUSTOM_PROMETHEUS_ENABLED"
            export GRAFANA_ENABLED="$CUSTOM_GRAFANA_ENABLED"
            export NODE_EXPORTER_ENABLED="$CUSTOM_NODE_EXPORTER_ENABLED"
            export CADVISOR_ENABLED="$CUSTOM_CADVISOR_ENABLED"
            export LOKI_ENABLED="$CUSTOM_LOKI_ENABLED"
            export PROMTAIL_ENABLED="$CUSTOM_PROMTAIL_ENABLED"
            export JAEGER_ENABLED="$CUSTOM_JAEGER_ENABLED"
            export ALERTMANAGER_ENABLED="$CUSTOM_ALERTMANAGER_ENABLED"
            export REDIS_EXPORTER_ENABLED="$CUSTOM_REDIS_EXPORTER_ENABLED"
            export POSTGRES_EXPORTER_ENABLED="$CUSTOM_POSTGRES_EXPORTER_ENABLED"
            export BLACKBOX_EXPORTER_ENABLED="$CUSTOM_BLACKBOX_EXPORTER_ENABLED"
            export PROMETHEUS_RETENTION="$CUSTOM_PROMETHEUS_RETENTION"
            export LOKI_RETENTION="$CUSTOM_LOKI_RETENTION"
            export JAEGER_SAMPLING="$CUSTOM_JAEGER_SAMPLING"
            ;;
        *)
            print_error "Unknown profile: $profile"
            print_error "Available profiles: minimal, standard, full, custom"
            exit 1
            ;;
    esac
    
    print_status "Loaded profile: $profile"
}

# Function to backup monitoring data
backup_monitoring_data() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="$BACKUP_DIR/backup_$timestamp"
    
    print_status "Creating backup of monitoring data..."
    
    # Create timestamped backup directory
    mkdir -p "$backup_path"
    
    # Stop current monitoring stack if running
    cd "$MONITORING_DIR"
    if docker compose -f docker-compose.monitoring.yml ps | grep -q "Up"; then
        print_status "Stopping current monitoring stack for backup..."
        docker compose -f docker-compose.monitoring.yml down
    fi
    
    # Backup volumes (if they exist)
    for volume in prometheus_data grafana_data loki_data jaeger_data alertmanager_data; do
        if docker volume ls | grep -q "$volume"; then
            print_status "Backing up volume: $volume"
            docker run --rm \
                -v "${volume}:/source:ro" \
                -v "$backup_path:/backup" \
                alpine:latest \
                tar czf "/backup/${volume}.tar.gz" -C /source .
        fi
    done
    
    # Backup configuration files
    cp -r "$MONITORING_DIR" "$backup_path/config"
    
    print_success "Backup completed: $backup_path"
    
    # Clean old backups (keep only last 5)
    find "$BACKUP_DIR" -type d -name "backup_*" | sort -r | tail -n +6 | xargs rm -rf
}

# Function to apply monitoring profile
apply_profile() {
    local profile="$1"
    local skip_backup="${2:-false}"
    
    print_status "Applying monitoring profile: $profile"
    
    # Load profile configuration
    load_profile "$profile"
    
    # Create backup unless skipped
    if [[ "$skip_backup" != "true" ]]; then
        backup_monitoring_data
    fi
    
    cd "$MONITORING_DIR"
    
    # Stop current stack
    print_status "Stopping current monitoring stack..."
    docker compose -f docker-compose.monitoring.yml down
    
    # Configure profile-specific settings
    configure_profile_files "$profile"
    
    # Apply new profile with appropriate compose files
    print_status "Starting monitoring stack with profile: $profile"
    
    case "$profile" in
        "minimal")
            # Minimal is the default - no profile needed
            docker compose -f docker-compose.monitoring.yml up -d
            ;;
        "custom")
            # Custom profile uses the script to selectively start services
            # Rather than relying on Docker Compose profiles (which don't support dynamic enabling)
            print_error "Custom profile requires manual service management."
            print_error "Use 'configure' command first, then manually start desired services."
            print_error "Example: docker compose up prometheus grafana loki"
            exit 1
            ;;
        *)
            # Standard and full profiles
            docker compose --profile "$profile" -f docker-compose.monitoring.yml up -d
            ;;
    esac
    
    print_success "Monitoring profile '$profile' applied successfully"
    
    # Show status
    show_status
}

# Function to show current status
show_status() {
    print_status "Current monitoring stack status:"
    
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml ps
    
    echo ""
    print_status "Active services:"
    
    local services=(
        "prometheus:Prometheus:9090"
        "grafana:Grafana:3001"
        "loki:Loki:3100"
        "jaeger:Jaeger:16686"
        "alertmanager:AlertManager:9093"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r container_name display_name port <<< "$service"
        if docker ps --format "table {{.Names}}" | grep -q "link_$container_name"; then
            print_success "$display_name is running on port $port"
        else
            print_warning "$display_name is not running"
        fi
    done
}

# Function to show profile comparison
show_profiles() {
    echo ""
    echo "Available Monitoring Profiles:"
    echo "=============================="
    echo ""
    
    echo -e "${BLUE}DEFAULT (Minimal)${NC} - Core metrics only (70% cost reduction)"
    echo "  ✓ Prometheus + Grafana"
    echo "  ✗ Logging, Tracing, Exporters"
    echo "  📊 3d retention, ~15GB storage"
    echo "  🚀 Usage: docker compose up"
    echo ""
    
    echo -e "${YELLOW}STANDARD${NC} - Balanced monitoring (40% cost reduction)"
    echo "  ✓ Prometheus + Grafana + Loki + Jaeger + AlertManager"
    echo "  ✓ Node + Container + Database exporters"
    echo "  📊 7d retention, ~80GB storage"
    echo "  🚀 Usage: docker compose --profile standard up"
    echo ""
    
    echo -e "${GREEN}FULL${NC} - Complete observability (optimized)"
    echo "  ✓ All monitoring services enabled"
    echo "  ✓ All exporters and integrations"
    echo "  📊 14d retention, ~200GB storage"
    echo "  🚀 Usage: docker compose --profile full up"
    echo ""
    
    echo -e "${BLUE}CUSTOM${NC} - User-defined configuration"
    echo "  🛠  Configure individual components"
    echo "  🔧 Override via environment variables"
    echo "  🚀 Usage: ./scripts/monitoring-control.sh custom"
    echo ""
}

# Function to configure custom profile
configure_custom() {
    print_status "Configuring custom monitoring profile..."
    
    echo "Select components to enable:"
    
    # Array of services for configuration
    local services=(
        "NODE_EXPORTER:Node Exporter (system metrics)"
        "CADVISOR:cAdvisor (container metrics)"
        "LOKI:Loki (log aggregation)"
        "PROMTAIL:Promtail (log shipping)"
        "JAEGER:Jaeger (distributed tracing)"
        "ALERTMANAGER:AlertManager (alert handling)"
        "REDIS_EXPORTER:Redis Exporter"
        "POSTGRES_EXPORTER:PostgreSQL Exporter"
        "BLACKBOX_EXPORTER:Blackbox Exporter (uptime)"
    )
    
    # Create custom environment file
    local custom_env="$MONITORING_DIR/.env.custom"
    echo "# Custom monitoring profile configuration" > "$custom_env"
    echo "# Generated on $(date)" >> "$custom_env"
    echo "" >> "$custom_env"
    
    # Always enable core services
    echo "CUSTOM_PROMETHEUS_ENABLED=true" >> "$custom_env"
    echo "CUSTOM_GRAFANA_ENABLED=true" >> "$custom_env"
    
    # Ask user about each optional service
    for service in "${services[@]}"; do
        IFS=':' read -r var_name display_name <<< "$service"
        
        echo -n "Enable $display_name? (y/N): "
        read -r response
        
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "CUSTOM_${var_name}_ENABLED=true" >> "$custom_env"
        else
            echo "CUSTOM_${var_name}_ENABLED=false" >> "$custom_env"
        fi
    done
    
    print_success "Custom configuration saved to: $custom_env"
    print_status "To use custom configuration, manually start desired services:"
    print_status "Example: docker compose up prometheus grafana loki"
}

# Function to show logs
show_logs() {
    local service="${1:-}"
    
    cd "$MONITORING_DIR"
    
    if [[ -n "$service" ]]; then
        docker compose -f docker-compose.monitoring.yml logs -f "$service"
    else
        docker compose -f docker-compose.monitoring.yml logs -f
    fi
}

# Function to restart specific service
restart_service() {
    local service="$1"
    
    print_status "Restarting service: $service"
    
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml restart "$service"
    
    print_success "Service '$service' restarted"
}

# Function to show usage
show_usage() {
    echo "Monitoring Stack Control Script"
    echo "==============================="
    echo ""
    echo "SIMPLIFIED APPROACH:"
    echo "  docker compose up                        # Minimal (default)"
    echo "  docker compose --profile standard up     # Balanced monitoring"
    echo "  docker compose --profile full up         # Complete observability"
    echo ""
    echo "ADVANCED MANAGEMENT:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  minimal         Apply minimal monitoring (same as default)"
    echo "  standard        Apply standard monitoring profile"
    echo "  full            Apply full monitoring profile"
    echo "  custom          Apply custom monitoring profile"
    echo "  configure       Configure custom profile interactively"
    echo "  status          Show current monitoring stack status"
    echo "  profiles        Show available profiles and usage"
    echo "  stop            Stop all monitoring services"
    echo "  backup          Create backup of monitoring data"
    echo "  logs [service]  Show logs for all services or specific service"
    echo "  restart <svc>   Restart specific service"
    echo "  help            Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --skip-backup   Skip creating backup when applying profile"
    echo ""
    echo "EXAMPLES:"
    echo "  # Simple usage (recommended)"
    echo "  docker compose up                        # Start with minimal monitoring"
    echo "  docker compose --profile standard up     # Upgrade to standard"
    echo ""
    echo "  # Script usage (advanced)"  
    echo "  $0 standard --skip-backup                # Apply standard without backup"
    echo "  $0 logs prometheus                       # Show Prometheus logs"
    echo "  $0 restart grafana                       # Restart Grafana"
    echo ""
}

# Main execution logic
main() {
    local command="${1:-help}"
    local skip_backup="false"
    
    # Parse options
    while [[ $# -gt 1 ]]; do
        case $2 in
            --skip-backup)
                skip_backup="true"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Execute command
    case "$command" in
        "minimal"|"standard"|"full"|"custom")
            apply_profile "$command" "$skip_backup"
            ;;
        "configure")
            configure_custom
            ;;
        "status")
            show_status
            ;;
        "profiles")
            show_profiles
            ;;
        "stop")
            cd "$MONITORING_DIR"
            print_status "Stopping monitoring stack..."
            docker compose -f docker-compose.monitoring.yml down
            print_success "Monitoring stack stopped"
            ;;
        "backup")
            backup_monitoring_data
            ;;
        "logs")
            show_logs "${2:-}"
            ;;
        "restart")
            if [[ -z "${2:-}" ]]; then
                print_error "Service name required for restart command"
                exit 1
            fi
            restart_service "$2"
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