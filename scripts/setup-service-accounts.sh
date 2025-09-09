#!/bin/bash

# Service Account Setup Script for CI/CD
# This script automatically creates and configures service accounts for all microservices

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-linkdb}"
DB_USER="${DB_USER:-link_user}"
ENVIRONMENT="${ENVIRONMENT:-development}"
SECRETS_BACKEND="${SECRETS_BACKEND:-kubernetes}" # kubernetes, aws, vault, env

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if database is accessible
    if ! command -v psql &> /dev/null; then
        log_error "psql is required but not installed"
        exit 1
    fi
    
    # Check database connectivity
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log_error "Cannot connect to database"
        exit 1
    fi
    
    # Check kubectl for Kubernetes secrets (if using k8s)
    if [[ "$SECRETS_BACKEND" == "kubernetes" ]] && ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required for Kubernetes secrets management"
        exit 1
    fi
    
    # Check AWS CLI for AWS Secrets Manager
    if [[ "$SECRETS_BACKEND" == "aws" ]] && ! command -v aws &> /dev/null; then
        log_error "AWS CLI is required for AWS Secrets Manager"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Generate secure client secret
generate_client_secret() {
    # Use OpenSSL to generate a cryptographically secure secret
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Hash client secret using bcrypt equivalent
hash_client_secret() {
    local secret="$1"
    # Use htpasswd to create bcrypt hash (equivalent to Go's bcrypt.GenerateFromPassword)
    echo "$secret" | htpasswd -bnBC 12 "" | tr -d ':\n' | sed 's/^[^$]*\$//'
}

# Create service account in database
create_service_account() {
    local service_name="$1"
    local description="$2"
    local scopes="$3"
    
    log_info "Creating service account for $service_name..."
    
    # Generate credentials
    local client_id="svc_${service_name}_$(openssl rand -hex 4)"
    local client_secret=$(generate_client_secret)
    local client_secret_hash=$(hash_client_secret "$client_secret")
    
    # Insert into database
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
INSERT INTO service_accounts (name, description, client_id, client_secret_hash, scopes, is_active)
VALUES (
    '$service_name',
    '$description', 
    '$client_id',
    '$client_secret_hash',
    '$scopes'::jsonb,
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    scopes = EXCLUDED.scopes,
    updated_at = NOW();
EOF

    log_info "Service account created: $client_id"
    
    # Store credentials securely
    store_service_credentials "$service_name" "$client_id" "$client_secret"
    
    echo "$client_id"  # Return client_id for role assignment
}

# Store service credentials in chosen backend
store_service_credentials() {
    local service_name="$1"
    local client_id="$2"
    local client_secret="$3"
    
    case "$SECRETS_BACKEND" in
        "kubernetes")
            store_kubernetes_secret "$service_name" "$client_id" "$client_secret"
            ;;
        "aws")
            store_aws_secret "$service_name" "$client_id" "$client_secret"
            ;;
        "vault")
            store_vault_secret "$service_name" "$client_id" "$client_secret"
            ;;
        "env")
            store_env_file "$service_name" "$client_id" "$client_secret"
            ;;
        *)
            log_error "Unknown secrets backend: $SECRETS_BACKEND"
            exit 1
            ;;
    esac
}

# Store in Kubernetes secrets
store_kubernetes_secret() {
    local service_name="$1"
    local client_id="$2"
    local client_secret="$3"
    
    log_info "Storing credentials in Kubernetes secret for $service_name"
    
    kubectl create secret generic "${service_name}-service-account" \
        --from-literal="SERVICE_CLIENT_ID=${client_id}" \
        --from-literal="SERVICE_CLIENT_SECRET=${client_secret}" \
        --from-literal="AUTH_SERVICE_URL=http://user-svc:8082" \
        --dry-run=client -o yaml | kubectl apply -f -
        
    # Add labels for better management
    kubectl label secret "${service_name}-service-account" \
        app.kubernetes.io/name="$service_name" \
        app.kubernetes.io/component=service-account \
        app.kubernetes.io/managed-by=ci-cd \
        --overwrite
}

