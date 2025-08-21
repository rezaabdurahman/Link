# Production Environment Configuration
# Maximum security and reliability settings

environment = "production"

# PostgreSQL Configuration
postgres_host     = "postgres.default.svc.cluster.local"
postgres_port     = 5432
postgres_database = "link_app_prod"
postgres_username = "link_prod_user"
postgres_sslmode  = "verify-full" # Maximum security for production

# Resource Limits (Production capacity)
database_connection_limit = 100
user_connection_limit     = 50

# Feature Flags
create_monitoring_user   = true
enable_ssl               = true # Required for production
enable_pgbouncer         = true
enable_backup_automation = true

# Kubernetes Configuration
kubernetes_namespace = "link-production"
kubernetes_context   = "production-cluster"

# PgBouncer Configuration (Optimized for production load)
pgbouncer_pool_mode         = "transaction" # Most efficient for high load
pgbouncer_max_client_conn   = 200
pgbouncer_default_pool_size = 15

# Backup Configuration
backup_retention_days = 90 # Extended retention for production

# Enable additional production features
enable_replica_setup = true

# Enhanced tagging strategy
tags = {
  # Core identification
  Project     = "Link"
  Component   = "Database"
  Environment = "production"

  # Management
  ManagedBy = "Terraform"
  Owner     = "backend-team"
  Purpose   = "Multi-Instance Database Isolation"

  # Cost management
  CostCenter  = "Engineering"
  BillingCode = "ENG-DB-PROD"

  # Compliance and security
  DataClass  = "production"
  Compliance = "required"
  Backup     = "required"

  # Operational
  Schedule = "24x7"
  Support  = "critical"

  # Technical
  TerraformModule = "service-databases"
  Version         = "1.0"

  # Lifecycle
  CreatedBy   = "terraform"
  CreatedDate = "2025-01-19"

  # Production-specific
  DisasterRecovery = "required"
  Monitoring       = "enhanced"
}
