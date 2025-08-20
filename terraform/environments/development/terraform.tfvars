# Development Environment Configuration
# Override defaults for development environment

environment = "development"

# PostgreSQL Configuration
postgres_host     = "localhost"
postgres_port     = 5432
postgres_database = "link_app_dev"
postgres_username = "link_dev_user"
postgres_sslmode  = "disable"  # Relaxed for local development

# Resource Limits (Lower for development)
database_connection_limit = 50
user_connection_limit     = 25

# Feature Flags
create_monitoring_user = true
enable_ssl            = false  # Simplified for local development
enable_pgbouncer      = true
enable_backup_automation = false  # No automated backups in dev

# Kubernetes Configuration
kubernetes_namespace = "link-dev"
kubernetes_context   = "docker-desktop"  # Common local k8s context

# PgBouncer Configuration (Conservative for development)
pgbouncer_pool_mode        = "session"
pgbouncer_max_client_conn  = 50
pgbouncer_default_pool_size = 5

# Backup Configuration
backup_retention_days = 7  # Shorter retention for development

# Tags
tags = {
  Project     = "Link"
  Component   = "Database"
  Environment = "development"
  ManagedBy   = "Terraform"
  Purpose     = "Multi-Instance Database Isolation"
  CostCenter  = "Engineering"
  Owner       = "backend-team"
}
