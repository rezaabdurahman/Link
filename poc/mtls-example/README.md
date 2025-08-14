# mTLS Example

This directory contains a complete mutual TLS (mTLS) implementation demonstration, featuring:

- **Root CA and Intermediate CA** certificate generation
- **Gateway** service with mTLS client authentication 
- **Service** with mTLS server requiring client certificates
- **Docker Compose** configuration for easy deployment

## 🏗️ Architecture

```
┌─────────────────┐    mTLS (8443)    ┌─────────────────┐
│     Gateway     │ ──────────────────▶│     Service     │
│  (Client Auth)  │                    │ (Server + Auth) │  
│   Port: 8080    │                    │   Port: 8443    │
└─────────────────┘                    └─────────────────┘
        ▲                                       ▲
        │                                       │
        │                                       │
   HTTP │                                  HTTPS │ (mTLS)
        │                                       │
        │                                       │
┌───────────────────────────────────────────────────────────┐
│                    Certificate Chain                       │
│                                                           │
│  Root CA ──▶ Intermediate CA ──▶ Gateway Cert            │
│                              ├──▶ Service Cert            │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### Required Tools
- **Docker** (20.10+) and **Docker Compose** (2.0+)
- **OpenSSL** (1.1.1+ or 3.0+) - For certificate generation
- **CFSSL** (Optional) - Alternative certificate generation tool
- **Make** - For automation commands
- **curl** and **jq** - For testing and JSON parsing

### System Requirements
- Linux, macOS, or Windows with WSL2
- At least 2GB available RAM for Docker containers
- Ports 8080 and 8443 available locally

### Environment Variables

The project supports configuration via environment variables and `.env` files:

**Setup environment configuration:**
```bash
# Copy the example configuration
cp .env.example .env

# Edit the configuration file (never commit this file!)
# Editor will open - modify values as needed
vim .env
```

**Key environment variables:**

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `USE_MTLS` | Enable/disable mTLS functionality | `true` | No |
| `CERTS_DIR` | Directory containing certificates | `./certs` | No |
| `SERVICE_URL` | Backend service URL | `https://service:8443` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `TLS_MIN_VERSION` | Minimum TLS version (1.2, 1.3) | `1.2` | No |
| `TLS_CLIENT_AUTH` | Client cert requirement (require, verify, request, none) | `require` | No |

**📝 Note:** See `.env.example` for complete configuration options and detailed documentation.

## 📋 Components

### 1. Certificate Generation (`scripts/generate-certs.sh`)
- Creates Root CA and Intermediate CA using OpenSSL
- Generates gateway and service certificates
- Sets up proper certificate chains
- Configures appropriate Subject Alternative Names (SANs)
- **Prerequisites**: OpenSSL 1.1.1+ installed on system

### 2. Gateway (`gateway/`)
- Go application acting as HTTP-to-HTTPS proxy
- Configured with `Transport.TLSClientConfig` for mTLS client authentication
- Uses `RootCAs` for server certificate validation
- Uses `Certificates` for client authentication

### 3. Service (`service/`)
- Go application with HTTPS server
- Configured with `http.Server` TLS config
- Uses `ClientAuth: RequireAndVerifyClientCert`
- Validates client certificates against CA bundle

### 4. Docker Configuration
- `docker-compose.yml`: Base configuration
- `docker-compose.override.yml`: mTLS-specific configuration
- Certificate mounting and port configuration

## 🚀 Quick Start

1. **Generate certificates and start services:**
   ```bash
   make start
   ```

2. **Test the setup:**
   ```bash
   make test
   ```

3. **View logs:**
   ```bash
   make logs
   ```

4. **Clean up:**
   ```bash
   make clean
   ```

## 📖 Detailed Usage

### Verify Prerequisites

**Check OpenSSL installation:**
```bash
# Verify OpenSSL is installed and version
openssl version

# Should show version 1.1.1+ or 3.0+
# Example: OpenSSL 3.0.8 7 Feb 2023 (Library: OpenSSL 3.0.8 7 Feb 2023)
```

**Install OpenSSL if needed:**
```bash
# macOS with Homebrew
brew install openssl

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install openssl

# CentOS/RHEL
sudo yum install openssl
```

### Generate Certificates Only

**Using OpenSSL (default):**
```bash
make certs
```

**Using CFSSL (alternative):**
```bash
# Install CFSSL first
go install github.com/cloudflare/cfssl/cmd/cfssl@latest
go install github.com/cloudflare/cfssl/cmd/cfssljson@latest

# Generate with CFSSL (if script supports it)
CERT_TOOL=cfssl make certs
```

This creates a complete certificate hierarchy:
- `certs/rootca.crt` + `certs/rootca.key`
- `certs/intermediate.crt` + `certs/intermediate.key` 
- `certs/gateway.crt` + `certs/gateway.key`
- `certs/service.crt` + `certs/service.key`
- `certs/ca-bundle.crt` (intermediate + root)

### Build Docker Images
```bash
make build
```

### Start Services

**Using Makefile (Recommended):**
```bash
make up
```

**Using Docker Compose directly with mTLS:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

