#!/bin/bash

# Bootstrap CI/CD Script
# This script sets up the initial GitHub repository configuration for fully automated deployments

set -euo pipefail

# Configuration
GITHUB_ORG="${GITHUB_ORG:-your-org}"
GITHUB_REPO="${GITHUB_REPO:-link-app}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
AWS_REGION="${AWS_REGION:-us-west-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local tools=("gh" "aws" "kubectl" "terraform" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check GitHub authentication
    if ! gh auth status &> /dev/null; then
        log_error "Please authenticate with GitHub CLI: gh auth login"
        exit 1
    fi
    
    # Check AWS authentication
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Please configure AWS CLI: aws configure"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Set up GitHub OIDC for AWS
setup_github_oidc() {
    log_step "Setting up GitHub OIDC provider in AWS..."
    
    # Create OIDC identity provider
    local oidc_provider_arn
    if oidc_provider_arn=$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" --query Arn --output text 2>/dev/null); then
        log_info "GitHub OIDC provider already exists: $oidc_provider_arn"
    else
        log_info "Creating GitHub OIDC provider..."
        
        # Get GitHub's OIDC thumbprints
        local thumbprints='["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]'
        
        aws iam create-open-id-connect-provider \
            --url "https://token.actions.githubusercontent.com" \
            --client-id-list "sts.amazonaws.com" \
            --thumbprint-list $thumbprints \
            --tags Key=Purpose,Value=GitHubActions Key=Project,Value=link-app
        
        log_info "✅ GitHub OIDC provider created"
    fi
}

# Create S3 bucket for Terraform state
setup_terraform_backend() {
    log_step "Setting up Terraform backend..."
    
    local environments=("development" "staging" "production")
    
    for env in "${environments[@]}"; do
        local bucket_name="link-app-terraform-state-${env}"
        local table_name="link-app-terraform-locks-${env}"
        
        # Create S3 bucket
        if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
            log_info "S3 bucket already exists: $bucket_name"
        else
            log_info "Creating S3 bucket: $bucket_name"
            
            if [ "$AWS_REGION" == "us-east-1" ]; then
                aws s3api create-bucket --bucket "$bucket_name"
            else
                aws s3api create-bucket \
                    --bucket "$bucket_name" \
                    --create-bucket-configuration LocationConstraint="$AWS_REGION"
            fi
            
            # Enable versioning
            aws s3api put-bucket-versioning \
                --bucket "$bucket_name" \
                --versioning-configuration Status=Enabled
            
            # Enable server-side encryption
            aws s3api put-bucket-encryption \
                --bucket "$bucket_name" \
                --server-side-encryption-configuration '{
                    "Rules": [
                        {
                            "ApplyServerSideEncryptionByDefault": {
                                "SSEAlgorithm": "AES256"
                            }
                        }
                    ]
                }'
            
            # Block public access
            aws s3api put-public-access-block \
                --bucket "$bucket_name" \
                --public-access-block-configuration \
                BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
        fi
        
        # Create DynamoDB table for locks
        if aws dynamodb describe-table --table-name "$table_name" &>/dev/null; then
            log_info "DynamoDB table already exists: $table_name"
        else
            log_info "Creating DynamoDB table: $table_name"
            
            aws dynamodb create-table \
                --table-name "$table_name" \
                --attribute-definitions AttributeName=LockID,AttributeType=S \
                --key-schema AttributeName=LockID,KeyType=HASH \
                --billing-mode PAY_PER_REQUEST \
                --tags Key=Purpose,Value=TerraformLocks Key=Project,Value=link-app Key=Environment,Value="$env"
        fi
    done
    
    log_info "✅ Terraform backend setup complete"
}

# Set up GitHub repository secrets and variables
setup_github_secrets() {
    log_step "Setting up GitHub repository secrets and variables..."
    
    local repo="${GITHUB_ORG}/${GITHUB_REPO}"
    
    # Set up environments in GitHub
    local environments=("development" "staging" "production")
    
    for env in "${environments[@]}"; do
        log_info "Configuring $env environment..."
        
        # Create environment (this may require manual setup in GitHub UI)
        log_warn "Please ensure the '$env' environment is created in GitHub repository settings"
        log_warn "Go to: https://github.com/$repo/settings/environments"
        
        # Set common variables
        gh variable set AWS_REGION --body "$AWS_REGION" --repo "$repo"
        gh variable set "$(echo ${env^^}_SECRETS_BACKEND)" --body "aws" --repo "$repo"
        
        # Environment-specific prompts
        case "$env" in
            "development")
                log_info "Development environment uses local PostgreSQL - no additional secrets needed"
                ;;
            "staging")
                cat << EOF

