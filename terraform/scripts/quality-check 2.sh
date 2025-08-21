#!/bin/bash

# Terraform Quality Check Script
# Runs comprehensive quality checks on Terraform code

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
EXIT_CODE=0

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

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}"
}

# Check if required tools are installed
check_dependencies() {
    local missing_tools=()
    
    if ! command -v terraform &> /dev/null; then
        missing_tools+=("terraform")
    fi
    
    if ! command -v tflint &> /dev/null; then
        missing_tools+=("tflint")
    fi
    
    if ! command -v tfsec &> /dev/null; then
        missing_tools+=("tfsec")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install missing tools:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                "terraform")
                    log_info "  - terraform: https://www.terraform.io/downloads.html"
                    ;;
                "tflint")
                    log_info "  - tflint: brew install tflint"
                    ;;
                "tfsec")
                    log_info "  - tfsec: brew install tfsec"
                    ;;
            esac
        done
        exit 1
    fi
}

# Run Terraform validation
run_terraform_validate() {
    log_section "Terraform Validation"
    
    cd "$TERRAFORM_DIR"
    
    # Check each environment
    for env in development staging production; do
        if [ -d "environments/$env" ]; then
            log_info "Validating environment: $env"
            
            # Initialize without backend for validation
            if terraform -chdir="environments/$env" init -backend=false &>/dev/null; then
                if terraform -chdir="environments/$env" validate; then
                    log_info "✅ $env: Validation passed"
                else
                    log_error "❌ $env: Validation failed"
                    EXIT_CODE=1
                fi
            else
                log_error "❌ $env: Failed to initialize"
                EXIT_CODE=1
            fi
        fi
    done
    
    # Validate root module
    log_info "Validating root module"
    if terraform init -backend=false &>/dev/null; then
        if terraform validate; then
            log_info "✅ Root module: Validation passed"
        else
            log_error "❌ Root module: Validation failed"
            EXIT_CODE=1
        fi
    else
        log_error "❌ Root module: Failed to initialize"
        EXIT_CODE=1
    fi
}

# Run Terraform formatting check
run_terraform_fmt() {
    log_section "Terraform Formatting"
    
    cd "$TERRAFORM_DIR"
    
    if terraform fmt -check -recursive; then
        log_info "✅ All files are properly formatted"
    else
        log_warn "⚠️  Some files are not properly formatted"
        log_info "Run 'terraform fmt -recursive' to fix formatting"
        EXIT_CODE=1
    fi
}

# Run TFLint
run_tflint() {
    log_section "TFLint Analysis"
    
    cd "$TERRAFORM_DIR"
    
    # Initialize TFLint plugins
    if [ -f ".tflint.hcl" ]; then
        log_info "Initializing TFLint plugins..."
        tflint --init
    fi
    
    # Run TFLint
    if tflint --recursive; then
        log_info "✅ TFLint analysis passed"
    else
        log_error "❌ TFLint analysis failed"
        EXIT_CODE=1
    fi
}

# Run TFSec security scan
run_tfsec() {
    log_section "TFSec Security Scan"
    
    cd "$TERRAFORM_DIR"
    
    local tfsec_args="--format default --include-passed=false"
    
    if [ -f ".tfsec.yml" ]; then
        tfsec_args="$tfsec_args --config-file .tfsec.yml"
    fi
    
    if eval "tfsec $tfsec_args ."; then
        log_info "✅ Security scan passed"
    else
        log_error "❌ Security scan failed"
        EXIT_CODE=1
    fi
}

# Run Checkov scan (if available)
run_checkov() {
    log_section "Checkov Policy Scan"
    
    if ! command -v checkov &> /dev/null; then
        log_warn "Checkov not installed, skipping policy scan"
        log_info "Install with: pip install checkov"
        return 0
    fi
    
    cd "$TERRAFORM_DIR"
    
    if checkov -d . --framework terraform --quiet; then
        log_info "✅ Policy scan passed"
    else
        log_error "❌ Policy scan failed"
        EXIT_CODE=1
    fi
}

# Check for secrets in code
check_secrets() {
    log_section "Secret Detection"
    
    cd "$TERRAFORM_DIR"
    
    # Basic grep for common secret patterns
    local secret_patterns=(
        "password.*=.*[\"'][^\"']*[\"']"
        "secret.*=.*[\"'][^\"']*[\"']"
        "token.*=.*[\"'][^\"']*[\"']"
        "key.*=.*[\"'][^\"']*[\"']"
        "AKIA[0-9A-Z]{16}"  # AWS access key
        "AIza[0-9A-Za-z\\-_]{35}"  # Google API key
    )
    
    local secrets_found=false
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -n -E "$pattern" --include="*.tf" --include="*.tfvars" . 2>/dev/null; then
            secrets_found=true
        fi
    done
    
    if [ "$secrets_found" = true ]; then
        log_error "❌ Potential secrets detected in code"
        EXIT_CODE=1
    else
        log_info "✅ No secrets detected"
    fi
}

# Generate documentation
generate_docs() {
    log_section "Documentation Generation"
    
    if ! command -v terraform-docs &> /dev/null; then
        log_warn "terraform-docs not installed, skipping documentation generation"
        log_info "Install with: brew install terraform-docs"
        return 0
    fi
    
    cd "$TERRAFORM_DIR"
    
    # Generate docs for root module
    terraform-docs markdown . > TERRAFORM_DOCS.md
    log_info "✅ Generated documentation: TERRAFORM_DOCS.md"
    
    # Generate docs for each module
    for module_dir in modules/*/; do
        if [ -d "$module_dir" ]; then
            module_name=$(basename "$module_dir")
            terraform-docs markdown "$module_dir" > "$module_dir/README_GENERATED.md"
            log_info "✅ Generated documentation for module: $module_name"
        fi
    done
}

# Print summary
print_summary() {
    log_section "Quality Check Summary"
    
    if [ $EXIT_CODE -eq 0 ]; then
        log_info "🎉 All quality checks passed!"
    else
        log_error "💥 Some quality checks failed!"
        log_info "Review the output above and fix the issues before proceeding."
    fi
}

# Main execution
main() {
    log_info "Starting Terraform quality checks..."
    
    check_dependencies
    
    # Run all checks
    run_terraform_validate
    run_terraform_fmt
    run_tflint
    run_tfsec
    run_checkov
    check_secrets
    generate_docs
    
    print_summary
    
    exit $EXIT_CODE
}

# Print usage if requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [--help]"
    echo ""
    echo "Runs comprehensive quality checks on Terraform code:"
    echo "  - Terraform validation and formatting"
    echo "  - TFLint static analysis"
    echo "  - TFSec security scanning"
    echo "  - Checkov policy scanning (if available)"
    echo "  - Secret detection"
    echo "  - Documentation generation (if terraform-docs available)"
    echo ""
    echo "Prerequisites:"
    echo "  - terraform"
    echo "  - tflint"
    echo "  - tfsec"
    echo "  - checkov (optional)"
    echo "  - terraform-docs (optional)"
    exit 0
fi

# Execute main function
main "$@"