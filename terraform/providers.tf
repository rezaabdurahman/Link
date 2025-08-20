# Provider Configurations
# Centralized provider setup with secure defaults

# Configure PostgreSQL provider
provider "postgresql" {
  host            = var.postgres_host
  port            = var.postgres_port
  database        = var.postgres_database
  username        = var.postgres_username
  password        = var.postgres_password
  sslmode         = var.postgres_sslmode
  connect_timeout = 15
  superuser       = false  # Follow principle of least privilege
}

# Configure Kubernetes provider for secret management
provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kubernetes_context
}

# Configure Helm provider for chart deployments
provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig_path
    config_context = var.kubernetes_context
  }
}
