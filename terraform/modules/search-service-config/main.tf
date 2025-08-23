# Search Service Configuration Module
# Manages secrets and configuration for search-svc

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Search Service Secret
resource "kubernetes_secret" "search_service" {
  metadata {
    name      = "search-service-secret"
    namespace = var.namespace
    labels = {
      app       = "search-svc"
      component = "config"
    }
  }

  # Use .env file approach - secrets loaded from environment
  data = {
    openai-api-key       = var.openai_api_key
    service-auth-token   = var.service_auth_token
  }

  type = "Opaque"
}

# Database Secret (for reindex job tracking)
resource "kubernetes_secret" "search_database" {
  metadata {
    name      = "search-service-db-secret"
    namespace = var.namespace
    labels = {
      app       = "search-svc"
      component = "database"
    }
  }

  data = {
    password = var.db_password
  }

  type = "Opaque"
}

# Qdrant Backup Secret
resource "kubernetes_secret" "qdrant_backup" {
  count = var.enable_backups ? 1 : 0
  
  metadata {
    name      = "qdrant-backup-secret"
    namespace = var.namespace
    labels = {
      app       = "qdrant-backup"
      component = "backup"
    }
  }

  data = {
    s3-bucket           = var.backup_s3_bucket
    aws-access-key-id   = var.aws_access_key_id
    aws-secret-access-key = var.aws_secret_access_key
  }

  type = "Opaque"
}

# ConfigMap for environment-specific configuration
resource "kubernetes_config_map" "search_service" {
  metadata {
    name      = "search-service-config"
    namespace = var.namespace
    labels = {
      app       = "search-svc"
      component = "config"
    }
  }

  data = {
    # Repository Configuration
    SEARCH_REPOSITORY_TYPE = var.repository_type
    
    # Qdrant Configuration
    QDRANT_HOST       = var.qdrant_host
    QDRANT_PORT       = var.qdrant_port
    QDRANT_USE_TLS    = var.qdrant_use_tls
    QDRANT_CLOUD      = var.qdrant_cloud
    QDRANT_COLLECTION = var.qdrant_collection
    QDRANT_TIMEOUT    = var.qdrant_timeout
    
    # Database Configuration (for reindex tracking)
    DB_HOST    = var.db_host
    DB_PORT    = var.db_port
    DB_NAME    = var.db_name
    DB_USER    = var.db_user
    DB_SSLMODE = var.db_sslmode
    
    # Embedding Configuration
    EMBEDDING_PROVIDER = var.embedding_provider
    EMBEDDING_MODEL    = var.embedding_model
    
    # Service Discovery
    DISCOVERY_SVC_URL = var.discovery_svc_url
    USER_SVC_URL      = var.user_svc_url
    
    # Service Configuration
    PORT     = var.service_port
    GIN_MODE = var.gin_mode
    LOG_LEVEL = var.log_level
    
    # Indexing Pipeline
    INDEXING_CRON_INTERVAL_MINUTES   = var.indexing_cron_interval_minutes
    INDEXING_WORKER_POOL_SIZE        = var.indexing_worker_pool_size
    INDEXING_RATE_LIMIT_PER_SECOND   = var.indexing_rate_limit_per_second
    INDEXING_BATCH_SIZE              = var.indexing_batch_size
    INDEXING_EMBEDDING_TTL_HOURS     = var.indexing_embedding_ttl_hours
    
    # Privacy & Security
    DB_ENCRYPTION_ENABLED        = var.db_encryption_enabled
    SEARCH_RATE_LIMIT_QPM        = var.search_rate_limit_qpm
    ENFORCE_PRIVACY_CHECKS       = var.enforce_privacy_checks
    ENFORCE_AVAILABILITY_CHECKS  = var.enforce_availability_checks
    
    # Caching
    CACHE_TTL = var.cache_ttl
  }
}

# .env file template for local development
resource "local_file" "env_template" {
  count = var.create_env_template ? 1 : 0
  
  filename = "${path.module}/../../../backend/search-svc/.env.${var.environment}"
  content = templatefile("${path.module}/templates/env.tpl", {
    # Repository Configuration
    repository_type = var.repository_type
    
    # Qdrant Configuration  
    qdrant_host       = var.qdrant_host
    qdrant_port       = var.qdrant_port
    qdrant_use_tls    = var.qdrant_use_tls
    qdrant_cloud      = var.qdrant_cloud
    qdrant_collection = var.qdrant_collection
    qdrant_timeout    = var.qdrant_timeout
    
    # Database Configuration
    db_host    = var.db_host
    db_port    = var.db_port
    db_name    = var.db_name
    db_user    = var.db_user
    db_sslmode = var.db_sslmode
    
    # Embedding Configuration
    embedding_provider = var.embedding_provider
    embedding_model    = var.embedding_model
    
    # Service Configuration
    service_port = var.service_port
    gin_mode     = var.gin_mode
    log_level    = var.log_level
    environment  = var.environment
    
    # Service Discovery
    discovery_svc_url = var.discovery_svc_url
    user_svc_url      = var.user_svc_url
    
    # Indexing Pipeline
    indexing_cron_interval_minutes  = var.indexing_cron_interval_minutes
    indexing_worker_pool_size       = var.indexing_worker_pool_size
    indexing_rate_limit_per_second  = var.indexing_rate_limit_per_second
    indexing_batch_size             = var.indexing_batch_size
    indexing_embedding_ttl_hours    = var.indexing_embedding_ttl_hours
    
    # Privacy & Security
    db_encryption_enabled       = var.db_encryption_enabled
    search_rate_limit_qpm       = var.search_rate_limit_qpm
    enforce_privacy_checks      = var.enforce_privacy_checks
    enforce_availability_checks = var.enforce_availability_checks
    
    # Caching
    cache_ttl = var.cache_ttl
  })
}