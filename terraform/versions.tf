# Terraform Version and Provider Configuration
# Implements exact versioning per ADR best practices

terraform {
  required_version = ">= 1.5.7"
  
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "= 1.21.0"  # Exact version for production stability
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.23.0"  # Exact version for production stability
    }
    helm = {
      source  = "hashicorp/helm"
      version = "= 2.11.0"  # Exact version for production stability
    }
    local = {
      source  = "hashicorp/local"
      version = "= 2.4.0"   # Exact version for production stability
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.4.0"   # Exact version for production stability
    }
  }
}
