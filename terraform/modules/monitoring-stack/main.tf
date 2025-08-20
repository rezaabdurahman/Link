# Monitoring Stack Terraform Module  
# Replaces monitoring/setup-secure-monitoring.sh with infrastructure-as-code

terraform {
  required_version = ">= 1.0"
  required_providers {
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    htpasswd = {
      source  = "loafoe/htpasswd"
      version = "~> 1.0"
    }
  }
}

# Local variables for configuration
locals {
  environment = var.environment
  monitoring_domain = var.monitoring_domain
  common_labels = merge(var.tags, {
    Environment = local.environment
    Component   = "monitoring-stack"
    ManagedBy   = "terraform"
  })
}

# 1. Generate secure passwords for services
resource "random_password" "grafana_admin" {
  length  = 32
  special = true
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "random_password" "postgres_monitoring" {
  length  = 32
  special = false
}

# 2. Generate HTTP Basic Auth credentials
resource "random_password" "nginx_auth" {
  length = 16
  special = false
}

resource "htpasswd_password" "nginx_basic_auth" {
  password = random_password.nginx_auth.result
}

# 3. Generate SSL certificates for monitoring domain
resource "tls_private_key" "monitoring_ca" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "tls_self_signed_cert" "monitoring_ca" {
  private_key_pem = tls_private_key.monitoring_ca.private_key_pem

  subject {
    country             = var.cert_country
    state               = var.cert_state
    locality            = var.cert_locality
    organization        = var.cert_organization
    organizational_unit = "Monitoring"
    common_name         = "Monitoring CA"
  }

  validity_period_hours = var.ca_validity_hours
  is_ca_certificate     = true

  allowed_uses = [
    "cert_signing",
    "crl_signing",
  ]
}

resource "tls_private_key" "monitoring_cert" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "monitoring_cert" {
  private_key_pem = tls_private_key.monitoring_cert.private_key_pem

  subject {
    country             = var.cert_country
    state               = var.cert_state
    locality            = var.cert_locality
    organization        = var.cert_organization
    organizational_unit = "Monitoring"
    common_name         = local.monitoring_domain
  }

  dns_names = [
    local.monitoring_domain,
    "localhost",
    "monitoring",
    "grafana",
    "prometheus",
    "jaeger",
    "alertmanager"
  ]

  ip_addresses = [
    "127.0.0.1",
    "::1"
  ]
}

resource "tls_locally_signed_cert" "monitoring_cert" {
  cert_request_pem   = tls_cert_request.monitoring_cert.cert_request_pem
  ca_private_key_pem = tls_private_key.monitoring_ca.private_key_pem
  ca_cert_pem        = tls_self_signed_cert.monitoring_ca.cert_pem

  validity_period_hours = var.cert_validity_hours

  allowed_uses = [
    "key_encipherment",
    "data_encipherment",
    "digital_signature",
    "server_auth",
    "client_auth",
  ]
}

# 4. Create local SSL certificate files
resource "local_file" "monitoring_ssl_key" {
  content  = tls_private_key.monitoring_cert.private_key_pem
  filename = "${var.ssl_output_path}/monitoring.key"
  file_permission = "0600"

  depends_on = [local_file.ssl_directory]
}

resource "local_file" "monitoring_ssl_cert" {
  content  = tls_locally_signed_cert.monitoring_cert.cert_pem
  filename = "${var.ssl_output_path}/monitoring.crt"
  file_permission = "0644"

  depends_on = [local_file.ssl_directory]
}

resource "local_file" "monitoring_ca_cert" {
  content  = tls_self_signed_cert.monitoring_ca.cert_pem
  filename = "${var.ssl_output_path}/ca.crt"
  file_permission = "0644"

  depends_on = [local_file.ssl_directory]
}

# 5. Create necessary directories
resource "local_file" "ssl_directory" {
  content  = ""
  filename = "${var.ssl_output_path}/.keep"
  file_permission = "0644"

  provisioner "local-exec" {
    command = "mkdir -p ${var.ssl_output_path} ${var.secrets_output_path} ${var.nginx_output_path}"
  }
}

# 6. Create HTTP Basic Auth file
resource "local_file" "nginx_htpasswd" {
  content = "${var.monitoring_username}:${htpasswd_password.nginx_basic_auth.bcrypt}\n"
  filename = "${var.nginx_output_path}/htpasswd"
  file_permission = "0600"

  depends_on = [local_file.ssl_directory]
}

# 7. Create secure secrets files
resource "local_sensitive_file" "grafana_admin_password" {
  content  = random_password.grafana_admin.result
  filename = "${var.secrets_output_path}/grafana_admin_password.txt"
  file_permission = "0600"

  depends_on = [local_file.ssl_directory]
}

resource "local_sensitive_file" "redis_password" {
  content  = random_password.redis_auth.result
  filename = "${var.secrets_output_path}/redis_password.txt"
  file_permission = "0600"

  depends_on = [local_file.ssl_directory]
}

resource "local_sensitive_file" "postgres_monitoring_dsn" {
  content = "postgresql://monitoring_user:${random_password.postgres_monitoring.result}@postgres:5432/link_app?sslmode=disable"
  filename = "${var.secrets_output_path}/postgres_exporter_dsn.txt"
  file_permission = "0600"

  depends_on = [local_file.ssl_directory]
}

# 8. Create Nginx SSL configuration
resource "local_file" "nginx_ssl_config" {
  content = templatefile("${path.module}/templates/nginx-ssl.conf.tpl", {
    monitoring_domain = local.monitoring_domain
    ssl_cert_path     = "/etc/ssl/certs/monitoring.crt"
    ssl_key_path      = "/etc/ssl/private/monitoring.key"
    htpasswd_path     = "/etc/nginx/htpasswd"
  })
  filename = "${var.nginx_output_path}/monitoring.conf"
  file_permission = "0644"

  depends_on = [local_file.ssl_directory]
}

# 9. Create Docker Compose override for secure monitoring
resource "local_file" "docker_compose_monitoring_secure" {
  content = templatefile("${path.module}/templates/docker-compose-monitoring-secure.yml.tpl", {
    ssl_cert_path      = abspath("${var.ssl_output_path}/monitoring.crt")
    ssl_key_path       = abspath("${var.ssl_output_path}/monitoring.key")
    ca_cert_path       = abspath("${var.ssl_output_path}/ca.crt")
    htpasswd_path      = abspath("${var.nginx_output_path}/htpasswd")
    nginx_config_path  = abspath("${var.nginx_output_path}/monitoring.conf")
    grafana_admin_password = random_password.grafana_admin.result
    redis_password     = random_password.redis_auth.result
    environment        = local.environment
    monitoring_domain  = local.monitoring_domain
  })
  filename = "${var.output_path}/docker-compose.monitoring.secure.yml"
  file_permission = "0644"
  sensitive_content = true
}

# 10. Kubernetes Secrets (if enabled)
resource "kubernetes_secret" "monitoring_tls" {
  count = var.create_kubernetes_secrets ? 1 : 0

  metadata {
    name      = "monitoring-tls"
    namespace = var.kubernetes_namespace
    labels    = local.common_labels
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = base64encode(tls_locally_signed_cert.monitoring_cert.cert_pem)
    "tls.key" = base64encode(tls_private_key.monitoring_cert.private_key_pem)
    "ca.crt"  = base64encode(tls_self_signed_cert.monitoring_ca.cert_pem)
  }
}

resource "kubernetes_secret" "monitoring_passwords" {
  count = var.create_kubernetes_secrets ? 1 : 0

  metadata {
    name      = "monitoring-passwords"
    namespace = var.kubernetes_namespace
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    "grafana-admin-password" = base64encode(random_password.grafana_admin.result)
    "redis-password"         = base64encode(random_password.redis_auth.result)
    "postgres-monitoring-dsn" = base64encode("postgresql://monitoring_user:${random_password.postgres_monitoring.result}@postgres:5432/link_app?sslmode=disable")
    "nginx-basic-auth"       = base64encode("${var.monitoring_username}:${random_password.nginx_auth.result}")
  }
}

resource "kubernetes_config_map" "nginx_config" {
  count = var.create_kubernetes_secrets ? 1 : 0

  metadata {
    name      = "nginx-monitoring-config"
    namespace = var.kubernetes_namespace
    labels    = local.common_labels
  }

  data = {
    "monitoring.conf" = local_file.nginx_ssl_config.content
  }
}
