# CDN Module for Link App
# Provides CloudFront distribution with S3 static hosting and ALB origin

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local variables for environment-specific configurations
locals {
  bucket_name = var.s3_bucket_name != "" ? "${var.s3_bucket_name}-${var.environment}" : "${var.project_name}-static-${var.environment}"
  
  # Apply environment-specific overrides
  effective_config = var.environment == "production" ? merge({
    price_class           = var.price_class
    enable_waf           = var.enable_waf
    enable_logging       = var.enable_logging
    enable_origin_shield = var.enable_origin_shield
    enable_real_time_logs = var.enable_real_time_logs
  }, var.production_overrides) : var.environment == "staging" ? merge({
    price_class           = var.price_class
    enable_waf           = var.enable_waf
    enable_logging       = var.enable_logging
    enable_origin_shield = false
    enable_real_time_logs = false
  }, var.staging_overrides) : merge({
    price_class           = var.price_class
    enable_waf           = var.enable_waf
    enable_logging       = var.enable_logging
    enable_origin_shield = false
    enable_real_time_logs = false
  }, var.development_overrides)
  
  cdn_domain = "${var.cdn_subdomain}.${var.domain_name}"
  
  common_tags = merge(var.tags, {
    Environment = var.environment
    Component   = "cdn"
  })
}

#=====================================================
# S3 BUCKET FOR STATIC ASSETS
#=====================================================

# S3 bucket for static assets
resource "aws_s3_bucket" "static_assets" {
  bucket        = local.bucket_name
  force_destroy = var.environment != "production"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-static-assets-${var.environment}"
  })
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration {
    status = var.enable_s3_versioning ? "Enabled" : "Suspended"
  }
}

# S3 bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "static_assets" {
  count  = length(var.s3_lifecycle_rules) > 0 ? 1 : 0
  bucket = aws_s3_bucket.static_assets.id

  dynamic "rule" {
    for_each = var.s3_lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.enabled ? "Enabled" : "Disabled"

      transition {
        days          = rule.value.transition.days
        storage_class = rule.value.transition.storage_class
      }

      expiration {
        days = rule.value.expiration.days
      }
    }
  }
}

#=====================================================
# S3 BUCKET FOR CLOUDFRONT LOGS
#=====================================================

# S3 bucket for CloudFront logs
resource "aws_s3_bucket" "cloudfront_logs" {
  count         = local.effective_config.enable_logging ? 1 : 0
  bucket        = "${local.bucket_name}-logs"
  force_destroy = var.environment != "production"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-cloudfront-logs-${var.environment}"
  })
}

# CloudFront logs bucket public access block
resource "aws_s3_bucket_public_access_block" "cloudfront_logs" {
  count  = local.effective_config.enable_logging ? 1 : 0
  bucket = aws_s3_bucket.cloudfront_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

#=====================================================
# CLOUDFRONT ORIGIN ACCESS IDENTITY
#=====================================================

# CloudFront Origin Access Identity for S3
resource "aws_cloudfront_origin_access_identity" "static_assets" {
  comment = "OAI for ${var.project_name} static assets - ${var.environment}"
}

# S3 bucket policy to allow CloudFront OAI
resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.static_assets.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
      }
    ]
  })
}

#=====================================================
# ACM CERTIFICATE
#=====================================================

# ACM certificate for CDN domain (must be in us-east-1 for CloudFront)
resource "aws_acm_certificate" "cdn" {
  provider = aws.us_east_1
  
  domain_name               = local.cdn_domain
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-cdn-certificate-${var.environment}"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Lambda@Edge functions are defined in lambda.tf

# IAM role for Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  count = var.enable_lambda_edge ? 1 : 0
  
  name = "${var.project_name}-lambda-edge-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM policy attachment for Lambda@Edge
resource "aws_iam_role_policy_attachment" "lambda_edge" {
  count = var.enable_lambda_edge ? 1 : 0
  
  role       = aws_iam_role.lambda_edge[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

#=====================================================
# WAF WEB ACL
#=====================================================

# WAF Web ACL for CloudFront
resource "aws_wafv2_web_acl" "cdn" {
  count = local.effective_config.enable_waf ? 1 : 0
  
  name  = "${var.project_name}-cdn-waf-${var.environment}"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-rate-limit-${var.environment}"
      sampled_requests_enabled   = true
    }

    action {
      block {}
    }
  }

  # AWS Managed Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-common-rules-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Known Bad Inputs Rule Set
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-bad-inputs-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  tags = local.common_tags

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf-${var.environment}"
    sampled_requests_enabled   = true
  }
}

