#!/bin/bash

# Zero-Downtime Deployment Script for Link Services
# Implements blue-green deployment with rolling database migrations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="/tmp/link-deployment-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

# Default values
ENVIRONMENT="staging"
SERVICES="user-svc,discovery-svc,chat-svc,ai-svc,search-svc"
DRY_RUN=false
SKIP_MIGRATIONS=false
SKIP_HEALTH_CHECKS=false
ROLLBACK_ON_FAILURE=true
MAX_RETRY_ATTEMPTS=3
HEALTH_CHECK_TIMEOUT=300 # 5 minutes
MIGRATION_TIMEOUT=1800    # 30 minutes

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Zero-downtime deployment script for Link services"
    echo ""
    echo "OPTIONS:"
    echo "  -e, --environment ENV     Environment to deploy to (staging, production) [default: staging]"
    echo "  -s, --services SERVICES   Comma-separated list of services to deploy [default: all]"
    echo "  -d, --dry-run            Perform a dry-run without making changes"
    echo "  -m, --skip-migrations    Skip database migrations"
    echo "  -h, --skip-health-checks Skip health checks"
    echo "  -n, --no-rollback        Don't rollback on failure"
    echo "  -r, --retry-attempts N   Maximum retry attempts [default: 3]"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --environment production --services user-svc,discovery-svc"
    echo "  $0 --dry-run"
    echo "  $0 --skip-migrations --environment staging"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--services)
            SERVICES="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -m|--skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        -h|--skip-health-checks)
            SKIP_HEALTH_CHECKS=true
            shift
            ;;
        -n|--no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
            ;;
        -r|--retry-attempts)
            MAX_RETRY_ATTEMPTS="$2"
            shift 2
            ;;
        --help)
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Convert services string to array
IFS=',' read -ra SERVICE_ARRAY <<< "$SERVICES"

log "Starting zero-downtime deployment"
log "Environment: $ENVIRONMENT"
log "Services: $SERVICES"
log "Dry run: $DRY_RUN"
log "Skip migrations: $SKIP_MIGRATIONS"

# Function to check if docker compose is available
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Function to check service health
check_service_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    log "Checking health of $service..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T "$service" wget -qO- http://localhost:8080/health/ready > /dev/null 2>&1; then
            log_success "$service is healthy"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed for $service"
        sleep 10
        ((attempt++))
    done
    
    log_error "$service failed health checks"
    return 1
}

# Function to run database migrations for a service
run_migrations() {
    local service=$1
    
    if [[ "$SKIP_MIGRATIONS" == true ]]; then
        log_warning "Skipping migrations for $service"
        return 0
    fi
    
    log "Running zero-downtime migrations for $service..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "DRY RUN: Would run migrations for $service"
        return 0
    fi
    
    # Run migrations with timeout
    if timeout "$MIGRATION_TIMEOUT" docker-compose exec -T "$service" ./migrate -action=zero-downtime-up; then
        log_success "Migrations completed successfully for $service"
        return 0
    else
        log_error "Migrations failed for $service"
        return 1
    fi
}

# Function to deploy a service with blue-green strategy
deploy_service() {
    local service=$1
    local attempt=1
    
    log "Deploying $service with zero-downtime strategy..."
    
    while [[ $attempt -le $MAX_RETRY_ATTEMPTS ]]; do
        log "Deployment attempt $attempt/$MAX_RETRY_ATTEMPTS for $service"
        
        # Step 1: Run database migrations
        if ! run_migrations "$service"; then
            if [[ "$ROLLBACK_ON_FAILURE" == true ]]; then
                rollback_service "$service"
            fi
            ((attempt++))
            continue
        fi
        
        # Step 2: Pull latest image
        if [[ "$DRY_RUN" != true ]]; then
            if ! docker-compose pull "$service"; then
                log_error "Failed to pull image for $service"
                ((attempt++))
                continue
            fi
        fi
        
        # Step 3: Start new container alongside old one
        if [[ "$DRY_RUN" != true ]]; then
            # Create temporary service with new image
            if ! docker-compose up -d --scale "$service"=2 "$service"; then
                log_error "Failed to scale up $service"
                ((attempt++))
                continue
            fi
            
            # Wait for new instance to be healthy
            sleep 30  # Give time for container to start
            
            if [[ "$SKIP_HEALTH_CHECKS" != true ]]; then
                if ! check_service_health "$service"; then
                    log_error "New instance of $service failed health checks"
                    # Scale back down
                    docker-compose up -d --scale "$service"=1 "$service"
                    ((attempt++))
                    continue
                fi
            fi
            
            # Step 4: Remove old container (scale back to 1)
            docker-compose up -d --scale "$service"=1 "$service"
            
            # Final health check
            if [[ "$SKIP_HEALTH_CHECKS" != true ]]; then
                if ! check_service_health "$service"; then
                    log_error "Final health check failed for $service"
                    ((attempt++))
                    continue
                fi
            fi
        fi
        
        log_success "Successfully deployed $service"
        return 0
    done
    
    log_error "Failed to deploy $service after $MAX_RETRY_ATTEMPTS attempts"
    return 1
}

