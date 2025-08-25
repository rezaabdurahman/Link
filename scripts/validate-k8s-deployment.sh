#!/bin/bash

# Link Platform - Kubernetes Deployment Validation Script
# This script validates the k8s configuration before deployment

set -euo pipefail

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

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_ROOT/k8s"

# Validation counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Function to increment counters
check_passed() {
    ((TOTAL_CHECKS++))
    ((PASSED_CHECKS++))
    log_success "$1"
}

check_failed() {
    ((TOTAL_CHECKS++))
    ((FAILED_CHECKS++))
    log_error "$1"
}

check_warning() {
    ((WARNINGS++))
    log_warning "$1"
}

# Function to check if a file exists
check_file_exists() {
    local file="$1"
    local description="$2"
    
    if [[ -f "$file" ]]; then
        check_passed "$description exists: $file"
        return 0
    else
        check_failed "$description missing: $file"
        return 1
    fi
}

# Function to check directory structure
check_directory_structure() {
    log_info "Checking k8s directory structure..."
    
    local required_dirs=(
        "foundations"
        "infrastructure/cache"
        "infrastructure/database" 
        "infrastructure/vector-db"
        "helm/link-app"
        "helm/link-app/templates"
        "access"
        "argocd"
        "standalone"
        "linkerd"
        "cloudnative-pg"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$K8S_DIR/$dir" ]]; then
            check_passed "Directory exists: k8s/$dir"
        else
            check_failed "Directory missing: k8s/$dir"
        fi
    done
}

# Function to check required files
check_required_files() {
    log_info "Checking required configuration files..."
    
    # Foundation files
    check_file_exists "$K8S_DIR/foundations/00-prerequisites.yaml" "Prerequisites configuration"
    check_file_exists "$K8S_DIR/foundations/01-secrets.yaml" "Secrets configuration"
    
    # Infrastructure files
    check_file_exists "$K8S_DIR/infrastructure/database/pgbouncer-configmap.yaml" "PgBouncer ConfigMap"
    check_file_exists "$K8S_DIR/infrastructure/database/pgbouncer-deployment.yaml" "PgBouncer Deployment"
    check_file_exists "$K8S_DIR/infrastructure/database/pgbouncer-service.yaml" "PgBouncer Service"
    check_file_exists "$K8S_DIR/infrastructure/cache/redis-cluster-ha.yaml" "Redis Cluster HA"
    check_file_exists "$K8S_DIR/infrastructure/vector-db/qdrant-cluster.yaml" "Qdrant Cluster"
    
    # Helm chart files
    check_file_exists "$K8S_DIR/helm/link-app/Chart.yaml" "Helm Chart definition"
    check_file_exists "$K8S_DIR/helm/link-app/values.yaml" "Helm values"
    check_file_exists "$K8S_DIR/helm/link-app/values-dev.yaml" "Dev environment values"
    check_file_exists "$K8S_DIR/helm/link-app/values-staging.yaml" "Staging environment values"
    check_file_exists "$K8S_DIR/helm/link-app/values-prod.yaml" "Production environment values"
    check_file_exists "$K8S_DIR/helm/link-app/templates/_helpers.tpl" "Helm helpers"
    
    # Service templates
    local services=("user-svc" "chat-svc" "ai-svc" "discovery-svc" "search-svc" "api-gateway" "frontend")
    for service in "${services[@]}"; do
        check_file_exists "$K8S_DIR/helm/link-app/templates/${service}-deployment.yaml" "$service template"
    done
    
    # ArgoCD applications
    check_file_exists "$K8S_DIR/argocd/root-app.yaml" "ArgoCD Root Application"
    check_file_exists "$K8S_DIR/argocd/microservices-apps.yaml" "Microservices Applications"
    check_file_exists "$K8S_DIR/argocd/infrastructure-apps.yaml" "Infrastructure Applications"
    
    # Security files
    check_file_exists "$K8S_DIR/access/rbac.yaml" "RBAC Configuration"
    check_file_exists "$K8S_DIR/access/network-policies.yaml" "Network Policies"
}

# Function to validate YAML syntax
validate_yaml_syntax() {
    log_info "Validating YAML syntax..."
    
    local yaml_files
    yaml_files=$(find "$K8S_DIR" -name "*.yaml" -o -name "*.yml" | grep -v ".git")
    
    local yaml_errors=0
    while IFS= read -r file; do
        if command -v yamllint >/dev/null 2>&1; then
            if yamllint -d relaxed "$file" >/dev/null 2>&1; then
                # Don't spam with individual file success - just count
                :
            else
                check_failed "YAML syntax error in: $file"
                ((yaml_errors++))
            fi
        elif command -v yq >/dev/null 2>&1; then
            if yq eval . "$file" >/dev/null 2>&1; then
                # Don't spam with individual file success - just count
                :
            else
                check_failed "YAML syntax error in: $file"
                ((yaml_errors++))
            fi
        else
            check_warning "No YAML validator found (install yamllint or yq for syntax validation)"
            break
        fi
    done <<< "$yaml_files"
    
    if [[ $yaml_errors -eq 0 ]] && { command -v yamllint >/dev/null 2>&1 || command -v yq >/dev/null 2>&1; }; then
        check_passed "All YAML files have valid syntax"
    fi
}

# Function to check namespace consistency
check_namespace_consistency() {
    log_info "Checking namespace consistency..."
    
    # Check that all resources use link-services namespace
    local inconsistent_namespaces=0
    local yaml_files
    yaml_files=$(find "$K8S_DIR" -name "*.yaml" -o -name "*.yml" | grep -v ".git" | grep -v "prerequisites" | grep -v "root-app")
    
    while IFS= read -r file; do
        if grep -q "namespace:" "$file"; then
            local namespaces
            namespaces=$(grep "namespace:" "$file" | grep -v "link-services" | grep -v "argocd" | grep -v "default" | grep -v "kube-system" | grep -v "monitoring" | grep -v "linkerd")
            if [[ -n "$namespaces" ]]; then
                check_warning "Potential namespace inconsistency in $file: $namespaces"
                ((inconsistent_namespaces++))
            fi
        fi
    done <<< "$yaml_files"
    
    if [[ $inconsistent_namespaces -eq 0 ]]; then
        check_passed "Namespace consistency validated"
    fi
}

# Function to check image registry consistency  
check_image_registry_consistency() {
    log_info "Checking image registry consistency..."
    
    local registry_issues=0
    local yaml_files
    yaml_files=$(find "$K8S_DIR" -name "*.yaml" -o -name "*.yml" | grep -v ".git")
    
    # Check for non-standard registries (allow ghcr.io/rezaabdurahman, bitnami, postgres, etc)
    while IFS= read -r file; do
        if grep -q "image:" "$file"; then
            # Look for images that don't use our standard registry or approved third-party registries
            local bad_images
            bad_images=$(grep "image:" "$file" | grep -v "ghcr.io/rezaabdurahman" | grep -v "bitnami" | grep -v "postgres" | grep -v "redis" | grep -v "qdrant" | grep -v "linkerd" | grep -v "^\s*#" | grep -v "repository:" || true)
            if [[ -n "$bad_images" ]]; then
                check_warning "Non-standard image registry in $file: $bad_images"
                ((registry_issues++))
            fi
        fi
    done <<< "$yaml_files"
    
    if [[ $registry_issues -eq 0 ]]; then
        check_passed "Image registry consistency validated"
    fi
}

# Function to validate ArgoCD application paths
validate_argocd_paths() {
    log_info "Validating ArgoCD application paths..."
    
    local path_errors=0
    local argocd_files
    argocd_files=$(find "$K8S_DIR/argocd" -name "*.yaml" | grep -v "root-app.yaml")
    
    while IFS= read -r file; do
        if grep -q "path:" "$file"; then
            local paths
            paths=$(grep "path:" "$file" | grep -o "k8s/[^[:space:]]*" || true)
            while IFS= read -r path; do
                if [[ -n "$path" ]]; then
                    local full_path="$PROJECT_ROOT/$path"
                    if [[ ! -d "$full_path" ]]; then
                        check_failed "ArgoCD path does not exist: $path (in $file)"
                        ((path_errors++))
                    fi
                fi
            done <<< "$paths"
        fi
    done <<< "$argocd_files"
    
    if [[ $path_errors -eq 0 ]]; then
        check_passed "All ArgoCD application paths are valid"
    fi
}

# Function to check for orphaned files
check_for_orphaned_files() {
    log_info "Checking for orphaned or duplicate files..."
    
    # Check for backup files and duplicates
    local orphaned_files
    orphaned_files=$(find "$K8S_DIR" \( -name "*.bak" -o -name "*~" -o -name "*.tmp" -o -name "*2.yaml" -o -name "*.orig" \) | head -5)
    
    if [[ -n "$orphaned_files" ]]; then
        check_warning "Found potential orphaned files:"
        echo "$orphaned_files" | while IFS= read -r file; do
            log_warning "  - $file"
        done
    else
        check_passed "No orphaned files found"
    fi
}

# Function to validate Helm chart dependencies
validate_helm_dependencies() {
    log_info "Validating Helm chart dependencies..."
    
    if [[ -f "$K8S_DIR/helm/link-app/Chart.yaml" ]]; then
        # Check if Chart.yaml is valid
        if command -v helm >/dev/null 2>&1; then
            if helm lint "$K8S_DIR/helm/link-app" >/dev/null 2>&1; then
                check_passed "Helm chart passes lint validation"
            else
                check_failed "Helm chart fails lint validation"
            fi
            
            # Check for dependency updates needed
            if [[ -f "$K8S_DIR/helm/link-app/Chart.lock" ]]; then
                check_passed "Helm dependencies are locked"
            else
                check_warning "Helm dependencies not locked (run 'helm dependency update')"
            fi
        else
            check_warning "Helm CLI not found - skipping Helm validation"
        fi
    fi
}

# Function to check resource definitions
validate_resource_definitions() {
    log_info "Validating Kubernetes resource definitions..."
    
    local resource_errors=0
    
    # Check for required fields in deployments
    local deployment_files
    deployment_files=$(find "$K8S_DIR" -name "*deployment*.yaml")
    
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            # Check for required security contexts
            if ! grep -q "securityContext:" "$file"; then
                check_warning "Missing securityContext in $file"
            fi
            
            # Check for resource limits
            if ! grep -q "resources:" "$file"; then
                check_warning "Missing resource limits in $file"
            fi
            
            # Check for health checks
            if ! grep -q "livenessProbe:\|readinessProbe:" "$file"; then
                check_warning "Missing health checks in $file"
            fi
        fi
    done <<< "$deployment_files"
    
    check_passed "Resource definition validation completed"
}

# Main execution
main() {
    echo "=========================================="
    echo "Link Platform - K8s Deployment Validation"
    echo "=========================================="
    echo
    
    log_info "Starting validation of k8s configuration..."
    echo
    
    # Run all checks
    check_directory_structure
    echo
    
    check_required_files
    echo
    
    validate_yaml_syntax
    echo
    
    check_namespace_consistency
    echo
    
    check_image_registry_consistency
    echo
    
    validate_argocd_paths
    echo
    
    check_for_orphaned_files
    echo
    
    validate_helm_dependencies
    echo
    
    validate_resource_definitions
    echo
    
    # Print summary
    echo "=========================================="
    echo "VALIDATION SUMMARY"
    echo "=========================================="
    echo
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log_success "✅ ALL VALIDATIONS PASSED!"
        echo -e "${GREEN}Total Checks: $TOTAL_CHECKS${NC}"
        echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
        if [[ $WARNINGS -gt 0 ]]; then
            echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        fi
        echo
        log_success "🚀 K8s configuration is ready for deployment!"
        echo
        echo "Next steps:"
        echo "1. Build and push container images to ghcr.io/rezaabdurahman"
        echo "2. Configure external secrets (AWS Secrets Manager)"
        echo "3. Deploy ArgoCD root application: kubectl apply -f k8s/argocd/root-app.yaml"
        echo "4. Monitor deployment progress in ArgoCD UI"
        echo
        exit 0
    else
        log_error "❌ VALIDATION FAILED!"
        echo -e "${RED}Total Checks: $TOTAL_CHECKS${NC}"
        echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
        echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
        if [[ $WARNINGS -gt 0 ]]; then
            echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        fi
        echo
        log_error "Please fix the above issues before deployment."
        exit 1
    fi
}

# Check if script is being sourced or executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi