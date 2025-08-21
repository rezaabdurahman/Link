# mTLS Backend Service

This is the backend service component of the mTLS demonstration, implementing a secure HTTPS server with mutual TLS authentication.

## 🏗️ Overview

The service acts as a secure backend that:
- Requires client certificates for authentication (mTLS)
- Validates client certificates against a Certificate Authority
- Provides REST API endpoints for demonstration
- Enforces TLS 1.2+ with strong cipher suites

## 📋 Prerequisites

### Required Tools
- **OpenSSL** (1.1.1+ or 3.0+) - For certificate validation and TLS operations
- **CFSSL** (Optional) - Alternative certificate management tool
- **Go** (1.21+) - For local development
- **Docker** (20.10+) - For containerized deployment

### Certificates Required
The service requires the following certificates to be present:
- `service.crt` - Server certificate for TLS
- `service.key` - Private key for server certificate  
- `ca-bundle.crt` - Certificate Authority bundle for client validation

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `USE_MTLS` | Enable/disable mTLS functionality | `true` | No |
| `TLS_CERT_PATH` | Path to server certificate | `/certs/service.crt` | Yes (when mTLS enabled) |
| `TLS_KEY_PATH` | Path to server private key | `/certs/service.key` | Yes (when mTLS enabled) |
| `CA_BUNDLE_PATH` | Path to CA certificate bundle | `/certs/ca-bundle.crt` | Yes (when mTLS enabled) |
| `TLS_CLIENT_AUTH` | Client certificate requirement | `require` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `SERVER_PORT` | HTTPS server port | `8443` | No |
| `TLS_MIN_VERSION` | Minimum TLS version (1.2, 1.3) | `1.2` | No |

### TLS Client Authentication Modes

| Mode | Description | Security Level |
|------|-------------|----------------|
| `none` | No client certificates required | Low |
| `request` | Client certificates requested but not required | Medium |
| `require` | Client certificates required but not verified | Medium |
| `verify` | Client certificates required and verified against CA | High |

**Default**: `require` (mTLS with verification)

## 🚀 Running the Service

### Using Docker Compose (Recommended)

**With mTLS enabled (default):**
```bash
# From project root
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d service
```

**With environment variable override:**
```bash
USE_MTLS=true docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d service
```

**Disable mTLS (if supported):**
```bash
USE_MTLS=false docker-compose -f docker-compose.yml up -d service
```

### Local Development

**Prerequisites:** Certificates must be generated first:
```bash
# From project root
make certs
```

**Run locally with Go:**
```bash
cd service
export TLS_CERT_PATH=../certs/service.crt
export TLS_KEY_PATH=../certs/service.key
export CA_BUNDLE_PATH=../certs/ca-bundle.crt
export USE_MTLS=true
go run main.go
```

### Docker Build

```bash
# Build service image
docker build -t mtls-service:latest .

# Run with volume-mounted certificates
docker run -d \
  -p 8443:8443 \
  -v $(pwd)/../certs:/certs:ro \
  -e USE_MTLS=true \
  -e TLS_CERT_PATH=/certs/service.crt \
  -e TLS_KEY_PATH=/certs/service.key \
  -e CA_BUNDLE_PATH=/certs/ca-bundle.crt \
  --name mtls-service \
  mtls-service:latest
```

## 🔍 API Endpoints

### Health Check
- **Endpoint**: `GET /health`
- **Description**: Service health status
- **Authentication**: mTLS required
- **Response**: JSON with service status

### User Management
- `GET /api/users` - List all users
- `POST /api/users` - Create new user  
- `GET /api/users/{id}` - Get specific user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Utility Endpoints
- `GET|POST|PUT|DELETE|PATCH /api/echo` - Echo request details
- `GET|POST|PUT|DELETE|PATCH /api/*` - Generic API handler

## 🧪 Testing

