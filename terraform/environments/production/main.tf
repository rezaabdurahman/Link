# Production Environment - Search Service with Qdrant

terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for production
locals {
  environment = "production"
  namespace   = "link-services"
}

# AWS Data Sources for production
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Qdrant Cluster for Production
module "qdrant_cluster" {
  source = "../../modules/qdrant-cluster"
  
  # Production cluster configuration
  cluster_size        = 3
  replication_factor  = 2
  environment        = local.environment
  namespace          = local.namespace
  
  # Production resource limits
  node_memory_request = "1Gi"
  node_memory_limit   = "4Gi"
  node_cpu_request    = "500m"
  node_cpu_limit      = "2000m"
  storage_size        = "100Gi"
  
  # Production networking (AWS EKS)
  load_balancer_type = "LoadBalancer"
  load_balancer_annotations = {
    "service.beta.kubernetes.io/aws-load-balancer-type"     = "nlb"
    "service.beta.kubernetes.io/aws-load-balancer-internal" = "true"
    "service.beta.kubernetes.io/aws-load-balancer-scheme"   = "internal"
  }
  
  # High availability
  enable_hpa              = true
  max_replicas           = 5
  cpu_target_utilization = 70
  min_available_pods     = 2
  
  # Production storage (AWS EBS)
  create_storage_class = true
  storage_class_name   = "qdrant-gp3-ssd"
  storage_provisioner  = "ebs.csi.aws.com"
  storage_parameters = {
    type       = "gp3"
    iops       = "3000"
    throughput = "125"
    encrypted  = "true"
    kmsKeyId   = var.kms_key_id
  }
  
  # Production security
  enable_linkerd_injection = true
  pod_security_context = {
    run_as_user     = 1000
    run_as_group    = 1000
    fs_group        = 1000
    run_as_non_root = true
  }
}

# S3 Bucket for Qdrant Backups
resource "aws_s3_bucket" "qdrant_backups" {
  bucket        = "link-qdrant-backups-${data.aws_caller_identity.current.account_id}"
  force_destroy = false  # Protect production backups
  
  tags = {
    Name        = "link-qdrant-backups"
    Environment = local.environment
    Component   = "qdrant-backups"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "qdrant_backups" {
  bucket = aws_s3_bucket.qdrant_backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "qdrant_backups" {
  bucket = aws_s3_bucket.qdrant_backups.id
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = var.kms_key_id
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "qdrant_backups" {
  bucket = aws_s3_bucket.qdrant_backups.id
  
  rule {
    id     = "qdrant_backup_retention"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    expiration {
      days = 365  # Keep backups for 1 year
    }
  }
}

# IAM User for Backup Operations
resource "aws_iam_user" "qdrant_backup" {
  name = "qdrant-backup-${local.environment}"
  path = "/system/"
  
  tags = {
    Environment = local.environment
    Component   = "qdrant-backup"
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_access_key" "qdrant_backup" {
  user = aws_iam_user.qdrant_backup.name
}

resource "aws_iam_user_policy" "qdrant_backup" {
  name = "qdrant-backup-policy"
  user = aws_iam_user.qdrant_backup.name
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.qdrant_backups.arn,
          "${aws_s3_bucket.qdrant_backups.arn}/*"
        ]
      }
    ]
  })
}

# Search Service Configuration
module "search_service_config" {
  source = "../../modules/search-service-config"
  
  environment = local.environment
  namespace   = local.namespace
  
  # No .env file in production (use K8s secrets)
  create_env_template = false
  
  # Repository configuration (use Qdrant)
  repository_type = "qdrant"
  qdrant_host     = module.qdrant_cluster.cluster_endpoint
  qdrant_use_tls  = "true"  # Enable TLS in production
  
  # Production database settings
  db_host    = "postgres.link-internal.svc.cluster.local"
  db_sslmode = "require"
  gin_mode   = "release"
  log_level  = "info"
  
  # Production service URLs
  discovery_svc_url = "http://discovery-svc.link-services.svc.cluster.local:8080"
  user_svc_url      = "http://user-svc.link-services.svc.cluster.local:8080"
  
  # Production-specific settings
  search_rate_limit_qpm = "50"    # Conservative for production
  cache_ttl            = "300"    # Standard 5-minute cache
  
  # Secrets (from external secret management)
  openai_api_key     = var.openai_api_key
  service_auth_token = var.service_auth_token
  db_password        = var.db_password
  
  # Enable backups in production
  enable_backups          = true
  backup_s3_bucket        = aws_s3_bucket.qdrant_backups.bucket
  aws_access_key_id       = aws_iam_access_key.qdrant_backup.id
  aws_secret_access_key   = aws_iam_access_key.qdrant_backup.secret
}

# Production-specific variables (should be set via external secret management)
variable "openai_api_key" {
  description = "OpenAI API key for production (from external secret store)"
  type        = string
  sensitive   = true
}

variable "service_auth_token" {
  description = "Service auth token for production (from external secret store)"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password for production (from external secret store)"
  type        = string
  sensitive   = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = "alias/link-production-key"
}

# Outputs
output "qdrant_cluster_info" {
  description = "Qdrant cluster information for production"
  value = {
    endpoint         = module.qdrant_cluster.grpc_endpoint
    load_balancer_ip = module.qdrant_cluster.load_balancer_ip
    cluster_size     = module.qdrant_cluster.cluster_size
    replication     = module.qdrant_cluster.replication_factor
  }
}

output "backup_configuration" {
  description = "Backup configuration for production"
  value = {
    s3_bucket    = aws_s3_bucket.qdrant_backups.bucket
    iam_user     = aws_iam_user.qdrant_backup.name
    lifecycle    = "365 days retention with Glacier transition"
    automation   = "CronJob every 6 hours"
  }
}

output "production_deployment_status" {
  description = "Production deployment status and next steps"
  value = {
    qdrant_cluster      = "3-node HA cluster with 2x replication"
    storage_encrypted   = "Yes (AWS KMS)"
    backups_enabled     = "Yes (S3 with lifecycle)"
    load_balancer      = "AWS NLB (internal)"
    monitoring         = "Linkerd service mesh + Prometheus"
    secrets_management = "Kubernetes secrets (external-secrets recommended)"
    
    next_steps = [
      "1. Configure external-secrets operator for secret management",
      "2. Set up monitoring dashboards for Qdrant metrics",
      "3. Test disaster recovery procedures",
      "4. Configure alerts for backup failures"
    ]
  }
}