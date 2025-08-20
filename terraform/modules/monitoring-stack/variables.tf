# Variables for Monitoring Stack Terraform Module

# Basic Configuration
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "monitoring_domain" {
  description = "Domain name for monitoring services"
  type        = string
  default     = "monitoring.linkapp.local"
}

variable "monitoring_username" {
  description = "Username for HTTP Basic Authentication"
  type        = string
  default     = "admin"
}

# Output Paths
variable "output_path" {
  description = "Base output path for generated files"
  type        = string
  default     = "./monitoring"
}

variable "ssl_output_path" {
  description = "Directory path for SSL certificate files"
  type        = string
  default     = "./monitoring/ssl"
}

variable "secrets_output_path" {
  description = "Directory path for secrets files"
  type        = string
  default     = "./monitoring/secrets"
}

variable "nginx_output_path" {
  description = "Directory path for Nginx configuration files"
  type        = string
  default     = "./monitoring/nginx"
}

# Certificate Configuration
variable "cert_country" {
  description = "Country code for certificate subject"
  type        = string
  default     = "US"
}

variable "cert_state" {
  description = "State/province for certificate subject"
  type        = string
  default     = "CA"
}

variable "cert_locality" {
  description = "Locality/city for certificate subject"
  type        = string
  default     = "San Francisco"
}

variable "cert_organization" {
  description = "Organization name for certificate subject"
  type        = string
  default     = "Link App"
}

variable "ca_validity_hours" {
  description = "Validity period for CA certificate in hours"
  type        = number
  default     = 87600 # 10 years
}

variable "cert_validity_hours" {
  description = "Validity period for monitoring certificate in hours"
  type        = number
  default     = 8760 # 1 year
}

# Kubernetes Integration
variable "create_kubernetes_secrets" {
  description = "Whether to create Kubernetes secrets for monitoring stack"
  type        = bool
  default     = false
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace for monitoring secrets"
  type        = string
  default     = "default"
}

# Service Configuration
variable "grafana_config" {
  description = "Grafana-specific configuration"
  type = object({
    enable_ssl      = optional(bool, true)
    admin_user      = optional(string, "admin")
    allow_sign_up   = optional(bool, false)
    anonymous_auth  = optional(bool, false)
  })
  default = {}
}

variable "prometheus_config" {
  description = "Prometheus-specific configuration"
  type = object({
    retention_time     = optional(string, "15d")
    storage_retention  = optional(string, "15GB")
    scrape_interval    = optional(string, "15s")
    evaluation_interval = optional(string, "15s")
  })
  default = {}
}

variable "redis_config" {
  description = "Redis-specific configuration"
  type = object({
    enable_auth     = optional(bool, true)
    max_memory      = optional(string, "128mb")
    max_memory_policy = optional(string, "allkeys-lru")
  })
  default = {}
}

# Security Configuration
variable "enable_basic_auth" {
  description = "Whether to enable HTTP Basic Authentication"
  type        = bool
  default     = true
}

variable "enable_ssl" {
  description = "Whether to enable SSL/TLS for monitoring services"
  type        = bool
  default     = true
}

variable "allowed_ips" {
  description = "List of IP addresses/CIDR blocks allowed to access monitoring"
  type        = list(string)
  default     = ["127.0.0.1", "::1"]
}

# Resource Tagging
variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default = {
    Project     = "Link"
    Component   = "Monitoring"
    ManagedBy   = "Terraform"
  }
}

# Advanced Configuration
variable "enable_jaeger" {
  description = "Whether to include Jaeger tracing in the monitoring stack"
  type        = bool
  default     = true
}

variable "enable_alertmanager" {
  description = "Whether to include AlertManager in the monitoring stack"
  type        = bool
  default     = true
}

variable "custom_nginx_config" {
  description = "Custom Nginx configuration to append"
  type        = string
  default     = ""
}

# Backup and Persistence
variable "enable_persistence" {
  description = "Whether to enable persistent storage for monitoring data"
  type        = bool
  default     = true
}

variable "storage_class" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "standard"
}

variable "grafana_storage_size" {
  description = "Storage size for Grafana persistent volume"
  type        = string
  default     = "1Gi"
}

variable "prometheus_storage_size" {
  description = "Storage size for Prometheus persistent volume"
  type        = string
  default     = "10Gi"
}
