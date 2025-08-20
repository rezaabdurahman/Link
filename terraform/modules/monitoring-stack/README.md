# Monitoring Stack Terraform Module

This module replaces the shell script `monitoring/setup-secure-monitoring.sh` with a comprehensive infrastructure-as-code solution for secure monitoring.

## Features

- ✅ **SSL/TLS Certificate Generation** - Automated CA and service certificate creation
- ✅ **Secure Secret Management** - Random password generation for all services
- ✅ **HTTP Basic Authentication** - Nginx reverse proxy with htpasswd protection
- ✅ **Docker Compose Configuration** - Complete monitoring stack orchestration
- ✅ **Kubernetes Integration** - Optional K8s secrets and config maps
- ✅ **Production-Ready Security** - Modern TLS, security headers, rate limiting

## Monitoring Stack Components

### Core Services
- **Grafana** - Data visualization and dashboards
- **Prometheus** - Metrics collection and alerting
- **Jaeger** - Distributed tracing
- **AlertManager** - Alert routing and management
- **Redis** - Caching and session storage

### Infrastructure
- **Nginx** - SSL termination and reverse proxy
- **Node Exporter** - Host metrics collection
- **cAdvisor** - Container metrics collection

## Advantages over Shell Script

| Aspect | Shell Script | Terraform Module |
|--------|--------------|------------------|
| **Idempotency** | ❌ Manual execution | ✅ State-managed resources |
| **Secret Management** | ❌ Plain text files | ✅ Terraform sensitive values |
| **Certificate Lifecycle** | ❌ Manual renewal | ✅ Automated renewal on apply |
| **Environment Consistency** | ❌ Script variations | ✅ Infrastructure as code |
| **Version Control** | ❌ Generated files ignored | ✅ Configuration tracked |
| **Team Collaboration** | ❌ Manual coordination | ✅ Terraform state locking |

## Usage

### Basic Usage (Development)

```hcl
module "monitoring_stack" {
  source = "../modules/monitoring-stack"
  
  environment        = "development"
  monitoring_domain  = "monitoring.linkapp.local"
  output_path        = "./monitoring"
}
```

### Production Usage

```hcl
module "monitoring_stack" {
  source = "../modules/monitoring-stack"
  
  environment       = "production"
  monitoring_domain = "monitoring.linkapp.com"
  
  # Kubernetes integration
  create_kubernetes_secrets = true
  kubernetes_namespace      = "monitoring"
  
  # Security configuration
  monitoring_username = "monitoring-admin"
  enable_ssl         = true
  enable_basic_auth  = true
  
  # Certificate configuration
  cert_validity_hours = 8760  # 1 year
  ca_validity_hours   = 87600 # 10 years
  
  # Service configuration
  grafana_config = {
    admin_user     = "admin"
    allow_sign_up  = false
    anonymous_auth = false
  }
  
  prometheus_config = {
    retention_time      = "30d"
    storage_retention   = "50GB"
    scrape_interval     = "15s"
  }
  
  tags = {
    Environment = "production"
    Project     = "Link"
    Owner       = "DevOps"
  }
}
```

## Generated Files

The module creates a complete secure monitoring environment:

```
monitoring/
├── ssl/
│   ├── ca.crt                    # Certificate Authority
│   ├── monitoring.crt            # SSL certificate
│   └── monitoring.key            # SSL private key
├── secrets/
│   ├── grafana_admin_password.txt
│   ├── redis_password.txt
│   └── postgres_exporter_dsn.txt
├── nginx/
│   ├── htpasswd                  # Basic auth credentials
│   └── monitoring.conf           # Nginx SSL configuration
└── docker-compose.monitoring.secure.yml
```

## Quick Start

1. **Apply Terraform**:
   ```bash
   terraform apply -target=module.monitoring_stack
   ```

2. **Add domain to /etc/hosts**:
   ```bash
   echo "127.0.0.1 monitoring.linkapp.local" | sudo tee -a /etc/hosts
   ```

3. **Start monitoring stack**:
   ```bash
   docker-compose -f monitoring/docker-compose.monitoring.secure.yml up -d
   ```

4. **Access services**:
   - **Grafana**: https://monitoring.linkapp.local/grafana/
   - **Prometheus**: https://monitoring.linkapp.local/prometheus/
   - **Jaeger**: https://monitoring.linkapp.local/jaeger/
   - **AlertManager**: https://monitoring.linkapp.local/alertmanager/

## Security Features

### SSL/TLS Configuration
- **Modern TLS protocols** (TLSv1.2, TLSv1.3)
- **Strong cipher suites** (ECDHE with AES-GCM)
- **HSTS headers** for enforced HTTPS
- **Certificate chain validation**

### Authentication & Authorization
- **HTTP Basic Authentication** via Nginx
- **Rate limiting** (10 requests/minute per IP)
- **IP-based access control** (configurable)
- **Secure cookie handling**

### Security Headers
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: enabled
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Strict-Transport-Security**: enforced

## Service Configuration

### Grafana
- **Admin password**: Auto-generated (32 chars)
- **SQLite database**: Local persistence
- **Sub-path serving**: `/grafana/`
- **Security**: Sign-up disabled, anonymous access blocked

### Prometheus
- **Data retention**: 15 days / 15GB (configurable)
- **Scrape interval**: 15 seconds
- **External URL**: Properly configured for sub-path
- **Admin API**: Enabled for dynamic configuration

### Jaeger
- **OTLP support**: gRPC and HTTP collectors
- **Query UI**: Available at `/jaeger/`
- **All-in-one deployment**: Memory storage for development

### Redis
- **Authentication**: Required with auto-generated password
- **Memory limit**: 128MB with LRU eviction
- **Persistence**: RDB + AOF for data safety

## Integration Examples

### With Existing Services

Add monitoring to your application services:

```yaml
# docker-compose.yml
services:
  api-gateway:
    image: link/api-gateway
    environment:
      - PROMETHEUS_ENDPOINT=http://prometheus:9090
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    networks:
      - monitoring_monitoring  # Connect to monitoring network
```

### Kubernetes Deployment

When `create_kubernetes_secrets = true`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitoring-nginx
spec:
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.25-alpine
        volumeMounts:
        - name: tls-certs
          mountPath: /etc/ssl/certs
        - name: nginx-config
          mountPath: /etc/nginx/conf.d
      volumes:
      - name: tls-certs
        secret:
          secretName: monitoring-tls
      - name: nginx-config
        configMap:
          name: nginx-monitoring-config
```

## Migration from Shell Script

### Before (Shell Script)
```bash
./monitoring/setup-secure-monitoring.sh
# Manual password entry
# File-based certificate management
# No state tracking
```

### After (Terraform)
```bash
terraform apply -target=module.monitoring_stack
# Automated password generation
# State-managed certificates
# Reproducible infrastructure
```

## Customization

### Custom Nginx Configuration

```hcl
module "monitoring_stack" {
  source = "../modules/monitoring-stack"
  
  custom_nginx_config = <<-EOF
    # Custom rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=1r/s;
    
    # Custom headers
    add_header X-Custom-Header "Link-Monitoring" always;
  EOF
}
```

### Environment-Specific Variables

```hcl
# terraform.tfvars.prod
monitoring_domain = "monitoring.linkapp.com"
cert_validity_hours = 8760
grafana_config = {
  allow_sign_up = false
  anonymous_auth = false
}
prometheus_config = {
  retention_time = "30d"
  storage_retention = "100GB"
}
```

## Troubleshooting

### Common Issues

1. **Certificate not trusted**:
   ```bash
   # Add CA to system trust store
   sudo cp monitoring/ssl/ca.crt /usr/local/share/ca-certificates/
   sudo update-ca-certificates
   ```

2. **Permission denied errors**:
   ```bash
   # Fix file permissions
   chmod 600 monitoring/secrets/*
   chmod 644 monitoring/ssl/*.crt
   ```

3. **Container networking issues**:
   ```bash
   # Check network connectivity
   docker network ls
   docker network inspect monitoring_monitoring
   ```

### Logs and Debugging

```bash
# Check container logs
docker-compose -f monitoring/docker-compose.monitoring.secure.yml logs nginx
docker-compose -f monitoring/docker-compose.monitoring.secure.yml logs grafana

# Test SSL certificate
openssl s509 -in monitoring/ssl/monitoring.crt -text -noout

# Verify basic auth
curl -k --user admin:$(cat monitoring/secrets/grafana_admin_password.txt) \
     https://monitoring.linkapp.local/health
```

## Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `environment` | Environment name | `"development"` | No |
| `monitoring_domain` | Domain for monitoring services | `"monitoring.linkapp.local"` | No |
| `create_kubernetes_secrets` | Create K8s secrets | `false` | No |
| `enable_ssl` | Enable SSL/TLS | `true` | No |
| `enable_basic_auth` | Enable HTTP Basic Auth | `true` | No |
| `cert_validity_hours` | Certificate validity (hours) | `8760` | No |

See `variables.tf` for complete list of configuration options.

## Outputs

| Output | Description |
|--------|-------------|
| `access_urls` | URLs for all monitoring services |
| `ssl_certificate_files` | Paths to SSL certificate files |
| `credentials` | Generated passwords and credentials |
| `usage_instructions` | Commands for using the stack |

## Security Considerations

- **Certificates are self-signed** - Use proper CA certificates in production
- **Passwords are stored in Terraform state** - Use remote state with encryption
- **Basic Auth over HTTPS** - Consider OAuth/OIDC for production
- **Rate limiting is basic** - Implement proper DDoS protection

## Requirements

- **Terraform** >= 1.0
- **Docker** and Docker Compose
- **htpasswd** utility (for basic auth)

---

**Next Steps**: See `terraform-suitability.md` for information about integrating this module into your infrastructure pipeline.
