# Output Definitions
# Structured outputs for service consumption

# Service database connection details
output "service_database_connections" {
  description = "Database connection details for each service"
  value = {
    for service_name, service_info in module.service_databases.service_databases : service_name => {
      database_name = service_info.database_name
      username      = service_info.username
      # Direct connection to PostgreSQL
      direct_connection_string = "postgresql://${service_info.username}:${nonsensitive(service_info.password)}@${var.postgres_host}:${var.postgres_port}/${service_info.database_name}?sslmode=${var.postgres_sslmode}"
    }
  }
  sensitive = true
}

# PgBouncer Connection Strings
output "pgbouncer_connection_strings" {
  description = "PgBouncer connection strings for each service"
  value = {
    for service_name, service_info in module.service_databases.service_databases : service_name => {
      # Connection through PgBouncer service
      docker_compose = "postgresql://${service_info.username}:${nonsensitive(service_info.password)}@pgbouncer:5432/${service_name}_service?sslmode=disable"
      kubernetes     = "postgresql://${service_info.username}:${nonsensitive(service_info.password)}@pgbouncer-service.link-internal.svc.cluster.local:5432/${service_name}_service?sslmode=disable"
      
      # Legacy connection for migration period
      legacy_docker_compose = "postgresql://${var.postgres_username}:${var.postgres_password}@pgbouncer:5432/linkdb?sslmode=disable"
      legacy_kubernetes     = "postgresql://${var.postgres_username}:${var.postgres_password}@pgbouncer-service.link-internal.svc.cluster.local:5432/linkdb?sslmode=disable"
    }
  }
  sensitive = true
}

# Kubernetes resources created
output "kubernetes_secrets_created" {
  description = "List of Kubernetes secrets created for service database credentials"
  value = [for secret in kubernetes_secret.service_db_credentials : secret.metadata[0].name]
}

# Generated files and scripts
output "environment_files_created" {
  description = "List of environment files created for local development"
  value = [for env_file in local_file.service_env_files : env_file.filename]
}

output "scripts_created" {
  description = "List of management scripts created"
  value = {
    backup_script     = local_file.backup_script.filename
    restore_script    = local_file.restore_script.filename
    migration_scripts = [for script in local_file.migration_scripts : script.filename]
  }
}

# Infrastructure summary
output "infrastructure_summary" {
  description = "Summary of infrastructure components created"
  value = {
    environment           = local.environment
    total_services       = length(module.service_databases.service_databases)
    services             = keys(module.service_databases.service_databases)
    monitoring_enabled   = var.create_monitoring_user
    pgbouncer_enabled   = var.enable_pgbouncer
    ssl_enabled         = var.enable_ssl
    backup_retention    = var.backup_retention_days
  }
}
