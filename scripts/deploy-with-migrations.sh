#!/bin/bash

# Deploy with Database Migrations Script
# This script handles automated deployment with database migrations
# Supports both staging and production environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICES=("user-svc" "chat-svc" "ai-svc" "discovery-svc" "search-svc")

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

# Usage function
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Link application with database migrations

OPTIONS:
    -e, --environment ENV    Target environment (staging|production)
    -d, --dry-run           Show what would be executed without running
    -s, --skip-migrations   Skip database migrations
    -v, --verbose           Enable verbose logging
    -h, --help              Show this help message

EXAMPLES:
    $0 --environment staging
    $0 --environment production --dry-run
    $0 --environment staging --skip-migrations

ENVIRONMENT VARIABLES:
    DB_HOST                 Database host
    DB_PORT                 Database port (default: 5432)
    DB_USER                 Database user
    DB_PASSWORD             Database password
    DB_NAME                 Database name
    DB_SSLMODE             SSL mode (default: require for production)
EOF
}

# Default values
ENVIRONMENT=""
DRY_RUN=false
SKIP_MIGRATIONS=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
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
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment is required. Use --environment staging|production"
    exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be staging or production"
    exit 1
fi

# Enable verbose mode
if [[ "$VERBOSE" == true ]]; then
    set -x
fi

log_info "Starting deployment to $ENVIRONMENT environment"

# Load environment-specific configuration
ENV_FILE="$ROOT_DIR/.env.$ENVIRONMENT"
if [[ -f "$ENV_FILE" ]]; then
    log_info "Loading environment file: $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
else
    log_warning "Environment file not found: $ENV_FILE"
fi

# Set SSL mode based on environment
if [[ "$ENVIRONMENT" == "production" ]]; then
    export DB_SSLMODE="${DB_SSLMODE:-require}"
else
    export DB_SSLMODE="${DB_SSLMODE:-disable}"
fi

# Validate required environment variables
required_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "DB_NAME")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        log_error "Required environment variable $var is not set"
        exit 1
    fi
done

# Function to check database connectivity
check_database_connection() {
    log_info "Checking database connectivity..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would check database connection to ${DB_HOST}:${DB_PORT:-5432}"
        return 0
    fi
    
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h "${DB_HOST}" -p "${DB_PORT:-5432}" -U "${DB_USER}"; then
            log_success "Database connection successful"
        else
            log_error "Cannot connect to database"
            exit 1
        fi
    else
        log_warning "pg_isready not available, skipping connection check"
    fi
}

# Function to build migration tool
build_migration_tool() {
    log_info "Building migration tool..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would build migration tool"
        return 0
    fi
    
    cd "$ROOT_DIR/backend/shared-libs/migrations"
    
    if go build -o migrate ./cmd/migrate; then
        log_success "Migration tool built successfully"
    else
        log_error "Failed to build migration tool"
        exit 1
    fi
    
    cd "$ROOT_DIR"
}

# Function to run migrations for a service
run_migrations_for_service() {
    local service="$1"
    local migrations_path="$ROOT_DIR/backend/$service/migrations"
    
    log_info "Running migrations for $service..."
    
    if [[ ! -d "$migrations_path" ]]; then
        log_warning "No migrations directory found for $service, skipping"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would run migrations for $service"
        cd "$ROOT_DIR/backend/shared-libs/migrations"
        ./migrate -service="$service" -action=up -dry-run -path="$migrations_path" || true
        return 0
    fi
    
    cd "$ROOT_DIR/backend/shared-libs/migrations"
    
    # Check migration status first
    log_info "Checking migration status for $service..."
    ./migrate -service="$service" -action=status -path="$migrations_path" || true
    
    # Run migrations
    if ./migrate -service="$service" -action=up -yes -path="$migrations_path"; then
        log_success "Migrations completed for $service"
    else
        log_error "Failed to run migrations for $service"
        exit 1
    fi
    
    # Verify integrity
    log_info "Verifying migration integrity for $service..."
    if ./migrate -service="$service" -action=verify -path="$migrations_path"; then
        log_success "Migration integrity verified for $service"
    else
        log_warning "Migration integrity check failed for $service"
    fi
}

# Function to run all migrations
run_all_migrations() {
    if [[ "$SKIP_MIGRATIONS" == true ]]; then
        log_warning "Skipping migrations as requested"
        return 0
    fi
    
    log_info "Running database migrations for all services..."
    
    for service in "${SERVICES[@]}"; do
        run_migrations_for_service "$service"
    done
    
    log_success "All migrations completed successfully"
}

# Function to deploy application
deploy_application() {
    log_info "Deploying application to $ENVIRONMENT..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would deploy application using docker-compose.$ENVIRONMENT.yml"
        return 0
    fi
    
    local compose_file="docker-compose.$ENVIRONMENT.yml"
    
    if [[ ! -f "$ROOT_DIR/$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        exit 1
    fi
    
    cd "$ROOT_DIR"
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f "$compose_file" pull
    
    # Deploy with rolling update
    log_info "Deploying services..."
    if docker-compose -f "$compose_file" up -d --remove-orphans; then
        log_success "Application deployed successfully"
    else
        log_error "Application deployment failed"
        exit 1
    fi
}

# Function to run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would run health checks"
        return 0
    fi
    
    local max_attempts=30
    local wait_time=10
    
    for service in "${SERVICES[@]}"; do
        log_info "Checking health of $service..."
        
        local attempts=0
        while [[ $attempts -lt $max_attempts ]]; do
            if docker-compose -f "docker-compose.$ENVIRONMENT.yml" exec -T "$service" wget --no-verbose --tries=1 --spider http://localhost:8080/health 2>/dev/null; then
                log_success "$service is healthy"
                break
            fi
            
            attempts=$((attempts + 1))
            if [[ $attempts -lt $max_attempts ]]; then
                log_info "Waiting for $service to become healthy... (attempt $attempts/$max_attempts)"
                sleep $wait_time
            else
                log_error "$service health check failed after $max_attempts attempts"
                return 1
            fi
        done
    done
    
    log_success "All services are healthy"
}

# Function to run post-deployment tasks
run_post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would run post-deployment tasks"
        return 0
    fi
    
    # Run any additional post-deployment scripts
    local post_deploy_dir="$ROOT_DIR/scripts/post-deploy"
    if [[ -d "$post_deploy_dir" ]]; then
        for script in "$post_deploy_dir"/*.sh; do
            if [[ -f "$script" ]]; then
                log_info "Running post-deployment script: $(basename "$script")"
                bash "$script" "$ENVIRONMENT"
            fi
        done
    fi
    
    log_success "Post-deployment tasks completed"
}

# Main deployment function
main() {
    log_info "=== Link Application Deployment ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    log_info "Skip Migrations: $SKIP_MIGRATIONS"
    log_info "======================================="
    
    # Pre-deployment checks
    check_database_connection
    build_migration_tool
    
    # Run migrations
    run_all_migrations
    
    # Deploy application
    deploy_application
    
    # Post-deployment verification
    run_health_checks
    run_post_deployment_tasks
    
    log_success "=== Deployment completed successfully ==="
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "This was a dry run. No actual changes were made."
    fi
}

# Trap to handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main