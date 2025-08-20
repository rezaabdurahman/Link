# Variables for Link Database Isolation Implementation

# PostgreSQL Connection Settings
variable "postgres_host" {
  description = "PostgreSQL server hostname"
  type        = string
  default     = "localhost"
}

variable "postgres_port" {
  description = "PostgreSQL server port"
  type        = number
  default     = 5432
}

variable "postgres_database" {
  description = "PostgreSQL admin database name"
  type        = string
  default     = "link_app"
}

variable "postgres_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "link_user"
}

variable "postgres_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "postgres_sslmode" {
  description = "PostgreSQL SSL mode"
  type        = string
  default     = "require"
  
  validation {
    condition = contains(["disable", "require", "verify-ca", "verify-full"], var.postgres_sslmode)
    error_message = "SSL mode must be one of: disable, require, verify-ca, verify-full."
  }
}

# Environment Configuration
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# Database Configuration
variable "database_connection_limit" {
  description = "Maximum number of connections allowed to each service database"
  type        = number
  default     = 100
}

variable "user_connection_limit" {
  description = "Maximum number of connections allowed per service user"
  type        = number
  default     = 50
}

variable "create_monitoring_user" {
  description = "Whether to create a monitoring user with read access to all service databases"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 30
}

variable "enable_ssl" {
  description = "Whether to enable SSL connections for all service databases"
  type        = bool
  default     = true
}

# Kubernetes Configuration
variable "kubernetes_namespace" {
  description = "Kubernetes namespace for database secrets"
  type        = string
  default     = "default"
}

variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kubernetes_context" {
  description = "Kubernetes context to use"
  type        = string
  default     = null
}

# PgBouncer Configuration
variable "enable_pgbouncer" {
  description = "Whether to generate PgBouncer configuration for connection pooling"
  type        = bool
  default     = true
}

variable "pgbouncer_pool_mode" {
  description = "PgBouncer pool mode (session, transaction, statement)"
  type        = string
  default     = "session"

  validation {
    condition = contains(["session", "transaction", "statement"], var.pgbouncer_pool_mode)
    error_message = "PgBouncer pool mode must be one of: session, transaction, statement."
  }
}

variable "pgbouncer_max_client_conn" {
  description = "Maximum number of client connections for PgBouncer"
  type        = number
  default     = 100
}

variable "pgbouncer_default_pool_size" {
  description = "Default pool size for PgBouncer"
  type        = number
  default     = 10
}

# Backup and High Availability
variable "enable_backup_automation" {
  description = "Whether to enable automated backup scripts"
  type        = bool
  default     = true
}

variable "backup_storage_path" {
  description = "Path where database backups will be stored"
  type        = string
  default     = "/var/backups/postgresql"
}

variable "enable_replica_setup" {
  description = "Whether to prepare configuration for PostgreSQL replicas"
  type        = bool
  default     = false
}

# Resource Tagging
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Link"
    Component   = "Database"
    ManagedBy   = "Terraform"
    Purpose     = "Multi-Instance Database Isolation"
  }
}
