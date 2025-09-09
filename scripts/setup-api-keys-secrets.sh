#!/bin/bash

# Setup API Keys in AWS Secrets Manager
# This script creates third-party API key secrets (OpenAI, Qdrant, etc.)
# Usage: ./scripts/setup-api-keys-secrets.sh [environment]

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SECRET_NAME="link-app/api-keys"

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

# Get API key from user input
get_api_key() {
    local key_name="$1"
    local key_description="$2"
    local current_value="$3"
    
    if [[ -n "$current_value" && "$current_value" != "null" && "$current_value" != "" ]]; then
        echo ""
        echo "Current $key_name: ${current_value:0:10}..."
        read -p "Keep existing $key_name? [Y/n]: " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            read -p "Enter new $key_description: " -r
            echo "$REPLY"
        else
            echo "$current_value"
        fi
    else
        echo ""
        read -p "Enter $key_description: " -r
        echo "$REPLY"
    fi
}

# Setup API key secrets
setup_api_keys() {
    log_info "Setting up API key secrets for environment: $ENVIRONMENT"
    
    # Initialize variables
    OPENAI_API_KEY=""
    QDRANT_API_KEY=""
    
    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
        log_warn "Secret $SECRET_NAME already exists. Checking for existing values..."
        
        # Get existing secret
        EXISTING_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)
        
        # Parse existing values
        EXISTING_OPENAI=$(echo "$EXISTING_SECRET" | jq -r '.openai_api_key // empty')
        EXISTING_QDRANT=$(echo "$EXISTING_SECRET" | jq -r '.qdrant_api_key // empty')
        
        # Interactive input for API keys
        OPENAI_API_KEY=$(get_api_key "OpenAI API Key" "OpenAI API key (sk-proj-...)" "$EXISTING_OPENAI")
        QDRANT_API_KEY=$(get_api_key "Qdrant API Key" "Qdrant API key" "$EXISTING_QDRANT")
        
    else
        log_info "Creating new secret $SECRET_NAME..."
        
        # Interactive input for new API keys
        echo ""
        echo "🤖 Setting up third-party API keys"
        echo "   Leave empty to skip optional keys"
        echo ""
        
        read -p "Enter OpenAI API key (required for AI features): " -r
        OPENAI_API_KEY="$REPLY"
        
        read -p "Enter Qdrant API key (optional, leave empty for local): " -r
        QDRANT_API_KEY="$REPLY"
    fi
    
    # Validate required keys
    if [[ -z "$OPENAI_API_KEY" ]]; then
        log_error "OpenAI API key is required for AI service functionality"
        exit 1
    fi
    
    if [[ ! "$OPENAI_API_KEY" =~ ^sk-(proj-)?[a-zA-Z0-9]{20,}$ ]]; then
        log_warn "OpenAI API key format appears invalid (expected: sk-proj-... or sk-...)"
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Aborting due to invalid API key format"
            exit 1
        fi
    fi
    
    # Create secret JSON
    SECRET_JSON=$(jq -n \
        --arg openai_key "$OPENAI_API_KEY" \
        --arg qdrant_key "$QDRANT_API_KEY" \
        '{
            openai_api_key: $openai_key,
            qdrant_api_key: $qdrant_key,
            created_at: now | strftime("%Y-%m-%d %H:%M:%S UTC"),
            environment: "'$ENVIRONMENT'"
        }')
    
    # Store or update the secret
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$SECRET_JSON" \
            >/dev/null
        log_info "Updated API keys in AWS Secrets Manager"
    else
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --description "Third-party API keys for Link platform ($ENVIRONMENT)" \
            --secret-string "$SECRET_JSON" \
            >/dev/null
        log_info "Created API keys in AWS Secrets Manager"
    fi
    
    # Add tags
    aws secretsmanager tag-resource \
        --secret-id "$SECRET_NAME" \
        --tags '[
            {"Key":"Environment","Value":"'$ENVIRONMENT'"},
            {"Key":"Application","Value":"Link"},
            {"Key":"ManagedBy","Value":"script"},
            {"Key":"SecretType","Value":"api-keys"}
        ]' >/dev/null 2>&1 || true
    
    log_info "✅ API keys setup completed successfully!"
    
    # Display summary (without showing actual keys)
    echo ""
    echo "📋 Summary:"
    echo "  Secret Name: $SECRET_NAME"
    echo "  Environment: $ENVIRONMENT"
    echo "  Region: $AWS_REGION"
    echo "  API Keys configured:"
    echo "    - OpenAI API Key: ${OPENAI_API_KEY:0:10}... (${#OPENAI_API_KEY} chars)"
    if [[ -n "$QDRANT_API_KEY" ]]; then
        echo "    - Qdrant API Key: ${QDRANT_API_KEY:0:10}... (${#QDRANT_API_KEY} chars)"
    else
        echo "    - Qdrant API Key: (not set - using local Qdrant)"
    fi
}

# Verify secrets were created
verify_secrets() {
    log_info "Verifying API keys were created..."
    
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
    echo "🔑 Link API Keys Setup"
    echo "====================="
    echo ""
    
    check_dependencies
    setup_api_keys
    verify_secrets
    
    echo ""
    echo "🎉 API keys setup completed successfully!"
    echo ""
    echo "🔄 Next steps:"
    echo "  1. Verify External Secrets sync: kubectl get secrets -n link-services"
    echo "  2. Restart AI service to pick up new keys: kubectl rollout restart deployment/ai-svc -n link-services"
    echo "  3. Check service logs for successful API key detection"
    echo ""
    echo "⚠️  Security reminders:"
    echo "  - API keys are stored securely in AWS Secrets Manager"
    echo "  - Keys are automatically synced to Kubernetes via External Secrets"
    echo "  - Rotate keys regularly and update them using this script"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi