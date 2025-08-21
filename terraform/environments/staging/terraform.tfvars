# Staging Environment Configuration
# Production-like settings for staging validation

environment = "staging"

# PostgreSQL Configuration
postgres_host     = "postgres.staging.svc.cluster.local"
postgres_port     = 5432
postgres_database = "link_app_staging"
postgres_username = "link_staging_user"
postgres_sslmode  = "require" # Production-like security

# Resource Limits (Production-like)
database_connection_limit = 75
user_connection_limit     = 40

# Feature Flags
create_monitoring_user   = true
enable_ssl               = true # Production-like security
enable_pgbouncer         = true
enable_backup_automation = true

# Kubernetes Configuration
kubernetes_namespace = "link-staging"
kubernetes_context   = "staging-cluster"

# PgBouncer Configuration (Production-like)
pgbouncer_pool_mode         = "transaction" # More efficient for staging load
pgbouncer_max_client_conn   = 75
pgbouncer_default_pool_size = 8

# Backup Configuration
backup_retention_days = 14 # Moderate retention for staging

# Enhanced tagging strategy
tags = {
  # Core identification
  Project     = "Link"
  Component   = "Database"
  Environment = "staging"

  # Management
  ManagedBy = "Terraform"
  Owner     = "backend-team"
  Purpose   = "Multi-Instance Database Isolation"

  # Cost management
  CostCenter  = "Engineering"
  BillingCode = "ENG-DB-STAGING"

  # Compliance and security
  DataClass  = "staging"
  Compliance = "testing"
  Backup     = "required"

  # Operational
  Schedule = "business-hours"
  Support  = "standard"

  # Technical
  TerraformModule = "service-databases"
  Version         = "1.0"

  # Lifecycle
  CreatedBy   = "terraform"
  CreatedDate = "2025-01-19"
}
