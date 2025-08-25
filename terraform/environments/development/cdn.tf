# Development CDN Configuration for Link App
# Minimal configuration for local/development testing

# Configure AWS provider for us-east-1 (required for CloudFront certificates and Lambda@Edge)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# CDN module for development (simplified)
module "cdn_development" {
  source = "../../modules/cdn"
  
  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  # Basic configuration
  environment    = "development"
  domain_name    = var.dev_domain_name != "" ? var.dev_domain_name : "dev.linkapp.local"
  cdn_subdomain  = "cdn"
  project_name   = "link"

  # No ALB for development (local API server)
  alb_dns_name = ""

  # Development-specific settings (minimal cost)
  price_class                = "PriceClass_100"  # US and Europe only
  http_version              = "http2"
  minimum_protocol_version  = "TLSv1.2_2021"
  ssl_support_method        = "sni-only"

  # Security configuration (disabled for cost/complexity)
  enable_waf               = false  # Disable WAF for development
  waf_rate_limit          = 1000
  geo_restriction_type    = "none"
  geo_restriction_locations = []

  # Performance optimizations (minimal for cost)
  enable_origin_shield    = false
  origin_shield_region    = var.aws_region
  enable_lambda_edge      = false  # Disable for development
  security_headers_function = false

  # Logging and monitoring (disabled for cost)
  enable_logging          = false
  log_include_cookies     = false
  enable_real_time_logs   = false
  enable_cloudwatch_alarms = false
  alarm_email_endpoint    = ""

  # S3 configuration
  s3_bucket_name          = "link-static-assets-dev"
  enable_s3_versioning    = false  # Disable for development
  s3_lifecycle_rules = [
    {
      id      = "dev_cleanup"
      enabled = true
      transition = {
        days          = 1   # Quick transition for testing
        storage_class = "STANDARD_IA"
      }
      expiration = {
        days = 7  # Delete after 7 days
      }
    }
  ]

  # Cache behaviors (shorter TTLs for development)
  default_cache_behavior = {
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "allow-all"  # Allow HTTP for development
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress              = true
    min_ttl               = 0
    default_ttl           = 300    # 5 minutes for development
    max_ttl               = 3600   # 1 hour max
  }

  # Cache invalidation
  enable_cache_invalidation = true
  invalidation_paths = [
    "/*"  # Invalidate everything for development
  ]

  # Environment-specific overrides
  development_overrides = {
    price_class    = "PriceClass_100"
    enable_waf     = false
    enable_logging = false
  }

  tags = {
    Environment = "development"
    Project     = "link"
    Component   = "cdn"
    ManagedBy   = "terraform"
    Purpose     = "development"
    AutoDelete  = "7days"  # Tag for automatic cleanup
  }
}

# Basic CloudWatch Dashboard for development (optional)
resource "aws_cloudwatch_dashboard" "cdn_development" {
  count = var.enable_monitoring ? 1 : 0
  
  dashboard_name = "link-cdn-development"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", module.cdn_development.cloudfront_distribution_id]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "Development CDN Traffic"
        }
      }
    ]
  })
}

# Simple IAM user for development deployments (not OIDC)
resource "aws_iam_user" "dev_deployer" {
  count = var.create_dev_user ? 1 : 0
  name  = "link-cdn-dev-deployer"
  path  = "/developers/"

  tags = {
    Environment = "development"
    Component   = "cdn"
    Purpose     = "deployment"
  }
}

resource "aws_iam_access_key" "dev_deployer" {
  count = var.create_dev_user ? 1 : 0
  user  = aws_iam_user.dev_deployer[0].name
}

# IAM policy for development CDN deployment
resource "aws_iam_user_policy" "dev_deployer" {
  count = var.create_dev_user ? 1 : 0
  name  = "dev-cdn-deployment"
  user  = aws_iam_user.dev_deployer[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*"  # Full S3 access for development
        ]
        Resource = [
          module.cdn_development.s3_bucket_arn,
          "${module.cdn_development.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:ListInvalidations"
        ]
        Resource = [
          module.cdn_development.cloudfront_distribution_arn
        ]
      }
    ]
  })
}

