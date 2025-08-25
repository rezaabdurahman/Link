# Production CDN Configuration for Link App

# Configure AWS provider for us-east-1 (required for CloudFront certificates and Lambda@Edge)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Data sources for production environment
data "aws_route53_zone" "main" {
  name = var.domain_name
}

data "aws_lb" "api_alb" {
  count = var.api_alb_name != "" ? 1 : 0
  name  = var.api_alb_name
}

# CDN module for production
module "cdn" {
  source = "../../modules/cdn"
  
  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  # Basic configuration
  environment    = "production"
  domain_name    = var.domain_name
  cdn_subdomain  = "cdn"
  api_subdomain  = "api"
  project_name   = "link"

  # ALB configuration for API endpoints
  alb_dns_name = var.api_alb_name != "" ? data.aws_lb.api_alb[0].dns_name : ""

  # Production-specific settings
  price_class                = "PriceClass_All"  # Global distribution
  http_version              = "http2and3"
  minimum_protocol_version  = "TLSv1.2_2021"
  ssl_support_method        = "sni-only"

  # Security configuration
  enable_waf               = true
  waf_rate_limit          = 10000  # 10k requests per 5 minutes
  geo_restriction_type    = "none"
  geo_restriction_locations = []

  # Performance optimizations
  enable_origin_shield    = true
  origin_shield_region    = var.aws_region
  enable_lambda_edge      = true
  security_headers_function = true

  # Logging and monitoring
  enable_logging          = true
  log_include_cookies     = false
  enable_real_time_logs   = true
  enable_cloudwatch_alarms = true
  alarm_email_endpoint    = var.alarm_email

  # S3 configuration
  s3_bucket_name          = "link-static-assets"
  enable_s3_versioning    = true
  s3_lifecycle_rules = [
    {
      id      = "optimize_old_versions"
      enabled = true
      transition = {
        days          = 30
        storage_class = "STANDARD_IA"
      }
      expiration = {
        days = 365  # Keep old versions for 1 year
      }
    }
  ]

  # Cache behaviors
  default_cache_behavior = {
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress              = true
    min_ttl               = 0
    default_ttl           = 86400      # 24 hours for HTML
    max_ttl               = 31536000   # 1 year max
  }

  # Cache invalidation
  enable_cache_invalidation = true
  invalidation_paths = [
    "/index.html",
    "/manifest.json", 
    "/service-worker.js",
    "/robots.txt",
    "/sitemap.xml"
  ]

  # Environment-specific overrides (production defaults)
  production_overrides = {
    price_class           = "PriceClass_All"
    enable_waf           = true
    enable_logging       = true
    enable_origin_shield = true
    enable_real_time_logs = true
  }

  tags = {
    Environment = "production"
    Project     = "link"
    Component   = "cdn"
    ManagedBy   = "terraform"
    CostCenter  = "infrastructure"
  }
}

# Route 53 record for CDN
resource "aws_route53_record" "cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "cdn"
  type    = "CNAME"
  ttl     = 300

  records = [module.cdn.cloudfront_domain_name]

  depends_on = [module.cdn]
}

# Route 53 record for ACM certificate validation
resource "aws_route53_record" "cdn_cert_validation" {
  for_each = {
    for dvo in module.cdn.acm_certificate_domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# CloudWatch Dashboard for CDN monitoring
resource "aws_cloudwatch_dashboard" "cdn" {
  dashboard_name = "link-cdn-production"

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
            ["AWS/CloudFront", "Requests", "DistributionId", module.cdn.cloudfront_distribution_id],
            [".", "BytesDownloaded", ".", "."],
            [".", "BytesUploaded", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"  # CloudFront metrics are in us-east-1
          title  = "CDN Traffic"
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
            ["AWS/CloudFront", "CacheHitRate", "DistributionId", module.cdn.cloudfront_distribution_id],
            [".", "OriginLatency", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"
          title  = "CDN Performance"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", module.cdn.cloudfront_distribution_id],
            [".", "5xxErrorRate", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"
          title  = "CDN Error Rates"
        }
      }
    ]
  })
}

# CloudWatch Alarms for CDN monitoring
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  count = var.alarm_email != "" ? 1 : 0

  alarm_name          = "link-cdn-high-error-rate-production"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "10"  # 10% error rate
  alarm_description   = "This metric monitors CDN 4xx error rate"
  alarm_actions       = [aws_sns_topic.cdn_alerts[0].arn]

  dimensions = {
    DistributionId = module.cdn.cloudfront_distribution_id
  }
}

resource "aws_cloudwatch_metric_alarm" "low_cache_hit_rate" {
  count = var.alarm_email != "" ? 1 : 0

  alarm_name          = "link-cdn-low-cache-hit-rate-production"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = "900"  # 15 minutes
  statistic           = "Average"
  threshold           = "80"   # 80% cache hit rate
  alarm_description   = "This metric monitors CDN cache hit rate"
  alarm_actions       = [aws_sns_topic.cdn_alerts[0].arn]

  dimensions = {
    DistributionId = module.cdn.cloudfront_distribution_id
  }
}

# SNS Topic for CDN alerts
resource "aws_sns_topic" "cdn_alerts" {
  count = var.alarm_email != "" ? 1 : 0
  name  = "link-cdn-alerts-production"

  tags = {
    Environment = "production"
    Component   = "cdn"
  }
}

resource "aws_sns_topic_subscription" "cdn_email_alerts" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cdn_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# S3 bucket for deployment artifacts
resource "aws_s3_bucket" "deployment_artifacts" {
  bucket = "link-deployment-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = {
    Environment = "production"
    Component   = "cdn"
    Purpose     = "deployment"
  }
}

resource "aws_s3_bucket_versioning" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# IAM role for GitHub Actions deployment
resource "aws_iam_role" "github_actions_cdn" {
  name = "github-actions-cdn-deployment-production"

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
            "${var.github_oidc_provider_arn}:sub" = "repo:${var.github_repository}:ref:refs/heads/main"
            "${var.github_oidc_provider_arn}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Environment = "production"
    Component   = "cdn"
    Purpose     = "github-actions"
  }
}

# IAM policy for CDN deployment
resource "aws_iam_role_policy" "github_actions_cdn" {
  name = "github-actions-cdn-policy"
  role = aws_iam_role.github_actions_cdn.id

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
          module.cdn.s3_bucket_arn,
          "${module.cdn.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:ListDistributions"
        ]
        Resource = [
          module.cdn.cloudfront_distribution_arn
        ]
      }
    ]
  })
}

# Production-specific variables
variable "domain_name" {
  description = "Production domain name"
  type        = string
}

variable "api_alb_name" {
  description = "Name of the API Application Load Balancer"
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region for production"
  type        = string
  default     = "us-west-2"
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarms"
  type        = string
  default     = ""
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
output "production_cdn_info" {
  description = "Production CDN deployment information"
  value = {
    cdn_url                = module.cdn.cdn_url
    distribution_id        = module.cdn.cloudfront_distribution_id  
    s3_bucket             = module.cdn.s3_bucket_name
    cloudwatch_dashboard  = aws_cloudwatch_dashboard.cdn.dashboard_name
    github_actions_role   = aws_iam_role.github_actions_cdn.arn
    deployment_command    = "aws s3 sync ./frontend/dist s3://${module.cdn.s3_bucket_name}/ --delete"
    invalidation_command  = "aws cloudfront create-invalidation --distribution-id ${module.cdn.cloudfront_distribution_id} --paths '/*'"
  }
}