# Function to rollback a service
rollback_service() {
    local service=$1
    
    log_warning "Rolling back $service..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "DRY RUN: Would rollback $service"
        return 0
    fi
    
    # Rollback to previous migration
    docker-compose exec -T "$service" ./migrate -action=down || true
    
    # Restart service
    docker-compose restart "$service"
    
    log "Rollback completed for $service"
}

# Function to create deployment backup
create_backup() {
    log "Creating deployment backup..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "DRY RUN: Would create backup"
        return 0
    fi
    
    # Create database backup
    local backup_file="link_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if docker-compose exec -T postgres pg_dump -U linkuser linkdb > "/tmp/$backup_file"; then
        log_success "Database backup created: /tmp/$backup_file"
    else
        log_warning "Failed to create database backup"
    fi
}

# Function to perform pre-deployment checks
pre_deployment_checks() {
    log "Performing pre-deployment checks..."
    
    # Check disk space
    local available_space=$(df / | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 1048576 ]]; then  # Less than 1GB
        log_error "Insufficient disk space: ${available_space}KB available"
        exit 1
    fi
    
    # Check if all services are currently healthy
    if [[ "$SKIP_HEALTH_CHECKS" != true ]]; then
        for service in "${SERVICE_ARRAY[@]}"; do
            if ! check_service_health "$service"; then
                log_error "Pre-deployment health check failed for $service"
                exit 1
            fi
        done
    fi
    
    # Validate migration files
    for service in "${SERVICE_ARRAY[@]}"; do
        if [[ -d "$PROJECT_ROOT/$service/migrations" ]]; then
            log "Validating migrations for $service..."
            if ! docker-compose exec -T "$service" ./migrate -action=verify; then
                log_error "Migration validation failed for $service"
                exit 1
            fi
        fi
    done
    
    log_success "Pre-deployment checks passed"
}

# Function to perform post-deployment checks
post_deployment_checks() {
    log "Performing post-deployment checks..."
    
    # Health checks for all services
    if [[ "$SKIP_HEALTH_CHECKS" != true ]]; then
        for service in "${SERVICE_ARRAY[@]}"; do
            if ! check_service_health "$service"; then
                log_error "Post-deployment health check failed for $service"
                return 1
            fi
        done
    fi
    
    # Check API gateway connectivity
    if [[ "$DRY_RUN" != true ]]; then
        if ! docker-compose exec -T api-gateway wget -qO- http://localhost:8080/health/ready > /dev/null 2>&1; then
            log_error "API gateway health check failed"
            return 1
        fi
    fi
    
    log_success "Post-deployment checks passed"
    return 0
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local message="Zero-downtime deployment $status for environment: $ENVIRONMENT, services: $SERVICES"
    
    log "$message"
    
    # Here you would integrate with your notification system
    # Examples: Slack, email, webhook, etc.
    
    # Slack webhook example (if webhook URL is set)
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
}

# Main deployment function
main() {
    trap 'log_error "Deployment interrupted"; exit 1' INT TERM
    
    log "🚀 Starting zero-downtime deployment process"
    
    # Check dependencies
    check_dependencies
    
    # Create backup
    create_backup
    
    # Pre-deployment checks
    pre_deployment_checks
    
    # Deploy services
    local failed_services=()
    for service in "${SERVICE_ARRAY[@]}"; do
        if ! deploy_service "$service"; then
            failed_services+=("$service")
        fi
    done
    
    # Check if any deployments failed
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log_error "Deployment failed for services: ${failed_services[*]}"
        send_notification "FAILED"
        exit 1
    fi
    
    # Post-deployment checks
    if ! post_deployment_checks; then
        log_error "Post-deployment checks failed"
        send_notification "FAILED"
        exit 1
    fi
    
    log_success "🎉 Zero-downtime deployment completed successfully"
    send_notification "SUCCEEDED"
    
    # Cleanup old images
    if [[ "$DRY_RUN" != true ]]; then
        log "Cleaning up old Docker images..."
        docker image prune -f || true
    fi
    
    log "Deployment log saved to: $LOG_FILE"
}

# Run main function
main