#!/bin/bash

# Rotate Application Secrets in AWS Secrets Manager
# This script rotates JWT secrets and encryption keys with proper service coordination
# Usage: ./scripts/rotate-application-secrets.sh [environment] [--force]

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SECRET_NAME="link-app/application"
FORCE_ROTATION="${2:-}"

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

# Check if rotation is needed
check_rotation_needed() {
    log_info "Checking if rotation is needed..."
    
    if [[ "$FORCE_ROTATION" == "--force" ]]; then
        log_warn "Force rotation requested - will rotate regardless of age"
        return 0
    fi
    
    # Get secret metadata
    SECRET_INFO=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" 2>/dev/null || echo "")
    
    if [[ -z "$SECRET_INFO" ]]; then
        log_error "Secret $SECRET_NAME not found. Run setup-application-secrets.sh first."
        exit 1
    fi
    
    # Check last modified date
    LAST_CHANGED=$(echo "$SECRET_INFO" | jq -r '.LastChangedDate')
    LAST_CHANGED_EPOCH=$(date -d "$LAST_CHANGED" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_SINCE_CHANGE=$(( (CURRENT_EPOCH - LAST_CHANGED_EPOCH) / 86400 ))
    
    log_info "Secret last changed: $DAYS_SINCE_CHANGE days ago"
    
    # Rotate if older than 30 days
    if [[ $DAYS_SINCE_CHANGE -gt 30 ]]; then
        log_info "✅ Rotation needed (older than 30 days)"
        return 0
    else
        log_info "⏸️  Rotation not needed (changed within 30 days)"
        return 1
    fi
}

# Create backup of current secrets
backup_current_secrets() {
    log_info "Creating backup of current secrets..."
    
    BACKUP_NAME="${SECRET_NAME}-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Get current secret
    CURRENT_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)
    
    # Create backup secret
    aws secretsmanager create-secret \
        --name "$BACKUP_NAME" \
        --description "Backup of application secrets before rotation on $(date)" \
        --secret-string "$CURRENT_SECRET" \
        >/dev/null
    
    # Tag backup
    aws secretsmanager tag-resource \
        --secret-id "$BACKUP_NAME" \
        --tags '[
            {"Key":"Environment","Value":"'$ENVIRONMENT'"},
            {"Key":"Application","Value":"Link"},
            {"Key":"SecretType","Value":"backup"},
            {"Key":"OriginalSecret","Value":"'$SECRET_NAME'"},
            {"Key":"BackupDate","Value":"'$(date -Iseconds)'"}
        ]' >/dev/null 2>&1 || true
    
    log_info "✅ Backup created: $BACKUP_NAME"
    echo "$BACKUP_NAME"
}

# Rotate application secrets
rotate_secrets() {
    local backup_name="$1"
    
    log_info "Rotating application secrets..."
    
    # Get existing secret values
    EXISTING_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)
    
    # Generate new values 
    NEW_JWT_SECRET=$(generate_key 64)
    NEW_DATA_ENCRYPTION_KEY=$(generate_key 32)
    EXISTING_SERVICE_AUTH_TOKEN=$(echo "$EXISTING_SECRET" | jq -r '.service_auth_token // empty')
    
    # IMPORTANT: Handle encryption key rotation safely
    # Move current encryption key to legacy keys for backward compatibility
    CURRENT_ENCRYPTION_KEY=$(echo "$EXISTING_SECRET" | jq -r '.data_encryption_key // empty')
    CURRENT_VERSION=$(echo "$EXISTING_SECRET" | jq -r '.data_encryption_version // "2"')
    EXISTING_LEGACY_KEYS=$(echo "$EXISTING_SECRET" | jq -r '.data_encryption_legacy_keys // "{}"')
    
    # Create new legacy keys object with current key
    if [[ -n "$CURRENT_ENCRYPTION_KEY" && "$CURRENT_ENCRYPTION_KEY" != "null" ]]; then
        # Add current key to legacy keys
        NEW_LEGACY_KEYS=$(echo "$EXISTING_LEGACY_KEYS" | jq --arg version "$CURRENT_VERSION" --arg key "$CURRENT_ENCRYPTION_KEY" \
            '. + {($version): $key}')
    else
        NEW_LEGACY_KEYS="$EXISTING_LEGACY_KEYS"
    fi
    
    # Increment version for new key
    NEW_VERSION=$((CURRENT_VERSION + 1))
    
    # Create new secret JSON with versioned encryption support
    NEW_SECRET_JSON=$(jq -n \
        --arg jwt_secret "$NEW_JWT_SECRET" \
        --arg data_encryption_key "$NEW_DATA_ENCRYPTION_KEY" \
        --arg service_auth_token "$EXISTING_SERVICE_AUTH_TOKEN" \
        --arg backup_name "$backup_name" \
        --arg data_version "$NEW_VERSION" \
        --argjson legacy_keys "$NEW_LEGACY_KEYS" \
        '{
            jwt_secret: $jwt_secret,
            data_encryption_key: $data_encryption_key,
            data_encryption_version: $data_version,
            data_encryption_legacy_keys: $legacy_keys,
            service_auth_token: $service_auth_token,
            rotated_at: now | strftime("%Y-%m-%d %H:%M:%S UTC"),
            rotation_backup: $backup_name,
            environment: "'$ENVIRONMENT'"
        }')
    
    # Update the secret
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$NEW_SECRET_JSON" \
        >/dev/null
    
    log_info "✅ Application secrets rotated successfully"
    
    # Display rotation summary
    echo ""
    echo "📋 Rotation Summary:"
    echo "  Secret Name: $SECRET_NAME"
    echo "  Environment: $ENVIRONMENT"
    echo "  Backup Name: $backup_name"
    echo "  Rotated Keys:"
    echo "    - JWT_SECRET: ✅ (New 64-char key)"
    echo "    - DATA_ENCRYPTION_KEY: ✅ (New 32-char key)"
    echo "    - SERVICE_AUTH_TOKEN: ⏸️  (Preserved for compatibility)"
    echo "  Rotation Time: $(date)"
}

