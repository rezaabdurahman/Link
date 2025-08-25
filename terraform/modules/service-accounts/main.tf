# Terraform module for automated service account infrastructure
# This module sets up the infrastructure needed for service account authentication

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.20"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "services" {
  description = "List of services that need service accounts"
  type = list(object({
    name        = string
    description = string
    scopes      = list(string)
    roles       = list(string)
  }))
  default = [
    {
      name        = "user-svc"
      description = "User management service"
      scopes      = ["user_management", "authentication"]
      roles       = ["service:user-management"]
    },
    {
      name        = "chat-svc"
      description = "Chat and messaging service"
      scopes      = ["messaging", "notifications"]
      roles       = ["service:messaging"]
    },
    {
      name        = "ai-svc"
      description = "AI processing service"
      scopes      = ["ai_processing", "content_analysis"]
      roles       = ["service:ai-processing"]
    },
    {
      name        = "discovery-svc"
      description = "User discovery service"
      scopes      = ["user_discovery", "search"]
      roles       = ["service:discovery"]
    },
    {
      name        = "search-svc"
      description = "Search and indexing service"
      scopes      = ["search", "indexing"]
      roles       = ["service:discovery"]
    }
  ]
}

variable "database_url" {
  description = "PostgreSQL database URL"
  type        = string
  sensitive   = true
}

variable "secrets_backend" {
  description = "Where to store service account secrets (aws, kubernetes)"
  type        = string
  default     = "aws"
  
  validation {
    condition     = contains(["aws", "kubernetes"], var.secrets_backend)
    error_message = "Secrets backend must be aws or kubernetes."
  }
}

variable "aws_region" {
  description = "AWS region for secrets storage"
  type        = string
  default     = "us-west-2"
}

variable "kms_key_id" {
  description = "AWS KMS key ID for encrypting secrets"
  type        = string
  default     = "alias/link-app-secrets"
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace for secrets"
  type        = string
  default     = "default"
}

variable "rotation_schedule" {
  description = "Cron schedule for automatic credential rotation"
  type        = string
  default     = "0 2 1 * *" # 2 AM on the 1st of every month
}

# Local values
locals {
  common_tags = {
    Environment = var.environment
    Project     = "link-app"
    ManagedBy   = "terraform"
    Module      = "service-accounts"
  }
  
  secret_prefix = "link-app/${var.environment}"
}

# Random passwords for service accounts
resource "random_password" "service_client_secrets" {
  for_each = { for service in var.services : service.name => service }
  
  length  = 32
  special = true
}

# AWS Secrets Manager secrets for service accounts
resource "aws_secretsmanager_secret" "service_account_secrets" {
  for_each = var.secrets_backend == "aws" ? { for service in var.services : service.name => service } : {}
  
  name        = "${local.secret_prefix}/${each.key}/service-account"
  description = "Service account credentials for ${each.value.description}"
  
  kms_key_id = var.kms_key_id
  
  replica {
    region = var.aws_region != "us-east-1" ? "us-east-1" : "us-west-2"
  }
  
  tags = merge(local.common_tags, {
    Name    = "${each.key}-service-account"
    Service = each.key
  })
}

# Generate client IDs
resource "random_id" "client_id_suffix" {
  for_each = { for service in var.services : service.name => service }
  
  byte_length = 4
}

# Local computation for client credentials
locals {
  service_credentials = {
    for service in var.services : service.name => {
      client_id     = "svc_${service.name}_${random_id.client_id_suffix[service.name].hex}"
      client_secret = random_password.service_client_secrets[service.name].result
      scopes        = jsonencode({ scopes = service.scopes })
    }
  }
}

# Store credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret_version" "service_account_credentials" {
  for_each = var.secrets_backend == "aws" ? local.service_credentials : {}
  
  secret_id = aws_secretsmanager_secret.service_account_secrets[each.key].id
  
  secret_string = jsonencode({
    SERVICE_CLIENT_ID     = each.value.client_id
    SERVICE_CLIENT_SECRET = each.value.client_secret
    AUTH_SERVICE_URL      = var.environment == "production" ? "https://user-svc.link-app.internal" : "http://user-svc:8082"
  })
  
  lifecycle {
    ignore_changes = [secret_string] # Allow external rotation
  }
}

# Kubernetes secrets for service accounts
resource "kubernetes_secret" "service_account_secrets" {
  for_each = var.secrets_backend == "kubernetes" ? local.service_credentials : {}
  
  metadata {
    name      = "${each.key}-service-account"
    namespace = var.kubernetes_namespace
    
    labels = {
      "app.kubernetes.io/name"       = each.key
      "app.kubernetes.io/component"  = "service-account"
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
    }
  }
  
  data = {
    SERVICE_CLIENT_ID     = each.value.client_id
    SERVICE_CLIENT_SECRET = each.value.client_secret
    AUTH_SERVICE_URL      = var.environment == "production" ? "https://user-svc.link-app.internal" : "http://user-svc:8082"
  }
  
  type = "Opaque"
}