# Local file with development deployment instructions
resource "local_file" "dev_instructions" {
  filename = "${path.module}/../../../docs/cdn-development-setup.md"
  content  = <<-EOT
# Development CDN Setup Instructions

## CDN Information
- **Distribution ID**: ${module.cdn_development.cloudfront_distribution_id}
- **CDN URL**: ${module.cdn_development.cdn_url}
- **S3 Bucket**: ${module.cdn_development.s3_bucket_name}

## Local Development Commands

### Build and Deploy Frontend
```bash
# 1. Build the frontend
cd frontend
npm run build

# 2. Sync to S3
aws s3 sync ./dist s3://${module.cdn_development.s3_bucket_name}/ --delete

# 3. Invalidate cache (optional in dev)
aws cloudfront create-invalidation \
  --distribution-id ${module.cdn_development.cloudfront_distribution_id} \
  --paths "/*"
```

### AWS Configuration
${var.create_dev_user ? "Set up AWS credentials for the dev user:" : "Use your existing AWS credentials or configure SSO:"}

${var.create_dev_user ? <<-CREDS
```bash
# Configure AWS CLI with dev user credentials
aws configure --profile link-dev
# AWS Access Key ID: ${aws_iam_access_key.dev_deployer[0].id}
# AWS Secret Access Key: ${aws_iam_access_key.dev_deployer[0].secret}
# Default region: ${var.aws_region}
# Default output format: json

# Use the profile
export AWS_PROFILE=link-dev
```
CREDS
: "```bash\n# Use your existing AWS profile\nexport AWS_PROFILE=your-profile\n# OR use AWS SSO\naws sso login\n```"}

### Testing Cache Behaviors

The development CDN has shorter cache TTLs for faster iteration:
- HTML files: 5 minutes
- Static assets: 1 hour maximum
- Cache invalidation: Available for immediate updates

### Cost Optimization

Development CDN is configured for minimal cost:
- PriceClass_100 (US/Europe only)
- WAF disabled
- Origin Shield disabled  
- Real-time logs disabled
- Lambda@Edge disabled
- Auto-cleanup after 7 days

## Troubleshooting

1. **403 Errors**: Check S3 bucket policy and OAI configuration
2. **Cache Issues**: Use cache invalidation or wait for TTL expiry
3. **SSL Issues**: Certificate validation may take time
4. **Cost Concerns**: Resources auto-tagged for cleanup

## Next Steps

1. Test the CDN with your local builds
2. Validate cache behaviors work as expected
3. Prepare for staging deployment
4. Set up automated deployment pipeline
EOT

  file_permission = "0644"
}

# Development-specific variables
variable "dev_domain_name" {
  description = "Development domain name (optional)"
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region for development"
  type        = string
  default     = "us-west-2"
}

variable "create_dev_user" {
  description = "Create dedicated IAM user for development deployments"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable basic monitoring for development"
  type        = bool
  default     = false
}

# Outputs
output "development_cdn_info" {
  description = "Development CDN information and setup instructions"
  value = {
    cdn_url              = module.cdn_development.cdn_url
    distribution_id      = module.cdn_development.cloudfront_distribution_id
    s3_bucket           = module.cdn_development.s3_bucket_name
    setup_instructions  = "See docs/cdn-development-setup.md for detailed setup"
    
    # Quick commands for development
    build_command       = "cd frontend && npm run build"
    deploy_command      = "aws s3 sync ./frontend/dist s3://${module.cdn_development.s3_bucket_name}/ --delete"
    invalidate_command  = "aws cloudfront create-invalidation --distribution-id ${module.cdn_development.cloudfront_distribution_id} --paths '/*'"
    
    # Configuration details
    cost_optimized      = "Yes - minimal features enabled for cost savings"
    cache_ttl          = "5 minutes for HTML, 1 hour for assets"
    auto_cleanup       = "Resources tagged for 7-day cleanup"
    
    # Access credentials (if created)
    iam_user_created   = var.create_dev_user
    aws_access_key_id  = var.create_dev_user ? aws_iam_access_key.dev_deployer[0].id : "Use existing AWS profile"
  }
  
  sensitive = true  # Contains AWS access key
}