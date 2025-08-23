# Search Service Configuration Module Outputs

output "search_service_secret_name" {
  description = "Name of the search service secret"
  value       = kubernetes_secret.search_service.metadata[0].name
}

output "search_database_secret_name" {
  description = "Name of the search database secret"
  value       = kubernetes_secret.search_database.metadata[0].name
}

output "search_service_config_name" {
  description = "Name of the search service config map"
  value       = kubernetes_config_map.search_service.metadata[0].name
}

output "qdrant_backup_secret_name" {
  description = "Name of the Qdrant backup secret (if enabled)"
  value       = var.enable_backups ? kubernetes_secret.qdrant_backup[0].metadata[0].name : null
}

output "environment_file_path" {
  description = "Path to generated environment file"
  value       = var.create_env_template ? local_file.env_template[0].filename : null
}

# Configuration for search service deployment
output "search_service_env_config" {
  description = "Environment configuration for search service deployment"
  value = {
    config_map_name = kubernetes_config_map.search_service.metadata[0].name
    secret_name     = kubernetes_secret.search_service.metadata[0].name
    db_secret_name  = kubernetes_secret.search_database.metadata[0].name
    namespace       = var.namespace
  }
}