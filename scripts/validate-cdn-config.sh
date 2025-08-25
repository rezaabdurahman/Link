#!/bin/bash

# CDN Configuration Validation Script
# Checks the CDN Terraform configuration for common issues

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
    ((CHECKS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
    ((CHECKS++))
}

echo -e "${BOLD}🔍 CDN Configuration Validation${NC}"
echo

# Check if we're in the project root
if [ ! -d "terraform/modules/cdn" ]; then
    log_error "Not in project root - terraform/modules/cdn directory not found"
    exit 1
fi

log_info "Validating CDN module structure..."

# Check required files exist
REQUIRED_FILES=(
    "terraform/modules/cdn/main.tf"
    "terraform/modules/cdn/variables.tf"
    "terraform/modules/cdn/outputs.tf" 
    "terraform/modules/cdn/lambda.tf"
    "terraform/modules/cdn/templates/security_headers.js.tpl"
    "terraform/modules/cdn/templates/url_rewrite.js.tpl"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "Required file exists: $file"
    else
        log_error "Missing required file: $file"
    fi
done

# Check environment configurations
ENVIRONMENTS=("production" "staging" "development")

for env in "${ENVIRONMENTS[@]}"; do
    env_file="terraform/environments/$env/cdn.tf"
    if [ -f "$env_file" ]; then
        log_success "Environment config exists: $env"
        
        # Check for provider alias
        if grep -q "provider.*us_east_1" "$env_file"; then
            log_success "US East 1 provider configured for $env"
        else
            log_error "Missing US East 1 provider alias in $env"
        fi
        
        # Check module provider mapping
        if grep -q "providers.*us_east_1" "$env_file"; then
            log_success "Provider mapping configured for $env"
        else
            log_error "Missing provider mapping in $env module call"
        fi
    else
        log_error "Missing environment config: $env"
    fi
done

# Check main.tf for common issues
MAIN_TF="terraform/modules/cdn/main.tf"

log_info "Validating main.tf configuration..."

# Check for provider alias requirement
if grep -q "configuration_aliases.*us_east_1" "$MAIN_TF"; then
    log_success "Provider alias configured in module"
else
    log_error "Missing provider alias configuration in module"
fi

# Check CloudFront distribution configuration
if grep -q "aws_cloudfront_distribution.*main" "$MAIN_TF"; then
    log_success "CloudFront distribution defined"
    
    # Check for proper cache behaviors
    if grep -q "ordered_cache_behavior" "$MAIN_TF"; then
        log_success "Cache behaviors configured"
    else
        log_warning "No ordered cache behaviors found"
    fi
    
    # Check for custom error responses (SPA routing)
    if grep -q "custom_error_response" "$MAIN_TF"; then
        log_success "Custom error responses configured for SPA routing"
    else
        log_warning "Missing custom error responses for SPA routing"
    fi
else
    log_error "CloudFront distribution not found"
fi

# Check S3 bucket security
if grep -q "aws_s3_bucket_public_access_block" "$MAIN_TF"; then
    log_success "S3 bucket public access blocked"
else
    log_error "S3 bucket public access not blocked"
fi

if grep -q "aws_s3_bucket_policy" "$MAIN_TF"; then
    log_success "S3 bucket policy configured"
else
    log_error "S3 bucket policy missing"
fi

# Check SSL certificate
if grep -q "aws_acm_certificate.*cdn" "$MAIN_TF"; then
    log_success "ACM certificate configured"
    
    if grep -q "provider.*us_east_1" "$MAIN_TF" && grep -q "aws_acm_certificate" "$MAIN_TF"; then
        log_success "ACM certificate in correct region (us-east-1)"
    else
        log_error "ACM certificate not configured for us-east-1"
    fi
else
    log_error "ACM certificate missing"
fi

# Check WAF configuration
if grep -q "aws_wafv2_web_acl" "$MAIN_TF"; then
    log_success "WAF configuration found"
else
    log_warning "WAF configuration missing (may be disabled by default)"
fi

# Validate Lambda@Edge configuration
LAMBDA_TF="terraform/modules/cdn/lambda.tf"

log_info "Validating Lambda@Edge configuration..."

if [ -f "$LAMBDA_TF" ]; then
    log_success "Lambda@Edge configuration file exists"
    
    # Check Lambda functions are in us-east-1
    if grep -q "provider.*us_east_1" "$LAMBDA_TF"; then
        log_success "Lambda@Edge functions configured for us-east-1"
    else
        log_error "Lambda@Edge functions not in us-east-1"
    fi
    
    # Check security headers function
    if grep -q "aws_lambda_function.*security_headers" "$LAMBDA_TF"; then
        log_success "Security headers Lambda function defined"
    else
        log_warning "Security headers Lambda function missing"
    fi
    
    # Check template files
    if [ -f "terraform/modules/cdn/templates/security_headers.js.tpl" ]; then
        log_success "Security headers template exists"
    else
        log_error "Security headers template missing"
    fi
    
    if [ -f "terraform/modules/cdn/templates/url_rewrite.js.tpl" ]; then
        log_success "URL rewrite template exists"
    else
        log_error "URL rewrite template missing"
    fi
else
    log_error "Lambda@Edge configuration file missing"
fi

# Check GitHub Actions workflow
WORKFLOW_FILE=".github/workflows/deploy-cdn.yml"

log_info "Validating CI/CD configuration..."

if [ -f "$WORKFLOW_FILE" ]; then
    log_success "GitHub Actions workflow exists"
    
    # Check for proper environment detection
    if grep -q "determine-environment" "$WORKFLOW_FILE"; then
        log_success "Environment detection configured"
    else
        log_warning "Environment detection missing"
    fi
    
    # Check for S3 sync with proper headers
    if grep -q "cache-control" "$WORKFLOW_FILE"; then
        log_success "Cache headers configured in deployment"
    else
        log_warning "Cache headers missing in deployment"
    fi
    
    # Check for CloudFront invalidation
    if grep -q "cloudfront.*invalidation" "$WORKFLOW_FILE"; then
        log_success "CloudFront invalidation configured"
    else
        log_error "CloudFront invalidation missing"
    fi
else
    log_error "GitHub Actions workflow missing"
fi

# Check operational scripts
INVALIDATION_SCRIPT="scripts/invalidate-cdn-cache.sh"

log_info "Validating operational tools..."

if [ -f "$INVALIDATION_SCRIPT" ]; then
    log_success "Cache invalidation script exists"
    
    if [ -x "$INVALIDATION_SCRIPT" ]; then
        log_success "Cache invalidation script is executable"
    else
        log_warning "Cache invalidation script not executable (run: chmod +x $INVALIDATION_SCRIPT)"
    fi
else
    log_error "Cache invalidation script missing"
fi

# Check Terraform syntax (if terraform is available)
log_info "Checking Terraform syntax..."

if command -v terraform &> /dev/null; then
    for env in "${ENVIRONMENTS[@]}"; do
        env_dir="terraform/environments/$env"
        if [ -d "$env_dir" ]; then
            (cd "$env_dir" && terraform validate -backend=false 2>/dev/null) && \
                log_success "Terraform syntax valid for $env" || \
                log_warning "Terraform syntax issues in $env (run: terraform validate)"
        fi
    done
    
    # Check module syntax
    (cd "terraform/modules/cdn" && terraform validate -backend=false 2>/dev/null) && \
        log_success "CDN module syntax valid" || \
        log_warning "CDN module syntax issues (run: terraform validate)"
else
    log_warning "Terraform not available - skipping syntax validation"
fi

# Summary
echo
echo -e "${BOLD}📊 Validation Summary${NC}"
echo "Checks completed: $CHECKS"
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 CDN configuration validation passed!${NC}"
    echo
    echo -e "${BOLD}Next Steps:${NC}"
    echo "1. Set up your domain variables in terraform/environments/*/terraform.tfvars"
    echo "2. Initialize Terraform: terraform init"
    echo "3. Plan deployment: terraform plan"
    echo "4. Deploy CDN: terraform apply"
    echo "5. Configure DNS records for certificate validation"
    echo "6. Test CDN endpoints"
    
    exit 0
else
    echo -e "\n${RED}❌ CDN configuration has critical issues that need to be fixed${NC}"
    echo
    echo -e "${BOLD}Required Actions:${NC}"
    echo "• Fix all errors listed above"
    echo "• Re-run this validation script"
    echo "• Only deploy after all errors are resolved"
    
    exit 1
fi