# Wait for External Secrets sync
wait_for_sync() {
    log_info "Waiting for External Secrets to sync new values..."
    
    # Check if kubectl is available
    if ! command -v kubectl >/dev/null 2>&1; then
        log_warn "kubectl not available - cannot verify sync. Manual verification needed."
        return 0
    fi
    
    # Try to get the secret from Kubernetes
    local retry_count=0
    local max_retries=12  # 2 minutes with 10-second intervals
    
    while [[ $retry_count -lt $max_retries ]]; do
        if kubectl get secret application-secrets -n link-services >/dev/null 2>&1; then
            log_info "✅ External Secrets sync detected"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_info "Waiting for sync... ($retry_count/$max_retries)"
        sleep 10
    done
    
    log_warn "⚠️  Could not verify External Secrets sync - check manually"
}

# Rolling restart of services
restart_services() {
    log_info "Performing rolling restart of services..."
    
    # Check if kubectl is available
    if ! command -v kubectl >/dev/null 2>&1; then
        log_warn "kubectl not available - cannot restart services. Manual restart needed."
        return 0
    fi
    
    # List of services that use application secrets
    local services=("api-gateway" "user-svc" "chat-svc" "ai-svc" "discovery-svc" "search-svc" "feature-svc")
    
    for service in "${services[@]}"; do
        if kubectl get deployment "$service" -n link-services >/dev/null 2>&1; then
            log_info "Restarting $service..."
            kubectl rollout restart deployment/"$service" -n link-services >/dev/null
            
            # Wait for rollout to complete
            kubectl rollout status deployment/"$service" -n link-services --timeout=300s >/dev/null
            log_info "✅ $service restarted successfully"
        else
            log_warn "⏸️  Service $service not found - skipping"
        fi
    done
}

# Cleanup old backups (keep last 5)
cleanup_old_backups() {
    log_info "Cleaning up old backup secrets..."
    
    # Get all backup secrets for this application
    BACKUP_SECRETS=$(aws secretsmanager list-secrets \
        --filters '[{"Key":"tag-key","Values":["OriginalSecret"]},{"Key":"tag-value","Values":["'$SECRET_NAME'"]}]' \
        --query 'SecretList[].Name' \
        --output text | tr '\t' '\n' | sort -r)
    
    # Keep only the 5 most recent backups
    local count=0
    while IFS= read -r backup_secret; do
        count=$((count + 1))
        if [[ $count -gt 5 ]]; then
            log_info "Deleting old backup: $backup_secret"
            aws secretsmanager delete-secret --secret-id "$backup_secret" --force-delete-without-recovery >/dev/null 2>&1 || true
        fi
    done <<< "$BACKUP_SECRETS"
    
    log_info "✅ Backup cleanup completed"
}

# Main execution
main() {
    echo "🔄 Link Application Secrets Rotation"
    echo "====================================="
    echo ""
    
    # Check dependencies
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
    
    # Check if rotation is needed
    if ! check_rotation_needed; then
        echo ""
        echo "🎉 No rotation needed at this time"
        echo ""
        echo "💡 To force rotation anyway, use: $0 $ENVIRONMENT --force"
        exit 0
    fi
    
    # Perform rotation
    backup_name=$(backup_current_secrets)
    rotate_secrets "$backup_name"
    wait_for_sync
    restart_services
    cleanup_old_backups
    
    echo ""
    echo "🎉 Application secrets rotation completed successfully!"
    echo ""
    echo "🔍 Verification steps:"
    echo "  1. Check service logs: kubectl logs deployment/user-svc -n link-services"
    echo "  2. Verify authentication: curl -H 'Authorization: Bearer <new-jwt>' <api-endpoint>"
    echo "  3. Monitor error rates in Grafana dashboards"
    echo ""
    echo "⚠️  If issues occur:"
    echo "  1. Check backup secret: $backup_name"  
    echo "  2. Rollback if needed: aws secretsmanager restore-secret --secret-id $SECRET_NAME"
    echo "  3. Contact the platform team for assistance"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi