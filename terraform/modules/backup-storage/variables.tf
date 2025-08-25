# Variables for Backup Storage Module

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development."
  }
}

variable "primary_region" {
  description = "Primary AWS region for backup storage"
  type        = string
  default     = "us-west-2"
}

variable "secondary_region" {
  description = "Secondary AWS region for cross-region replication"
  type        = string
  default     = "us-east-1"
}

variable "primary_bucket_name" {
  description = "Name of the primary S3 bucket for backups"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.primary_bucket_name))
    error_message = "Bucket name must be valid S3 bucket name."
  }
}

variable "secondary_bucket_name" {
  description = "Name of the secondary S3 bucket for cross-region replication"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.secondary_bucket_name))
    error_message = "Bucket name must be valid S3 bucket name."
  }
}

variable "backup_user_arn" {
  description = "ARN of the IAM user/role that will perform backup operations (optional, will create if not provided)"
  type        = string
  default     = ""
}

variable "backup_encryption_key" {
  description = "Master encryption key for backup system (will generate if not provided)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sns_topic_arn" {
  description = "ARN of SNS topic for backup notifications"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Link"
    ManagedBy   = "Terraform"
    Component   = "backup-storage"
  }
}

variable "enable_cross_region_replication" {
  description = "Enable cross-region replication for disaster recovery"
  type        = bool
  default     = true
}

variable "enable_lifecycle_policies" {
  description = "Enable S3 lifecycle policies for cost optimization"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups in primary storage"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 2555
    error_message = "Backup retention must be between 1 and 2555 days."
  }
}

variable "glacier_transition_days" {
  description = "Number of days after which to transition backups to Glacier"
  type        = number
  default     = 90
  validation {
    condition     = var.glacier_transition_days >= 30
    error_message = "Glacier transition must be at least 30 days."
  }
}

variable "deep_archive_transition_days" {
  description = "Number of days after which to transition backups to Deep Archive"
  type        = number
  default     = 365
  validation {
    condition     = var.deep_archive_transition_days >= 180
    error_message = "Deep Archive transition must be at least 180 days."
  }
}

variable "wal_retention_days" {
  description = "Number of days to retain WAL archive files"
  type        = number
  default     = 365
  validation {
    condition     = var.wal_retention_days >= 30 && var.wal_retention_days <= 2555
    error_message = "WAL retention must be between 30 and 2555 days."
  }
}

variable "enable_access_logging" {
  description = "Enable S3 access logging"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_metrics" {
  description = "Enable CloudWatch metrics for S3 buckets"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for S3 bucket encryption (optional)"
  type        = string
  default     = ""
}

variable "notification_endpoints" {
  description = "List of notification endpoints (email, slack, etc.)"
  type = list(object({
    type     = string  # email, sms, slack
    endpoint = string  # email address, phone number, webhook URL
  }))
  default = []
}

variable "compliance_mode" {
  description = "Enable compliance mode with extended retention"
  type        = bool
  default     = false
}

variable "enable_versioning" {
  description = "Enable S3 versioning for backup buckets"
  type        = bool
  default     = true
}

variable "multipart_upload_cleanup_days" {
  description = "Days after which to cleanup incomplete multipart uploads"
  type        = number
  default     = 7
  validation {
    condition     = var.multipart_upload_cleanup_days >= 1 && var.multipart_upload_cleanup_days <= 30
    error_message = "Multipart upload cleanup must be between 1 and 30 days."
  }
}

# Network and Security Variables
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access backup buckets"
  type        = list(string)
  default     = []
}

variable "vpc_id" {
  description = "VPC ID for VPC endpoint (optional)"
  type        = string
  default     = ""
}

variable "create_vpc_endpoint" {
  description = "Create VPC endpoint for S3 access"
  type        = bool
  default     = false
}

# Monitoring and Alerting Variables
variable "backup_failure_threshold" {
  description = "Number of failed backups before alerting"
  type        = number
  default     = 2
}

variable "backup_size_threshold_gb" {
  description = "Backup size threshold in GB for alerting"
  type        = number
  default     = 100
}

variable "enable_backup_integrity_check" {
  description = "Enable automated backup integrity verification"
  type        = bool
  default     = true
}