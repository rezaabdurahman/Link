# TLS Certificates Terraform Module

This module replaces the shell script `poc/mtls-example/scripts/generate-certs.sh` with pure Terraform infrastructure-as-code approach.

## Features

- ✅ **Root CA + Intermediate CA hierarchy** - Following PKI best practices
- ✅ **Service certificates** - With proper SAN extensions for multiple services  
- ✅ **File compatibility** - Generates same file structure as original shell script
- ✅ **Kubernetes integration** - Optional TLS secret creation
- ✅ **Configurable validity periods** - Different lifespans for CA vs service certs
- ✅ **Development-friendly** - Easy to regenerate and customize

## Advantages over Shell Script

| Aspect | Shell Script | Terraform Module |
|--------|--------------|------------------|
| **Idempotency** | ❌ Overwrites existing certs | ✅ Only creates if missing/changed |
| **State tracking** | ❌ Manual file management | ✅ Terraform state tracks all resources |
| **Secrets handling** | ❌ Plain files on disk | ✅ Can integrate with vault/k8s secrets |
| **Validation** | ❌ No built-in validation | ✅ Terraform validates cert chains |
| **Reproducibility** | ❌ Manual script execution | ✅ Version controlled, repeatable |
| **Integration** | ❌ Standalone script | ✅ Integrates with other infrastructure |

## Usage

### Basic Usage (POC/Development)

```hcl
module "mtls_certificates" {
  source = "../modules/tls-certificates"
  
  service_names = ["gateway", "service"]
  output_path   = "./poc/mtls-example/certs"
  
  # Certificate details
  cert_organization = "Link App"
  cert_locality     = "San Francisco"
}
```

### Production Usage with Kubernetes

```hcl
module "production_certificates" {
  source = "../modules/tls-certificates"
  
  service_names = ["api-gateway", "user-svc", "chat-svc", "search-svc"]
  output_path   = "./certificates"
  
  # Additional DNS names for production
  service_dns_names = {
    "api-gateway" = ["api.linkapp.com", "gateway.internal"]
    "user-svc"    = ["users.internal", "user-service.internal"]
    "chat-svc"    = ["chat.internal", "messaging.internal"]
    "search-svc"  = ["search.internal", "search-api.internal"]
  }
  
  # Create Kubernetes TLS secrets
  create_k8s_secrets    = true
  kubernetes_namespace  = "link-app"
  
  # Production validity periods
  root_ca_validity_hours         = 87600  # 10 years
  intermediate_ca_validity_hours = 43800  # 5 years  
  service_cert_validity_hours    = 8760   # 1 year
  
  environment = "production"
}
```

## Generated Files

The module creates the same file structure as the original shell script:

```
certs/
├── rootca.key              # Root CA private key
├── rootca.crt              # Root CA certificate
├── intermediate.key        # Intermediate CA private key  
├── intermediate.crt        # Intermediate CA certificate
├── gateway.key             # Gateway service private key
├── gateway.crt             # Gateway service certificate
├── gateway-chain.crt       # Gateway full certificate chain
├── service.key             # Service private key
├── service.crt             # Service certificate  
├── service-chain.crt       # Service full certificate chain
└── ca-bundle.crt           # CA bundle (intermediate + root)
```

## Integration Examples

### Docker Compose

Use the certificates in your docker-compose.yml:

```yaml
services:
  gateway:
    build: .
    volumes:
      - ./certs/gateway.crt:/etc/ssl/certs/gateway.crt:ro
      - ./certs/gateway.key:/etc/ssl/private/gateway.key:ro  
      - ./certs/ca-bundle.crt:/etc/ssl/certs/ca-bundle.crt:ro
    environment:
      - TLS_CERT_FILE=/etc/ssl/certs/gateway.crt
      - TLS_KEY_FILE=/etc/ssl/private/gateway.key
      - CA_BUNDLE_FILE=/etc/ssl/certs/ca-bundle.crt
```

### Kubernetes

If `create_k8s_secrets = true`, use the secrets in your pods:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  template:
    spec:
      containers:
      - name: gateway
        image: link/api-gateway
        volumeMounts:
        - name: tls-certs
          mountPath: /etc/ssl/certs
          readOnly: true
      volumes:
      - name: tls-certs
        secret:
          secretName: api-gateway-tls
```

### Testing with curl

```bash
# Test mTLS connection
curl --cacert certs/ca-bundle.crt \
     --cert certs/gateway.crt \
     --key certs/gateway.key \
     https://localhost:8443/health
```

## Migration from Shell Script

1. **Replace script calls** in your Makefile/CI:
   ```bash
   # Old
   ./poc/mtls-example/scripts/generate-certs.sh
   
   # New  
   terraform -chdir=terraform apply -target=module.mtls_certificates
   ```

2. **Update integration tests** to use Terraform outputs:
   ```bash
   # Get cert paths from Terraform
   CERT_DIR=$(terraform -chdir=terraform output -raw certificate_output_path)
   ./poc/mtls-example/integration-tests.sh
   ```

3. **CI/CD integration** - add to your GitHub Actions:
   ```yaml
   - name: Generate TLS certificates
     run: terraform -chdir=terraform apply -auto-approve -target=module.mtls_certificates
   
   - name: Run mTLS tests  
     run: ./poc/mtls-example/integration-tests.sh
   ```

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `service_names` | Set of service names for certificates | `["gateway", "service"]` |
| `output_path` | Directory for certificate files | `"./certs"` |
| `cert_organization` | Organization name in certificates | `"Link App"` |
| `service_cert_validity_hours` | Service cert validity in hours | `8760` (1 year) |
| `create_k8s_secrets` | Create Kubernetes TLS secrets | `false` |
| `kubernetes_namespace` | Namespace for K8s secrets | `"default"` |

See `variables.tf` for full list of configuration options.

## Outputs

| Output | Description |
|--------|-------------|
| `certificate_files` | Paths to all generated certificate files |
| `service_certs` | Service certificate content and metadata |
| `kubernetes_tls_secrets` | Names of created K8s TLS secrets |
| `certificate_validity` | Validity periods for all certificates |

## Certificate Renewal

Certificates will be automatically renewed when:
- Validity period is less than 30 days remaining
- Certificate content or configuration changes
- Running `terraform apply` with `-replace` flag

```bash
# Force certificate renewal
terraform apply -replace=module.mtls_certificates.tls_self_signed_cert.root_ca
```