### Test with Client Certificate
```bash
# Health check with mTLS
curl --cert ../certs/gateway.crt \
     --key ../certs/gateway.key \
     --cacert ../certs/ca-bundle.crt \
     https://localhost:8443/health

# API endpoint test
curl --cert ../certs/gateway.crt \
     --key ../certs/gateway.key \
     --cacert ../certs/ca-bundle.crt \
     https://localhost:8443/api/users
```

### Test Without Client Certificate (should fail)
```bash
# This should be rejected by the server
curl -k https://localhost:8443/health
```

### Verify TLS Configuration
```bash
# Check TLS version and cipher suites
openssl s_client -connect localhost:8443 \
  -cert ../certs/gateway.crt \
  -key ../certs/gateway.key \
  -CAfile ../certs/ca-bundle.crt
```

## 🔐 Security Features

### TLS Configuration
- **Minimum TLS Version**: 1.2 (configurable)
- **Client Authentication**: Required and verified against CA
- **Certificate Validation**: Full chain validation
- **Strong Cipher Suites**: Only secure algorithms allowed

### Certificate Requirements
- **Server Certificate**: Valid for `service`, `localhost`, `127.0.0.1`
- **Client Certificate**: Must be signed by trusted CA
- **Certificate Chain**: Full chain validation required
- **Key Usage**: Proper key usage extensions validated

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## 🛠️ Development

### Build for Development
```bash
go mod tidy
go build -o service main.go
```

### Run Tests
```bash
go test -v ./...
```

### Debug Mode
```bash
LOG_LEVEL=debug go run main.go
```

### Container Shell Access
```bash
# Access running container
docker exec -it mtls-service /bin/sh

# Check certificate files
docker exec -it mtls-service ls -la /certs/
```

## 📊 Monitoring

### Health Checks
The service provides health check endpoints:
- **HTTP Health**: Not available (HTTPS only)
- **HTTPS Health**: `GET /health` (requires client certificate)

### Logging
Structured logging with configurable levels:
- `debug`: Detailed request/response information
- `info`: Standard operational messages  
- `warn`: Warning conditions
- `error`: Error conditions

### Metrics (if enabled)
- Request count and latency
- TLS handshake success/failure rates
- Certificate validation statistics

## 🔧 Troubleshooting

### Common Issues

**1. Certificate Not Found**
```
Error: could not load certificate: no such file or directory
```
Solution: Ensure certificates are generated with `make certs`

**2. Certificate Verification Failed**
```
Error: tls: bad certificate
```
Solution: Verify client certificate is signed by trusted CA

**3. Permission Denied**
```
Error: bind: permission denied
```
Solution: Run as root or use non-privileged ports (>1024)

**4. TLS Handshake Failure**
```
Error: tls: handshake failure
```
Solution: Check TLS version compatibility and cipher suites

### Debug Commands

**Check certificate validity:**
```bash
openssl x509 -in ../certs/service.crt -text -noout
```

**Verify certificate chain:**
```bash
openssl verify -CAfile ../certs/ca-bundle.crt ../certs/service.crt
```

**Test TLS connection:**
```bash
openssl s_client -connect localhost:8443 -verify 2 \
  -cert ../certs/gateway.crt -key ../certs/gateway.key
```

## 📁 File Structure

```
service/
├── main.go              # Main server implementation
├── go.mod              # Go module definition  
├── go.sum              # Go module checksums
├── Dockerfile          # Container build definition
└── README.md          # This file
```

## ⚠️ Important Notes

1. **Production Considerations**: Use proper CA-signed certificates in production
2. **Certificate Rotation**: Implement certificate rotation for long-running services  
3. **Secrets Management**: Never commit private keys to version control
4. **Network Security**: Restrict network access to authorized clients only
5. **Monitoring**: Implement proper monitoring and alerting for certificate expiration

## 🔄 Version-Controlled Infrastructure

This service follows infrastructure-as-code principles:
- Configuration managed through environment variables
- Certificates generated via automated scripts
- Docker configuration version-controlled
- No secrets committed to repository
- Reproducible deployments across environments
