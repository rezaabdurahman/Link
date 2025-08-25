# CDN Module Outputs

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront Distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront Distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront Distribution hosted zone ID for Route 53"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "cdn_url" {
  description = "Full CDN URL with custom domain"
  value       = "https://${local.cdn_domain}"
}

output "s3_bucket_name" {
  description = "S3 bucket name for static assets"
  value       = aws_s3_bucket.static_assets.bucket
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN for static assets"
  value       = aws_s3_bucket.static_assets.arn
}

output "s3_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name"
  value       = aws_s3_bucket.static_assets.bucket_regional_domain_name
}

output "s3_logs_bucket_name" {
  description = "S3 bucket name for CloudFront logs"
  value       = local.effective_config.enable_logging ? aws_s3_bucket.cloudfront_logs[0].bucket : null
}

output "origin_access_identity_id" {
  description = "CloudFront Origin Access Identity ID"
  value       = aws_cloudfront_origin_access_identity.static_assets.id
}

output "origin_access_identity_iam_arn" {
  description = "CloudFront Origin Access Identity IAM ARN"
  value       = aws_cloudfront_origin_access_identity.static_assets.iam_arn
}

output "acm_certificate_arn" {
  description = "ACM Certificate ARN for the CDN"
  value       = aws_acm_certificate.cdn.arn
}

output "acm_certificate_domain_validation_options" {
  description = "Domain validation options for ACM certificate"
  value       = aws_acm_certificate.cdn.domain_validation_options
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID (if enabled)"
  value       = local.effective_config.enable_waf ? aws_wafv2_web_acl.cdn[0].id : null
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN (if enabled)"
  value       = local.effective_config.enable_waf ? aws_wafv2_web_acl.cdn[0].arn : null
}

output "lambda_security_headers_arn" {
  description = "Lambda@Edge security headers function ARN (if enabled)"
  value       = var.enable_lambda_edge && var.security_headers_function ? aws_lambda_function.security_headers[0].qualified_arn : null
}

output "cache_invalidation_paths" {
  description = "Default cache invalidation paths"
  value       = var.invalidation_paths
}

# Deployment information
output "deployment_info" {
  description = "CDN deployment information and instructions"
  value = {
    distribution_id     = aws_cloudfront_distribution.main.id
    cdn_domain         = local.cdn_domain
    s3_sync_command    = "aws s3 sync ./frontend/dist s3://${aws_s3_bucket.static_assets.bucket}/ --delete"
    invalidation_command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.main.id} --paths '/*'"
    dns_setup_required = "Create CNAME record: ${local.cdn_domain} -> ${aws_cloudfront_distribution.main.domain_name}"
    ssl_verification   = "Verify ACM certificate via DNS validation"
  }
}

# Monitoring information
output "monitoring_info" {
  description = "Monitoring and observability information"
  value = {
    cloudwatch_metrics_namespace = "AWS/CloudFront"
    distribution_id              = aws_cloudfront_distribution.main.id
    waf_metrics_enabled          = local.effective_config.enable_waf
    access_logs_bucket           = local.effective_config.enable_logging ? aws_s3_bucket.cloudfront_logs[0].bucket : "disabled"
    real_time_logs_enabled       = local.effective_config.enable_real_time_logs
  }
}

# Cost optimization information
output "cost_optimization_info" {
  description = "Cost optimization settings and recommendations"
  value = {
    price_class           = local.effective_config.price_class
    origin_shield_enabled = local.effective_config.enable_origin_shield
    s3_storage_class_transitions = var.s3_lifecycle_rules
    cache_hit_ratio_target = "85%+"
    estimated_monthly_cost = var.environment == "production" ? "$50-200 depending on traffic" : var.environment == "staging" ? "$20-50" : "$10-30"
  }
}

# Security information  
output "security_info" {
  description = "Security configuration details"
  value = {
    waf_enabled                = local.effective_config.enable_waf
    waf_rate_limit            = var.waf_rate_limit
    lambda_security_headers   = var.enable_lambda_edge && var.security_headers_function
    minimum_tls_version       = var.minimum_protocol_version
    origin_access_protected   = "S3 bucket access via OAI only"
    geo_restrictions          = var.geo_restriction_type != "none" ? var.geo_restriction_locations : "none"
    https_only                = "Enforced via viewer protocol policy"
  }
}

# Performance information
output "performance_info" {
  description = "Performance optimization details"
  value = {
    http_version          = var.http_version
    compression_enabled   = "Automatic gzip/brotli"
    cache_behaviors_count = length(aws_cloudfront_distribution.main.ordered_cache_behavior) + 1
    edge_locations        = local.effective_config.price_class == "PriceClass_All" ? "Global" : local.effective_config.price_class == "PriceClass_200" ? "US, Canada, Europe, Asia, Middle East, Africa" : "US, Canada, Europe"
    origin_shield_region  = local.effective_config.enable_origin_shield ? var.origin_shield_region : "disabled"
  }
}

# Environment-specific configuration summary
output "environment_config" {
  description = "Environment-specific configuration summary"
  value = {
    environment           = var.environment
    price_class          = local.effective_config.price_class
    waf_enabled          = local.effective_config.enable_waf
    logging_enabled      = local.effective_config.enable_logging
    origin_shield        = local.effective_config.enable_origin_shield
    real_time_logs       = local.effective_config.enable_real_time_logs
    lambda_edge_enabled  = var.enable_lambda_edge
    s3_versioning        = var.enable_s3_versioning
  }
}

# Next steps for deployment
output "next_steps" {
  description = "Next steps for completing CDN deployment"
  value = [
    "1. Validate ACM certificate via DNS records",
    "2. Create CNAME record: ${local.cdn_domain} -> ${aws_cloudfront_distribution.main.domain_name}",
    "3. Build and sync frontend assets to S3: aws s3 sync ./frontend/dist s3://${aws_s3_bucket.static_assets.bucket}/",
    "4. Test CDN endpoints and cache behaviors",
    "5. Set up CloudWatch dashboards for monitoring",
    "6. Configure deployment pipeline with cache invalidation",
    "7. Verify security headers and WAF rules",
    "8. Monitor costs and optimize cache hit ratio"
  ]
}