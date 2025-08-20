# Production Environment Configuration
# Maximum security and reliability settings

environment = "production"

# PostgreSQL Configuration
postgres_host     = "postgres.default.svc.cluster.local"
postgres_port     = 5432
postgres_database = "link_app_prod"
postgres_username = "link_prod_user"
postgres_sslmode  = "verify-full"  # Maximum security for production

# Resource Limits (Production capacity)
database_connection_limit = 100
user_connection_limit     = 50

# Feature Flags
create_monitoring_user = true
enable_ssl            = true   # Required for production
enable_pgbouncer      = true
enable_backup_automation = true

# Kubernetes Configuration
kubernetes_namespace = "link-production"
kubernetes_context   = "production-cluster"

# PgBouncer Configuration (Optimized for production load)
pgbouncer_pool_mode        = "transaction"  # Most efficient for high load
pgbouncer_max_client_conn  = 200
pgbouncer_default_pool_size = 15

# Backup Configuration
backup_retention_days = 90  # Extended retention for production

# Enable additional production features
enable_replica_setup = true

# Tags
tags = {
  Project     = "Link"
  Component   = "Database"
  Environment = "production"
  ManagedBy   = "Terraform"
  Purpose     = "Multi-Instance Database Isolation"
  CostCenter  = "Engineering"
  Owner       = "backend-team"
  DataClass   = "production"
  Compliance  = "required"
  Backup      = "required"
}
