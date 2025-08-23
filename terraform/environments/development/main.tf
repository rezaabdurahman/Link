# Development Environment - Search Service with Qdrant

terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Local variables for development
locals {
  environment = "development"
  namespace   = "link-dev"
}

# Qdrant Cluster for Development
module "qdrant_cluster" {
  source = "../../modules/qdrant-cluster"
  
  # Use development-specific tfvars file
  cluster_size        = 1
  replication_factor  = 1
  environment        = local.environment
  namespace          = local.namespace
  
  # Development resource limits
  node_memory_request = "256Mi"
  node_memory_limit   = "1Gi"
  node_cpu_request    = "100m"
  node_cpu_limit      = "500m"
  storage_size        = "10Gi"
  
  # Development networking
  load_balancer_type = "ClusterIP"
  enable_hpa         = false
  
  # Development storage
  create_storage_class = true
  storage_class_name   = "local-ssd"
  storage_provisioner  = "rancher.io/local-path"
  storage_parameters = {
    type = "local"
  }
}

# Search Service Configuration
module "search_service_config" {
  source = "../../modules/search-service-config"
  
  environment = local.environment
  namespace   = local.namespace
  
  # Create .env file for local development
  create_env_template = true
  
  # Repository configuration (use Qdrant)
  repository_type = "qdrant"
  qdrant_host     = module.qdrant_cluster.cluster_endpoint
  
  # Development database settings (relaxed)
  db_host    = "localhost"
  db_sslmode = "disable"
  gin_mode   = "debug"
  log_level  = "debug"
  
  # Development service URLs
  discovery_svc_url = "http://localhost:8081"
  user_svc_url      = "http://localhost:8082"
  
  # Development-specific settings
  search_rate_limit_qpm = "1000"  # Higher for testing
  cache_ttl            = "60"      # Shorter for development
  
  # Secrets (loaded from environment variables)
  openai_api_key     = var.openai_api_key
  service_auth_token = var.service_auth_token
  db_password        = var.db_password
  
  # No backups in development
  enable_backups = false
}

# Development-specific variables
variable "openai_api_key" {
  description = "OpenAI API key for development"
  type        = string
  sensitive   = true
  default     = ""
}

variable "service_auth_token" {
  description = "Service auth token for development"
  type        = string
  sensitive   = true
  default     = "dev-token-change-in-production"
}

variable "db_password" {
  description = "Database password for development"
  type        = string
  sensitive   = true
  default     = "dev-password"
}

# Outputs
output "qdrant_endpoint" {
  description = "Qdrant cluster endpoint for development"
  value       = module.qdrant_cluster.grpc_endpoint
}

output "env_file_created" {
  description = "Path to generated .env file for development"
  value       = module.search_service_config.environment_file_path
}

output "development_setup_complete" {
  description = "Development environment setup status"
  value = {
    qdrant_cluster_ready     = "Single-node Qdrant cluster deployed for development"
    config_created          = "Search service configuration created"
    env_file_location      = module.search_service_config.environment_file_path
    next_steps = [
      "1. Set environment variables: export OPENAI_API_KEY=your-key",
      "2. Set service token: export SERVICE_AUTH_TOKEN=your-token", 
      "3. Start services: docker-compose up -d",
      "4. Test Qdrant: curl http://localhost:6333/health"
    ]
  }
}