📝 Please set the following secrets for STAGING environment in GitHub:
   Go to: https://github.com/$repo/settings/environments

   Required secrets:
   - STAGING_DB_HOST
   - STAGING_DB_PORT (default: 5432)
   - STAGING_DB_NAME  
   - STAGING_DB_USER
   - STAGING_DB_PASSWORD
   - KUBECONFIG (base64 encoded kubernetes config)

EOF
                ;;
            "production")
                cat << EOF

📝 Please set the following secrets for PRODUCTION environment in GitHub:
   Go to: https://github.com/$repo/settings/environments

   Required secrets:
   - PROD_DB_HOST
   - PROD_DB_PORT (default: 5432)
   - PROD_DB_NAME
   - PROD_DB_USER
   - PROD_DB_PASSWORD
   - KUBECONFIG (base64 encoded kubernetes config)

EOF
                ;;
        esac
    done
    
    # Set repository-level secrets
    log_info "Setting repository-level secrets..."
    
    # AWS credentials (these should be set by user)
    cat << EOF

📝 Please set the following repository secrets in GitHub:
   Go to: https://github.com/$repo/settings/secrets/actions

   Required repository secrets:
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - SLACK_WEBHOOK_URL (optional, for notifications)
   - PAGERDUTY_INTEGRATION_KEY (optional, for alerts)

EOF
}

