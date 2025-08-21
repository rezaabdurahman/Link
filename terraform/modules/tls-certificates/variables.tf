# Variables for TLS Certificate Generation Module

variable "service_names" {
  description = "Set of service names to generate certificates for"
  type        = set(string)
  default     = ["gateway", "service"]
}

variable "service_dns_names" {
  description = "Additional DNS names for each service certificate"
  type        = map(list(string))
  default     = {}

  # Example:
  # {
  #   "gateway" = ["api.linkapp.local", "linkapp.com"]
  #   "service" = ["backend.linkapp.local"]
  # }
}

variable "output_path" {
  description = "Directory path where certificate files will be written"
  type        = string
  default     = "./certs"
}

# Certificate Authority Details
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

variable "cert_organizational_unit" {
  description = "Organizational unit for certificate subject"
  type        = string
  default     = "Security Team"
}

# Certificate Validity Periods
variable "root_ca_validity_hours" {
  description = "Validity period for root CA certificate in hours"
  type        = number
  default     = 87600 # 10 years
}

variable "intermediate_ca_validity_hours" {
  description = "Validity period for intermediate CA certificate in hours"
  type        = number
  default     = 43800 # 5 years
}

variable "service_cert_validity_hours" {
  description = "Validity period for service certificates in hours"
  type        = number
  default     = 8760 # 1 year
}

# Kubernetes Integration
variable "create_k8s_secrets" {
  description = "Whether to create Kubernetes TLS secrets"
  type        = bool
  default     = false
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace for TLS secrets"
  type        = string
  default     = "default"
}

# Environment Tagging
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
