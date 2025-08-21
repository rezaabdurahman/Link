# Outputs for TLS Certificate Generation Module

# Certificate Authority Outputs
output "root_ca_cert_pem" {
  description = "Root CA certificate in PEM format"
  value       = tls_self_signed_cert.root_ca.cert_pem
}

output "intermediate_ca_cert_pem" {
  description = "Intermediate CA certificate in PEM format"
  value       = tls_locally_signed_cert.intermediate_ca.cert_pem
}

output "ca_bundle_pem" {
  description = "CA bundle (intermediate + root) in PEM format"
  value       = local_file.ca_bundle.content
}

# Service Certificate Outputs
output "service_certs" {
  description = "Service certificate information"
  value = {
    for service in var.service_names : service => {
      cert_pem        = tls_locally_signed_cert.service_certs[service].cert_pem
      private_key_pem = tls_private_key.service_certs[service].private_key_pem
      cert_file       = local_file.service_certs[service].filename
      key_file        = local_file.service_keys[service].filename
      chain_file      = local_file.service_cert_chains[service].filename
    }
  }
  sensitive = true
}

# File Paths (for integration with existing scripts)
output "certificate_files" {
  description = "Paths to generated certificate files"
  value = {
    root_ca = {
      cert = local_file.root_ca_cert.filename
      key  = local_file.root_ca_key.filename
    }
    intermediate_ca = {
      cert = local_file.intermediate_ca_cert.filename
      key  = local_file.intermediate_ca_key.filename
    }
    services = {
      for service in var.service_names : service => {
        cert  = local_file.service_certs[service].filename
        key   = local_file.service_keys[service].filename
        chain = local_file.service_cert_chains[service].filename
      }
    }
    ca_bundle = local_file.ca_bundle.filename
  }
}

# Kubernetes Secret Names
output "kubernetes_tls_secrets" {
  description = "Names of created Kubernetes TLS secrets"
  value = var.create_k8s_secrets ? {
    for service in var.service_names : service => kubernetes_secret.tls_secrets[service].metadata[0].name
  } : {}
}

# Certificate Validation Information
output "certificate_validity" {
  description = "Certificate validity information"
  value = {
    root_ca = {
      valid_from = tls_self_signed_cert.root_ca.validity_start_time
      valid_to   = tls_self_signed_cert.root_ca.validity_end_time
    }
    intermediate_ca = {
      valid_from = tls_locally_signed_cert.intermediate_ca.validity_start_time
      valid_to   = tls_locally_signed_cert.intermediate_ca.validity_end_time
    }
    services = {
      for service in var.service_names : service => {
        valid_from = tls_locally_signed_cert.service_certs[service].validity_start_time
        valid_to   = tls_locally_signed_cert.service_certs[service].validity_end_time
      }
    }
  }
}

# Usage Instructions
output "usage_instructions" {
  description = "Instructions for using the generated certificates"
  value = {
    curl_examples = {
      for service in var.service_names : service =>
      "curl --cacert ${var.output_path}/ca-bundle.crt --cert ${var.output_path}/${service}.crt --key ${var.output_path}/${service}.key https://localhost:8443"
    }
    docker_volume_mounts = {
      for service in var.service_names : service =>
      "-v ${abspath(var.output_path)}/${service}.crt:/etc/ssl/certs/${service}.crt:ro -v ${abspath(var.output_path)}/${service}.key:/etc/ssl/private/${service}.key:ro -v ${abspath(var.output_path)}/ca-bundle.crt:/etc/ssl/certs/ca-bundle.crt:ro"
    }
  }
}
