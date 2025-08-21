# Main Terraform Configuration for Link Database Isolation
# Implements ADR-002: Distributed Database Strategy
# 
# This file contains the main resource definitions and module calls.
# Provider configurations are in providers.tf
# Version constraints are in versions.tf
# Local values are in locals.tf

# Create service databases using the module
module "service_databases" {
  source = "./modules/service-databases"

  # Configuration
  environment               = local.environment
  database_connection_limit = var.database_connection_limit
  user_connection_limit     = var.user_connection_limit
  create_monitoring_user    = var.create_monitoring_user
  backup_retention_days     = var.backup_retention_days
  enable_ssl                = var.enable_ssl
  tags                      = local.common_tags
}

# Create Kubernetes secrets for each service
resource "kubernetes_secret" "service_db_credentials" {
  for_each = module.service_databases.kubernetes_secrets

  metadata {
    name      = each.value.name
    namespace = var.kubernetes_namespace
    labels    = local.common_tags
  }

  data = each.value.data

  type = "Opaque"
}

# Generate local environment files for development
resource "local_file" "service_env_files" {
  for_each = module.service_databases.env_files

  filename        = "${path.root}/../.env/${each.value.filename}"
  content         = each.value.content
  file_permission = "0600"
}

# Create backup configuration
resource "local_file" "backup_script" {
  filename = "${path.root}/scripts/backup-databases.sh"
  content = templatefile("${path.module}/templates/backup-script.tpl", {
    databases          = [for db in module.service_databases.service_databases : db.database_name]
    postgres_host      = var.postgres_host
    postgres_port      = var.postgres_port
    retention_days     = var.backup_retention_days
    backup_schedule    = "0 2 * * *" # Daily at 2 AM
    monitoring_enabled = var.create_monitoring_user
  })
  file_permission = "0755"
}

# Create restore script
resource "local_file" "restore_script" {
  filename = "${path.root}/scripts/restore-database.sh"
  content = templatefile("${path.module}/templates/restore-script.tpl", {
    service_databases = module.service_databases.service_databases
    postgres_host     = var.postgres_host
    postgres_port     = var.postgres_port
  })
  file_permission = "0755"
}

# Create docker-compose environment override
resource "local_file" "docker_compose_override" {
  filename = "${path.root}/../docker-compose.db-isolation.yml"
  content = templatefile("${path.module}/templates/docker-compose-override.tpl", {
    services = module.service_databases.docker_compose_env
  })
  file_permission = "0644"
}

# Create migration scripts for each service
resource "local_file" "migration_scripts" {
  for_each = module.service_databases.service_databases

  filename = "${path.root}/scripts/migrate-${each.key}-database.sh"
  content = templatefile("${path.module}/templates/migration-script.tpl", {
    service_name  = each.key
    database_name = each.value.database_name
    username      = each.value.username
    postgres_host = var.postgres_host
    postgres_port = var.postgres_port
    old_database  = var.postgres_database
  })
  file_permission = "0755"
}

# Create PgBouncer configuration for connection pooling
resource "local_file" "pgbouncer_config" {
  count = var.enable_pgbouncer ? 1 : 0

  filename = "${path.root}/pgbouncer/pgbouncer.ini"
  content = templatefile("${path.module}/templates/pgbouncer.ini.tpl", {
    databases         = module.service_databases.service_databases
    postgres_host     = var.postgres_host
    postgres_port     = var.postgres_port
    pool_mode         = var.pgbouncer_pool_mode
    max_client_conn   = var.pgbouncer_max_client_conn
    default_pool_size = var.pgbouncer_default_pool_size
  })
  file_permission = "0644"
}

# Create comprehensive documentation
resource "local_file" "implementation_guide" {
  filename = "${path.root}/IMPLEMENTATION_GUIDE.md"
  content = templatefile("${path.module}/templates/implementation-guide.tpl", {
    services               = module.service_databases.service_databases
    connection_summary     = module.service_databases.connection_usage_summary
    backup_recommendations = module.service_databases.backup_recommendations
    environment            = local.environment
  })
  file_permission = "0644"
}

