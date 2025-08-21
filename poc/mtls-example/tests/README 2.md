# mTLS Integration Tests

This directory contains comprehensive integration tests for the mTLS POC implementation.

## Test Files

### `mtls_integration_test.go`
Comprehensive Go integration tests that validate:
- mTLS handshake and connection establishment
- Certificate validation and chain verification
- API endpoint accessibility through mTLS
- Security enforcement (rejection of invalid certificates)
- Performance characteristics

## Running the Tests

### Option 1: Using Go test framework
```bash
# Run all tests with verbose output
go test -v mtls_integration_test.go

# Run with timeout
go test -v -timeout=60s mtls_integration_test.go

# Run specific test
go test -v -run TestMTLSHandshake mtls_integration_test.go
```

### Option 2: As standalone program
```bash
# Run as standalone executable
go run mtls_integration_test.go test

# Show usage
go run mtls_integration_test.go
```

### Option 3: Using Makefile targets
```bash
# Run Go integration tests only
make test-go

# Run comprehensive integration tests (includes Go tests)
make integration-tests
```

## Configuration

The tests use environment variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVICE_URL` | mTLS service endpoint | `https://localhost:8443` |
| `CERTS_DIR` | Certificate directory | `./certs` |
| `SERVER_NAME` | Expected server name in certificate | `service` |

### Example with custom configuration:
```bash
CERTS_DIR=/custom/certs SERVICE_URL=https://service:8443 go test -v mtls_integration_test.go
```

## Test Categories

### 1. mTLS Handshake Tests
- Validates successful mutual authentication
- Verifies TLS version and cipher suite requirements
- Confirms certificate chain validation

### 2. Security Tests  
- Ensures connections without client certificates are rejected
- Validates server name verification
- Tests with invalid/expired certificates

### 3. API Integration Tests
- Tests various API endpoints through mTLS
- Validates JSON responses
- Confirms proper header forwarding

### 4. Certificate Validation Tests
- Verifies certificate chain integrity
- Checks certificate expiration dates
- Validates certificate properties and extensions

## Prerequisites

1. **Certificate files must exist**:
   - `certs/gateway.crt` - Client certificate
   - `certs/gateway.key` - Client private key  
   - `certs/ca-bundle.crt` - CA certificate bundle

2. **mTLS service must be running**:
   ```bash
   make start  # Start services with Docker
   # OR
   go run service/main.go  # Run service directly
   ```

3. **Go 1.21+ installed**

## Test Output

The tests provide detailed output including:
- ✅ Success indicators for passing tests
- ❌ Error details for failing tests  
- 📊 Certificate and TLS connection details
- ⏭️ Skip messages for unavailable resources

## Integration with CI/CD

These tests are designed to work in automated environments:
- Exit codes indicate success/failure
- Graceful skipping when certificates unavailable
- Configurable timeouts and retry logic
- Environment variable configuration

## Troubleshooting

### Common Issues

1. **Certificate not found**: 
   - Run `make certs` to generate certificates
   - Check `CERTS_DIR` environment variable

2. **Service not available**:
   - Ensure service is running with `make start`
   - Check service URL with `SERVICE_URL` variable

3. **Connection timeout**:
   - Verify service is listening on expected port
   - Check firewall and network connectivity

### Debug Mode

For additional debugging information:
```bash
# Run with verbose Go test output
go test -v -timeout=60s mtls_integration_test.go

# Check service logs
make logs
```
