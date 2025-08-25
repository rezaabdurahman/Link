#!/bin/bash

# Feature Flag Admin CLI Wrapper Script
# This script provides convenient wrappers for common feature flag operations

set -e

# Configuration
CLI_PATH="backend/feature-svc/cmd/feature-cli"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
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

# Check if CLI exists
check_cli() {
    if [ ! -f "$PROJECT_ROOT/$CLI_PATH/main.go" ]; then
        log_error "Feature CLI not found at $PROJECT_ROOT/$CLI_PATH/main.go"
        exit 1
    fi
}

# Build CLI if needed
build_cli() {
    log_info "Building feature CLI..."
    cd "$PROJECT_ROOT/$CLI_PATH"
    go build -o feature-cli main.go
    log_success "CLI built successfully"
}

# Get database connection parameters
get_db_params() {
    local db_params=""
    
    # Check if we're in development environment
    if [ -f "$PROJECT_ROOT/backend/.env" ]; then
        log_info "Loading database config from backend/.env"
        source "$PROJECT_ROOT/backend/.env"
        db_params="--db-host=${DB_HOST:-localhost} --db-port=${DB_PORT:-5432} --db-user=${DB_USER:-feature_service_user} --db-name=${DB_NAME:-feature_service_db}"
        
        # Check for feature service password first, then fallback
        local password="${FEATURE_SERVICE_PASSWORD:-${DB_PASSWORD}}"
        if [ -n "$password" ]; then
            db_params="$db_params --db-password=$password"
        fi
    else
        log_warning "No .env file found, using default database settings"
        db_params="--db-host=localhost --db-port=5432 --db-user=feature_service_user --db-name=feature_service_db"
    fi
    
    echo "$db_params"
}

# Main CLI wrapper function
run_cli() {
    local cmd="$1"
    shift
    local args="$@"
    
    check_cli
    build_cli
    
    local db_params=$(get_db_params)
    local user_param=""
    
    # Add user identification
    if [ -n "$USER" ]; then
        user_param="--user=$USER@$(hostname)"
    fi
    
    cd "$PROJECT_ROOT/$CLI_PATH"
    log_info "Running: ./feature-cli $cmd $args"
    ./feature-cli $db_params $user_param $cmd $args
}

# Convenience functions for common operations

# List all flags
list_flags() {
    log_info "Listing all feature flags..."
    run_cli "flag list" "$@"
}

# Create a new flag
create_flag() {
    local key="$1"
    local name="$2"
    local description="$3"
    local type="${4:-boolean}"
    
    if [ -z "$key" ] || [ -z "$name" ]; then
        log_error "Usage: create_flag <key> <name> [description] [type]"
        exit 1
    fi
    
    log_info "Creating feature flag '$key'..."
    local args="create $key --name=\"$name\" --type=$type"
    
    if [ -n "$description" ]; then
        args="$args --description=\"$description\""
    fi
    
    run_cli "flag" $args
}

# Toggle a flag
toggle_flag() {
    local key="$1"
    local env="$2"
    
    if [ -z "$key" ]; then
        log_error "Usage: toggle_flag <key> [environment]"
        exit 1
    fi
    
    local args="toggle $key"
    if [ -n "$env" ]; then
        args="$args --env=$env"
    fi
    
    log_info "Toggling feature flag '$key'..."
    run_cli "flag" $args
}

# Enable a flag with rollout
enable_flag() {
    local key="$1"
    local env="$2"
    local percentage="${3:-100}"
    local reason="$4"
    
    if [ -z "$key" ] || [ -z "$env" ]; then
        log_error "Usage: enable_flag <key> <environment> [percentage] [reason]"
        exit 1
    fi
    
    log_info "Enabling feature flag '$key' in environment '$env' at $percentage%..."
    local args="rollout $key $percentage --env=$env"
    
    if [ -n "$reason" ]; then
        args="$args --reason=\"$reason\""
    fi
    
    run_cli "flag" $args
}

# Disable a flag
disable_flag() {
    local key="$1"
    local reason="$2"
    
    if [ -z "$key" ]; then
        log_error "Usage: disable_flag <key> <reason>"
        exit 1
    fi
    
    if [ -z "$reason" ]; then
        log_error "Reason is required when disabling flags"
        exit 1
    fi
    
    log_info "Disabling feature flag '$key'..."
    run_cli "flag" "update $key --disabled --reason=\"$reason\""
}

