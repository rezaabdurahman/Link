# Development Environment Configuration
# Override defaults for development environment

environment = "development"

# PostgreSQL Configuration
postgres_host     = "localhost"
postgres_port     = 5432
postgres_database = "link_app_dev"
postgres_username = "link_dev_user"
postgres_sslmode  = "disable" # Relaxed for local development

# Resource Limits (Lower for development)
database_connection_limit = 50
user_connection_limit     = 25

# Feature Flags
create_monitoring_user   = true
enable_ssl               = false # Simplified for local development
enable_pgbouncer         = true
enable_backup_automation = false # No automated backups in dev

# Kubernetes Configuration
kubernetes_namespace = "link-dev"
kubernetes_context   = "docker-desktop" # Common local k8s context

# PgBouncer Configuration (Conservative for development)
pgbouncer_pool_mode         = "session"
pgbouncer_max_client_conn   = 50
pgbouncer_default_pool_size = 5

# Backup Configuration
backup_retention_days = 7 # Shorter retention for development

# Enhanced tagging strategy
tags = {
  # Core identification
  Project     = "Link"
  Component   = "Database"
  Environment = "development"

  # Management
  ManagedBy = "Terraform"
  Owner     = "backend-team"
  Purpose   = "Multi-Instance Database Isolation"

  # Cost management
  CostCenter  = "Engineering"
  BillingCode = "ENG-DB-DEV"

  # Compliance and security
  DataClass  = "development"
  Compliance = "none"
  Backup     = "not-required"

  # Operational
  Schedule = "business-hours"
  Support  = "best-effort"

  # Technical
  TerraformModule = "service-databases"
  Version         = "1.0"

  # Lifecycle
  CreatedBy   = "terraform"
  CreatedDate = "2025-01-19"
}