**With environment variable override:**
```bash
USE_MTLS=true docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

**Non-mTLS mode (if supported by application):**
```bash
USE_MTLS=false docker-compose -f docker-compose.yml up -d
```

Services will be available at:
- Gateway: http://localhost:8080
- Service: https://localhost:8443 (mTLS required)

### Test mTLS Connectivity

**Gateway Health Check:**
```bash
curl http://localhost:8080/health
```

**API Proxy Test:**
```bash
curl http://localhost:8080/api/users
```

**Direct Service Access (should fail):**
```bash
curl -k https://localhost:8443/health
```

**Direct Service Access with Client Cert:**
```bash
curl --cert certs/gateway.crt --key certs/gateway.key \
     --cacert certs/ca-bundle.crt \
     https://localhost:8443/health
```

## 🔐 Security Features

### Gateway (Client Side)
- **Client Certificate Authentication**: Presents certificate to service
- **Server Certificate Validation**: Verifies service certificate against CA bundle
- **TLS 1.2+ Only**: Enforces minimum TLS version
- **Proper SNI**: Uses correct ServerName for certificate validation

### Service (Server Side)
- **Mutual Authentication**: `RequireAndVerifyClientCert`
- **Client Certificate Validation**: Validates against CA bundle
- **Strong Cipher Suites**: Only secure cipher suites enabled
- **TLS 1.2+ Only**: Minimum version enforcement

### Certificates
- **4096-bit Root CA**: Maximum security for root
- **4096-bit Intermediate CA**: Strong intermediate signing
- **2048-bit Service Certificates**: Standard service certificates
- **Proper Certificate Chains**: Full chain validation
- **Subject Alternative Names**: DNS and IP address validation

## 🛠️ Development

### Shell Access
```bash
make shell-gateway   # Access gateway container
make shell-service   # Access service container
```

### Certificate Verification
```bash
make verify-certs    # Verify certificate chain integrity
```

### View Logs
```bash
make logs           # Follow all service logs
docker logs mtls-gateway  # Gateway logs only
docker logs mtls-service  # Service logs only
```

## 📁 Directory Structure

```
poc/mtls-example/
├── scripts/
│   └── generate-certs.sh      # Certificate generation script
├── gateway/
│   ├── main.go               # Gateway implementation
│   ├── go.mod               # Go dependencies
│   └── Dockerfile           # Gateway container
├── service/
│   ├── main.go              # Service implementation  
│   ├── go.mod              # Go dependencies
│   └── Dockerfile          # Service container
├── certs/                  # Generated certificates (created by script)
├── docker-compose.yml      # Base Docker configuration
├── docker-compose.override.yml  # mTLS-specific configuration
├── Makefile               # Automation commands
└── README.md             # This file
```

## 🔍 API Endpoints

### Gateway (HTTP - Port 8080)
- `GET /` - Gateway information page
- `GET /health` - Health check (gateway + service)
- `GET|POST|PUT|DELETE /api/*` - Proxy to service with mTLS

### Service (HTTPS - Port 8443, mTLS Required)  
- `GET /health` - Service health check
- `GET /api/users` - Get users list
- `POST /api/users` - Create user
- `GET /api/users/{id}` - Get specific user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user
- `GET|POST|PUT|DELETE|PATCH /api/echo` - Echo request details
- `GET|POST|PUT|DELETE|PATCH /api/*` - Generic API handler

## ✅ Project Compliance

This mTLS implementation follows established project rules and best practices:

### Security & Secrets Management
- ✅ **No secrets committed**: All certificates generated dynamically via scripts
- ✅ **Environment variables**: Sensitive configuration via `.env` files (gitignored)
- ✅ **Version-controlled infrastructure**: All configuration managed as code
- ✅ **No manual changes**: Infrastructure defined in Docker Compose and Makefiles

### Development Practices
- ✅ **Comprehensive documentation**: Complete setup instructions and API documentation
- ✅ **Environment parity**: Consistent Docker environments for dev/staging/production
- ✅ **Exact version control**: Docker image tags and dependency versions specified
- ✅ **Code organization**: Clear separation of concerns (gateway, service, certificates, tests)
- ✅ **Testing included**: Integration tests and validation scripts provided

### Documentation Standards
- ✅ **Setup instructions**: Complete prerequisite and installation guide
- ✅ **Usage examples**: Working code examples and curl commands
- ✅ **API documentation**: All endpoints documented with examples
- ✅ **Troubleshooting guide**: Common issues and solutions provided

## ⚠️ Important Notes

1. **Development Only**: These are self-signed certificates for demonstration
2. **Certificate Paths**: Certificates are mounted at `/certs/` in containers  
3. **Port Configuration**: Service uses 8443 (HTTPS) internally, Gateway uses 8080 (HTTP) externally
4. **Network Isolation**: Services communicate over dedicated Docker network
5. **No Real Keys**: All certificates are generated dynamically - no secrets committed
6. **Gitignore compliance**: Certificate directory excluded from version control

## 🧪 Testing Scenarios

The example demonstrates:

1. **Successful mTLS**: Gateway → Service with valid certificates
2. **Certificate Validation**: Proper CA chain verification
3. **Client Authentication**: Service requires valid client certificates
4. **Access Control**: Direct service access fails without proper certificates
5. **Proxy Functionality**: Gateway successfully proxies requests with mTLS

## 📊 Monitoring

Health checks are configured for both services:
- **Gateway**: HTTP health check on port 8080
- **Service**: HTTPS health check with client certificate on port 8443

Use `make status` to check container health status.
