# TLS Certificate Generation Module
# Replaces poc/mtls-example/scripts/generate-certs.sh with pure Terraform

terraform {
  required_providers {
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

# 1. Root CA Private Key
resource "tls_private_key" "root_ca" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# 2. Root CA Certificate
resource "tls_self_signed_cert" "root_ca" {
  private_key_pem = tls_private_key.root_ca.private_key_pem

  subject {
    country             = var.cert_country
    state               = var.cert_state  
    locality            = var.cert_locality
    organization        = var.cert_organization
    organizational_unit = var.cert_organizational_unit
    common_name         = "Root CA"
  }

  validity_period_hours = var.root_ca_validity_hours # 10 years default
  is_ca_certificate     = true

  allowed_uses = [
    "cert_signing",
    "crl_signing",
  ]
}

# 3. Intermediate CA Private Key
resource "tls_private_key" "intermediate_ca" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# 4. Intermediate CA Certificate Request
resource "tls_cert_request" "intermediate_ca" {
  private_key_pem = tls_private_key.intermediate_ca.private_key_pem

  subject {
    country             = var.cert_country
    state               = var.cert_state
    locality            = var.cert_locality
    organization        = var.cert_organization
    organizational_unit = var.cert_organizational_unit
    common_name         = "Intermediate CA"
  }
}

# 5. Intermediate CA Certificate (signed by Root CA)
resource "tls_locally_signed_cert" "intermediate_ca" {
  cert_request_pem   = tls_cert_request.intermediate_ca.cert_request_pem
  ca_private_key_pem = tls_private_key.root_ca.private_key_pem
  ca_cert_pem        = tls_self_signed_cert.root_ca.cert_pem

  validity_period_hours = var.intermediate_ca_validity_hours # 5 years default
  is_ca_certificate     = true

  allowed_uses = [
    "cert_signing",
    "crl_signing",
  ]
}

# 6. Service Certificate Private Keys
resource "tls_private_key" "service_certs" {
  for_each = var.service_names

  algorithm = "RSA"
  rsa_bits  = 2048
}

# 7. Service Certificate Requests
resource "tls_cert_request" "service_certs" {
  for_each = var.service_names

  private_key_pem = tls_private_key.service_certs[each.key].private_key_pem

  subject {
    country             = var.cert_country
    state               = var.cert_state
    locality            = var.cert_locality
    organization        = var.cert_organization
    organizational_unit = var.cert_organizational_unit
    common_name         = each.key
  }

  dns_names = concat(
    [each.key, "localhost"],
    lookup(var.service_dns_names, each.key, [])
  )

  ip_addresses = [
    "127.0.0.1",
    "::1",
  ]
}

# 8. Service Certificates (signed by Intermediate CA)
resource "tls_locally_signed_cert" "service_certs" {
  for_each = var.service_names

  cert_request_pem   = tls_cert_request.service_certs[each.key].cert_request_pem
  ca_private_key_pem = tls_private_key.intermediate_ca.private_key_pem
  ca_cert_pem        = tls_locally_signed_cert.intermediate_ca.cert_pem

  validity_period_hours = var.service_cert_validity_hours # 1 year default

  allowed_uses = [
    "key_encipherment",
    "data_encipherment",
    "digital_signature",
    "server_auth",
    "client_auth",
  ]
}

# 9. Write Certificate Files (for compatibility with existing scripts)
resource "local_file" "root_ca_key" {
  content  = tls_private_key.root_ca.private_key_pem
  filename = "${var.output_path}/rootca.key"
  file_permission = "0600"
}

resource "local_file" "root_ca_cert" {
  content  = tls_self_signed_cert.root_ca.cert_pem
  filename = "${var.output_path}/rootca.crt"
  file_permission = "0644"
}

resource "local_file" "intermediate_ca_key" {
  content  = tls_private_key.intermediate_ca.private_key_pem
  filename = "${var.output_path}/intermediate.key"
  file_permission = "0600"
}

resource "local_file" "intermediate_ca_cert" {
  content  = tls_locally_signed_cert.intermediate_ca.cert_pem
  filename = "${var.output_path}/intermediate.crt"
  file_permission = "0644"
}

resource "local_file" "service_keys" {
  for_each = var.service_names
  
  content  = tls_private_key.service_certs[each.key].private_key_pem
  filename = "${var.output_path}/${each.key}.key"
  file_permission = "0600"
}

resource "local_file" "service_certs" {
  for_each = var.service_names
  
  content  = tls_locally_signed_cert.service_certs[each.key].cert_pem
  filename = "${var.output_path}/${each.key}.crt"
  file_permission = "0644"
}

# 10. Create Certificate Chains
resource "local_file" "service_cert_chains" {
  for_each = var.service_names
  
  content = join("", [
    tls_locally_signed_cert.service_certs[each.key].cert_pem,
    tls_locally_signed_cert.intermediate_ca.cert_pem,
    tls_self_signed_cert.root_ca.cert_pem,
  ])
  filename = "${var.output_path}/${each.key}-chain.crt"
  file_permission = "0644"
}

resource "local_file" "ca_bundle" {
  content = join("", [
    tls_locally_signed_cert.intermediate_ca.cert_pem,
    tls_self_signed_cert.root_ca.cert_pem,
  ])
  filename = "${var.output_path}/ca-bundle.crt"
  file_permission = "0644"
}

# 11. Kubernetes Secrets (for containerized deployments)
resource "kubernetes_secret" "tls_secrets" {
  for_each = var.create_k8s_secrets ? var.service_names : {}

  metadata {
    name      = "${each.key}-tls"
    namespace = var.kubernetes_namespace
    labels = {
      "app.kubernetes.io/name"     = each.key
      "app.kubernetes.io/part-of"  = "link-app"
      "app.kubernetes.io/component" = "tls"
    }
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = base64encode(tls_locally_signed_cert.service_certs[each.key].cert_pem)
    "tls.key" = base64encode(tls_private_key.service_certs[each.key].private_key_pem)
    "ca.crt"  = base64encode(local_file.ca_bundle.content)
  }
}
