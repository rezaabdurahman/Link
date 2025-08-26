#!/bin/bash

# Setup Sentry Configuration in AWS Secrets Manager
# This script stores Sentry DSNs and configuration in AWS Secrets Manager
# Usage: ./scripts/setup-sentry-secrets.sh [environment] [backend-dsn] [frontend-dsn]

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-production}"
BACKEND_DSN="${2:-}"
FRONTEND_DSN="${3:-}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SECRET_NAME="link-app/observability/sentry"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Show usage
show_usage() {
    echo "Usage: $0 [environment] [backend-dsn] [frontend-dsn]"
    echo ""
    echo "Arguments:"
    echo "  environment   Target environment (default: production)"
    echo "  backend-dsn   Sentry DSN for backend services (optional - will prompt)"
    echo "  frontend-dsn  Sentry DSN for frontend (optional - will prompt)"
    echo ""
    echo "Environment variables:"
    echo "  AWS_REGION    AWS region (default: us-west-2)"
    echo ""
    echo "Example:"
    echo "  $0 production https://abc@123.ingest.sentry.io/456 https://def@789.ingest.sentry.io/012"
    echo ""
}

# Validate DSN format
validate_dsn() {
    local dsn="$1"
    if [[ ! "$dsn" =~ ^https://[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io/[0-9]+$ ]]; then
        return 1
    fi
    return 0
}

# Prompt for DSN if not provided
prompt_for_dsn() {
    local service="$1"
    local dsn_var="$2"
    
    if [[ -z "${!dsn_var}" ]]; then
        echo ""
        log_info "Please provide the Sentry DSN for $service"
        echo "Example: https://abc123@456789.ingest.sentry.io/789012"
        read -p "Enter $service DSN: " dsn
        
        if [[ -z "$dsn" ]]; then
            log_error "$service DSN cannot be empty"
            exit 1
        fi
        
        if ! validate_dsn "$dsn"; then
            log_error "Invalid DSN format for $service"
            log_info "DSN should be in format: https://KEY@INGEST_URL/PROJECT_ID"
            exit 1
        fi
        
        eval "$dsn_var='$dsn'"
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    command -v aws >/dev/null 2>&1 || { 
        log_error "AWS CLI is required but not installed. Please install it first."
        exit 1
    }
    
    command -v jq >/dev/null 2>&1 || { 
        log_error "jq is required but not installed. Please install it first."
        exit 1
    }
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_info "Dependencies check passed ✓"
}

# Extract project info from DSN
extract_project_info() {
    local dsn="$1"
    # Extract project ID (last part after /)
    echo "$dsn" | sed 's/.*\///'
}

# Create secret structure
create_secret_json() {
    local backend_project_id=$(extract_project_info "$BACKEND_DSN")
    local frontend_project_id=$(extract_project_info "$FRONTEND_DSN")
    
    # Prompt for additional info
    echo ""
    log_info "Please provide additional Sentry configuration:"
    
    read -p "Sentry Organization slug (e.g., your-org): " organization
    if [[ -z "$organization" ]]; then
        log_error "Organization slug cannot be empty"
        exit 1
    fi
    
    read -p "Backend project slug (default: link-backend): " backend_project
    backend_project="${backend_project:-link-backend}"
    
    read -p "Frontend project slug (default: link-frontend): " frontend_project
    frontend_project="${frontend_project:-link-frontend}"
    
    read -p "Sentry Auth Token (for CI/CD releases): " -s auth_token
    echo ""
    if [[ -z "$auth_token" ]]; then
        log_warn "No auth token provided - CI/CD release tracking will be disabled"
        auth_token=""
    fi
    
    cat <<EOF
{
  "backend_dsn": "$BACKEND_DSN",
  "frontend_dsn": "$FRONTEND_DSN",
  "environment": "$ENVIRONMENT",
  "organization": "$organization",
  "backend_project": "$backend_project",
  "frontend_project": "$frontend_project",
  "backend_project_id": "$backend_project_id",
  "frontend_project_id": "$frontend_project_id",
  "auth_token": "$auth_token",
  "release": "unknown",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "description": "Sentry configuration for Link application observability"
}
EOF
}

# Main execution
main() {
    # Check for help flag
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "Setting up Sentry secrets for environment: $ENVIRONMENT"
    
    check_dependencies
    
    # Prompt for DSNs if not provided
    prompt_for_dsn "backend" BACKEND_DSN
    prompt_for_dsn "frontend" FRONTEND_DSN
    
    log_debug "Backend DSN: ${BACKEND_DSN:0:30}..."
    log_debug "Frontend DSN: ${FRONTEND_DSN:0:30}..."
    
    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
        log_warn "Secret '$SECRET_NAME' already exists."
        read -p "Do you want to update it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Aborted by user."
            exit 0
        fi
        
        # Update existing secret
        log_info "Updating existing secret..."
        SECRET_JSON=$(create_secret_json)
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$SECRET_JSON" \
            --region "$AWS_REGION" \
            --description "Sentry configuration for Link application - Updated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    else
        # Create new secret
        log_info "Creating new secret..."
        SECRET_JSON=$(create_secret_json)
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --description "Sentry configuration for Link application observability" \
            --secret-string "$SECRET_JSON" \
            --region "$AWS_REGION" \
            --tags '[
                {"Key":"Project","Value":"Link"},
                {"Key":"Component","Value":"Observability"},
                {"Key":"Environment","Value":"'$ENVIRONMENT'"},
                {"Key":"ManagedBy","Value":"external-secrets-operator"}
            ]'
    fi
    
    if [ $? -eq 0 ]; then
        log_info "✓ Sentry configuration successfully stored in AWS Secrets Manager"
        log_info "Secret ARN: arn:aws:secretsmanager:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):secret:$SECRET_NAME"
        
        echo ""
        log_info "Next steps:"
        echo "1. Apply the Sentry external secrets: kubectl apply -f k8s/secrets/sentry-external-secrets.yaml"
        echo "2. Verify secrets are synced: kubectl get secrets -n link-services sentry-config -o yaml"
        echo "3. Update service deployments to use the new Sentry environment variables"
        echo "4. Deploy services and verify Sentry error tracking is working"
        
        echo ""
        log_info "Sentry Projects:"
        echo "- Backend: https://sentry.io/organizations/$(echo "$organization")/projects/$(echo "$backend_project")/"
        echo "- Frontend: https://sentry.io/organizations/$(echo "$organization")/projects/$(echo "$frontend_project")/"
    else
        log_error "Failed to create/update secret in AWS Secrets Manager"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    # Clean up any temporary files if created
    unset SECRET_JSON 2>/dev/null || true
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"