# Store in AWS Secrets Manager
store_aws_secret() {
    local service_name="$1"
    local client_id="$2"
    local client_secret="$3"
    
    log_info "Storing credentials in AWS Secrets Manager for $service_name"
    
    local secret_name="link-app/${ENVIRONMENT}/${service_name}/service-account"
    local secret_value=$(cat << EOF
{
    "SERVICE_CLIENT_ID": "${client_id}",
    "SERVICE_CLIENT_SECRET": "${client_secret}",
    "AUTH_SERVICE_URL": "https://user-svc.link-app.internal"
}
EOF
    )
    
    # Create or update secret
    if aws secretsmanager describe-secret --secret-id "$secret_name" &> /dev/null; then
        aws secretsmanager update-secret --secret-id "$secret_name" --secret-string "$secret_value"
    else
        aws secretsmanager create-secret --name "$secret_name" --secret-string "$secret_value" \
            --description "Service account credentials for $service_name"
    fi
}

# Store in HashiCorp Vault
store_vault_secret() {
    local service_name="$1"
    local client_id="$2"
    local client_secret="$3"
    
    log_info "Storing credentials in Vault for $service_name"
    
    vault kv put "secret/link-app/${ENVIRONMENT}/${service_name}/service-account" \
        SERVICE_CLIENT_ID="$client_id" \
        SERVICE_CLIENT_SECRET="$client_secret" \
        AUTH_SERVICE_URL="https://user-svc.link-app.internal"
}

# Store in environment file (for development)
store_env_file() {
    local service_name="$1"
    local client_id="$2"
    local client_secret="$3"
    
    log_info "Storing credentials in .env file for $service_name"
    
    local env_file="backend/${service_name}/.env.service-account"
    
    cat > "$env_file" << EOF
# Service account credentials for $service_name
# Generated automatically by CI/CD on $(date)
SERVICE_CLIENT_ID=$client_id
SERVICE_CLIENT_SECRET=$client_secret
AUTH_SERVICE_URL=http://user-svc:8082
EOF
    
    # Secure the file
    chmod 600 "$env_file"
    log_info "Credentials stored in $env_file (mode 600)"
}

# Assign role to service account
assign_service_role() {
    local service_name="$1"
    local role_name="$2"
    
    log_info "Assigning role '$role_name' to service '$service_name'"
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
INSERT INTO service_account_roles (service_account_id, role_id)
SELECT sa.id, r.id
FROM service_accounts sa, roles r
WHERE sa.name = '$service_name' AND r.name = '$role_name'
ON CONFLICT (service_account_id, role_id) DO NOTHING;
EOF
}

# Rotate credentials for a service
rotate_service_credentials() {
    local service_name="$1"
    
    log_info "Rotating credentials for $service_name"
    
    # Generate new credentials
    local client_secret=$(generate_client_secret)
    local client_secret_hash=$(hash_client_secret "$client_secret")
    
    # Get current client_id
    local client_id=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT client_id FROM service_accounts WHERE name = '$service_name';" | xargs)
    
    if [[ -z "$client_id" ]]; then
        log_error "Service account not found: $service_name"
        return 1
    fi
    
    # Update database
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
UPDATE service_accounts 
SET client_secret_hash = '$client_secret_hash', updated_at = NOW()
WHERE name = '$service_name';
EOF

    # Update stored credentials
    store_service_credentials "$service_name" "$client_id" "$client_secret"
    
    log_info "Credentials rotated successfully for $service_name"
}

# Main service setup function
setup_service_accounts() {
    log_info "Setting up service accounts for Link application"
    
    # Define services and their configurations
    declare -A services=(
        ["user-svc"]="User management service|{\"scopes\": [\"user_management\", \"authentication\"]}|service:user-management"
        ["chat-svc"]="Chat and messaging service|{\"scopes\": [\"messaging\", \"notifications\"]}|service:messaging"
        ["ai-svc"]="AI processing service|{\"scopes\": [\"ai_processing\", \"content_analysis\"]}|service:ai-processing"
        ["discovery-svc"]="User discovery service|{\"scopes\": [\"user_discovery\", \"search\"]}|service:discovery"
        ["search-svc"]="Search and indexing service|{\"scopes\": [\"search\", \"indexing\"]}|service:discovery"
    )
    
    # Create service accounts
    for service_name in "${!services[@]}"; do
        IFS='|' read -r description scopes role <<< "${services[$service_name]}"
        
        create_service_account "$service_name" "$description" "$scopes"
        assign_service_role "$service_name" "$role"
    done
    
    log_info "✅ Service account setup completed successfully"
}

# Generate deployment manifests
generate_deployment_manifests() {
    log_info "Generating Kubernetes deployment manifests with service account integration"
    
    for service in user-svc chat-svc ai-svc discovery-svc search-svc; do
        cat > "k8s/${service}-deployment-with-service-auth.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service}
  labels:
    app: ${service}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${service}
  template:
    metadata:
      labels:
        app: ${service}
    spec:
      containers:
      - name: ${service}
        image: ${service}:latest
        ports:
        - containerPort: 8080
        env:
        # Service account credentials from Kubernetes secrets
        - name: SERVICE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: ${service}-service-account
              key: SERVICE_CLIENT_ID
        - name: SERVICE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: ${service}-service-account
              key: SERVICE_CLIENT_SECRET
        - name: AUTH_SERVICE_URL
          valueFrom:
            secretKeyRef:
              name: ${service}-service-account
              key: AUTH_SERVICE_URL
        # Database configuration
        - name: DB_HOST
          value: "postgres-service"
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: "linkdb"
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: password
        # Redis configuration
        - name: REDIS_HOST
          value: "redis-service"
        - name: REDIS_PORT
          value: "6379"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: password
              optional: true
        # Application configuration
        - name: ENVIRONMENT
          value: "${ENVIRONMENT}"
        - name: LOG_LEVEL
          value: "info"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ${service}
  labels:
    app: ${service}
spec:
  selector:
    app: ${service}
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP
EOF
    done
    
    log_info "✅ Kubernetes manifests generated in k8s/ directory"
}

# Health check for service accounts
health_check() {
    log_info "Performing health check on service accounts"
    
    local failed_services=()
    
    for service in user-svc chat-svc ai-svc discovery-svc search-svc; do
        log_info "Checking $service..."
        
        # Check if service account exists in database
        local count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM service_accounts WHERE name = '$service' AND is_active = true;" | xargs)
        
        if [[ "$count" != "1" ]]; then
            log_error "Service account not found or inactive: $service"
            failed_services+=("$service")
            continue
        fi
        
        # Check if credentials exist in secrets backend
        case "$SECRETS_BACKEND" in
            "kubernetes")
                if ! kubectl get secret "${service}-service-account" &> /dev/null; then
                    log_error "Kubernetes secret not found: ${service}-service-account"
                    failed_services+=("$service")
                fi
                ;;
            "aws")
                if ! aws secretsmanager describe-secret --secret-id "link-app/${ENVIRONMENT}/${service}/service-account" &> /dev/null; then
                    log_error "AWS secret not found for: $service"
                    failed_services+=("$service")
                fi
                ;;
        esac
    done
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log_info "✅ All service accounts are healthy"
        return 0
    else
        log_error "❌ Failed services: ${failed_services[*]}"
        return 1
    fi
}

# Main function
main() {
    case "${1:-setup}" in
        "setup")
            check_prerequisites
            setup_service_accounts
            generate_deployment_manifests
            ;;
        "rotate")
            check_prerequisites
            if [[ -z "${2:-}" ]]; then
                log_error "Usage: $0 rotate <service-name>"
                exit 1
            fi
            rotate_service_credentials "$2"
            ;;
        "health-check")
            check_prerequisites
            health_check
            ;;
        "generate-manifests")
            generate_deployment_manifests
            ;;
        *)
            echo "Usage: $0 {setup|rotate <service>|health-check|generate-manifests}"
            echo ""
            echo "Commands:"
            echo "  setup              - Create service accounts and store credentials"
            echo "  rotate <service>   - Rotate credentials for a specific service"
            echo "  health-check       - Verify all service accounts are healthy"
            echo "  generate-manifests - Generate Kubernetes deployment manifests"
            echo ""
            echo "Environment variables:"
            echo "  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Database connection"
            echo "  ENVIRONMENT - Environment name (development, staging, production)"
            echo "  SECRETS_BACKEND - Where to store secrets (kubernetes, aws, vault, env)"
            exit 1
            ;;
    esac
}

main "$@"