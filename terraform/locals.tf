# Local Values and Common Configurations
# Centralized local variables for reuse across resources

locals {
  environment = var.environment

  # Common tags applied to all resources
  common_tags = merge(var.tags, {
    Environment = local.environment
    Terraform   = "true"
    Component   = "database-isolation"
    CreatedBy   = "terraform"
    ManagedBy   = "infrastructure-team"
  })

  # Environment-specific configurations
  env_config = {
    development = {
      postgres_host      = "localhost"
      kubernetes_host    = "postgres"
      backup_enabled     = false
      monitoring_enabled = true
      ssl_required       = false
    }
    staging = {
      postgres_host      = "postgres.staging.svc.cluster.local"
      kubernetes_host    = "postgres.staging.svc.cluster.local"
      backup_enabled     = true
      monitoring_enabled = true
      ssl_required       = true
    }
    production = {
      postgres_host      = "postgres.default.svc.cluster.local"
      kubernetes_host    = "postgres.default.svc.cluster.local"
      backup_enabled     = true
      monitoring_enabled = true
      ssl_required       = true
    }
  }

  # Get current environment configuration
  current_env = local.env_config[local.environment]

  # Remote state configuration per environment
  backend_config = {
    development = {
      bucket = "link-terraform-state-dev"
      key    = "database-isolation/terraform.tfstate"
      region = "us-west-2"
    }
    staging = {
      bucket = "link-terraform-state-staging"
      key    = "database-isolation/terraform.tfstate"
      region = "us-west-2"
    }
    production = {
      bucket = "link-terraform-state-prod"
      key    = "database-isolation/terraform.tfstate"
      region = "us-west-2"
    }
  }
}
