# Search Service Configuration Module Variables

# Basic Configuration
variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "link-services"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "create_env_template" {
  description = "Create .env template file for local development"
  type        = bool
  default     = false
}

# Secret Values (loaded from external sources)
variable "openai_api_key" {
  description = "OpenAI API key for embeddings"
  type        = string
  sensitive   = true
}

variable "service_auth_token" {
  description = "Service authentication token for inter-service communication"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

# Backup Configuration (optional)
variable "enable_backups" {
  description = "Enable automated backups"
  type        = bool
  default     = false
}

variable "backup_s3_bucket" {
  description = "S3 bucket for backups"
  type        = string
  default     = ""
}

variable "aws_access_key_id" {
  description = "AWS Access Key ID for backup"
  type        = string
  default     = ""
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS Secret Access Key for backup"
  type        = string
  default     = ""
  sensitive   = true
}

# Repository Configuration
variable "repository_type" {
  description = "Type of search repository (postgresql or qdrant)"
  type        = string
  default     = "qdrant"
  validation {
    condition     = contains(["postgresql", "qdrant"], var.repository_type)
    error_message = "Repository type must be postgresql or qdrant."
  }
}

# Qdrant Configuration
variable "qdrant_host" {
  description = "Qdrant host"
  type        = string
  default     = "qdrant-cluster"
}

variable "qdrant_port" {
  description = "Qdrant port"
  type        = string
  default     = "6334"
}

variable "qdrant_use_tls" {
  description = "Use TLS for Qdrant connection"
  type        = string
  default     = "false"
}

variable "qdrant_cloud" {
  description = "Use Qdrant cloud"
  type        = string
  default     = "false"
}

variable "qdrant_collection" {
  description = "Qdrant collection name"
  type        = string
  default     = "user_profiles"
}

variable "qdrant_timeout" {
  description = "Qdrant timeout"
  type        = string
  default     = "30s"
}

# Database Configuration (for reindex tracking)
variable "db_host" {
  description = "PostgreSQL host"
  type        = string
  default     = "postgres"
}

variable "db_port" {
  description = "PostgreSQL port"
  type        = string
  default     = "5432"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "search_svc"
}

variable "db_user" {
  description = "PostgreSQL user"
  type        = string
  default     = "search_user"
}

variable "db_sslmode" {
  description = "PostgreSQL SSL mode"
  type        = string
  default     = "disable"
}

# Embedding Configuration
variable "embedding_provider" {
  description = "Embedding provider"
  type        = string
  default     = "openai"
}

variable "embedding_model" {
  description = "Embedding model"
  type        = string
  default     = "text-embedding-3-small"
}

# Service Configuration
variable "service_port" {
  description = "Service port"
  type        = string
  default     = "8085"
}

variable "gin_mode" {
  description = "Gin mode"
  type        = string
  default     = "release"
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "info"
}

# Service Discovery
variable "discovery_svc_url" {
  description = "Discovery service URL"
  type        = string
  default     = "http://discovery-svc:8081"
}

variable "user_svc_url" {
  description = "User service URL"
  type        = string
  default     = "http://user-svc:8082"
}

# Indexing Pipeline
variable "indexing_cron_interval_minutes" {
  description = "Indexing cron interval in minutes"
  type        = string
  default     = "120"
}

variable "indexing_worker_pool_size" {
  description = "Indexing worker pool size"
  type        = string
  default     = "10"
}

variable "indexing_rate_limit_per_second" {
  description = "Indexing rate limit per second"
  type        = string
  default     = "50"
}

variable "indexing_batch_size" {
  description = "Indexing batch size"
  type        = string
  default     = "100"
}

variable "indexing_embedding_ttl_hours" {
  description = "Embedding TTL in hours"
  type        = string
  default     = "2"
}

# Privacy & Security
variable "db_encryption_enabled" {
  description = "Enable database encryption"
  type        = string
  default     = "true"
}

variable "search_rate_limit_qpm" {
  description = "Search rate limit queries per minute"
  type        = string
  default     = "50"
}

variable "enforce_privacy_checks" {
  description = "Enforce privacy checks"
  type        = string
  default     = "true"
}

variable "enforce_availability_checks" {
  description = "Enforce availability checks"
  type        = string
  default     = "true"
}

# Caching
variable "cache_ttl" {
  description = "Cache TTL in seconds"
  type        = string
  default     = "300"
}