# PostgreSQL provider configuration
provider "postgresql" {
  host     = split(":", split("@", split("//", var.database_url)[1])[1])[0]
  port     = try(tonumber(split(":", split("@", split("//", var.database_url)[1])[1])[1]), 5432)
  database = split("?", split("/", var.database_url)[3])[0]
  username = split(":", split("@", split("//", var.database_url)[1])[0])[0]
  password = split("@", split(":", split("@", split("//", var.database_url)[1])[0])[1])[0]
  sslmode  = "require"
}

# Hash the client secrets using external data source (calls bcrypt utility)
data "external" "hashed_secrets" {
  for_each = local.service_credentials
  
  program = ["bash", "-c", "echo '{\"hash\":\"'$(echo '${each.value.client_secret}' | htpasswd -bnBC 12 '' | cut -d: -f2)'\"}'"]
}

# Create service accounts in database
resource "postgresql_role" "service_account_migration_role" {
  name     = "terraform_service_account_manager"
  login    = false
  password = random_password.migration_password.result
}

resource "random_password" "migration_password" {
  length = 16
}

# Insert service accounts into database using null_resource with local-exec
resource "null_resource" "create_service_accounts" {
  for_each = local.service_credentials
  
  triggers = {
    client_id          = each.value.client_id
    client_secret_hash = data.external.hashed_secrets[each.key].result.hash
    scopes            = each.value.scopes
    environment       = var.environment
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      PGPASSWORD="${split("@", split(":", split("@", split("//", var.database_url)[1])[0])[1])[0]}" psql "${var.database_url}" << 'EOF'
      INSERT INTO service_accounts (name, description, client_id, client_secret_hash, scopes, is_active)
      VALUES (
        '${each.key}',
        '${var.services[index(var.services.*.name, each.key)].description}',
        '${each.value.client_id}',
        '${data.external.hashed_secrets[each.key].result.hash}',
        '${each.value.scopes}'::jsonb,
        true
      )
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        client_id = EXCLUDED.client_id,
        client_secret_hash = EXCLUDED.client_secret_hash,
        scopes = EXCLUDED.scopes,
        updated_at = NOW();
      EOF
    EOT
  }
}

# Assign roles to service accounts
resource "null_resource" "assign_service_roles" {
  for_each = { 
    for pair in flatten([
      for service in var.services : [
        for role in service.roles : {
          service = service.name
          role    = role
        }
      ]
    ]) : "${pair.service}-${pair.role}" => pair
  }
  
  depends_on = [null_resource.create_service_accounts]
  
  triggers = {
    service = each.value.service
    role    = each.value.role
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      PGPASSWORD="${split("@", split(":", split("@", split("//", var.database_url)[1])[0])[1])[0]}" psql "${var.database_url}" << 'EOF'
      INSERT INTO service_account_roles (service_account_id, role_id)
      SELECT sa.id, r.id
      FROM service_accounts sa, roles r
      WHERE sa.name = '${each.value.service}' AND r.name = '${each.value.role}'
      ON CONFLICT (service_account_id, role_id) DO NOTHING;
      EOF
    EOT
  }
}

# CloudWatch Event Rule for automatic credential rotation
resource "aws_cloudwatch_event_rule" "credential_rotation" {
  count = var.secrets_backend == "aws" ? 1 : 0
  
  name        = "link-app-${var.environment}-credential-rotation"
  description = "Trigger service account credential rotation"
  
  schedule_expression = "cron(${var.rotation_schedule})"
  
  tags = local.common_tags
}

# IAM role for credential rotation Lambda
resource "aws_iam_role" "rotation_lambda_role" {
  count = var.secrets_backend == "aws" ? 1 : 0
  
  name = "link-app-${var.environment}-rotation-lambda"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# IAM policy for credential rotation Lambda
resource "aws_iam_role_policy" "rotation_lambda_policy" {
  count = var.secrets_backend == "aws" ? 1 : 0
  
  name = "rotation-lambda-policy"
  role = aws_iam_role.rotation_lambda_role[0].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          for secret in aws_secretsmanager_secret.service_account_secrets : secret.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Outputs
output "service_credentials" {
  description = "Service account credentials (sensitive)"
  value = {
    for service_name, creds in local.service_credentials : service_name => {
      client_id   = creds.client_id
      secret_name = var.secrets_backend == "aws" ? aws_secretsmanager_secret.service_account_secrets[service_name].name : kubernetes_secret.service_account_secrets[service_name].metadata[0].name
    }
  }
  sensitive = true
}

output "secret_arns" {
  description = "AWS Secrets Manager ARNs (if using AWS backend)"
  value = var.secrets_backend == "aws" ? {
    for service_name, secret in aws_secretsmanager_secret.service_account_secrets : 
    service_name => secret.arn
  } : {}
}

output "kubernetes_secret_names" {
  description = "Kubernetes secret names (if using Kubernetes backend)"
  value = var.secrets_backend == "kubernetes" ? {
    for service_name, secret in kubernetes_secret.service_account_secrets :
    service_name => secret.metadata[0].name
  } : {}
}