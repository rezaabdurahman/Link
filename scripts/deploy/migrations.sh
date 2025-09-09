#!/bin/bash
# Database Migration Management Script
# Handles database migrations for Link services

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
ACTION="up"
SERVICE=""
STEPS=""
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
Usage: $0 [ACTION] [OPTIONS]

Manage database migrations for Link services.

ACTIONS:
    up              Run migrations (default)
    down            Rollback migrations
    status          Show migration status

OPTIONS:
    -s, --service SERVICE    Target specific service
    --steps N               Number of migration steps (for down action)
    --dry-run              Show what would be executed
    --help                 Show this help message

EXAMPLES:
    $0 up                           # Run all pending migrations
    $0 up --service user-svc        # Run migrations for user service only
    $0 down --steps 1               # Rollback 1 migration for all services
    $0 down --service user-svc --steps 2  # Rollback 2 migrations for user service
    $0 status                       # Show migration status

SERVICES:
    Available services: ${SERVICES[*]}
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        up|down|status)
            ACTION="$1"
            shift
            ;;
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        --steps)
            STEPS="$2"
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
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate service if specified
if [ -n "$SERVICE" ] && ! validate_service "$SERVICE" 2>/dev/null; then
    log_error "Invalid service: $SERVICE"
    list_services
    exit 1
fi

echo -e "${GREEN}🗄️  Link Database Migration Management${NC}"
echo "======================================"
log_info "Action: $ACTION"
[ -n "$SERVICE" ] && log_info "Service: $SERVICE" || log_info "Service: all services"
[ -n "$STEPS" ] && log_info "Steps: $STEPS"
log_info "Dry run: $DRY_RUN"
echo ""

# Determine services to process
if [ -n "$SERVICE" ]; then
    SERVICES_TO_PROCESS=("$SERVICE")
else
    SERVICES_TO_PROCESS=("${SERVICES[@]}")
fi

# Function to run migration for a service
run_service_migration() {
    local service=$1
    local service_path="$PROJECT_ROOT/backend/$service"
    
    if [ ! -d "$service_path" ]; then
        log_warning "Service directory not found: $service_path"
        return 1
    fi
    
    log_info "Processing migrations for $service..."
    
    case "$ACTION" in
        up)
            if [ "$DRY_RUN" = true ]; then
                log_info "DRY RUN: Would run migrations for $service"
            else
                # Try different migration approaches
                if [ -f "$service_path/Makefile" ] && grep -q migrate-up "$service_path/Makefile"; then
                    cd "$service_path" && make migrate-up
                elif [ -f "$service_path/migrate" ]; then
                    cd "$service_path" && ./migrate up
                elif command -v migrate >/dev/null 2>&1; then
                    cd "$service_path" && migrate -path migrations -database "$DATABASE_URL" up
                else
                    log_warning "No migration tool found for $service"
                    return 1
                fi
                log_success "$service migrations completed"
            fi
            ;;
        down)
            if [ "$DRY_RUN" = true ]; then
                log_info "DRY RUN: Would rollback $STEPS migrations for $service"
            else
                if [ -z "$STEPS" ]; then
                    log_error "Steps parameter required for rollback"
                    return 1
                fi
                
                # Try different rollback approaches
                if [ -f "$service_path/Makefile" ] && grep -q migrate-down "$service_path/Makefile"; then
                    cd "$service_path" && make migrate-down STEPS="$STEPS"
                elif [ -f "$service_path/migrate" ]; then
                    cd "$service_path" && ./migrate down "$STEPS"
                elif command -v migrate >/dev/null 2>&1; then
                    cd "$service_path" && migrate -path migrations -database "$DATABASE_URL" down "$STEPS"
                else
                    log_warning "No migration tool found for $service"
                    return 1
                fi
                log_success "$service rollback completed"
            fi
            ;;
        status)
            log_info "Migration status for $service:"
            if [ -f "$service_path/Makefile" ] && grep -q migrate-status "$service_path/Makefile"; then
                cd "$service_path" && make migrate-status
            elif [ -f "$service_path/migrate" ]; then
                cd "$service_path" && ./migrate status
            elif command -v migrate >/dev/null 2>&1; then
                cd "$service_path" && migrate -path migrations -database "$DATABASE_URL" status
            else
                log_warning "No migration tool found for $service"
                return 1
            fi
            ;;
    esac
}

# Process migrations
migration_failures=0

for service in "${SERVICES_TO_PROCESS[@]}"; do
    if ! run_service_migration "$service"; then
        migration_failures=$((migration_failures + 1))
    fi
    echo ""
done

# Final status
if [ $migration_failures -eq 0 ]; then
    log_success "All migrations completed successfully!"
else
    log_error "$migration_failures service(s) had migration issues"
    exit 1
fi