#!/bin/bash

# Setup Database Secrets in AWS Secrets Manager
# This script generates secure passwords and stores them in AWS Secrets Manager
# Usage: ./scripts/setup-database-secrets.sh [environment]

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SECRET_NAME="link-app/database/postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Generate secure password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
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
    
    command -v openssl >/dev/null 2>&1 || { 
        log_error "openssl is required but not installed. Please install it first."
        exit 1
    }
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_info "Dependencies check passed ✓"
}

# Create secret structure
create_secret_json() {
    local linkuser_password=$(generate_password 32)
    local user_service_password=$(generate_password 32)
    local chat_service_password=$(generate_password 32)
    local discovery_service_password=$(generate_password 32)
    local search_service_password=$(generate_password 32)
    local ai_service_password=$(generate_password 32)
    local feature_service_password=$(generate_password 32)
    local streaming_replica_password=$(generate_password 32)
    
    cat <<EOF
{
  "linkuser_password": "$linkuser_password",
  "user_service_password": "$user_service_password",
  "chat_service_password": "$chat_service_password",
  "discovery_service_password": "$discovery_service_password",
  "search_service_password": "$search_service_password",
  "ai_service_password": "$ai_service_password",
  "feature_service_password": "$feature_service_password",
  "streaming_replica_password": "$streaming_replica_password",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "description": "PostgreSQL passwords for Link application services"
}
EOF
}

# Main execution
main() {
    log_info "Setting up database secrets for environment: $ENVIRONMENT"
    
    check_dependencies
    
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
            --description "PostgreSQL passwords for Link application - Updated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    else
        # Create new secret
        log_info "Creating new secret..."
        SECRET_JSON=$(create_secret_json)
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --description "PostgreSQL passwords for Link application services" \
            --secret-string "$SECRET_JSON" \
            --region "$AWS_REGION" \
            --tags '[
                {"Key":"Project","Value":"Link"},
                {"Key":"Component","Value":"Database"},
                {"Key":"Environment","Value":"'$ENVIRONMENT'"},
                {"Key":"ManagedBy","Value":"external-secrets-operator"}
            ]'
    fi
    
    if [ $? -eq 0 ]; then
        log_info "✓ Database secrets successfully stored in AWS Secrets Manager"
        log_info "Secret ARN: arn:aws:secretsmanager:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):secret:$SECRET_NAME"
        
        echo ""
        log_info "Next steps:"
        echo "1. Ensure External Secrets Operator is deployed in your cluster"
        echo "2. Apply the database external secrets: kubectl apply -f k8s/secrets/database-external-secrets.yaml"
        echo "3. Verify secrets are synced: kubectl get secrets -n link-services | grep postgres"
        echo "4. Apply the updated CloudNativePG cluster configuration"
        echo "5. Run the password setup job after cluster initialization"
        
        echo ""
        log_warn "IMPORTANT: Store the secret ARN securely - you'll need it for disaster recovery!"
    else
        log_error "Failed to create/update secret in AWS Secrets Manager"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Clean up any temporary files if created
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"