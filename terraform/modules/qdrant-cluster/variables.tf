# Qdrant Cluster Module Variables

variable "namespace" {
  description = "Kubernetes namespace for Qdrant cluster"
  type        = string
  default     = "link-services"
}

variable "qdrant_version" {
  description = "Qdrant Docker image version"
  type        = string
  default     = "v1.11.0"
}

variable "cluster_size" {
  description = "Number of Qdrant nodes in the cluster"
  type        = number
  default     = 3
  validation {
    condition     = var.cluster_size >= 3 && var.cluster_size <= 7
    error_message = "Cluster size must be between 3 and 7 nodes for optimal performance."
  }
}

variable "replication_factor" {
  description = "Default replication factor for collections"
  type        = number
  default     = 2
  validation {
    condition     = var.replication_factor >= 1 && var.replication_factor <= var.cluster_size
    error_message = "Replication factor must be between 1 and cluster_size."
  }
}

variable "log_level" {
  description = "Log level for Qdrant instances"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be one of: DEBUG, INFO, WARN, ERROR."
  }
}

# Resource Configuration
variable "node_memory_request" {
  description = "Memory request per Qdrant node"
  type        = string
  default     = "512Mi"
}

variable "node_memory_limit" {
  description = "Memory limit per Qdrant node"
  type        = string
  default     = "2Gi"
}

variable "node_cpu_request" {
  description = "CPU request per Qdrant node"
  type        = string
  default     = "200m"
}

variable "node_cpu_limit" {
  description = "CPU limit per Qdrant node"
  type        = string
  default     = "1000m"
}

# Storage Configuration
variable "storage_size" {
  description = "Storage size per Qdrant node"
  type        = string
  default     = "50Gi"
}

variable "storage_class_name" {
  description = "Storage class name for Qdrant persistent volumes"
  type        = string
  default     = "gp3-ssd"
}

variable "create_storage_class" {
  description = "Whether to create a custom storage class"
  type        = bool
  default     = false
}

variable "storage_provisioner" {
  description = "Storage provisioner for custom storage class"
  type        = string
  default     = "ebs.csi.aws.com"
}

variable "storage_parameters" {
  description = "Parameters for storage class"
  type        = map(string)
  default = {
    type      = "gp3"
    iops      = "3000"
    throughput = "125"
    encrypted = "true"
  }
}

# Load Balancer Configuration
variable "load_balancer_type" {
  description = "Type of load balancer service"
  type        = string
  default     = "LoadBalancer"
  validation {
    condition     = contains(["ClusterIP", "LoadBalancer", "NodePort"], var.load_balancer_type)
    error_message = "Load balancer type must be ClusterIP, LoadBalancer, or NodePort."
  }
}

variable "load_balancer_annotations" {
  description = "Annotations for load balancer service"
  type        = map(string)
  default = {
    "service.beta.kubernetes.io/aws-load-balancer-type"     = "nlb"
    "service.beta.kubernetes.io/aws-load-balancer-internal" = "true"
  }
}

# High Availability Configuration
variable "min_available_pods" {
  description = "Minimum available pods during disruptions"
  type        = number
  default     = 2
}

# Horizontal Pod Autoscaler Configuration
variable "enable_hpa" {
  description = "Enable Horizontal Pod Autoscaler"
  type        = bool
  default     = false
}

variable "max_replicas" {
  description = "Maximum replicas for HPA"
  type        = number
  default     = 5
}

variable "cpu_target_utilization" {
  description = "Target CPU utilization for HPA"
  type        = number
  default     = 70
}

variable "memory_target_utilization" {
  description = "Target memory utilization for HPA"
  type        = number
  default     = 80
}

# Environment Configuration
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "cluster_name" {
  description = "Name of the Kubernetes cluster"
  type        = string
  default     = "link-production"
}

# Monitoring and Observability
variable "enable_linkerd_injection" {
  description = "Enable Linkerd service mesh injection"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable monitoring and observability features"
  type        = bool
  default     = true
}

# Security Configuration
variable "pod_security_context" {
  description = "Pod security context"
  type = object({
    run_as_user     = number
    run_as_group    = number
    fs_group        = number
    run_as_non_root = bool
  })
  default = {
    run_as_user     = 1000
    run_as_group    = 1000
    fs_group        = 1000
    run_as_non_root = true
  }
}

variable "container_security_context" {
  description = "Container security context"
  type = object({
    allow_privilege_escalation = bool
    read_only_root_filesystem  = bool
    run_as_non_root           = bool
    capabilities = object({
      drop = list(string)
    })
  })
  default = {
    allow_privilege_escalation = false
    read_only_root_filesystem  = false
    run_as_non_root           = true
    capabilities = {
      drop = ["ALL"]
    }
  }
}