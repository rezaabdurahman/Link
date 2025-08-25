# Staging CDN Configuration for Link App

# Configure AWS provider for us-east-1 (required for CloudFront certificates and Lambda@Edge)
provider "aws" {
  alias  = "us_east_1" 
  region = "us-east-1"
}

# Data sources for staging environment
data "aws_route53_zone" "staging" {
  count = var.staging_domain_name != "" ? 1 : 0
  name  = var.staging_domain_name
}

data "aws_lb" "api_alb_staging" {
  count = var.api_alb_name != "" ? 1 : 0
  name  = var.api_alb_name
}

# CDN module for staging
module "cdn_staging" {
  source = "../../modules/cdn"
  
  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  # Basic configuration
  environment    = "staging"
  domain_name    = var.staging_domain_name != "" ? var.staging_domain_name : "staging.${var.domain_name}"
  cdn_subdomain  = "cdn"
  api_subdomain  = "api"
  project_name   = "link"

  # ALB configuration for API endpoints
  alb_dns_name = var.api_alb_name != "" ? data.aws_lb.api_alb_staging[0].dns_name : ""

  # Staging-specific settings (cost-optimized but production-like)
  price_class                = "PriceClass_200"  # US, Canada, Europe, Asia, Middle East, Africa
  http_version              = "http2and3"
  minimum_protocol_version  = "TLSv1.2_2021"
  ssl_support_method        = "sni-only"

  # Security configuration (same as production for testing)
  enable_waf               = true
  waf_rate_limit          = 5000   # Lower limit for staging
  geo_restriction_type    = "none"
  geo_restriction_locations = []

  # Performance optimizations (reduced for cost)
  enable_origin_shield    = false  # Disable for staging to save costs
  origin_shield_region    = var.aws_region
  enable_lambda_edge      = true
  security_headers_function = true

  # Logging and monitoring (enabled for testing)
  enable_logging          = true
  log_include_cookies     = false
  enable_real_time_logs   = false  # Disable for cost savings
  enable_cloudwatch_alarms = false
  alarm_email_endpoint    = ""

  # S3 configuration
  s3_bucket_name          = "link-static-assets-staging"
  enable_s3_versioning    = true
  s3_lifecycle_rules = [
    {
      id      = "staging_cleanup"
      enabled = true
      transition = {
        days          = 7   # Transition faster in staging
        storage_class = "STANDARD_IA"
      }
      expiration = {
        days = 30  # Keep for 30 days only
      }
    }
  ]

  # Cache behaviors (same as production)
  default_cache_behavior = {
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress              = true
    min_ttl               = 0
    default_ttl           = 3600       # 1 hour for HTML
    max_ttl               = 86400      # 24 hours max
  }

  # Cache invalidation
  enable_cache_invalidation = true
  invalidation_paths = [
    "/index.html",
    "/manifest.json", 
    "/service-worker.js"
  ]

  # Environment-specific overrides
  staging_overrides = {
    price_class    = "PriceClass_200"
    enable_waf     = true
    enable_logging = true
  }

  tags = {
    Environment = "staging"
    Project     = "link"
    Component   = "cdn"
    ManagedBy   = "terraform"
    Purpose     = "testing"
  }
}

# Route 53 record for staging CDN (if staging domain exists)
resource "aws_route53_record" "cdn_staging" {
  count = var.staging_domain_name != "" ? 1 : 0
  
  zone_id = data.aws_route53_zone.staging[0].zone_id
  name    = "cdn"
  type    = "CNAME"
  ttl     = 300

  records = [module.cdn_staging.cloudfront_domain_name]

  depends_on = [module.cdn_staging]
}

# Route 53 record for ACM certificate validation
resource "aws_route53_record" "cdn_cert_validation_staging" {
  for_each = var.staging_domain_name != "" ? {
    for dvo in module.cdn_staging.acm_certificate_domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.staging[0].zone_id
}

# Basic CloudWatch Dashboard for staging
resource "aws_cloudwatch_dashboard" "cdn_staging" {
  dashboard_name = "link-cdn-staging"

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
            ["AWS/CloudFront", "Requests", "DistributionId", module.cdn_staging.cloudfront_distribution_id],
            [".", "BytesDownloaded", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "Staging CDN Traffic"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/CloudFront", "CacheHitRate", "DistributionId", module.cdn_staging.cloudfront_distribution_id],
            [".", "OriginLatency", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"
          title  = "Staging CDN Performance"
        }
      }
    ]
  })
}

# IAM role for staging deployments (simplified)
resource "aws_iam_role" "github_actions_cdn_staging" {
  name = "github-actions-cdn-staging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = var.github_oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "${var.github_oidc_provider_arn}:sub" = [
              "repo:${var.github_repository}:ref:refs/heads/staging",
              "repo:${var.github_repository}:ref:refs/heads/develop"
            ]
            "${var.github_oidc_provider_arn}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Environment = "staging"
    Component   = "cdn"
  }
}

# IAM policy for staging CDN deployment
resource "aws_iam_role_policy" "github_actions_cdn_staging" {
  name = "github-actions-cdn-staging-policy"
  role = aws_iam_role.github_actions_cdn_staging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl", 
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          module.cdn_staging.s3_bucket_arn,
          "${module.cdn_staging.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution"
        ]
        Resource = [
          module.cdn_staging.cloudfront_distribution_arn
        ]
      }
    ]
  })
}

# Staging-specific variables
variable "staging_domain_name" {
  description = "Staging domain name (optional, will use staging.domain_name if not provided)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Base domain name"
  type        = string
}

variable "api_alb_name" {
  description = "Name of the API Application Load Balancer for staging"
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region for staging"
  type        = string
  default     = "us-west-2"
}

variable "github_oidc_provider_arn" {
  description = "GitHub OIDC provider ARN for Actions"
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
  default     = ""
}

# Outputs
output "staging_cdn_info" {
  description = "Staging CDN deployment information"
  value = {
    cdn_url               = module.cdn_staging.cdn_url
    distribution_id       = module.cdn_staging.cloudfront_distribution_id
    s3_bucket            = module.cdn_staging.s3_bucket_name
    cloudwatch_dashboard = aws_cloudwatch_dashboard.cdn_staging.dashboard_name
    github_actions_role  = aws_iam_role.github_actions_cdn_staging.arn
    deployment_command   = "aws s3 sync ./frontend/dist s3://${module.cdn_staging.s3_bucket_name}/ --delete"
    invalidation_command = "aws cloudfront create-invalidation --distribution-id ${module.cdn_staging.cloudfront_distribution_id} --paths '/*'"
    cost_optimization   = "Reduced features for cost savings: no origin shield, no real-time logs, faster lifecycle"
  }
}