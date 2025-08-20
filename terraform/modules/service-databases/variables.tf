# Variables for Service Databases Terraform Module

variable "database_connection_limit" {
  description = "Maximum number of connections allowed to each service database"
  type        = number
  default     = 100
  
  validation {
    condition     = var.database_connection_limit >= 10 && var.database_connection_limit <= 1000
    error_message = "Database connection limit must be between 10 and 1000."
  }
}

variable "user_connection_limit" {
  description = "Maximum number of connections allowed per service user"
  type        = number
  default     = 50
  
  validation {
    condition     = var.user_connection_limit >= 5 && var.user_connection_limit <= 500
    error_message = "User connection limit must be between 5 and 500."
  }
}

variable "create_monitoring_user" {
  description = "Whether to create a monitoring user with read access to all service databases"
  type        = bool
  default     = true
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 1 and 365 days."
  }
}

variable "enable_ssl" {
  description = "Whether to enable SSL connections for all service databases"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Link"
    Component   = "Database"
    ManagedBy   = "Terraform"
    Purpose     = "Service Database Isolation"
  }
}
