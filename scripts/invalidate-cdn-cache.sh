#!/bin/bash

# CDN Cache Invalidation Script for Link App
# Supports all environments: development, staging, production

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Default values
ENVIRONMENT=""
PATHS=""
DISTRIBUTION_ID=""
WAIT_FOR_COMPLETION=false
DRY_RUN=false
VERBOSE=false

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${NC}🔍 $1${NC}"
    fi
}

# Help function
show_help() {
    cat << EOF
${BOLD}CDN Cache Invalidation Script${NC}

${BOLD}USAGE:${NC}
    $0 -e ENVIRONMENT [OPTIONS]

${BOLD}REQUIRED ARGUMENTS:${NC}
    -e, --environment ENV    Environment to invalidate (development|staging|production)

${BOLD}OPTIONS:${NC}
    -p, --paths PATHS        Paths to invalidate (default: environment-specific)
    -d, --distribution-id ID CloudFront distribution ID (auto-detected if not provided)
    -w, --wait              Wait for invalidation to complete
    -n, --dry-run           Show what would be invalidated without executing
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message

${BOLD}EXAMPLES:${NC}
    # Invalidate production CDN with default paths
    $0 -e production

    # Invalidate specific paths in staging
    $0 -e staging -p "/index.html,/manifest.json,/static/*"

    # Dry run for development
    $0 -e development -n -v

    # Invalidate and wait for completion
    $0 -e staging -w

    # Use specific distribution ID
    $0 -e production -d E1234567890123 -p "/*"

${BOLD}ENVIRONMENT-SPECIFIC DEFAULTS:${NC}
    ${BOLD}Development:${NC} Invalidates everything (/*) - fast iteration
    ${BOLD}Staging:${NC}     Invalidates common files - testing focused  
    ${BOLD}Production:${NC}  Selective invalidation - cost optimized

${BOLD}PREREQUISITES:${NC}
    - AWS CLI configured with appropriate permissions
    - Terraform outputs available in terraform/environments/{env}/
    - CloudFront distribution must exist

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -p|--paths)
                PATHS="$2"
                shift 2
                ;;
            -d|--distribution-id)
                DISTRIBUTION_ID="$2"
                shift 2
                ;;
            -w|--wait)
                WAIT_FOR_COMPLETION=true
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1\nUse -h or --help for usage information."
                ;;
        esac
    done

    # Validate required arguments
    if [ -z "$ENVIRONMENT" ]; then
        log_error "Environment is required. Use -e or --environment."
    fi

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production."
    fi
}

# Get default paths for environment
get_default_paths() {
    case "$ENVIRONMENT" in
        production)
            # Production: Selective invalidation to minimize costs
            echo "/index.html /manifest.json /service-worker.js /robots.txt /sitemap.xml"
            ;;
        staging)
            # Staging: Common files for testing
            echo "/index.html /manifest.json /service-worker.js /static/css/* /static/js/*"
            ;;
        development)
            # Development: Everything for fast iteration
            echo "/*"
            ;;
        *)
            echo "/*"
            ;;
    esac
}

# Get CloudFront distribution ID from Terraform output
get_distribution_id() {
    local terraform_env_dir="$TERRAFORM_DIR/environments/$ENVIRONMENT"
    
    if [ ! -d "$terraform_env_dir" ]; then
        log_error "Terraform environment directory not found: $terraform_env_dir"
    fi
    
    log_verbose "Checking Terraform outputs in: $terraform_env_dir"
    
    # Try different output names based on environment
    local output_names=()
    case "$ENVIRONMENT" in
        production)
            output_names=("cloudfront_distribution_id" "production_cdn_info" "cdn_distribution_id")
            ;;
        staging)
            output_names=("cloudfront_distribution_id" "staging_cdn_info" "cdn_distribution_id")
            ;;
        development)
            output_names=("cloudfront_distribution_id" "development_cdn_info" "cdn_distribution_id")
            ;;
    esac
    
    # Try to get distribution ID from Terraform outputs
    for output_name in "${output_names[@]}"; do
        log_verbose "Trying Terraform output: $output_name"
        
        local dist_id=""
        if dist_id=$(cd "$terraform_env_dir" && terraform output -raw "$output_name" 2>/dev/null); then
            if [[ "$dist_id" =~ ^E[A-Z0-9]{13}$ ]]; then
                echo "$dist_id"
                return 0
            elif [ "$output_name" = "production_cdn_info" ] || [ "$output_name" = "staging_cdn_info" ] || [ "$output_name" = "development_cdn_info" ]; then
                # Try to extract distribution ID from JSON output
                if dist_id=$(cd "$terraform_env_dir" && terraform output -json "$output_name" 2>/dev/null | jq -r '.distribution_id // .cloudfront_distribution_id // empty' 2>/dev/null); then
                    if [[ "$dist_id" =~ ^E[A-Z0-9]{13}$ ]]; then
                        echo "$dist_id"
                        return 0
                    fi
                fi
            fi
        fi
    done
    
    log_warning "Could not find CloudFront distribution ID in Terraform outputs"
    return 1
}

# Validate AWS CLI and permissions
validate_aws_setup() {
    log_verbose "Validating AWS CLI setup..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
    fi
    
    local aws_identity
    aws_identity=$(aws sts get-caller-identity --query 'Arn' --output text)
    log_verbose "AWS Identity: $aws_identity"
    
    # Check if we can access CloudFront
    if ! aws cloudfront list-distributions &> /dev/null; then
        log_error "No permission to access CloudFront or service unavailable"
    fi
    
    log_verbose "AWS setup validation passed"
}

# Validate distribution ID exists and is accessible
validate_distribution() {
    local dist_id="$1"
    
    log_verbose "Validating distribution ID: $dist_id"
    
    if [[ ! "$dist_id" =~ ^E[A-Z0-9]{13}$ ]]; then
        log_error "Invalid CloudFront distribution ID format: $dist_id"
    fi
    
    # Check if distribution exists and is accessible
    if ! aws cloudfront get-distribution --id "$dist_id" &> /dev/null; then
        log_error "CloudFront distribution not found or not accessible: $dist_id"
    fi
    
    # Get distribution status
    local status
    status=$(aws cloudfront get-distribution --id "$dist_id" --query 'Distribution.Status' --output text)
    log_verbose "Distribution status: $status"
    
    if [ "$status" != "Deployed" ]; then
        log_warning "Distribution is not in 'Deployed' status. Current status: $status"
        log_warning "Invalidation may not work as expected."
    fi
    
    log_verbose "Distribution validation passed"
}

# Create CloudFront invalidation
create_invalidation() {
    local dist_id="$1"
    local paths="$2"
    
    log_info "Creating CloudFront invalidation..."
    log_info "Distribution ID: $dist_id"
    log_info "Environment: $ENVIRONMENT"
    log_info "Paths: $paths"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN: Would create invalidation with the following paths:"
        echo "$paths" | tr ' ' '\n' | sed 's/^/  - /'
        return 0
    fi
    
    # Convert space-separated paths to JSON array format
    local paths_json
    paths_json=$(echo "$paths" | tr ' ' '\n' | jq -R . | jq -s .)
    
    log_verbose "Paths JSON: $paths_json"
    
    # Create the invalidation
    local invalidation_output
    invalidation_output=$(aws cloudfront create-invalidation \
        --distribution-id "$dist_id" \
        --invalidation-batch "Paths={Items=$paths_json,Quantity=$(echo "$paths" | wc -w)},CallerReference=$(date +%s)-$$" \
        --output json)
    
    if [ $? -ne 0 ]; then
        log_error "Failed to create CloudFront invalidation"
    fi
    
    # Extract invalidation ID
    local invalidation_id
    invalidation_id=$(echo "$invalidation_output" | jq -r '.Invalidation.Id')
    
    log_success "Invalidation created successfully!"
    log_info "Invalidation ID: $invalidation_id"
    
    # Get cost estimate
    local path_count
    path_count=$(echo "$paths" | wc -w)
    log_info "Paths invalidated: $path_count"
    
    if [ "$path_count" -gt 1000 ]; then
        local cost_estimate
        cost_estimate=$(echo "scale=2; ($path_count - 1000) * 0.005" | bc)
        log_warning "Cost estimate: \$${cost_estimate} (first 1000 paths are free)"
    else
        log_info "Cost: Free (within 1000 path limit)"
    fi
    
    # Wait for completion if requested
    if [ "$WAIT_FOR_COMPLETION" = true ]; then
        log_info "Waiting for invalidation to complete..."
        
        aws cloudfront wait invalidation-completed \
            --distribution-id "$dist_id" \
            --id "$invalidation_id"
        
        if [ $? -eq 0 ]; then
            log_success "Invalidation completed successfully!"
        else
            log_error "Invalidation wait failed or timed out"
        fi
    else
        log_info "Invalidation is in progress. Use 'aws cloudfront get-invalidation --distribution-id $dist_id --id $invalidation_id' to check status."
    fi
}

# Get current invalidations status
show_invalidation_status() {
    local dist_id="$1"
    
    log_info "Recent invalidations for distribution $dist_id:"
    
    aws cloudfront list-invalidations --distribution-id "$dist_id" --max-items 5 \
        --query 'InvalidationList.Items[*].[Id,Status,CreateTime,Paths.Quantity]' \
        --output table
}

# Main function
main() {
    echo -e "${BOLD}🚀 CDN Cache Invalidation Script${NC}"
    echo

    parse_arguments "$@"
    
    log_info "Starting CDN cache invalidation for environment: $ENVIRONMENT"
    
    # Validate AWS setup
    validate_aws_setup
    
    # Get distribution ID if not provided
    if [ -z "$DISTRIBUTION_ID" ]; then
        log_verbose "Distribution ID not provided, attempting auto-detection..."
        if ! DISTRIBUTION_ID=$(get_distribution_id); then
            log_error "Could not auto-detect CloudFront distribution ID. Please provide it with -d or --distribution-id."
        fi
        log_info "Auto-detected distribution ID: $DISTRIBUTION_ID"
    fi
    
    # Validate distribution
    validate_distribution "$DISTRIBUTION_ID"
    
    # Get paths if not provided
    if [ -z "$PATHS" ]; then
        PATHS=$(get_default_paths)
        log_info "Using default paths for $ENVIRONMENT environment"
    fi
    
    # Show current status if verbose
    if [ "$VERBOSE" = true ]; then
        show_invalidation_status "$DISTRIBUTION_ID"
        echo
    fi
    
    # Create invalidation
    create_invalidation "$DISTRIBUTION_ID" "$PATHS"
    
    log_success "CDN cache invalidation process completed!"
    echo
    
    # Show next steps
    log_info "Next steps:"
    echo "  1. Monitor invalidation progress in AWS Console"
    echo "  2. Test your CDN endpoints after completion"
    echo "  3. Verify cache headers are correct"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo
        log_info "Production deployment checklist:"
        echo "  ✓ CDN cache invalidated"
        echo "  ⏳ Verify application loads correctly"
        echo "  ⏳ Check performance metrics"
        echo "  ⏳ Monitor error rates"
    fi
}

# Run main function with all arguments
main "$@"