#=====================================================
# CLOUDFRONT DISTRIBUTION
#=====================================================

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  comment             = "${var.project_name} CDN - ${var.environment}"
  default_root_object = "index.html"
  enabled             = true
  http_version        = var.http_version
  is_ipv6_enabled     = true
  price_class         = local.effective_config.price_class
  web_acl_id         = local.effective_config.enable_waf ? aws_wafv2_web_acl.cdn[0].arn : null

  # S3 Origin for static assets
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "s3-static"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.static_assets.cloudfront_access_identity_path
    }

    dynamic "origin_shield" {
      for_each = local.effective_config.enable_origin_shield ? [1] : []
      content {
        enabled                = true
        origin_shield_region   = var.origin_shield_region
      }
    }
  }

  # ALB Origin for API endpoints (if ALB DNS provided)
  dynamic "origin" {
    for_each = var.alb_dns_name != "" ? [1] : []
    content {
      domain_name = var.alb_dns_name
      origin_id   = "alb-api"
      origin_path = ""

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }

      dynamic "origin_shield" {
        for_each = local.effective_config.enable_origin_shield ? [1] : []
        content {
          enabled                = true
          origin_shield_region   = var.origin_shield_region
        }
      }
    }
  }

  # Default cache behavior (static assets)
  default_cache_behavior {
    target_origin_id       = var.default_cache_behavior.target_origin_id
    viewer_protocol_policy = var.default_cache_behavior.viewer_protocol_policy
    allowed_methods        = var.default_cache_behavior.allowed_methods
    cached_methods         = var.default_cache_behavior.cached_methods
    compress               = var.default_cache_behavior.compress

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = var.default_cache_behavior.min_ttl
    default_ttl = var.default_cache_behavior.default_ttl
    max_ttl     = var.default_cache_behavior.max_ttl

    # Security headers Lambda@Edge
    dynamic "lambda_function_association" {
      for_each = var.enable_lambda_edge && var.security_headers_function ? [1] : []
      content {
        event_type   = "origin-response"
        lambda_arn   = aws_lambda_function.security_headers[0].qualified_arn
        include_body = false
      }
    }
  }

  # API cache behavior (no caching)
  dynamic "ordered_cache_behavior" {
    for_each = var.alb_dns_name != "" ? [1] : []
    content {
      path_pattern           = "/api/*"
      target_origin_id       = "alb-api"
      viewer_protocol_policy = "https-only"
      allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      forwarded_values {
        query_string = true
        headers      = ["Authorization", "Content-Type", "Origin", "Accept"]
        cookies {
          forward = "all"
        }
      }

      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  # Static assets cache behaviors
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 604800    # 1 week
    max_ttl     = 31536000  # 1 year
  }

  # JavaScript files
  ordered_cache_behavior {
    path_pattern           = "*.js"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 604800    # 1 week
    max_ttl     = 31536000  # 1 year
  }

  # CSS files
  ordered_cache_behavior {
    path_pattern           = "*.css"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 604800    # 1 week
    max_ttl     = 31536000  # 1 year
  }

  # Image files
  ordered_cache_behavior {
    path_pattern           = "*.{jpg,jpeg,png,gif,ico,svg,webp}"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false  # Images are already compressed

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 2592000   # 30 days
    max_ttl     = 31536000  # 1 year
  }

  # Font files
  ordered_cache_behavior {
    path_pattern           = "*.{woff,woff2,ttf,eot}"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      headers      = ["Origin"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 604800    # 1 week
    max_ttl     = 31536000  # 1 year
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }

  # SSL Certificate
  viewer_certificate {
    acm_certificate_arn            = aws_acm_certificate.cdn.arn
    ssl_support_method             = var.ssl_support_method
    minimum_protocol_version       = var.minimum_protocol_version
    cloudfront_default_certificate = false
  }

  # Custom error responses
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"  # SPA routing
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"  # SPA routing
  }

  # Logging configuration
  dynamic "logging_config" {
    for_each = local.effective_config.enable_logging ? [1] : []
    content {
      bucket          = aws_s3_bucket.cloudfront_logs[0].bucket_domain_name
      include_cookies = var.log_include_cookies
      prefix          = var.log_prefix
    }
  }

  # Aliases (custom domains)
  aliases = [local.cdn_domain]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-cdn-${var.environment}"
  })

  depends_on = [
    aws_acm_certificate.cdn,
    aws_s3_bucket_policy.static_assets
  ]
}