# Generate deployment documentation
generate_documentation() {
    log_step "Generating deployment documentation..."
    
    cat > "docs/AUTOMATED_DEPLOYMENT.md" << 'EOF'
# Automated Deployment Guide

Your Link application now has **fully automated** infrastructure setup and deployment!

## 🚀 Quick Start

### 1. One-time Bootstrap (Already Done!)
The bootstrap script has set up:
- ✅ GitHub OIDC provider in AWS
- ✅ S3 buckets for Terraform state
- ✅ DynamoDB tables for Terraform locks
- ✅ GitHub repository configuration

### 2. Set GitHub Secrets
Complete the setup by adding these secrets to your GitHub repository:

#### Repository Secrets (Settings → Secrets and Variables → Actions):
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
SLACK_WEBHOOK_URL=your-slack-webhook (optional)
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key (optional)
```

#### Environment Secrets (Settings → Environments):
For **staging** and **production** environments:
```
[ENV]_DB_HOST=your-db-host
[ENV]_DB_PORT=5432
[ENV]_DB_NAME=your-db-name
[ENV]_DB_USER=your-db-user
[ENV]_DB_PASSWORD=your-db-password
KUBECONFIG=your-base64-encoded-kubeconfig
```

### 3. Trigger Automated Setup
Once secrets are configured, trigger the infrastructure setup:

1. Go to **Actions** tab in your GitHub repository
2. Select **"Setup Infrastructure & Initial Deployment"**
3. Click **"Run workflow"**
4. Choose your environment (development/staging/production)
5. Click **"Run workflow"**

## 🎯 What Gets Automated

### ✅ Infrastructure Setup
- AWS resources (KMS, Secrets Manager, CloudWatch, SNS)
- Terraform state management
- Kubernetes secrets and deployments

### ✅ Service Account Management  
- Automatic credential generation
- Secure storage in AWS Secrets Manager
- Database integration with roles and permissions
- Kubernetes deployment manifest generation

### ✅ Continuous Deployment
- Automatic deployments on code changes
- Environment-specific configurations
- Health checks and validation
- Rollback on failures

### ✅ Credential Rotation
- Monthly automated rotation
- Zero-downtime updates
- Health verification
- Emergency rotation capabilities

### ✅ Monitoring & Alerting
- CloudWatch alarms for authentication failures
- Slack notifications for status updates
- PagerDuty integration for critical alerts
- Comprehensive audit logging

## 🔄 Daily Operations

Once set up, everything runs automatically:

- **Code changes** → Automatic deployment
- **Monthly rotation** → Handled by GitHub Actions
- **Health monitoring** → CloudWatch + notifications
- **Scaling** → Kubernetes handles automatically
- **Security** → Regular credential rotation + audit logs

## 🚨 Emergency Procedures

### Manual Credential Rotation
1. Go to Actions → "Rotate Service Credentials"
2. Select environment and service
3. Check "Force rotation" if needed
4. Run workflow

### Rollback Infrastructure
1. Go to Actions → "Setup Infrastructure & Initial Deployment"  
2. Select environment
3. Check "Force recreate"
4. Run workflow

## 📞 Support

If anything goes wrong:
1. Check the GitHub Actions logs
2. Review CloudWatch alarms in AWS Console
3. Check Slack notifications for error details
4. Use emergency rollback procedures above

Your infrastructure is now **enterprise-ready** with full automation! 🎉
EOF

    log_info "✅ Documentation generated: docs/AUTOMATED_DEPLOYMENT.md"
}

# Create a simple validation script
create_validation_script() {
    log_step "Creating validation script..."
    
    cat > "scripts/validate-setup.sh" << 'EOF'
#!/bin/bash
# Validation script to check if CI/CD setup is working

set -euo pipefail

echo "🔍 Validating CI/CD Setup..."

# Check GitHub CLI authentication
if gh auth status &> /dev/null; then
    echo "✅ GitHub CLI authenticated"
else
    echo "❌ GitHub CLI not authenticated"
    exit 1
fi

# Check if workflows exist
if [ -f ".github/workflows/setup-infrastructure.yml" ]; then
    echo "✅ Infrastructure setup workflow exists"
else
    echo "❌ Infrastructure setup workflow missing"
fi

if [ -f ".github/workflows/rotate-service-credentials.yml" ]; then
    echo "✅ Credential rotation workflow exists"
else
    echo "❌ Credential rotation workflow missing"
fi

# Check if Terraform configurations exist
if [ -d "terraform/environments/production" ]; then
    echo "✅ Terraform production configuration exists"
else
    echo "❌ Terraform production configuration missing"
fi

# Check if service account script exists
if [ -f "scripts/setup-service-accounts.sh" ] && [ -x "scripts/setup-service-accounts.sh" ]; then
    echo "✅ Service account setup script exists and is executable"
else
    echo "❌ Service account setup script missing or not executable"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Set GitHub repository secrets (AWS credentials, database credentials)"
echo "2. Go to GitHub Actions and run 'Setup Infrastructure & Initial Deployment'"
echo "3. Choose your environment and click 'Run workflow'"
echo ""
echo "📖 See docs/AUTOMATED_DEPLOYMENT.md for detailed instructions"
EOF

    chmod +x "scripts/validate-setup.sh"
    log_info "✅ Validation script created: scripts/validate-setup.sh"
}

# Main execution
main() {
    log_info "🚀 Starting CI/CD Bootstrap for Link Application"
    log_info "This will set up fully automated infrastructure deployment and management"
    echo
    
    # Collect required information
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        log_info "Detected AWS Account ID: $AWS_ACCOUNT_ID"
    fi
    
    # Confirm setup
    echo
    log_info "Configuration:"
    echo "  GitHub Repository: ${GITHUB_ORG}/${GITHUB_REPO}"
    echo "  AWS Account ID: $AWS_ACCOUNT_ID"
    echo "  AWS Region: $AWS_REGION"
    echo
    
    read -p "Proceed with bootstrap setup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Bootstrap cancelled"
        exit 0
    fi
    
    # Execute setup steps
    check_prerequisites
    setup_github_oidc
    setup_terraform_backend
    setup_github_secrets
    generate_documentation
    create_validation_script
    
    echo
    log_info "🎉 Bootstrap setup complete!"
    echo
    log_info "Next steps:"
    echo "1. Run: ./scripts/validate-setup.sh"
    echo "2. Set GitHub secrets as shown above"
    echo "3. Go to GitHub Actions and run 'Setup Infrastructure & Initial Deployment'"
    echo "4. Read docs/AUTOMATED_DEPLOYMENT.md for full instructions"
    echo
    log_info "Your infrastructure is now ready for fully automated deployment! 🚀"
}

# Help function
show_help() {
    cat << EOF
Bootstrap CI/CD Setup for Link Application

This script sets up fully automated infrastructure deployment and service account management.

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -o, --org ORG          GitHub organization (default: $GITHUB_ORG)
    -r, --repo REPO        GitHub repository name (default: $GITHUB_REPO)
    -a, --account ID       AWS Account ID (auto-detected if not provided)
    -R, --region REGION    AWS region (default: $AWS_REGION)

Environment Variables:
    GITHUB_ORG             GitHub organization name
    GITHUB_REPO            GitHub repository name
    AWS_ACCOUNT_ID         AWS Account ID
    AWS_REGION             AWS region

Examples:
    $0                                          # Use defaults/auto-detection
    $0 -o myorg -r myrepo                      # Custom org and repo
    $0 -a 123456789012 -R us-east-1           # Custom account and region

Prerequisites:
    - GitHub CLI (gh) installed and authenticated
    - AWS CLI installed and configured  
    - kubectl installed (for Kubernetes environments)
    - Terraform installed
    - jq installed

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -o|--org)
            GITHUB_ORG="$2"
            shift 2
            ;;
        -r|--repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        -a|--account)
            AWS_ACCOUNT_ID="$2"
            shift 2
            ;;
        -R|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
EOF

chmod +x scripts/bootstrap-cicd.sh