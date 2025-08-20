# Outputs for Monitoring Stack Terraform Module

# SSL Certificate Outputs
output "ssl_certificate_files" {
  description = "Paths to SSL certificate files"
  value = {
    ca_cert     = local_file.monitoring_ca_cert.filename
    cert        = local_file.monitoring_ssl_cert.filename
    private_key = local_file.monitoring_ssl_key.filename
  }
}

output "ssl_certificate_content" {
  description = "SSL certificate content (sensitive)"
  value = {
    ca_cert_pem     = tls_self_signed_cert.monitoring_ca.cert_pem
    cert_pem        = tls_locally_signed_cert.monitoring_cert.cert_pem
    private_key_pem = tls_private_key.monitoring_cert.private_key_pem
  }
  sensitive = true
}

# Authentication Outputs
output "authentication" {
  description = "Authentication credentials and configuration"
  value = {
    grafana_admin_password_file = local_sensitive_file.grafana_admin_password.filename
    redis_password_file        = local_sensitive_file.redis_password.filename
    postgres_dsn_file          = local_sensitive_file.postgres_monitoring_dsn.filename
    htpasswd_file              = local_file.nginx_htpasswd.filename
    monitoring_username        = var.monitoring_username
  }
}

output "credentials" {
  description = "Generated credentials (sensitive)"
  value = {
    grafana_admin_password = random_password.grafana_admin.result
    redis_password         = random_password.redis_auth.result
    nginx_basic_auth       = random_password.nginx_auth.result
    postgres_monitoring_password = random_password.postgres_monitoring.result
  }
  sensitive = true
}

# Configuration File Outputs
output "configuration_files" {
  description = "Paths to generated configuration files"
  value = {
    nginx_config              = local_file.nginx_ssl_config.filename
    docker_compose_secure     = local_file.docker_compose_monitoring_secure.filename
  }
}

# Kubernetes Resources
output "kubernetes_secrets" {
  description = "Kubernetes secrets created for monitoring stack"
  value = var.create_kubernetes_secrets ? {
    tls_secret       = kubernetes_secret.monitoring_tls[0].metadata[0].name
    passwords_secret = kubernetes_secret.monitoring_passwords[0].metadata[0].name
    nginx_config_map = kubernetes_config_map.nginx_config[0].metadata[0].name
  } : {}
}

# Access Information
output "access_urls" {
  description = "URLs for accessing monitoring services"
  value = {
    base_url        = "https://${var.monitoring_domain}"
    grafana         = "https://${var.monitoring_domain}/grafana/"
    prometheus      = "https://${var.monitoring_domain}/prometheus/"
    jaeger          = var.enable_jaeger ? "https://${var.monitoring_domain}/jaeger/" : null
    alertmanager    = var.enable_alertmanager ? "https://${var.monitoring_domain}/alertmanager/" : null
  }
}

# Certificate Validity Information
output "certificate_validity" {
  description = "Certificate validity periods"
  value = {
    ca_certificate = {
      valid_from = tls_self_signed_cert.monitoring_ca.validity_start_time
      valid_to   = tls_self_signed_cert.monitoring_ca.validity_end_time
    }
    monitoring_certificate = {
      valid_from = tls_locally_signed_cert.monitoring_cert.validity_start_time
      valid_to   = tls_locally_signed_cert.monitoring_cert.validity_end_time
    }
  }
}

# Usage Instructions
output "usage_instructions" {
  description = "Instructions for using the monitoring stack"
  value = {
    docker_compose_command = "docker-compose -f ${local_file.docker_compose_monitoring_secure.filename} up -d"
    
    curl_test_command = join(" ", [
      "curl",
      "--cacert ${local_file.monitoring_ca_cert.filename}",
      "--user ${var.monitoring_username}:${random_password.nginx_auth.result}",
      "https://${var.monitoring_domain}/grafana/api/health"
    ])
    
    hosts_file_entry = "127.0.0.1 ${var.monitoring_domain}"
    
    grafana_login = {
      url      = "https://${var.monitoring_domain}/grafana/"
      username = "admin"
      password = "Check ${local_sensitive_file.grafana_admin_password.filename}"
    }
  }
}

# Environment-specific Configuration
output "environment_config" {
  description = "Environment-specific configuration summary"
  value = {
    environment     = var.environment
    ssl_enabled     = var.enable_ssl
    basic_auth      = var.enable_basic_auth
    jaeger_enabled  = var.enable_jaeger
    alertmanager    = var.enable_alertmanager
    kubernetes_mode = var.create_kubernetes_secrets
  }
}

# File Structure Summary
output "generated_files" {
  description = "Summary of all generated files"
  value = {
    ssl_files = {
      ca_cert     = local_file.monitoring_ca_cert.filename
      server_cert = local_file.monitoring_ssl_cert.filename
      server_key  = local_file.monitoring_ssl_key.filename
    }
    
    secret_files = {
      grafana_admin = local_sensitive_file.grafana_admin_password.filename
      redis_auth    = local_sensitive_file.redis_password.filename
      postgres_dsn  = local_sensitive_file.postgres_monitoring_dsn.filename
    }
    
    config_files = {
      nginx_conf         = local_file.nginx_ssl_config.filename
      htpasswd          = local_file.nginx_htpasswd.filename
      docker_compose    = local_file.docker_compose_monitoring_secure.filename
    }
  }
}

# Migration Information
output "migration_from_script" {
  description = "Information about migration from setup-secure-monitoring.sh"
  value = {
    replaced_script = "monitoring/setup-secure-monitoring.sh"
    equivalent_features = [
      "SSL certificate generation",
      "Secure password generation", 
      "HTTP Basic Auth setup",
      "Docker Compose configuration",
      "Kubernetes secrets (optional)"
    ]
    migration_benefits = [
      "Idempotent resource management",
      "Version controlled infrastructure",
      "Automated secret rotation capability",
      "Environment-specific configuration",
      "State-managed certificate renewal"
    ]
  }
}
