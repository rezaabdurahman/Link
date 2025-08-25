#!/bin/bash

# Database Migration Rollback Script
# Safely rollback database migrations for specific services or all services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICES=("user-svc" "chat-svc" "ai-svc" "discovery-svc" "search-svc")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Rollback database migrations for Link services

OPTIONS:
    -s, --service SERVICE    Rollback specific service (user-svc, chat-svc, etc.)
    -a, --all               Rollback all services
    -n, --steps NUMBER      Number of steps to rollback (default: 1)
    -d, --dry-run           Show what would be executed
    -f, --force             Skip confirmation prompts
    -v, --verbose           Enable verbose logging
    -h, --help              Show this help message

EXAMPLES:
    $0 --service user-svc                    # Rollback latest migration for user-svc
    $0 --service user-svc --steps 3          # Rollback last 3 migrations
    $0 --all --dry-run                       # Show what would be rolled back
    $0 --service chat-svc --force            # Skip confirmations

ENVIRONMENT VARIABLES:
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSLMODE
EOF
}

# Default values
SERVICE=""
ALL_SERVICES=false
ROLLBACK_STEPS=1
DRY_RUN=false
FORCE=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--service) SERVICE="$2"; shift 2 ;;
        -a|--all) ALL_SERVICES=true; shift ;;
        -n|--steps) ROLLBACK_STEPS="$2"; shift 2 ;;
        -d|--dry-run) DRY_RUN=true; shift ;;
        -f|--force) FORCE=true; shift ;;
        -v|--verbose) VERBOSE=true; shift ;;
        -h|--help) show_usage; exit 0 ;;
        *) log_error "Unknown option: $1"; show_usage; exit 1 ;;
    esac
done

if [[ "$VERBOSE" == true ]]; then set -x; fi

# Validation
if [[ "$ALL_SERVICES" == false && -z "$SERVICE" ]]; then
    log_error "Must specify either --service or --all"
    exit 1
fi

if [[ "$ALL_SERVICES" == true && -n "$SERVICE" ]]; then
    log_error "Cannot specify both --service and --all"
    exit 1
fi

if [[ -n "$SERVICE" ]]; then
    if [[ ! " ${SERVICES[@]} " =~ " ${SERVICE} " ]]; then
        log_error "Invalid service: $SERVICE. Valid services: ${SERVICES[*]}"
        exit 1
    fi
fi

# Load environment
ENV_FILE="$ROOT_DIR/.env.production"
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

# Build migration tool
build_migration_tool() {
    log_info "Building migration tool..."
    cd "$ROOT_DIR/backend/shared-libs/migrations"
    if go build -o migrate ./cmd/migrate; then
        log_success "Migration tool built"
    else
        log_error "Failed to build migration tool"
        exit 1
    fi
}

# Show migration status
show_migration_status() {
    local service="$1"
    local migrations_path="$ROOT_DIR/backend/$service/migrations"
    
    if [[ ! -d "$migrations_path" ]]; then
        log_warning "No migrations found for $service"
        return 0
    fi
    
    log_info "Current migration status for $service:"
    cd "$ROOT_DIR/backend/shared-libs/migrations"
    ./migrate -service="$service" -action=status -path="$migrations_path" || true
}

# Rollback migrations for a service
rollback_service_migrations() {
    local service="$1"
    local migrations_path="$ROOT_DIR/backend/$service/migrations"
    
    if [[ ! -d "$migrations_path" ]]; then
        log_warning "No migrations directory for $service, skipping"
        return 0
    fi
    
    log_info "Rolling back $ROLLBACK_STEPS step(s) for $service..."
    
    cd "$ROOT_DIR/backend/shared-libs/migrations"
    
    # Show current status
    show_migration_status "$service"
    
    # Confirm rollback unless forced
    if [[ "$FORCE" == false && "$DRY_RUN" == false ]]; then
        echo
        read -p "Are you sure you want to rollback $ROLLBACK_STEPS step(s) for $service? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled for $service"
            return 0
        fi
    fi
    
    # Perform rollback
    local step
    for ((step=1; step<=ROLLBACK_STEPS; step++)); do
        log_info "Rolling back step $step/$ROLLBACK_STEPS for $service..."
        
        if [[ "$DRY_RUN" == true ]]; then
            log_info "[DRY RUN] Would rollback migration for $service (step $step)"
            continue
        fi
        
        if ./migrate -service="$service" -action=down -yes -path="$migrations_path"; then
            log_success "Rollback step $step completed for $service"
        else
            log_warning "Rollback step $step failed or no more migrations to rollback for $service"
            break
        fi
    done
    
    # Show final status
    if [[ "$DRY_RUN" == false ]]; then
        log_info "Final status for $service:"
        show_migration_status "$service"
    fi
}

# Main execution
main() {
    log_info "=== Database Migration Rollback ==="
    log_info "Dry Run: $DRY_RUN"
    log_info "Force: $FORCE"
    log_info "Steps: $ROLLBACK_STEPS"
    
    if [[ "$ALL_SERVICES" == true ]]; then
        log_info "Target: All services"
    else
        log_info "Target: $SERVICE"
    fi
    
    log_info "====================================="
    
    # Build migration tool
    if [[ "$DRY_RUN" == false ]]; then
        build_migration_tool
    fi
    
    # Execute rollback
    if [[ "$ALL_SERVICES" == true ]]; then
        for service in "${SERVICES[@]}"; do
            rollback_service_migrations "$service"
        done
    else
        rollback_service_migrations "$SERVICE"
    fi
    
    log_success "=== Rollback completed ==="
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "This was a dry run. No actual changes were made."
    fi
}

# Handle interruption
trap 'log_error "Rollback interrupted"; exit 1' INT TERM

main