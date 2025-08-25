# S3 Backup Storage with Cross-Region Replication and Lifecycle Management

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      configuration_aliases = [aws.primary, aws.secondary]
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Primary S3 Bucket for Backups
resource "aws_s3_bucket" "backup_primary" {
  provider = aws.primary
  bucket   = var.primary_bucket_name
  
  tags = merge(var.common_tags, {
    Name        = "Link App Backups - Primary"
    Environment = var.environment
    Purpose     = "backup-storage"
    Region      = "primary"
  })
}

# Secondary S3 Bucket for Cross-Region Replication
resource "aws_s3_bucket" "backup_secondary" {
  provider = aws.secondary
  bucket   = var.secondary_bucket_name
  
  tags = merge(var.common_tags, {
    Name        = "Link App Backups - Secondary"
    Environment = var.environment
    Purpose     = "backup-storage"
    Region      = "secondary"
  })
}

# Enable versioning on primary bucket
resource "aws_s3_bucket_versioning" "backup_primary_versioning" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable versioning on secondary bucket  
resource "aws_s3_bucket_versioning" "backup_secondary_versioning" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.backup_secondary.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption for primary bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_primary_encryption" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Server-side encryption for secondary bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_secondary_encryption" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.backup_secondary.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block public access to primary bucket
resource "aws_s3_bucket_public_access_block" "backup_primary_pab" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Block public access to secondary bucket
resource "aws_s3_bucket_public_access_block" "backup_secondary_pab" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.backup_secondary.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for Cross-Region Replication
resource "aws_iam_role" "replication_role" {
  provider = aws.primary
  name     = "${var.environment}-backup-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# IAM Policy for Cross-Region Replication
resource "aws_iam_role_policy" "replication_policy" {
  provider = aws.primary
  name     = "${var.environment}-backup-replication-policy"
  role     = aws_iam_role.replication_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.backup_primary.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup_primary.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.backup_secondary.arn}/*"
      }
    ]
  })
}

# Cross-Region Replication Configuration
resource "aws_s3_bucket_replication_configuration" "backup_replication" {
  provider   = aws.primary
  depends_on = [aws_s3_bucket_versioning.backup_primary_versioning]

  role   = aws_iam_role.replication_role.arn
  bucket = aws_s3_bucket.backup_primary.id

  rule {
    id     = "replicate-all-backups"
    status = "Enabled"

    filter {
      prefix = "postgres-backups/"
    }

    destination {
      bucket        = aws_s3_bucket.backup_secondary.arn
      storage_class = "STANDARD_IA"
      
      # Encryption settings for replicated objects
      encryption_configuration {
        replica_kms_key_id = "alias/aws/s3"
      }
    }
  }

  rule {
    id     = "replicate-redis-backups"
    status = "Enabled"

    filter {
      prefix = "redis-backups/"
    }

    destination {
      bucket        = aws_s3_bucket.backup_secondary.arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = "alias/aws/s3"
      }
    }
  }

  rule {
    id     = "replicate-wal-archives"
    status = "Enabled"

    filter {
      prefix = "wal-archive/"
    }

    destination {
      bucket        = aws_s3_bucket.backup_secondary.arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = "alias/aws/s3"
      }
    }
  }

  rule {
    id     = "replicate-qdrant-backups"
    status = "Enabled"

    filter {
      prefix = "qdrant-backups/"
    }

    destination {
      bucket        = aws_s3_bucket.backup_secondary.arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = "alias/aws/s3"
      }
    }
  }
}

# Lifecycle Configuration for Primary Bucket
resource "aws_s3_bucket_lifecycle_configuration" "backup_primary_lifecycle" {
  provider   = aws.primary
  depends_on = [aws_s3_bucket_versioning.backup_primary_versioning]
  bucket     = aws_s3_bucket.backup_primary.id

  # PostgreSQL Backups Lifecycle
  rule {
    id     = "postgres-backup-lifecycle"
    status = "Enabled"

    filter {
      prefix = "postgres-backups/"
    }

    # Transition current versions
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    # Delete old versions
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 2555  # 7 years
    }

    expiration {
      days = 2555  # 7 years for compliance
    }
  }

  # Redis Backups Lifecycle
  rule {
    id     = "redis-backup-lifecycle"
    status = "Enabled"

    filter {
      prefix = "redis-backups/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    expiration {
      days = 1095  # 3 years
    }
  }

  # WAL Archive Lifecycle
  rule {
    id     = "wal-archive-lifecycle"
    status = "Enabled"

    filter {
      prefix = "wal-archive/"
    }

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365  # 1 year for WAL files
    }
  }

  # Qdrant Backups Lifecycle
  rule {
    id     = "qdrant-backup-lifecycle"
    status = "Enabled"

    filter {
      prefix = "qdrant-backups/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 1095  # 3 years
    }
  }

  # Cleanup incomplete multipart uploads
  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Lifecycle Configuration for Secondary Bucket (similar but more aggressive)
resource "aws_s3_bucket_lifecycle_configuration" "backup_secondary_lifecycle" {
  provider   = aws.secondary
  depends_on = [aws_s3_bucket_versioning.backup_secondary_versioning]
  bucket     = aws_s3_bucket.backup_secondary.id

  rule {
    id     = "secondary-backup-lifecycle"
    status = "Enabled"

    # Immediately transition to IA since this is disaster recovery
    transition {
      days          = 0
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    expiration {
      days = 2555  # 7 years
    }
  }

  rule {
    id     = "cleanup-incomplete-uploads-secondary"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
}

# S3 Bucket Notification for Backup Monitoring
resource "aws_s3_bucket_notification" "backup_notifications" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  topic {
    topic_arn = aws_sns_topic.backup_notifications.arn
    events = [
      "s3:ObjectCreated:*",
      "s3:ObjectRemoved:*",
      "s3:Replication:*"
    ]
    filter_prefix = "postgres-backups/"
  }

  topic {
    topic_arn = aws_sns_topic.backup_notifications.arn
    events = [
      "s3:ObjectCreated:*",
      "s3:ObjectRemoved:*"
    ]
    filter_prefix = "redis-backups/"
  }

  topic {
    topic_arn = aws_sns_topic.backup_notifications.arn
    events = [
      "s3:ObjectCreated:*"
    ]
    filter_prefix = "qdrant-backups/"
  }

  topic {
    topic_arn = aws_sns_topic.backup_notifications.arn
    events = [
      "s3:ObjectCreated:*"
    ]
    filter_prefix = "wal-archive/"
  }

  depends_on = [aws_sns_topic_policy.backup_notifications_policy]
}

# SNS Topic for Backup Notifications
resource "aws_sns_topic" "backup_notifications" {
  provider = aws.primary
  name     = "${var.environment}-backup-notifications"

  tags = var.common_tags
}

# SNS Topic Policy to allow S3 to publish
resource "aws_sns_topic_policy" "backup_notifications_policy" {
  provider = aws.primary
  arn      = aws_sns_topic.backup_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.backup_notifications.arn
        Condition = {
          StringEquals = {
            "aws:SourceArn" = aws_s3_bucket.backup_primary.arn
          }
        }
      }
    ]
  })
}

# CloudWatch Metrics for S3 Bucket
resource "aws_s3_bucket_metric" "backup_metrics" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id
  name     = "backup-metrics"

  filter {
    prefix = "postgres-backups/"
  }
}

# S3 Bucket Logging
resource "aws_s3_bucket" "access_logs" {
  provider = aws.primary
  bucket   = "${var.primary_bucket_name}-access-logs"

  tags = merge(var.common_tags, {
    Name    = "Backup Access Logs"
    Purpose = "access-logging"
  })
}

resource "aws_s3_bucket_logging" "backup_logging" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "backup-access-logs/"
}

# Bucket policy for backup operations
resource "aws_s3_bucket_policy" "backup_policy" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.backup_primary.arn,
          "${aws_s3_bucket.backup_primary.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "AllowBackupOperations"
        Effect = "Allow"
        Principal = {
          AWS = var.backup_user_arn != "" ? var.backup_user_arn : aws_iam_user.backup_user.arn
        }
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket",
          "s3:ListBucketVersions",
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource = [
          aws_s3_bucket.backup_primary.arn,
          "${aws_s3_bucket.backup_primary.arn}/*"
        ]
      },
      {
        Sid    = "DenyUnencryptedUploads"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:PutObject"
        Resource = "${aws_s3_bucket.backup_primary.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      }
    ]
  })
}

# IAM User for Backup Operations
resource "aws_iam_user" "backup_user" {
  provider = aws.primary
  name     = "${var.environment}-backup-service-user"
  path     = "/service-accounts/"

  tags = merge(var.common_tags, {
    Purpose = "backup-operations"
    Service = "backup-system"
  })
}

# IAM Access Key for Backup User
resource "aws_iam_access_key" "backup_user_key" {
  provider = aws.primary
  user     = aws_iam_user.backup_user.name
}

# IAM Policy for Backup User
resource "aws_iam_user_policy" "backup_user_policy" {
  provider = aws.primary
  name     = "${var.environment}-backup-operations-policy"
  user     = aws_iam_user.backup_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket",
          "s3:ListBucketVersions",
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource = [
          aws_s3_bucket.backup_primary.arn,
          "${aws_s3_bucket.backup_primary.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListAllMyBuckets",
          "s3:GetBucketLocation"
        ]
        Resource = "*"
      }
    ]
  })
}

# AWS Secrets Manager Secret for Backup Credentials
resource "aws_secretsmanager_secret" "backup_credentials" {
  provider    = aws.primary
  name        = "backup/aws/backup-user-credentials"
  description = "AWS credentials for backup system"
  
  tags = merge(var.common_tags, {
    Purpose = "backup-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "backup_credentials" {
  provider  = aws.primary
  secret_id = aws_secretsmanager_secret.backup_credentials.id
  secret_string = jsonencode({
    access_key_id     = aws_iam_access_key.backup_user_key.id
    secret_access_key = aws_iam_access_key.backup_user_key.secret
  })
}

# Secrets for S3 Configuration
resource "aws_secretsmanager_secret" "s3_config" {
  provider    = aws.primary
  name        = "backup/s3/config"
  description = "S3 configuration for backup system"
  
  tags = merge(var.common_tags, {
    Purpose = "backup-config"
  })
}

resource "aws_secretsmanager_secret_version" "s3_config" {
  provider  = aws.primary
  secret_id = aws_secretsmanager_secret.s3_config.id
  secret_string = jsonencode({
    primary_bucket_name   = aws_s3_bucket.backup_primary.id
    secondary_bucket_name = aws_s3_bucket.backup_secondary.id
    primary_region        = var.primary_region
    secondary_region      = var.secondary_region
  })
}

# Master Encryption Key Secret
resource "aws_secretsmanager_secret" "encryption_key" {
  provider    = aws.primary
  name        = "backup/encryption/master-key"
  description = "Master encryption key for backup system"
  
  tags = merge(var.common_tags, {
    Purpose = "backup-encryption"
  })
}

# Generate encryption key if not provided
resource "random_password" "backup_encryption_key" {
  length  = 32
  special = true
}

locals {
  encryption_key = var.backup_encryption_key != "" ? var.backup_encryption_key : random_password.backup_encryption_key.result
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  provider  = aws.primary
  secret_id = aws_secretsmanager_secret.encryption_key.id
  secret_string = jsonencode({
    backup_encryption_key = local.encryption_key
  })
}

# CloudWatch Alarms for Backup Monitoring
resource "aws_cloudwatch_metric_alarm" "backup_failure_alarm" {
  provider            = aws.primary
  alarm_name          = "${var.environment}-backup-system-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/S3"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors backup upload failures to S3"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]

  dimensions = {
    BucketName = aws_s3_bucket.backup_primary.id
  }

  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "backup_storage_alarm" {
  provider            = aws.primary
  alarm_name          = "${var.environment}-backup-storage-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400"  # Daily
  statistic           = "Average"
  threshold           = "1000000000000"  # 1TB
  alarm_description   = "This metric monitors backup storage usage"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    BucketName  = aws_s3_bucket.backup_primary.id
    StorageType = "StandardStorage"
  }

  tags = var.common_tags
}