# Outputs for Backup Storage Module

output "primary_bucket_name" {
  description = "Name of the primary backup bucket"
  value       = aws_s3_bucket.backup_primary.bucket
}

output "primary_bucket_arn" {
  description = "ARN of the primary backup bucket"
  value       = aws_s3_bucket.backup_primary.arn
}

output "primary_bucket_domain_name" {
  description = "Domain name of the primary backup bucket"
  value       = aws_s3_bucket.backup_primary.bucket_domain_name
}

output "secondary_bucket_name" {
  description = "Name of the secondary backup bucket"
  value       = aws_s3_bucket.backup_secondary.bucket
}

output "secondary_bucket_arn" {
  description = "ARN of the secondary backup bucket"
  value       = aws_s3_bucket.backup_secondary.arn
}

output "replication_role_arn" {
  description = "ARN of the IAM role used for cross-region replication"
  value       = aws_iam_role.replication_role.arn
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for backup notifications"
  value       = aws_sns_topic.backup_notifications.arn
}

output "sns_topic_name" {
  description = "Name of the SNS topic for backup notifications"
  value       = aws_sns_topic.backup_notifications.name
}

output "access_logs_bucket_name" {
  description = "Name of the access logs bucket"
  value       = aws_s3_bucket.access_logs.bucket
}

output "access_logs_bucket_arn" {
  description = "ARN of the access logs bucket"
  value       = aws_s3_bucket.access_logs.arn
}

# Backup User Credentials (Sensitive)
output "backup_user_access_key_id" {
  description = "Access key ID for backup user"
  value       = aws_iam_access_key.backup_user_key.id
  sensitive   = true
}

output "backup_user_secret_access_key" {
  description = "Secret access key for backup user"
  value       = aws_iam_access_key.backup_user_key.secret
  sensitive   = true
}

output "backup_user_arn" {
  description = "ARN of the backup user"
  value       = aws_iam_user.backup_user.arn
}

# AWS Secrets Manager Outputs
output "backup_credentials_secret_arn" {
  description = "ARN of the backup credentials secret in AWS Secrets Manager"
  value       = aws_secretsmanager_secret.backup_credentials.arn
}

output "s3_config_secret_arn" {
  description = "ARN of the S3 configuration secret in AWS Secrets Manager"
  value       = aws_secretsmanager_secret.s3_config.arn
}

output "encryption_key_secret_arn" {
  description = "ARN of the encryption key secret in AWS Secrets Manager"
  value       = aws_secretsmanager_secret.encryption_key.arn
}

# CloudWatch Alarm Outputs
output "backup_failure_alarm_arn" {
  description = "ARN of the backup failure CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.backup_failure_alarm.arn
}

output "backup_storage_alarm_arn" {
  description = "ARN of the backup storage usage CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.backup_storage_alarm.arn
}

# Backup Configuration Outputs
output "backup_configuration" {
  description = "Backup configuration details"
  value = {
    primary_region   = var.primary_region
    secondary_region = var.secondary_region
    retention_days   = var.backup_retention_days
    wal_retention    = var.wal_retention_days
    lifecycle_enabled = var.enable_lifecycle_policies
    replication_enabled = var.enable_cross_region_replication
    versioning_enabled = var.enable_versioning
  }
}

# Security Outputs
output "bucket_encryption" {
  description = "Encryption configuration for buckets"
  value = {
    primary_encryption   = "AES256"
    secondary_encryption = "AES256"
    kms_key_id          = var.kms_key_id
  }
}

# Monitoring Outputs
output "cloudwatch_metrics" {
  description = "CloudWatch metrics configuration"
  value = {
    enabled = var.enable_cloudwatch_metrics
    metric_name = aws_s3_bucket_metric.backup_metrics.name
  }
}

# Lifecycle Policy Details
output "lifecycle_policies" {
  description = "Details of lifecycle policies applied"
  value = {
    postgres_backups = {
      ia_transition     = 30
      glacier_transition = var.glacier_transition_days
      deep_archive_transition = var.deep_archive_transition_days
      expiration        = var.compliance_mode ? 2555 : var.backup_retention_days * 3
    }
    redis_backups = {
      ia_transition     = 30
      glacier_transition = var.glacier_transition_days
      expiration        = 1095  # 3 years
    }
    wal_archives = {
      ia_transition     = 7
      glacier_transition = 30
      expiration        = var.wal_retention_days
    }
    qdrant_backups = {
      ia_transition     = 30
      glacier_transition = var.glacier_transition_days
      expiration        = 1095  # 3 years
    }
  }
}

# Cost Optimization Information
output "cost_optimization" {
  description = "Cost optimization features enabled"
  value = {
    lifecycle_policies        = var.enable_lifecycle_policies
    ia_transition_days       = 30
    glacier_transition_days  = var.glacier_transition_days
    multipart_cleanup_days   = var.multipart_upload_cleanup_days
    cross_region_replication = var.enable_cross_region_replication
    intelligent_tiering      = false  # Can be enabled if needed
  }
}

# Access and Permissions
output "bucket_policies" {
  description = "Bucket policy information"
  value = {
    secure_transport_required = true
    public_access_blocked     = true
    backup_user_permissions   = [
      "s3:PutObject",
      "s3:PutObjectAcl", 
      "s3:GetObject",
      "s3:ListBucket",
      "s3:DeleteObject"
    ]
  }
}

# Disaster Recovery Information
output "disaster_recovery" {
  description = "Disaster recovery configuration"
  value = {
    cross_region_replication = var.enable_cross_region_replication
    primary_region          = var.primary_region
    secondary_region        = var.secondary_region
    rto_hours              = 4   # Recovery Time Objective
    rpo_hours              = 1   # Recovery Point Objective
    backup_verification    = var.enable_backup_integrity_check
  }
}

# Integration Information for Kubernetes
output "kubernetes_integration" {
  description = "Information needed for Kubernetes backup jobs"
  value = {
    bucket_name        = aws_s3_bucket.backup_primary.bucket
    bucket_region      = var.primary_region
    sns_topic_arn      = aws_sns_topic.backup_notifications.arn
    encryption_enabled = true
    versioning_enabled = var.enable_versioning
  }
  sensitive = false
}

# Backup Paths Structure
output "backup_paths" {
  description = "Standard backup paths structure in S3"
  value = {
    postgres_backups = "postgres-backups/"
    redis_backups   = "redis-backups/"
    wal_archives    = "wal-archive/"
    qdrant_backups  = "qdrant-backups/"
    metadata_path   = "metadata/"
    logs_path       = "logs/"
  }
}