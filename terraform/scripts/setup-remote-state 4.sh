#!/bin/bash

# Setup script for Terraform remote state infrastructure
# Creates S3 buckets and DynamoDB tables for state management

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-west-2}"
PROJECT_NAME="link"
ENVIRONMENTS=("development" "staging" "production")

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

# Check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS CLI not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    log_info "Using AWS Account: $account_id"
}

# Create S3 bucket for Terraform state
create_state_bucket() {
    local env=$1
    local bucket_name="${PROJECT_NAME}-terraform-state-${env}"
    
    log_info "Creating S3 bucket: $bucket_name"
    
    # Check if bucket already exists
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        log_warn "Bucket $bucket_name already exists"
    else
        # Create bucket
        aws s3api create-bucket \
            --bucket "$bucket_name" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled
        
        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        # Block public access
        aws s3api put-public-access-block \
            --bucket "$bucket_name" \
            --public-access-block-configuration \
                BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
        
        # Add lifecycle policy
        aws s3api put-bucket-lifecycle-configuration \
            --bucket "$bucket_name" \
            --lifecycle-configuration '{
                "Rules": [{
                    "ID": "delete-old-versions",
                    "Status": "Enabled",
                    "NoncurrentVersionExpiration": {
                        "NoncurrentDays": 90
                    }
                }]
            }'
        
        log_info "Successfully created bucket: $bucket_name"
    fi
}

# Create DynamoDB table for state locking
create_lock_table() {
    local env=$1
    local table_name="terraform-state-lock-${env}"
    
    log_info "Creating DynamoDB table: $table_name"
    
    # Check if table already exists
    if aws dynamodb describe-table --table-name "$table_name" &>/dev/null; then
        log_warn "Table $table_name already exists"
    else
        # Create table
        aws dynamodb create-table \
            --table-name "$table_name" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --tags Key=Project,Value="$PROJECT_NAME" \
                   Key=Purpose,Value="terraform-state-locking" \
                   Key=Environment,Value="$env"
        
        # Wait for table to be created
        aws dynamodb wait table-exists --table-name "$table_name"
        
        log_info "Successfully created table: $table_name"
    fi
}

# Create backup bucket for production (optional)
create_backup_bucket() {
    local bucket_name="${PROJECT_NAME}-terraform-state-prod-backup"
    
    log_info "Creating backup bucket: $bucket_name"
    
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        log_warn "Backup bucket $bucket_name already exists"
    else
        aws s3api create-bucket \
            --bucket "$bucket_name" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
        
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled
        
        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        aws s3api put-public-access-block \
            --bucket "$bucket_name" \
            --public-access-block-configuration \
                BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
        
        log_info "Successfully created backup bucket: $bucket_name"
    fi
}

# Main execution
main() {
    log_info "Setting up Terraform remote state infrastructure"
    
    check_aws_config
    
    for env in "${ENVIRONMENTS[@]}"; do
        log_info "Setting up resources for environment: $env"
        create_state_bucket "$env"
        create_lock_table "$env"
    done
    
    # Create backup bucket for production
    create_backup_bucket
    
    log_info "✅ Remote state infrastructure setup complete!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Initialize Terraform with remote backend:"
    log_info "   cd environments/development && terraform init"
    log_info "2. Review the generated backend configurations"
    log_info "3. Run terraform plan to verify setup"
}

# Print usage if requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [--help]"
    echo ""
    echo "This script creates the AWS infrastructure needed for Terraform remote state:"
    echo "  - S3 buckets for state storage (per environment)"
    echo "  - DynamoDB tables for state locking (per environment)"
    echo "  - Backup S3 bucket for production"
    echo ""
    echo "Environment variables:"
    echo "  AWS_REGION - AWS region to use (default: us-west-2)"
    echo ""
    echo "Prerequisites:"
    echo "  - AWS CLI configured with appropriate permissions"
    echo "  - jq installed"
    exit 0
fi

# Execute main function
main "$@"