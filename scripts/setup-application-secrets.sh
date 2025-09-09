#!/bin/bash

# Setup Application Secrets in AWS Secrets Manager
# This script creates application-level secrets like JWT_SECRET, DATA_ENCRYPTION_KEY, etc.
# Usage: ./scripts/setup-application-secrets.sh [environment]

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SECRET_NAME="link-app/application"

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

# Generate secure key
generate_key() {
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
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid. Run 'aws configure' first."
        exit 1
    fi
}

# Setup application secrets
setup_application_secrets() {
    log_info "Setting up application secrets for environment: $ENVIRONMENT"
    
    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
        log_warn "Secret $SECRET_NAME already exists. Updating with new values..."
        
        # Get existing secret
        EXISTING_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)
        
        # Parse existing values
        JWT_SECRET=$(echo "$EXISTING_SECRET" | jq -r '.jwt_secret // empty')
        DATA_ENCRYPTION_KEY=$(echo "$EXISTING_SECRET" | jq -r '.data_encryption_key // empty')
        SERVICE_AUTH_TOKEN=$(echo "$EXISTING_SECRET" | jq -r '.service_auth_token // empty')
        
        # Generate new values for missing secrets
        if [[ -z "$JWT_SECRET" || "$JWT_SECRET" == "null" ]]; then
            JWT_SECRET=$(generate_key 64)
            log_info "Generated new JWT_SECRET"
        else
            log_info "Keeping existing JWT_SECRET"
        fi
        
        if [[ -z "$DATA_ENCRYPTION_KEY" || "$DATA_ENCRYPTION_KEY" == "null" ]]; then
            DATA_ENCRYPTION_KEY=$(generate_key 32)
            log_info "Generated new DATA_ENCRYPTION_KEY"
        else
            log_info "Keeping existing DATA_ENCRYPTION_KEY"
        fi
        
        if [[ -z "$SERVICE_AUTH_TOKEN" || "$SERVICE_AUTH_TOKEN" == "null" ]]; then
            SERVICE_AUTH_TOKEN=$(generate_key 32)
            log_info "Generated new SERVICE_AUTH_TOKEN"
        else
            log_info "Keeping existing SERVICE_AUTH_TOKEN"
        fi
    else
        log_info "Creating new secret $SECRET_NAME..."
        
        # Generate all new values
        JWT_SECRET=$(generate_key 64)
        DATA_ENCRYPTION_KEY=$(generate_key 32)
        SERVICE_AUTH_TOKEN=$(generate_key 32)
        
        log_info "Generated all new application secrets"
    fi
    
    # Create secret JSON with versioning support
    SECRET_JSON=$(jq -n \
        --arg jwt_secret "$JWT_SECRET" \
        --arg data_encryption_key "$DATA_ENCRYPTION_KEY" \
        --arg service_auth_token "$SERVICE_AUTH_TOKEN" \
        '{
            jwt_secret: $jwt_secret,
            data_encryption_key: $data_encryption_key,
            data_encryption_version: "2",
            data_encryption_legacy_keys: {},
            service_auth_token: $service_auth_token,
            created_at: now | strftime("%Y-%m-%d %H:%M:%S UTC"),
            environment: "'$ENVIRONMENT'"
        }')
    
    # Store or update the secret
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$SECRET_JSON" \
            >/dev/null
        log_info "Updated application secrets in AWS Secrets Manager"
    else
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --description "Application secrets for Link platform ($ENVIRONMENT)" \
            --secret-string "$SECRET_JSON" \
            >/dev/null
        log_info "Created application secrets in AWS Secrets Manager"
    fi
    
    # Add tags
    aws secretsmanager tag-resource \
        --secret-id "$SECRET_NAME" \
        --tags '[
            {"Key":"Environment","Value":"'$ENVIRONMENT'"},
            {"Key":"Application","Value":"Link"},
            {"Key":"ManagedBy","Value":"script"},
            {"Key":"SecretType","Value":"application"}
        ]' >/dev/null 2>&1 || true
    
    log_info "✅ Application secrets setup completed successfully!"
    
    # Display summary (without showing actual secrets)
    echo ""
    echo "📋 Summary:"
    echo "  Secret Name: $SECRET_NAME"
    echo "  Environment: $ENVIRONMENT"
    echo "  Region: $AWS_REGION"
    echo "  Secrets configured:"
    echo "    - JWT_SECRET (64 chars)"
    echo "    - DATA_ENCRYPTION_KEY (32 chars)"
    echo "    - SERVICE_AUTH_TOKEN (32 chars)"
    echo ""
    echo "🔄 Next steps:"
    echo "  1. Update External Secrets configuration in K8s"
    echo "  2. Restart affected services to pick up new secrets"
    echo "  3. Verify secret propagation: kubectl get secrets -n link-services"
}

# Verify secrets were created
verify_secrets() {
    log_info "Verifying secrets were created..."
    
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
        log_info "✅ Secret $SECRET_NAME exists in AWS Secrets Manager"
        
        # Get secret metadata
        SECRET_INFO=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME")
        CREATED_DATE=$(echo "$SECRET_INFO" | jq -r '.CreatedDate')
        MODIFIED_DATE=$(echo "$SECRET_INFO" | jq -r '.LastChangedDate')
        
        echo "  Created: $CREATED_DATE"
        echo "  Modified: $MODIFIED_DATE"
    else
        log_error "❌ Failed to create secret $SECRET_NAME"
        exit 1
    fi
}

# Main execution
main() {
    echo "🔐 Link Application Secrets Setup"
    echo "=================================="
    echo ""
    
    check_dependencies
    setup_application_secrets
    verify_secrets
    
    echo ""
    echo "🎉 Application secrets setup completed successfully!"
    echo ""
    echo "⚠️  Important Notes:"
    echo "  - Secrets are stored securely in AWS Secrets Manager"
    echo "  - External Secrets Operator will sync these to Kubernetes"
    echo "  - Secrets are automatically rotated by AWS (if configured)"
    echo "  - Use 'aws secretsmanager get-secret-value --secret-id $SECRET_NAME' to view (if needed)"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi