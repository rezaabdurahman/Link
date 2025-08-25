#!/bin/bash

# Script to update image tags in ArgoCD applications
# Usage: ./update-image-tags.sh <environment> <image_tag> [service_name]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ARGOCD_DIR="k8s/argocd"
HELM_APP_FILE="$ARGOCD_DIR/link-helm-app.yaml"
MICROSERVICES_FILE="$ARGOCD_DIR/microservices-apps.yaml"

# Available services
SERVICES=("user-svc" "chat-svc" "ai-svc" "discovery-svc" "search-svc" "api-gateway")
ENVIRONMENTS=("dev" "staging" "production")

# Helper functions
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

usage() {
    echo "Usage: $0 <environment> <image_tag> [service_name]"
    echo ""
    echo "Arguments:"
    echo "  environment  - Target environment (dev|staging|production)"
    echo "  image_tag    - New image tag (e.g., v1.0.0, sha-abc1234, latest)"
    echo "  service_name - Optional: specific service to update (default: all services)"
    echo ""
    echo "Examples:"
    echo "  $0 staging sha-abc1234                    # Update all services in staging"
    echo "  $0 production v1.0.0                     # Update all services in production"
    echo "  $0 dev latest user-svc                   # Update only user-svc in dev"
    echo ""
    echo "Available services: ${SERVICES[*]}"
    echo "Available environments: ${ENVIRONMENTS[*]}"
    exit 1
}

validate_environment() {
    local env="$1"
    if [[ ! " ${ENVIRONMENTS[*]} " =~ " $env " ]]; then
        log_error "Invalid environment: $env"
        log_info "Available environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi
}

validate_service() {
    local service="$1"
    if [[ ! " ${SERVICES[*]} " =~ " $service " ]]; then
        log_error "Invalid service: $service"
        log_info "Available services: ${SERVICES[*]}"
        exit 1
    fi
}

check_dependencies() {
    local missing_deps=()
    
    if ! command -v yq &> /dev/null; then
        missing_deps+=("yq")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        echo "To install yq:"
        echo "  sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64"
        echo "  sudo chmod +x /usr/local/bin/yq"
        exit 1
    fi
}

backup_files() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="backups/image-tags-$timestamp"
    
    log_info "Creating backup in $backup_dir"
    mkdir -p "$backup_dir"
    
    cp "$HELM_APP_FILE" "$backup_dir/"
    cp "$MICROSERVICES_FILE" "$backup_dir/"
    
    log_success "Backup created: $backup_dir"
}

update_helm_application() {
    local environment="$1"
    local image_tag="$2"
    local app_name=""
    
    case "$environment" in
        "dev")
            app_name="link-app-dev"
            ;;
        "staging")
            app_name="link-app-staging"
            ;;
        "production")
            app_name="link-app-production"
            ;;
    esac
    
    log_info "Updating Helm application: $app_name"
    
    # Update the specific application's image tag
    yq eval "(.[] | select(.metadata.name == \"$app_name\") | .spec.source.helm.parameters[] | select(.name == \"global.image.tag\").value) = \"$image_tag\"" \
        -i "$HELM_APP_FILE"
    
    log_success "Updated $app_name image tag to: $image_tag"
}

update_microservice_application() {
    local service="$1"
    local image_tag="$2"
    
    log_info "Updating microservice: $service"
    
    # Update the specific microservice's image tag
    yq eval "(.[] | select(.metadata.name == \"$service\") | .spec.source.helm.parameters[] | select(.name == \"image.tag\").value) = \"$image_tag\"" \
        -i "$MICROSERVICES_FILE"
    
    log_success "Updated $service image tag to: $image_tag"
}

update_all_microservices() {
    local image_tag="$1"
    
    log_info "Updating all microservices with tag: $image_tag"
    
    for service in "${SERVICES[@]}"; do
        update_microservice_application "$service" "$image_tag"
    done
}

generate_commit_message() {
    local environment="$1"
    local image_tag="$2"
    local service="$3"
    
    if [ "$service" = "all" ]; then
        echo "ci: update $environment image tags to $image_tag"
    else
        echo "ci: update $service image tag to $image_tag in $environment"
    fi
}

commit_changes() {
    local environment="$1"
    local image_tag="$2"
    local service="${3:-all}"
    
    local commit_msg=$(generate_commit_message "$environment" "$image_tag" "$service")
    
    # Check if there are changes to commit
    if git diff --quiet "$HELM_APP_FILE" "$MICROSERVICES_FILE"; then
        log_warning "No changes detected, nothing to commit"
        return 0
    fi
    
    log_info "Committing changes..."
    git add "$HELM_APP_FILE" "$MICROSERVICES_FILE"
    git commit -m "$commit_msg"
    
    log_success "Changes committed: $commit_msg"
}

validate_yaml_files() {
    log_info "Validating YAML files after changes..."
    
    local files=("$HELM_APP_FILE" "$MICROSERVICES_FILE")
    
    for file in "${files[@]}"; do
        if yq eval '.' "$file" > /dev/null 2>&1; then
            log_success "✅ $file is valid"
        else
            log_error "❌ $file has invalid YAML syntax"
            exit 1
        fi
    done
}

show_current_tags() {
    local environment="$1"
    
    log_info "Current image tags for $environment:"
    echo ""
    
    # Show Helm application tags
    case "$environment" in
        "dev")
            app_name="link-app-dev"
            ;;
        "staging")
            app_name="link-app-staging"
            ;;
        "production")
            app_name="link-app-production"
            ;;
    esac
    
    local helm_tag=$(yq eval "(.[] | select(.metadata.name == \"$app_name\") | .spec.source.helm.parameters[] | select(.name == \"global.image.tag\").value)" "$HELM_APP_FILE")
    echo "  Helm Application ($app_name): $helm_tag"
    
    # Show microservice tags
    echo "  Microservices:"
    for service in "${SERVICES[@]}"; do
        local service_tag=$(yq eval "(.[] | select(.metadata.name == \"$service\") | .spec.source.helm.parameters[] | select(.name == \"image.tag\").value)" "$MICROSERVICES_FILE" 2>/dev/null || echo "not found")
        echo "    $service: $service_tag"
    done
    echo ""
}

main() {
    # Parse arguments
    if [ $# -lt 2 ] || [ $# -gt 3 ]; then
        usage
    fi
    
    local environment="$1"
    local image_tag="$2"
    local service="${3:-all}"
    
    # Validate inputs
    validate_environment "$environment"
    
    if [ "$service" != "all" ]; then
        validate_service "$service"
    fi
    
    # Check dependencies
    check_dependencies
    
    # Verify we're in the correct directory
    if [ ! -f "$HELM_APP_FILE" ] || [ ! -f "$MICROSERVICES_FILE" ]; then
        log_error "ArgoCD application files not found. Please run from repository root."
        exit 1
    fi
    
    # Show current state
    show_current_tags "$environment"
    
    # Create backup
    backup_files
    
    # Update image tags
    log_info "Updating image tags..."
    
    if [ "$service" = "all" ]; then
        # Update Helm application
        update_helm_application "$environment" "$image_tag"
        
        # Update all microservices
        update_all_microservices "$image_tag"
    else
        # Update specific microservice only
        update_microservice_application "$service" "$image_tag"
    fi
    
    # Validate changes
    validate_yaml_files
    
    # Show updated state
    echo ""
    show_current_tags "$environment"
    
    # Commit changes
    commit_changes "$environment" "$image_tag" "$service"
    
    log_success "Image tag update completed successfully!"
    
    echo ""
    echo "Next steps:"
    echo "1. Push changes to Git: git push origin $(git branch --show-current)"
    echo "2. ArgoCD will automatically detect changes and sync applications"
    echo "3. Monitor deployment in ArgoCD UI"
    
    if [ "$environment" = "production" ]; then
        log_warning "Production deployments require manual sync approval in ArgoCD"
    fi
}

# Run main function with all arguments
main "$@"