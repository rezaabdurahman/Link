variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "domain_name" {
  description = "Primary domain name for the application (e.g., linkapp.com)"
  type        = string
}

variable "cdn_subdomain" {
  description = "Subdomain for CDN (will create cdn.domain_name)"
  type        = string
  default     = "cdn"
}

variable "api_subdomain" {
  description = "Subdomain for API endpoints"
  type        = string
  default     = "api"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "link"
}

# Origin Configuration
variable "origins" {
  description = "List of origins for the CloudFront distribution"
  type = list(object({
    domain_name = string
    origin_id   = string
    origin_path = string
    custom_origin_config = optional(object({
      http_port              = number
      https_port             = number
      origin_protocol_policy = string
      origin_ssl_protocols   = list(string)
    }))
    s3_origin_config = optional(object({
      origin_access_identity = string
    }))
  }))
  default = []
}

variable "alb_dns_name" {
  description = "Application Load Balancer DNS name for API origin"
  type        = string
  default     = ""
}

# Cache Behavior Configuration
variable "default_cache_behavior" {
  description = "Default cache behavior configuration"
  type = object({
    target_origin_id       = string
    viewer_protocol_policy = string
    allowed_methods        = list(string)
    cached_methods         = list(string)
    compress              = bool
    min_ttl               = number
    default_ttl           = number
    max_ttl               = number
  })
  default = {
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress              = true
    min_ttl               = 0
    default_ttl           = 3600      # 1 hour
    max_ttl               = 86400     # 24 hours
  }
}

variable "ordered_cache_behaviors" {
  description = "Ordered list of cache behaviors"
  type = list(object({
    path_pattern           = string
    target_origin_id       = string
    viewer_protocol_policy = string
    allowed_methods        = list(string)
    cached_methods         = list(string)
    compress              = bool
    min_ttl               = number
    default_ttl           = number
    max_ttl               = number
    headers               = list(string)
    query_string          = bool
    cookies               = string
  }))
  default = []
}

# SSL/TLS Configuration
variable "ssl_support_method" {
  description = "SSL support method for CloudFront"
  type        = string
  default     = "sni-only"
  validation {
    condition     = contains(["sni-only", "vip"], var.ssl_support_method)
    error_message = "SSL support method must be either 'sni-only' or 'vip'."
  }
}

variable "minimum_protocol_version" {
  description = "Minimum TLS protocol version"
  type        = string
  default     = "TLSv1.2_2021"
  validation {
    condition = contains([
      "SSLv3",
      "TLSv1",
      "TLSv1_2016",
      "TLSv1.1_2016",
      "TLSv1.2_2018",
      "TLSv1.2_2019",
      "TLSv1.2_2021"
    ], var.minimum_protocol_version)
    error_message = "Invalid TLS protocol version."
  }
}

# Geographic Restrictions
variable "geo_restriction_type" {
  description = "Type of geographic restriction (none, whitelist, blacklist)"
  type        = string
  default     = "none"
  validation {
    condition     = contains(["none", "whitelist", "blacklist"], var.geo_restriction_type)
    error_message = "Geo restriction type must be one of: none, whitelist, blacklist."
  }
}

variable "geo_restriction_locations" {
  description = "List of country codes for geographic restrictions"
  type        = list(string)
  default     = []
}

# Logging Configuration
variable "enable_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = true
}

variable "log_include_cookies" {
  description = "Include cookies in access logs"
  type        = bool
  default     = false
}

variable "log_prefix" {
  description = "Prefix for log file names"
  type        = string
  default     = "cloudfront-logs/"
}

# Performance Configuration
variable "price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_200"  # US, Canada, Europe, Asia, Middle East, Africa
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200", 
      "PriceClass_100"
    ], var.price_class)
    error_message = "Price class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

variable "http_version" {
  description = "HTTP version for CloudFront (http1.1, http2, http2and3)"
  type        = string
  default     = "http2and3"
  validation {
    condition     = contains(["http1.1", "http2", "http2and3"], var.http_version)
    error_message = "HTTP version must be http1.1, http2, or http2and3."
  }
}

# Security Configuration
variable "enable_waf" {
  description = "Enable AWS WAF for CloudFront"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "Rate limit for WAF (requests per 5 minutes)"
  type        = number
  default     = 10000
}

variable "enable_origin_shield" {
  description = "Enable CloudFront Origin Shield"
  type        = bool
  default     = false
}

variable "origin_shield_region" {
  description = "AWS region for Origin Shield"
  type        = string
  default     = "us-east-1"
}

# Lambda@Edge Configuration
variable "enable_lambda_edge" {
  description = "Enable Lambda@Edge functions"
  type        = bool
  default     = true
}

variable "security_headers_function" {
  description = "Enable security headers Lambda@Edge function"
  type        = bool
  default     = true
}

variable "url_rewrite_function" {
  description = "Enable URL rewrite Lambda@Edge function"
  type        = bool
  default     = false
}

# Monitoring and Alerting
variable "enable_real_time_logs" {
  description = "Enable CloudFront real-time logs"
  type        = bool
  default     = false  # Can be expensive
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for CDN monitoring"
  type        = bool
  default     = true
}

variable "alarm_email_endpoint" {
  description = "Email endpoint for CloudWatch alarms"
  type        = string
  default     = ""
}

# Cache Invalidation
variable "enable_cache_invalidation" {
  description = "Enable automatic cache invalidation on deployments"
  type        = bool
  default     = true
}

variable "invalidation_paths" {
  description = "Default paths to invalidate on deployment"
  type        = list(string)
  default     = ["/index.html", "/manifest.json", "/service-worker.js"]
}

# S3 Bucket Configuration
variable "s3_bucket_name" {
  description = "Name for the S3 bucket (will add environment suffix)"
  type        = string
  default     = ""
}

variable "enable_s3_versioning" {
  description = "Enable versioning on S3 bucket"
  type        = bool
  default     = true
}

variable "s3_lifecycle_rules" {
  description = "S3 lifecycle rules for cost optimization"
  type = list(object({
    id      = string
    enabled = bool
    transition = object({
      days          = number
      storage_class = string
    })
    expiration = object({
      days = number
    })
  }))
  default = [
    {
      id      = "optimize_storage"
      enabled = true
      transition = {
        days          = 30
        storage_class = "STANDARD_IA"
      }
      expiration = {
        days = 90
      }
    }
  ]
}

# Environment-specific overrides
variable "development_overrides" {
  description = "Development environment specific overrides"
  type = object({
    price_class    = optional(string)
    enable_waf     = optional(bool)
    enable_logging = optional(bool)
  })
  default = {
    price_class    = "PriceClass_100"  # US and Europe only
    enable_waf     = false
    enable_logging = false
  }
}

variable "staging_overrides" {
  description = "Staging environment specific overrides"
  type = object({
    price_class    = optional(string)
    enable_waf     = optional(bool)
    enable_logging = optional(bool)
  })
  default = {
    price_class    = "PriceClass_200"
    enable_waf     = true
    enable_logging = true
  }
}

variable "production_overrides" {
  description = "Production environment specific overrides"
  type = object({
    price_class           = optional(string)
    enable_waf           = optional(bool)
    enable_logging       = optional(bool)
    enable_origin_shield = optional(bool)
    enable_real_time_logs = optional(bool)
  })
  default = {
    price_class           = "PriceClass_All"
    enable_waf           = true
    enable_logging       = true
    enable_origin_shield = true
    enable_real_time_logs = true
  }
}

# Tags
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy = "terraform"
    Project   = "link"
  }
}