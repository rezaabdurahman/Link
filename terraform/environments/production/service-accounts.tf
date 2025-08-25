# Production environment service accounts configuration

terraform {
  required_version = ">= 1.0"
  
  backend "s3" {
    bucket = "link-app-terraform-state-prod"
    key    = "service-accounts/terraform.tfstate"
    region = "us-west-2"
    
    dynamodb_table = "link-app-terraform-locks"
    encrypt        = true
  }
}

# Provider configurations
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = "production"
      Project     = "link-app"
      ManagedBy   = "terraform"
      Owner       = "devops-team"
    }
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
  # Or use EKS cluster configuration
  # host                   = data.aws_eks_cluster.cluster.endpoint
  # cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  # token                  = data.aws_eks_cluster_auth.cluster.token
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "database_url" {
  description = "Production database URL"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# KMS key for encrypting secrets
resource "aws_kms_key" "service_account_secrets" {
  description             = "KMS key for Link app service account secrets"
  deletion_window_in_days = 7
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Secrets Manager"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      }
    ]
  })
  
  tags = {
    Name = "link-app-service-accounts-${var.environment}"
  }
}

resource "aws_kms_alias" "service_account_secrets" {
  name          = "alias/link-app-service-accounts-${var.environment}"
  target_key_id = aws_kms_key.service_account_secrets.key_id
}

# Service accounts module
module "service_accounts" {
  source = "../../modules/service-accounts"
  
  environment    = var.environment
  database_url   = var.database_url
  secrets_backend = "aws"
  aws_region     = var.aws_region
  kms_key_id     = aws_kms_alias.service_account_secrets.name
  
  # Custom rotation schedule for production (monthly)
  rotation_schedule = "0 2 1 * *" # 2 AM on the 1st of every month
  
  services = [
    {
      name        = "user-svc"
      description = "User management and authentication service"
      scopes      = ["user_management", "authentication", "profile_management"]
      roles       = ["service:user-management"]
    },
    {
      name        = "chat-svc"
      description = "Real-time chat and messaging service"
      scopes      = ["messaging", "notifications", "real_time_communication"]
      roles       = ["service:messaging"]
    },
    {
      name        = "ai-svc"
      description = "AI processing and content analysis service"
      scopes      = ["ai_processing", "content_analysis", "conversation_summarization"]
      roles       = ["service:ai-processing"]
    },
    {
      name        = "discovery-svc"
      description = "User discovery and matching service"
      scopes      = ["user_discovery", "search", "matching_algorithms"]
      roles       = ["service:discovery"]
    },
    {
      name        = "search-svc"
      description = "Search indexing and retrieval service"
      scopes      = ["search", "indexing", "vector_search"]
      roles       = ["service:discovery"]
    }
  ]
}

# CloudWatch alarms for service account health
resource "aws_cloudwatch_metric_alarm" "failed_service_authentications" {
  for_each = toset(["user-svc", "chat-svc", "ai-svc", "discovery-svc", "search-svc"])
  
  alarm_name          = "link-app-${var.environment}-${each.key}-auth-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FailedServiceAuthentications"
  namespace           = "LinkApp/ServiceAuth"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Service ${each.key} has too many authentication failures"
  
  alarm_actions = [aws_sns_topic.service_alerts.arn]
  ok_actions    = [aws_sns_topic.service_alerts.arn]
  
  dimensions = {
    ServiceName = each.key
    Environment = var.environment
  }
  
  tags = {
    Name = "ServiceAuth-${each.key}"
  }
}

# SNS topic for service alerts
resource "aws_sns_topic" "service_alerts" {
  name = "link-app-${var.environment}-service-alerts"
  
  tags = {
    Name = "ServiceAlerts"
  }
}

# SNS topic subscription (replace with your notification endpoint)
resource "aws_sns_topic_subscription" "service_alerts_email" {
  topic_arn = aws_sns_topic.service_alerts.arn
  protocol  = "email"
  endpoint  = "devops@link-app.com" # Replace with actual email
}

# IAM role for GitHub Actions to manage service accounts
resource "aws_iam_role" "github_actions_service_accounts" {
  name = "link-app-${var.environment}-github-actions-service-accounts"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:your-org/link-app:*"
          }
        }
      }
    ]
  })
  
  tags = {
    Name = "GitHubActions-ServiceAccounts"
  }
}

resource "aws_iam_role_policy" "github_actions_service_accounts" {
  name = "service-accounts-management"
  role = aws_iam_role.github_actions_service_accounts.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:CreateSecret",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecrets"
        ]
        Resource = [
          for arn in module.service_accounts.secret_arns : arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.service_account_secrets.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "LinkApp/ServiceAuth"
          }
        }
      }
    ]
  })
}

# Outputs
output "service_account_secret_arns" {
  description = "ARNs of service account secrets"
  value       = module.service_accounts.secret_arns
}

output "kms_key_id" {
  description = "KMS key ID for service account secrets"
  value       = aws_kms_key.service_account_secrets.key_id
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions"
  value       = aws_iam_role.github_actions_service_accounts.arn
}

output "sns_topic_arn" {
  description = "SNS topic ARN for service alerts"
  value       = aws_sns_topic.service_alerts.arn
}