# Archive/delete a flag
archive_flag() {
    local key="$1"
    local reason="$2"
    
    if [ -z "$key" ]; then
        log_error "Usage: archive_flag <key> <reason>"
        exit 1
    fi
    
    if [ -z "$reason" ]; then
        log_error "Reason is required when archiving flags"
        exit 1
    fi
    
    log_warning "This will archive feature flag '$key' permanently!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        exit 0
    fi
    
    log_info "Archiving feature flag '$key'..."
    run_cli "flag" "delete $key --reason=\"$reason\" --yes"
}

# Get flag details
get_flag() {
    local key="$1"
    
    if [ -z "$key" ]; then
        log_error "Usage: get_flag <key>"
        exit 1
    fi
    
    log_info "Getting details for feature flag '$key'..."
    run_cli "flag" "get $key --config"
}

# List environments
list_environments() {
    log_info "Listing all environments..."
    run_cli "env list"
}

# View recent changes
recent_changes() {
    local limit="${1:-10}"
    log_info "Showing $limit most recent changes..."
    run_cli "audit" "recent --limit=$limit"
}

# View audit history for a flag
flag_history() {
    local key="$1"
    local limit="${2:-20}"
    
    if [ -z "$key" ]; then
        log_error "Usage: flag_history <key> [limit]"
        exit 1
    fi
    
    log_info "Getting audit history for feature flag '$key'..."
    run_cli "audit" "history --entity-type=feature_flag --entity-key=$key --limit=$limit"
}

# Show usage help
show_help() {
    echo "Feature Flag Admin CLI Wrapper"
    echo "=============================="
    echo
    echo "Common Operations:"
    echo "  list_flags                              - List all feature flags"
    echo "  create_flag <key> <name> [desc] [type]  - Create a new feature flag"
    echo "  get_flag <key>                          - Get flag details with configs"
    echo "  toggle_flag <key> [env]                 - Toggle flag on/off"
    echo "  enable_flag <key> <env> [%] [reason]    - Enable flag with rollout percentage"
    echo "  disable_flag <key> <reason>             - Disable a flag (requires reason)"
    echo "  archive_flag <key> <reason>             - Archive/delete a flag (requires reason)"
    echo
    echo "Environment & Monitoring:"
    echo "  list_environments                       - List all environments"
    echo "  recent_changes [limit]                  - Show recent changes (default: 10)"
    echo "  flag_history <key> [limit]              - Show audit history for a flag"
    echo
    echo "Advanced:"
    echo "  run_cli <command> [args...]             - Run raw CLI command"
    echo
    echo "Examples:"
    echo "  ./feature-admin.sh list_flags"
    echo "  ./feature-admin.sh create_flag new-checkout \"New Checkout Flow\" \"Improved checkout experience\" boolean"
    echo "  ./feature-admin.sh enable_flag new-checkout production 25 \"Gradual rollout to 25% of users\""
    echo "  ./feature-admin.sh disable_flag old-checkout \"Feature deprecated, removing old code\""
    echo "  ./feature-admin.sh flag_history new-checkout 10"
    echo
    echo "Environment Variables:"
    echo "  Reads database config from backend/.env if available"
    echo "  Uses USER and hostname for audit trails"
    echo
}

# Main script logic
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        "help" | "--help" | "-h")
            show_help
            ;;
        "list_flags" | "list-flags")
            list_flags "$@"
            ;;
        "create_flag" | "create-flag")
            create_flag "$@"
            ;;
        "get_flag" | "get-flag")
            get_flag "$@"
            ;;
        "toggle_flag" | "toggle-flag")
            toggle_flag "$@"
            ;;
        "enable_flag" | "enable-flag")
            enable_flag "$@"
            ;;
        "disable_flag" | "disable-flag")
            disable_flag "$@"
            ;;
        "archive_flag" | "archive-flag")
            archive_flag "$@"
            ;;
        "list_environments" | "list-environments")
            list_environments "$@"
            ;;
        "recent_changes" | "recent-changes")
            recent_changes "$@"
            ;;
        "flag_history" | "flag-history")
            flag_history "$@"
            ;;
        "run_cli" | "run-cli")
            run_cli "$@"
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"